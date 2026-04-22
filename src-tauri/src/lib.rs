use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCommandInput {
    args: Vec<String>,
    cwd: Option<String>,
    git_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitCommandOutput {
    success: bool,
    stdout: String,
    stderr: String,
}

fn is_git_executable(path: &str) -> bool {
    Path::new(path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map(|stem| stem.eq_ignore_ascii_case("git"))
        .unwrap_or(false)
}

#[tauri::command]
fn run_git_command(input: GitCommandInput) -> GitCommandOutput {
    let git_path = input
        .git_path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .unwrap_or("git");

    if git_path != "git" && !is_git_executable(git_path) {
        return GitCommandOutput {
            success: false,
            stdout: String::new(),
            stderr: "Configured Git path must point to a git executable.".into(),
        };
    }

    let mut command = Command::new(git_path);
    command.args(&input.args);

    if let Some(cwd) = input.cwd.as_deref().map(str::trim).filter(|cwd| !cwd.is_empty()) {
        command.current_dir(cwd);
    }

    match command.output() {
        Ok(output) => GitCommandOutput {
            success: output.status.success(),
            stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
        },
        Err(err) => GitCommandOutput {
            success: false,
            stdout: String::new(),
            stderr: err.to_string(),
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial tables",
            sql: r#"
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
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "expand saved issues for reopening details",
            sql: r#"
                ALTER TABLE saved_issues ADD COLUMN issue_number INTEGER;
                ALTER TABLE saved_issues ADD COLUMN html_url TEXT;
                ALTER TABLE saved_issues ADD COLUMN comments INTEGER;
                ALTER TABLE saved_issues ADD COLUMN user_login TEXT;
                ALTER TABLE saved_issues ADD COLUMN user_avatar_url TEXT;
                ALTER TABLE saved_issues ADD COLUMN created_at TEXT;
                ALTER TABLE saved_issues ADD COLUMN updated_at TEXT;
            "#,
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![run_git_command])
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:wisteria.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
