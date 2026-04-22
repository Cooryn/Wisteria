mod db;
mod git;
mod llm;

use serde::Serialize;
use std::path::Path;
use tauri::Manager;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalPathInfo {
    exists: bool,
    is_dir: bool,
}

#[tauri::command]
fn inspect_local_path(path: String) -> LocalPathInfo {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return LocalPathInfo {
            exists: false,
            is_dir: false,
        };
    }

    let local_path = Path::new(trimmed);
    LocalPathInfo {
        exists: local_path.exists(),
        is_dir: local_path.is_dir(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            let database = db::Database::init(app_data_dir)
                .expect("failed to initialise database");

            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // System
            inspect_local_path,
            // Database — settings & preferences
            db::settings::db_get_setting,
            db::settings::db_set_setting,
            db::settings::db_get_all_settings,
            db::settings::db_get_preference,
            db::settings::db_set_preference,
            // Database — tech tags
            db::tags::db_get_tech_tags,
            db::tags::db_save_tech_tag,
            db::tags::db_delete_tech_tag,
            db::tags::db_clear_tech_tags,
            // Database — saved repos
            db::repos::db_get_saved_repos,
            db::repos::db_save_repo,
            db::repos::db_delete_saved_repo,
            // Database — saved issues
            db::issues::db_get_saved_issues,
            db::issues::db_get_saved_issue_by_github_id,
            db::issues::db_save_issue,
            db::issues::db_delete_saved_issue,
            // Database — PR history
            db::pr_history::db_get_pr_history,
            db::pr_history::db_add_pr_history,
            // Database — contribution sessions
            db::sessions::db_get_contribution_session,
            db::sessions::db_upsert_contribution_session,
            db::sessions::db_update_contribution_session_pr,
            db::sessions::db_delete_contribution_session,
            // Git
            git::commands::git_is_available,
            git::commands::git_get_version,
            git::commands::git_clone,
            git::commands::git_checkout_new_branch,
            git::commands::git_checkout,
            git::commands::git_checkout_branch_from,
            git::commands::git_add_all,
            git::commands::git_commit,
            git::commands::git_push,
            git::commands::git_push_with_upstream,
            git::commands::git_fetch,
            git::commands::git_list_remotes,
            git::commands::git_get_remote_url,
            git::commands::git_set_remote_url,
            git::commands::git_add_remote,
            git::commands::git_get_current_branch,
            git::commands::git_is_repository,
            git::commands::git_status,
            git::commands::git_is_working_tree_clean,
            git::commands::git_count_commits_ahead,
            // LLM
            llm::commands::llm_analyze_issue,
            llm::commands::llm_generate_pr_description,
            llm::commands::llm_validate_key,
        ])
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
