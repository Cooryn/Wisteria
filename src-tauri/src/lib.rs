mod commands;
mod llm;
mod state;
mod system;

use sha2::{Digest, Sha256};
use state::AppState;

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(
            tauri_plugin_stronghold::Builder::new(|password| {
                let mut hasher = Sha256::new();
                hasher.update(password.as_bytes());
                hasher.update(b"wisteria-session-salt");
                hasher.finalize().to_vec()
            })
            .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::save_github_token,
            commands::get_github_token_status,
            commands::save_llm_config,
            commands::generate_draft_pr,
            commands::git_probe
        ])
        .run(tauri::generate_context!())
        .expect("error while running Wisteria");
}
