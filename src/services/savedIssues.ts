import type { Issue, IssueLabel, SavedIssue } from '../types';

function normalizeLabel(raw: unknown, index: number): IssueLabel | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const label = raw as Partial<IssueLabel>;
  return {
    id: typeof label.id === 'number' ? label.id : index,
    name: typeof label.name === 'string' ? label.name : '',
    color: typeof label.color === 'string' ? label.color : '000000',
    description: typeof label.description === 'string' || label.description === null
      ? label.description ?? null
      : null,
  };
}

export function parseSavedIssueLabels(labels: string): IssueLabel[] {
  try {
    const parsed = JSON.parse(labels);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((label, index) => normalizeLabel(label, index))
      .filter((label): label is IssueLabel => label !== null && label.name.length > 0);
  } catch {
    return [];
  }
}

export function savedIssueToIssue(savedIssue: SavedIssue): Issue {
  const createdAt = savedIssue.created_at ?? savedIssue.saved_at;
  const updatedAt = savedIssue.updated_at ?? savedIssue.created_at ?? savedIssue.saved_at;

  return {
    id: savedIssue.github_id,
    number: savedIssue.issue_number ?? 0,
    title: savedIssue.title,
    body: savedIssue.body,
    state: savedIssue.state,
    labels: parseSavedIssueLabels(savedIssue.labels),
    html_url: savedIssue.html_url ?? '',
    created_at: createdAt,
    updated_at: updatedAt,
    comments: savedIssue.comments ?? 0,
    user: {
      login: savedIssue.user_login ?? 'unknown',
      avatar_url: savedIssue.user_avatar_url ?? '',
    },
    repo_full_name: savedIssue.repo_full_name,
  };
}
