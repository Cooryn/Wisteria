use serde::{Deserialize, Serialize};
use tauri::State;

use super::Database;

#[derive(Debug, Serialize)]
pub struct ContributionSession {
    pub id: i64,
    pub issue_github_id: i64,
    pub repo_full_name: String,
    pub local_repo_path: String,
    pub fork_full_name: String,
    pub push_remote_name: String,
    pub base_branch: String,
    pub branch_name: String,
    pub pr_url: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertSessionInput {
    pub issue_github_id: i64,
    pub repo_full_name: String,
    pub local_repo_path: String,
    pub fork_full_name: String,
    pub push_remote_name: String,
    pub base_branch: String,
    pub branch_name: String,
    pub pr_url: Option<String>,
    pub status: String,
}

#[tauri::command]
pub fn db_get_contribution_session(
    db: State<'_, Database>,
    issue_github_id: i64,
) -> Result<Option<ContributionSession>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, issue_github_id, repo_full_name, local_repo_path, fork_full_name,
                    push_remote_name, base_branch, branch_name, pr_url, status,
                    created_at, updated_at
             FROM contribution_sessions WHERE issue_github_id = ?1 LIMIT 1",
        )
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_row([issue_github_id], |row| {
            Ok(ContributionSession {
                id: row.get(0)?,
                issue_github_id: row.get(1)?,
                repo_full_name: row.get(2)?,
                local_repo_path: row.get(3)?,
                fork_full_name: row.get(4)?,
                push_remote_name: row.get(5)?,
                base_branch: row.get(6)?,
                branch_name: row.get(7)?,
                pr_url: row.get(8)?,
                status: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .ok();

    Ok(result)
}

#[tauri::command]
pub fn db_upsert_contribution_session(
    db: State<'_, Database>,
    session: UpsertSessionInput,
) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "INSERT INTO contribution_sessions (
            issue_github_id, repo_full_name, local_repo_path, fork_full_name,
            push_remote_name, base_branch, branch_name, pr_url, status
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(issue_github_id) DO UPDATE SET
            repo_full_name = excluded.repo_full_name,
            local_repo_path = excluded.local_repo_path,
            fork_full_name = excluded.fork_full_name,
            push_remote_name = excluded.push_remote_name,
            base_branch = excluded.base_branch,
            branch_name = excluded.branch_name,
            pr_url = excluded.pr_url,
            status = excluded.status,
            updated_at = CURRENT_TIMESTAMP",
        rusqlite::params![
            session.issue_github_id,
            session.repo_full_name,
            session.local_repo_path,
            session.fork_full_name,
            session.push_remote_name,
            session.base_branch,
            session.branch_name,
            session.pr_url,
            session.status,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_update_contribution_session_pr(
    db: State<'_, Database>,
    issue_github_id: i64,
    pr_url: String,
) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "UPDATE contribution_sessions
         SET pr_url = ?1, status = 'draft_created', updated_at = CURRENT_TIMESTAMP
         WHERE issue_github_id = ?2",
        rusqlite::params![pr_url, issue_github_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_delete_contribution_session(
    db: State<'_, Database>,
    issue_github_id: i64,
) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "DELETE FROM contribution_sessions WHERE issue_github_id = ?1",
        [issue_github_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
