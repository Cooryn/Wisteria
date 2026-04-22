pub mod commands;

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct LlmConfig {
    #[serde(rename = "apiKey")]
    pub api_key: String,
    pub model: String,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
}

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f64,
    max_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatChoiceMessage,
}

#[derive(Debug, Deserialize)]
struct ChatChoiceMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Option<Vec<ChatChoice>>,
}

pub async fn call_openai(
    config: &LlmConfig,
    messages: Vec<(String, String)>,
) -> Result<String, String> {
    let chat_messages: Vec<ChatMessage> = messages
        .into_iter()
        .map(|(role, content)| ChatMessage { role, content })
        .collect();

    let request_body = ChatRequest {
        model: config.model.clone(),
        messages: chat_messages,
        temperature: 0.7,
        max_tokens: 2000,
    };

    let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", config.api_key))
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("LLM request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("LLM API error: {status} — {body}"));
    }

    let data: ChatResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse LLM response: {e}"))?;

    let content = data
        .choices
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.message.content)
        .unwrap_or_default();

    Ok(content)
}
