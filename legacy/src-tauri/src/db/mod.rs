pub mod issues;
pub mod pr_history;
pub mod repos;
pub mod sessions;
pub mod settings;
pub mod tags;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

/// Global database connection wrapped in a Mutex for thread-safe access.
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Open (or create) the SQLite database at the given directory and run
    /// all migrations. Returns an initialised `Database` value that should
    /// be managed as Tauri state.
    pub fn init(app_data_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;

        let db_path = app_data_dir.join("wisteria.db");
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

        // Enable WAL mode for better concurrent read performance.
        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .map_err(|e| e.to_string())?;

        run_migrations(&conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Acquire the connection lock. Panics only if a thread panicked while
    /// holding the lock (which should never happen in normal operation).
    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().expect("database lock poisoned")
    }
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY
        );",
    )
    .map_err(|e| e.to_string())?;

    // If upgrading from tauri-plugin-sql, detect old migration state and
    // pre-populate our tracker so we don't re-run already-applied migrations.
    detect_legacy_migrations(conn)?;

    let current_version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM _migrations",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if current_version < 1 {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tech_tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                category TEXT NOT NULL,
                weight REAL DEFAULT 1.0
            );

            CREATE TABLE IF NOT EXISTS saved_repos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                github_id INTEGER UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                description TEXT,
                language TEXT,
                stars INTEGER,
                topics TEXT,
                score REAL,
                saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS saved_issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                github_id INTEGER UNIQUE NOT NULL,
                repo_full_name TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT,
                labels TEXT,
                state TEXT,
                score REAL,
                analysis TEXT,
                saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS pr_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                issue_id INTEGER,
                repo_full_name TEXT NOT NULL,
                pr_url TEXT,
                branch_name TEXT,
                status TEXT DEFAULT 'draft',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (issue_id) REFERENCES saved_issues(id)
            );
            "#,
        )
        .map_err(|e| format!("migration v1 failed: {e}"))?;

        conn.execute("INSERT INTO _migrations (version) VALUES (1)", [])
            .map_err(|e| e.to_string())?;
    }

    if current_version < 2 {
        // Use idempotent column additions — skip columns that already exist.
        let columns = [
            "issue_number INTEGER",
            "html_url TEXT",
            "comments INTEGER",
            "user_login TEXT",
            "user_avatar_url TEXT",
            "created_at TEXT",
            "updated_at TEXT",
        ];
        for col_def in &columns {
            let col_name = col_def.split_whitespace().next().unwrap_or("");
            if !column_exists(conn, "saved_issues", col_name) {
                conn.execute_batch(&format!(
                    "ALTER TABLE saved_issues ADD COLUMN {col_def};"
                ))
                .map_err(|e| format!("migration v2 failed adding {col_name}: {e}"))?;
            }
        }

        conn.execute("INSERT INTO _migrations (version) VALUES (2)", [])
            .map_err(|e| e.to_string())?;
    }

    if current_version < 3 {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS contribution_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                issue_github_id INTEGER UNIQUE NOT NULL,
                repo_full_name TEXT NOT NULL,
                local_repo_path TEXT NOT NULL,
                fork_full_name TEXT NOT NULL,
                push_remote_name TEXT NOT NULL,
                base_branch TEXT NOT NULL,
                branch_name TEXT NOT NULL,
                pr_url TEXT,
                status TEXT NOT NULL DEFAULT 'ready',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            "#,
        )
        .map_err(|e| format!("migration v3 failed: {e}"))?;

        conn.execute("INSERT INTO _migrations (version) VALUES (3)", [])
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Check whether a column exists on a table via PRAGMA table_info.
fn column_exists(conn: &Connection, table: &str, column: &str) -> bool {
    conn.prepare(&format!("PRAGMA table_info({table})"))
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))
                .map(|rows| {
                    rows.filter_map(|r| r.ok())
                        .any(|name| name == column)
                })
        })
        .unwrap_or(false)
}

/// Detect if this database was previously managed by tauri-plugin-sql and
/// seed our `_migrations` table with the equivalent version numbers so we
/// don't try to re-run already-applied migrations.
fn detect_legacy_migrations(conn: &Connection) -> Result<(), String> {
    // Only run detection when our _migrations table is empty.
    let our_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM _migrations", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if our_count > 0 {
        return Ok(());
    }

    // tauri-plugin-sql stores migrations in `_sqlx_migrations`.
    let has_legacy = conn
        .prepare("SELECT version FROM _sqlx_migrations ORDER BY version")
        .ok();

    if let Some(mut stmt) = has_legacy {
        let legacy_versions: Vec<i64> = stmt
            .query_map([], |row| row.get(0))
            .map(|rows| rows.filter_map(|r| r.ok()).collect())
            .unwrap_or_default();

        for version in legacy_versions {
            let _ = conn.execute(
                "INSERT OR IGNORE INTO _migrations (version) VALUES (?1)",
                [version],
            );
        }
    }

    Ok(())
}

