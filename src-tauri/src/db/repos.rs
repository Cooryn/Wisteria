use serde::{Deserialize, Serialize};
use tauri::State;

use super::Database;

#[derive(Debug, Serialize)]
pub struct SavedRepo {
    pub id: i64,
    pub github_id: i64,
    pub full_name: String,
    pub description: Option<String>,
    pub language: Option<String>,
    pub stars: Option<i64>,
    pub topics: Option<String>,
    pub score: Option<f64>,
    pub saved_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRepoInput {
    pub github_id: i64,
    pub full_name: String,
    pub description: Option<String>,
    pub language: Option<String>,
    pub stars: Option<i64>,
    pub topics: Option<String>,
    pub score: Option<f64>,
}

#[tauri::command]
pub fn db_get_saved_repos(db: State<'_, Database>) -> Result<Vec<SavedRepo>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, github_id, full_name, description, language, stars, topics, score, saved_at
             FROM saved_repos ORDER BY score DESC, saved_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(SavedRepo {
                id: row.get(0)?,
                github_id: row.get(1)?,
                full_name: row.get(2)?,
                description: row.get(3)?,
                language: row.get(4)?,
                stars: row.get(5)?,
                topics: row.get(6)?,
                score: row.get(7)?,
                saved_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut repos = Vec::new();
    for row in rows {
        repos.push(row.map_err(|e| e.to_string())?);
    }

    Ok(repos)
}

#[tauri::command]
pub fn db_save_repo(db: State<'_, Database>, repo: SaveRepoInput) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "INSERT INTO saved_repos (github_id, full_name, description, language, stars, topics, score)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(github_id) DO UPDATE SET score = excluded.score",
        rusqlite::params![
            repo.github_id,
            repo.full_name,
            repo.description,
            repo.language,
            repo.stars,
            repo.topics,
            repo.score,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_delete_saved_repo(db: State<'_, Database>, github_id: i64) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "DELETE FROM saved_repos WHERE github_id = ?1",
        [github_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
