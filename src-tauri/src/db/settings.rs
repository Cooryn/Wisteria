use std::collections::HashMap;
use tauri::State;

use super::Database;

// ---- App Settings ----

#[tauri::command]
pub fn db_get_setting(db: State<'_, Database>, key: String) -> Result<Option<String>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare("SELECT value FROM app_settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_row([&key], |row| row.get::<_, String>(0))
        .ok();

    Ok(result)
}

#[tauri::command]
pub fn db_set_setting(db: State<'_, Database>, key: String, value: String) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [&key, &value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_get_all_settings(db: State<'_, Database>) -> Result<HashMap<String, String>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare("SELECT key, value FROM app_settings")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;

    let mut result = HashMap::new();
    for row in rows {
        let (k, v) = row.map_err(|e| e.to_string())?;
        result.insert(k, v);
    }

    Ok(result)
}

// ---- Preferences ----

#[tauri::command]
pub fn db_get_preference(db: State<'_, Database>, key: String) -> Result<Option<String>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare("SELECT value FROM preferences WHERE key = ?1")
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_row([&key], |row| row.get::<_, String>(0))
        .ok();

    Ok(result)
}

#[tauri::command]
pub fn db_set_preference(
    db: State<'_, Database>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "INSERT INTO preferences (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
        [&key, &value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
