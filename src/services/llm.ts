import type { Issue, IssueAnalysis } from '../types';

interface LLMConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

async function callOpenAI(
  config: LLMConfig,
  messages: { role: string; content: string }[]
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM API error: ${response.status} — ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ---- Analyze an issue ----
export async function analyzeIssue(
  config: LLMConfig,
  issue: Issue,
  repoDescription?: string
): Promise<IssueAnalysis> {
  const prompt = `You are an expert open-source contributor. Analyze the following GitHub issue and provide a structured assessment.

Repository: ${issue.repo_full_name ?? 'Unknown'}
${repoDescription ? `Repository Description: ${repoDescription}` : ''}

Issue #${issue.number}: ${issue.title}
Labels: ${issue.labels.map((l) => l.name).join(', ')}

Issue Body:
${issue.body?.substring(0, 3000) ?? 'No description provided.'}

Please respond in JSON format:
{
  "difficulty": "easy" | "medium" | "hard",
  "estimatedTime": "e.g. '2-4 hours'",
  "suggestedApproach": "concise paragraph on how to approach this",
  "relatedFiles": ["possible files that might need changes"],
  "tags": ["relevant technology tags"]
}

Respond ONLY with the JSON, no markdown fences.`;

  const reply = await callOpenAI(config, [
    { role: 'system', content: 'You are a helpful assistant that analyzes GitHub issues for open-source contributors. Always respond in valid JSON.' },
    { role: 'user', content: prompt },
  ]);

  try {
    // Strip potential markdown code fences
    const cleaned = reply.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      difficulty: 'medium',
      estimatedTime: 'Unknown',
      suggestedApproach: reply,
      relatedFiles: [],
      tags: [],
    };
  }
}

// ---- Generate PR description ----
export async function generatePRDescription(
  config: LLMConfig,
  issue: Issue,
  branchName: string
): Promise<string> {
  const prompt = `Generate a clear and professional GitHub Pull Request description for the following issue.

Issue #${issue.number}: ${issue.title}
Labels: ${issue.labels.map((l) => l.name).join(', ')}

Issue Description:
${issue.body?.substring(0, 2000) ?? 'No description.'}

Branch: ${branchName}

Write a PR description in the following format:
## Summary
[Brief summary of what this PR does]

## Related Issue
Closes #${issue.number}

## Changes Made
- [List of changes]

## Testing
- [How to test the changes]

Keep it concise and professional.`;

  return callOpenAI(config, [
    { role: 'system', content: 'You are a helpful assistant that writes professional GitHub PR descriptions.' },
    { role: 'user', content: prompt },
  ]);
}

// ---- Validate API Key ----
export async function validateOpenAIKey(config: LLMConfig): Promise<boolean> {
  try {
    await callOpenAI(config, [
      { role: 'user', content: 'Say "ok"' },
    ]);
    return true;
  } catch {
    return false;
  }
}
