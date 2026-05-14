use serde::{Deserialize, Serialize};

use super::{call_openai, LlmConfig};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeIssueInput {
    pub repo_full_name: Option<String>,
    pub number: i64,
    pub title: String,
    pub body: Option<String>,
    pub labels: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueAnalysis {
    pub difficulty: String,
    pub estimated_time: String,
    pub suggested_approach: String,
    pub related_files: Vec<String>,
    pub tags: Vec<String>,
}

#[tauri::command]
pub async fn llm_analyze_issue(
    config: LlmConfig,
    issue: AnalyzeIssueInput,
    repo_description: Option<String>,
) -> Result<IssueAnalysis, String> {
    let labels_str = issue.labels.join(", ");
    let body_text = issue
        .body
        .as_deref()
        .unwrap_or("No description provided.");
    // Truncate body to avoid token overflow.
    let truncated_body: String = body_text.chars().take(3000).collect();

    let repo_name = issue.repo_full_name.as_deref().unwrap_or("Unknown");
    let repo_desc_line = match &repo_description {
        Some(desc) => format!("\nRepository Description: {desc}"),
        None => String::new(),
    };

    let prompt = format!(
        r#"You are an expert open-source contributor. Analyze the following GitHub issue and provide a structured assessment.

Repository: {repo_name}{repo_desc_line}

Issue #{num}: {title}
Labels: {labels_str}

Issue Body:
{truncated_body}

Please respond in JSON format:
{{
  "difficulty": "easy" | "medium" | "hard",
  "estimatedTime": "e.g. '2-4 hours'",
  "suggestedApproach": "concise paragraph on how to approach this",
  "relatedFiles": ["possible files that might need changes"],
  "tags": ["relevant technology tags"]
}}

Respond ONLY with the JSON, no markdown fences."#,
        num = issue.number,
        title = issue.title,
    );

    let reply = call_openai(
        &config,
        vec![
            (
                "system".to_string(),
                "You are a helpful assistant that analyzes GitHub issues for open-source contributors. Always respond in valid JSON.".to_string(),
            ),
            ("user".to_string(), prompt),
        ],
    )
    .await?;

    // Try to parse JSON, stripping potential markdown fences.
    let cleaned = reply
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    match serde_json::from_str::<IssueAnalysis>(cleaned) {
        Ok(analysis) => Ok(analysis),
        Err(_) => Ok(IssueAnalysis {
            difficulty: "medium".to_string(),
            estimated_time: "Unknown".to_string(),
            suggested_approach: reply,
            related_files: Vec::new(),
            tags: Vec::new(),
        }),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratePRInput {
    pub number: i64,
    pub title: String,
    pub body: Option<String>,
    pub labels: Vec<String>,
}

#[tauri::command]
pub async fn llm_generate_pr_description(
    config: LlmConfig,
    issue: GeneratePRInput,
    branch_name: String,
) -> Result<String, String> {
    let labels_str = issue.labels.join(", ");
    let body_text = issue.body.as_deref().unwrap_or("No description.");
    let truncated_body: String = body_text.chars().take(2000).collect();

    let prompt = format!(
        r#"Generate a clear and professional GitHub Pull Request description for the following issue.

Issue #{num}: {title}
Labels: {labels_str}

Issue Description:
{truncated_body}

Branch: {branch_name}

Write a PR description in the following format:
## Summary
[Brief summary of what this PR does]

## Related Issue
Closes #{num}

## Changes Made
- [List of changes]

## Testing
- [How to test the changes]

Keep it concise and professional."#,
        num = issue.number,
        title = issue.title,
    );

    call_openai(
        &config,
        vec![
            (
                "system".to_string(),
                "You are a helpful assistant that writes professional GitHub PR descriptions."
                    .to_string(),
            ),
            ("user".to_string(), prompt),
        ],
    )
    .await
}

#[tauri::command]
pub async fn llm_validate_key(config: LlmConfig) -> Result<bool, String> {
    match call_openai(
        &config,
        vec![("user".to_string(), "Say \"ok\"".to_string())],
    )
    .await
    {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}
