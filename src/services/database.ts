import Database from '@tauri-apps/plugin-sql';
import type { TechTag, SavedRepo, SavedIssue, PRHistoryEntry } from '../types';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:wisteria.db');
  }
  return db;
}

// ---- App Settings ----
export async function getSetting(key: string): Promise<string | null> {
  const d = await getDb();
  const rows = await d.select<{ value: string }[]>(
    'SELECT value FROM app_settings WHERE key = $1',
    [key]
  );
  return rows.length > 0 ? rows[0].value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const d = await getDb();
  const rows = await d.select<{ key: string; value: string }[]>(
    'SELECT key, value FROM app_settings'
  );
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

// ---- Tech Tags ----
export async function getTechTags(): Promise<TechTag[]> {
  const d = await getDb();
  return d.select<TechTag[]>('SELECT * FROM tech_tags ORDER BY category, name');
}

export async function saveTechTag(tag: TechTag): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO tech_tags (name, category, weight) VALUES ($1, $2, $3)
     ON CONFLICT(name) DO UPDATE SET category = excluded.category, weight = excluded.weight`,
    [tag.name, tag.category, tag.weight]
  );
}

export async function deleteTechTag(name: string): Promise<void> {
  const d = await getDb();
  await d.execute('DELETE FROM tech_tags WHERE name = $1', [name]);
}

export async function clearTechTags(): Promise<void> {
  const d = await getDb();
  await d.execute('DELETE FROM tech_tags');
}

// ---- Saved Repos ----
export async function getSavedRepos(): Promise<SavedRepo[]> {
  const d = await getDb();
  return d.select<SavedRepo[]>(
    'SELECT * FROM saved_repos ORDER BY score DESC, saved_at DESC'
  );
}

export async function saveRepo(repo: SavedRepo): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO saved_repos (github_id, full_name, description, language, stars, topics, score)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT(github_id) DO UPDATE SET score = excluded.score`,
    [repo.github_id, repo.full_name, repo.description, repo.language, repo.stars, repo.topics, repo.score]
  );
}

export async function deleteSavedRepo(githubId: number): Promise<void> {
  const d = await getDb();
  await d.execute('DELETE FROM saved_repos WHERE github_id = $1', [githubId]);
}

// ---- Saved Issues ----
export async function getSavedIssues(): Promise<SavedIssue[]> {
  const d = await getDb();
  return d.select<SavedIssue[]>(
    'SELECT * FROM saved_issues ORDER BY score DESC, saved_at DESC'
  );
}

export async function saveIssue(issue: SavedIssue): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO saved_issues (github_id, repo_full_name, title, body, labels, state, score, analysis)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(github_id) DO UPDATE SET score = excluded.score, analysis = excluded.analysis`,
    [issue.github_id, issue.repo_full_name, issue.title, issue.body, issue.labels, issue.state, issue.score, issue.analysis]
  );
}

export async function deleteSavedIssue(githubId: number): Promise<void> {
  const d = await getDb();
  await d.execute('DELETE FROM saved_issues WHERE github_id = $1', [githubId]);
}

// ---- PR History ----
export async function getPRHistory(): Promise<PRHistoryEntry[]> {
  const d = await getDb();
  return d.select<PRHistoryEntry[]>(
    'SELECT * FROM pr_history ORDER BY created_at DESC'
  );
}

export async function addPRHistory(entry: Omit<PRHistoryEntry, 'id' | 'created_at'>): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO pr_history (issue_id, repo_full_name, pr_url, branch_name, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [entry.issue_id, entry.repo_full_name, entry.pr_url, entry.branch_name, entry.status]
  );
}

// ---- Preferences (simple key-value) ----
export async function getPreference(key: string): Promise<string | null> {
  const d = await getDb();
  const rows = await d.select<{ value: string }[]>(
    'SELECT value FROM preferences WHERE key = $1',
    [key]
  );
  return rows.length > 0 ? rows[0].value : null;
}

export async function setPreference(key: string, value: string): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO preferences (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [key, value]
  );
}
