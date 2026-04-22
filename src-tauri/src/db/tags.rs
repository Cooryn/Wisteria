use serde::Serialize;
use tauri::State;

use super::Database;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TechTag {
    pub id: Option<i64>,
    pub name: String,
    pub category: String,
    pub weight: f64,
}

#[tauri::command]
pub fn db_get_tech_tags(db: State<'_, Database>) -> Result<Vec<TechTag>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare("SELECT id, name, category, weight FROM tech_tags ORDER BY category, name")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(TechTag {
                id: row.get(0)?,
                name: row.get(1)?,
                category: row.get(2)?,
                weight: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tags = Vec::new();
    for row in rows {
        tags.push(row.map_err(|e| e.to_string())?);
    }

    Ok(tags)
}

#[tauri::command]
pub fn db_save_tech_tag(
    db: State<'_, Database>,
    name: String,
    category: String,
    weight: f64,
) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "INSERT INTO tech_tags (name, category, weight) VALUES (?1, ?2, ?3)
         ON CONFLICT(name) DO UPDATE SET category = excluded.category, weight = excluded.weight",
        rusqlite::params![name, category, weight],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_delete_tech_tag(db: State<'_, Database>, name: String) -> Result<(), String> {
    let conn = db.conn();
    conn.execute("DELETE FROM tech_tags WHERE name = ?1", [&name])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_clear_tech_tags(db: State<'_, Database>) -> Result<(), String> {
    let conn = db.conn();
    conn.execute("DELETE FROM tech_tags", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}
