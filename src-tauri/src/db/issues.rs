use serde::{Deserialize, Serialize};
use tauri::State;

use super::Database;

#[derive(Debug, Serialize)]
pub struct SavedIssue {
    pub id: i64,
    pub github_id: i64,
    pub repo_full_name: String,
    pub issue_number: Option<i64>,
    pub title: String,
    pub body: Option<String>,
    pub labels: Option<String>,
    pub state: Option<String>,
    pub html_url: Option<String>,
    pub comments: Option<i64>,
    pub user_login: Option<String>,
    pub user_avatar_url: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub score: Option<f64>,
    pub analysis: Option<String>,
    pub saved_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveIssueInput {
    pub github_id: i64,
    pub repo_full_name: String,
    pub issue_number: Option<i64>,
    pub title: String,
    pub body: Option<String>,
    pub labels: Option<String>,
    pub state: Option<String>,
    pub html_url: Option<String>,
    pub comments: Option<i64>,
    pub user_login: Option<String>,
    pub user_avatar_url: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub score: Option<f64>,
    pub analysis: Option<String>,
}

#[tauri::command]
pub fn db_get_saved_issues(db: State<'_, Database>) -> Result<Vec<SavedIssue>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, github_id, repo_full_name, issue_number, title, body, labels, state,
                    html_url, comments, user_login, user_avatar_url, created_at, updated_at,
                    score, analysis, saved_at
             FROM saved_issues ORDER BY saved_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(SavedIssue {
                id: row.get(0)?,
                github_id: row.get(1)?,
                repo_full_name: row.get(2)?,
                issue_number: row.get(3)?,
                title: row.get(4)?,
                body: row.get(5)?,
                labels: row.get(6)?,
                state: row.get(7)?,
                html_url: row.get(8)?,
                comments: row.get(9)?,
                user_login: row.get(10)?,
                user_avatar_url: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                score: row.get(14)?,
                analysis: row.get(15)?,
                saved_at: row.get(16)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut issues = Vec::new();
    for row in rows {
        issues.push(row.map_err(|e| e.to_string())?);
    }

    Ok(issues)
}

#[tauri::command]
pub fn db_get_saved_issue_by_github_id(
    db: State<'_, Database>,
    github_id: i64,
) -> Result<Option<SavedIssue>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, github_id, repo_full_name, issue_number, title, body, labels, state,
                    html_url, comments, user_login, user_avatar_url, created_at, updated_at,
                    score, analysis, saved_at
             FROM saved_issues WHERE github_id = ?1 LIMIT 1",
        )
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_row([github_id], |row| {
            Ok(SavedIssue {
                id: row.get(0)?,
                github_id: row.get(1)?,
                repo_full_name: row.get(2)?,
                issue_number: row.get(3)?,
                title: row.get(4)?,
                body: row.get(5)?,
                labels: row.get(6)?,
                state: row.get(7)?,
                html_url: row.get(8)?,
                comments: row.get(9)?,
                user_login: row.get(10)?,
                user_avatar_url: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                score: row.get(14)?,
                analysis: row.get(15)?,
                saved_at: row.get(16)?,
            })
        })
        .ok();

    Ok(result)
}

#[tauri::command]
pub fn db_save_issue(db: State<'_, Database>, issue: SaveIssueInput) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "INSERT INTO saved_issues (
            github_id, repo_full_name, issue_number, title, body, labels, state,
            html_url, comments, user_login, user_avatar_url, created_at, updated_at,
            score, analysis
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
         ON CONFLICT(github_id) DO UPDATE SET
            repo_full_name = excluded.repo_full_name,
            issue_number = excluded.issue_number,
            title = excluded.title,
            body = excluded.body,
            labels = excluded.labels,
            state = excluded.state,
            html_url = excluded.html_url,
            comments = excluded.comments,
            user_login = excluded.user_login,
            user_avatar_url = excluded.user_avatar_url,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            score = excluded.score,
            analysis = excluded.analysis",
        rusqlite::params![
            issue.github_id,
            issue.repo_full_name,
            issue.issue_number,
            issue.title,
            issue.body,
            issue.labels,
            issue.state,
            issue.html_url,
            issue.comments,
            issue.user_login,
            issue.user_avatar_url,
            issue.created_at,
            issue.updated_at,
            issue.score,
            issue.analysis,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_delete_saved_issue(db: State<'_, Database>, github_id: i64) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "DELETE FROM saved_issues WHERE github_id = ?1",
        [github_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
