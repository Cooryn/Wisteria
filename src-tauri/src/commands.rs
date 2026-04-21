use crate::llm::{generate_with_llm, GenerateDraftPrRequest, GenerateDraftPrResponse, LlmError};
use crate::state::{AppState, GithubTokenStatus, LlmConfigPayload, LlmConfigStatus};
use crate::system::{probe, SystemProbe};
use tauri::State;

#[tauri::command]
pub fn save_github_token(token: String, state: State<'_, AppState>) -> Result<GithubTokenStatus, String> {
    let normalized = token.trim().to_string();
    if normalized.is_empty() {
        return Err("GitHub token cannot be empty.".to_string());
    }

    Ok(state.save_github_token(normalized))
}

#[tauri::command]
pub fn get_github_token_status(state: State<'_, AppState>) -> GithubTokenStatus {
    state.github_status()
}

#[tauri::command]
pub fn save_llm_config(
    config: LlmConfigPayload,
    state: State<'_, AppState>,
) -> Result<LlmConfigStatus, String> {
    if config.base_url.trim().is_empty() {
        return Err("LLM base URL cannot be empty.".to_string());
    }
    if config.model.trim().is_empty() {
        return Err("LLM model cannot be empty.".to_string());
    }

    Ok(state.save_llm_config(config))
}

#[tauri::command]
pub async fn generate_draft_pr(
    request: GenerateDraftPrRequest,
    state: State<'_, AppState>,
) -> Result<GenerateDraftPrResponse, String> {
    let config = state.llm_config().ok_or(LlmError::MissingConfig).map_err(|error| error.to_string())?;
    generate_with_llm(config, request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn git_probe() -> SystemProbe {
    probe()
}

