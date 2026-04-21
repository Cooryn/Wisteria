use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmConfigPayload {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub organization: Option<String>,
    pub project: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct SessionSecrets {
    pub github_token: Option<String>,
    pub github_token_hydrated: bool,
    pub llm_config: Option<LlmConfigPayload>,
}

#[derive(Default)]
pub struct AppState {
    pub session: Mutex<SessionSecrets>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubTokenStatus {
    pub has_token: bool,
    pub masked_token: Option<String>,
    pub token: Option<String>,
    pub hydrated_from_vault: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmConfigStatus {
    pub configured: bool,
    pub model: Option<String>,
    pub base_url: Option<String>,
}

impl AppState {
    pub fn save_github_token(&self, token: String) -> GithubTokenStatus {
        let mut session = self.session.lock().expect("session mutex poisoned");
        session.github_token = Some(token.clone());
        session.github_token_hydrated = true;
        GithubTokenStatus {
            has_token: true,
            masked_token: Some(mask_token(&token)),
            token: Some(token),
            hydrated_from_vault: true,
        }
    }

    pub fn github_status(&self) -> GithubTokenStatus {
        let session = self.session.lock().expect("session mutex poisoned");
        GithubTokenStatus {
            has_token: session.github_token.is_some(),
            masked_token: session.github_token.as_ref().map(|value| mask_token(value)),
            token: session.github_token.clone(),
            hydrated_from_vault: session.github_token_hydrated,
        }
    }

    pub fn save_llm_config(&self, config: LlmConfigPayload) -> LlmConfigStatus {
        let mut session = self.session.lock().expect("session mutex poisoned");
        let status = LlmConfigStatus {
            configured: !config.api_key.trim().is_empty(),
            model: Some(config.model.clone()),
            base_url: Some(config.base_url.clone()),
        };
        session.llm_config = Some(config);
        status
    }

    pub fn llm_config(&self) -> Option<LlmConfigPayload> {
        let session = self.session.lock().expect("session mutex poisoned");
        session.llm_config.clone()
    }
}

pub fn mask_token(token: &str) -> String {
    if token.len() <= 8 {
        return "****".to_string();
    }

    let prefix = &token[..4];
    let suffix = &token[token.len() - 4..];
    format!("{prefix}••••{suffix}")
}

