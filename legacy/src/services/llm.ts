import { invoke } from '@tauri-apps/api/core';
import type { Issue, IssueAnalysis } from '../types';

interface LLMConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

// ---- Analyze an issue ----
export async function analyzeIssue(
  config: LLMConfig,
  issue: Issue,
  _repoDescription?: string
): Promise<IssueAnalysis> {
  return invoke<IssueAnalysis>('llm_analyze_issue', {
    config: {
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
    },
    issue: {
      repoFullName: issue.repo_full_name ?? null,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      labels: issue.labels.map((l) => l.name),
    },
    repoDescription: _repoDescription ?? null,
  });
}

// ---- Validate API Key ----
export async function validateOpenAIKey(config: LLMConfig): Promise<boolean> {
  return invoke<boolean>('llm_validate_key', {
    config: {
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
    },
  });
}
