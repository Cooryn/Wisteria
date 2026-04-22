use serde::Serialize;
use tauri::State;

use super::Database;

#[derive(Debug, Serialize)]
pub struct PRHistoryEntry {
    pub id: i64,
    pub issue_id: Option<i64>,
    pub repo_full_name: String,
    pub pr_url: Option<String>,
    pub branch_name: Option<String>,
    pub status: String,
    pub created_at: String,
}

#[tauri::command]
pub fn db_get_pr_history(db: State<'_, Database>) -> Result<Vec<PRHistoryEntry>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, issue_id, repo_full_name, pr_url, branch_name, status, created_at
             FROM pr_history ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(PRHistoryEntry {
                id: row.get(0)?,
                issue_id: row.get(1)?,
                repo_full_name: row.get(2)?,
                pr_url: row.get(3)?,
                branch_name: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(row.map_err(|e| e.to_string())?);
    }

    Ok(entries)
}

#[tauri::command]
pub fn db_add_pr_history(
    db: State<'_, Database>,
    issue_id: Option<i64>,
    repo_full_name: String,
    pr_url: Option<String>,
    branch_name: Option<String>,
    status: String,
) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "INSERT INTO pr_history (issue_id, repo_full_name, pr_url, branch_name, status)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![issue_id, repo_full_name, pr_url, branch_name, status],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
