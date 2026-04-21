use crate::state::LlmConfigPayload;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfilePayload {
    pub display_name: String,
    pub languages: Vec<String>,
    pub frameworks: Vec<String>,
    pub interest_domains: Vec<String>,
    pub difficulty_preference: String,
    pub weekly_hours: u32,
    pub preferred_issue_types: Vec<String>,
    pub exclude_keywords: Vec<String>,
    pub exclude_licenses: Vec<String>,
    pub repo_size_preference: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoPayload {
    pub full_name: String,
    pub description: String,
    pub html_url: String,
    pub readme_excerpt: Option<String>,
    pub contributing_excerpt: Option<String>,
    pub match_reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreBreakdownPayload {
    pub label_bonus: i32,
    pub difficulty_score: i32,
    pub time_fit_score: i32,
    pub maintainer_score: i32,
    pub risk_penalty: i32,
    pub total: i32,
    pub reasons: Vec<String>,
    pub risk_flags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssuePayload {
    pub id: Option<i64>,
    pub number: u64,
    pub title: String,
    pub body_excerpt: String,
    pub html_url: String,
    pub labels: Vec<String>,
    pub recommendation_summary: String,
    pub score_breakdown: ScoreBreakdownPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateDraftPrRequest {
    pub profile: UserProfilePayload,
    pub issue: IssuePayload,
    pub repo: RepoPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftPrArtifactPayload {
    pub created_at: String,
    pub branch_name: String,
    pub title: String,
    pub summary: String,
    pub problem_statement: String,
    pub implementation_plan: Vec<String>,
    pub validation_checklist: Vec<String>,
    pub commit_plan: Vec<String>,
    pub pr_body: String,
    pub assistant_prompt: String,
    pub provider_used: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateDraftPrResponse {
    pub artifact: DraftPrArtifactPayload,
    pub warnings: Vec<String>,
}

#[derive(Debug, Error)]
pub enum LlmError {
    #[error("LLM relay is not configured in the current session")]
    MissingConfig,
    #[error("LLM relay requires a base URL, model, and API key")]
    InvalidConfig,
    #[error("The provider rate-limited the request (HTTP 429)")]
    RateLimited,
    #[error("The provider returned a server-side failure ({0})")]
    ServerFailure(u16),
    #[error("The provider returned malformed JSON")]
    MalformedResponse,
    #[error("The HTTP request failed: {0}")]
    Transport(String),
}

#[derive(Debug, Deserialize)]
struct ChatCompletionEnvelope {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Debug, Deserialize)]
struct ChatMessage {
    content: Option<String>,
}

fn normalized_endpoint(base_url: &str) -> String {
    if base_url.trim_end_matches('/').ends_with("/chat/completions") {
        base_url.trim_end_matches('/').to_string()
    } else {
        format!("{}/chat/completions", base_url.trim_end_matches('/'))
    }
}

fn json_prompt(request: &GenerateDraftPrRequest) -> String {
    format!(
        "Return only valid JSON with keys createdAt, branchName, title, summary, problemStatement, implementationPlan, validationChecklist, commitPlan, prBody, assistantPrompt, providerUsed. Keep the tone practical and concise. Use this issue packet:\n{}",
        serde_json::to_string_pretty(request).unwrap_or_else(|_| "{}".to_string())
    )
}

fn extract_json_object(content: &str) -> Option<&str> {
    let start = content.find('{')?;
    let end = content.rfind('}')?;
    if end <= start {
        return None;
    }
    Some(&content[start..=end])
}

pub async fn generate_with_llm(
    config: LlmConfigPayload,
    request: GenerateDraftPrRequest,
) -> Result<GenerateDraftPrResponse, LlmError> {
    if config.base_url.trim().is_empty()
        || config.model.trim().is_empty()
        || config.api_key.trim().is_empty()
    {
        return Err(LlmError::InvalidConfig);
    }

    let endpoint = normalized_endpoint(&config.base_url);
    let mut request_builder = reqwest::Client::new()
        .post(endpoint)
        .bearer_auth(config.api_key)
        .header("Content-Type", "application/json");

    if let Some(organization) = &config.organization {
        if !organization.trim().is_empty() {
            request_builder = request_builder.header("OpenAI-Organization", organization);
        }
    }
    if let Some(project) = &config.project {
        if !project.trim().is_empty() {
            request_builder = request_builder.header("OpenAI-Project", project);
        }
    }

    let body = json!({
        "model": config.model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": "You prepare actionable draft PR packets for open-source contribution planning."
            },
            {
                "role": "user",
                "content": json_prompt(&request)
            }
        ]
    });

    let response = request_builder
        .json(&body)
        .send()
        .await
        .map_err(|error| LlmError::Transport(error.to_string()))?;

    match response.status() {
        StatusCode::OK => {
            let envelope = response
                .json::<ChatCompletionEnvelope>()
                .await
                .map_err(|error| LlmError::Transport(error.to_string()))?;
            let content = envelope
                .choices
                .first()
                .and_then(|choice| choice.message.content.clone())
                .ok_or(LlmError::MalformedResponse)?;
            let json_body = extract_json_object(&content).ok_or(LlmError::MalformedResponse)?;
            let parsed = serde_json::from_str::<DraftPrArtifactPayload>(json_body)
                .map_err(|_| LlmError::MalformedResponse)?;

            Ok(GenerateDraftPrResponse {
                artifact: parsed,
                warnings: Vec::new(),
            })
        }
        StatusCode::TOO_MANY_REQUESTS => Err(LlmError::RateLimited),
        status if status.is_server_error() => Err(LlmError::ServerFailure(status.as_u16())),
        status => {
            let detail = response
                .json::<Value>()
                .await
                .ok()
                .and_then(|json| json.get("error").cloned())
                .unwrap_or(Value::String("unknown provider response".to_string()));
            Err(LlmError::Transport(format!(
                "Provider rejected the request with HTTP {}: {}",
                status.as_u16(),
                detail
            )))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{extract_json_object, normalized_endpoint};

    #[test]
    fn normalizes_base_url() {
        assert_eq!(
            normalized_endpoint("https://api.openai.com/v1"),
            "https://api.openai.com/v1/chat/completions"
        );
        assert_eq!(
            normalized_endpoint("https://example.com/chat/completions/"),
            "https://example.com/chat/completions"
        );
    }

    #[test]
    fn extracts_json_payload() {
        let value = "Here you go {\"title\":\"test\"}";
        assert_eq!(extract_json_object(value), Some("{\"title\":\"test\"}"));
    }
}

