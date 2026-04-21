import Database from "@tauri-apps/plugin-sql";
import type {
  DraftPrArtifact,
  IssueCandidate,
  QuerySnapshot,
  RateLimitSnapshot,
  RepoCandidate,
  ScanRun,
  ScanWorkspace,
  ScoreBreakdown,
  UserProfile
} from "../domain/types";

let databasePromise: Promise<Database> | null = null;

function toJson(value: unknown): string {
  return JSON.stringify(value);
}

function fromJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = Database.load("sqlite:wisteria.db");
  }

  return databasePromise;
}

export async function initDatabase(): Promise<void> {
  const db = await getDatabase();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      display_name TEXT NOT NULL,
      languages_json TEXT NOT NULL,
      frameworks_json TEXT NOT NULL,
      interest_domains_json TEXT NOT NULL,
      difficulty_preference TEXT NOT NULL,
      weekly_hours INTEGER NOT NULL,
      preferred_issue_types_json TEXT NOT NULL,
      exclude_keywords_json TEXT NOT NULL,
      exclude_licenses_json TEXT NOT NULL,
      repo_size_preference TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS scan_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      query_snapshot_json TEXT NOT NULL,
      rate_limit_json TEXT NOT NULL,
      repo_count INTEGER NOT NULL,
      issue_count INTEGER NOT NULL,
      error_message TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS repo_candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_run_id INTEGER NOT NULL,
      repo_id INTEGER NOT NULL,
      owner_login TEXT NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      html_url TEXT NOT NULL,
      description TEXT NOT NULL,
      primary_language TEXT,
      topics_json TEXT NOT NULL,
      license_spdx TEXT,
      stars INTEGER NOT NULL,
      forks INTEGER NOT NULL,
      open_issues INTEGER NOT NULL,
      archived INTEGER NOT NULL,
      pushed_at TEXT,
      health_score REAL NOT NULL,
      profile_score REAL NOT NULL,
      total_score REAL NOT NULL,
      match_reasons_json TEXT NOT NULL,
      readme_excerpt TEXT,
      contributing_excerpt TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS issue_candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_run_id INTEGER NOT NULL,
      repo_candidate_id INTEGER NOT NULL,
      issue_id INTEGER NOT NULL,
      issue_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      body_excerpt TEXT NOT NULL,
      html_url TEXT NOT NULL,
      labels_json TEXT NOT NULL,
      comments INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      author TEXT NOT NULL,
      assignees_json TEXT NOT NULL,
      score_breakdown_json TEXT NOT NULL,
      recommendation_summary TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS draft_pr_artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_candidate_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      problem_statement TEXT NOT NULL,
      implementation_plan_json TEXT NOT NULL,
      validation_checklist_json TEXT NOT NULL,
      commit_plan_json TEXT NOT NULL,
      pr_body TEXT NOT NULL,
      assistant_prompt TEXT NOT NULL,
      provider_used TEXT NOT NULL,
      warnings_json TEXT NOT NULL
    )
  `);
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `
      INSERT INTO profiles (
        id,
        display_name,
        languages_json,
        frameworks_json,
        interest_domains_json,
        difficulty_preference,
        weekly_hours,
        preferred_issue_types_json,
        exclude_keywords_json,
        exclude_licenses_json,
        repo_size_preference,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        languages_json = excluded.languages_json,
        frameworks_json = excluded.frameworks_json,
        interest_domains_json = excluded.interest_domains_json,
        difficulty_preference = excluded.difficulty_preference,
        weekly_hours = excluded.weekly_hours,
        preferred_issue_types_json = excluded.preferred_issue_types_json,
        exclude_keywords_json = excluded.exclude_keywords_json,
        exclude_licenses_json = excluded.exclude_licenses_json,
        repo_size_preference = excluded.repo_size_preference,
        updated_at = excluded.updated_at
    `,
    [
      1,
      profile.displayName,
      toJson(profile.languages),
      toJson(profile.frameworks),
      toJson(profile.interestDomains),
      profile.difficultyPreference,
      profile.weeklyHours,
      toJson(profile.preferredIssueTypes),
      toJson(profile.excludeKeywords),
      toJson(profile.excludeLicenses),
      profile.repoSizePreference,
      new Date().toISOString()
    ]
  );
}

export async function loadProfile(): Promise<UserProfile | null> {
  const db = await getDatabase();
  const rows = await db.select<
    {
      display_name: string;
      languages_json: string;
      frameworks_json: string;
      interest_domains_json: string;
      difficulty_preference: UserProfile["difficultyPreference"];
      weekly_hours: number;
      preferred_issue_types_json: string;
      exclude_keywords_json: string;
      exclude_licenses_json: string;
      repo_size_preference: UserProfile["repoSizePreference"];
    }[]
  >("SELECT * FROM profiles WHERE id = 1");

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    displayName: row.display_name,
    languages: fromJson(row.languages_json, []),
    frameworks: fromJson(row.frameworks_json, []),
    interestDomains: fromJson(row.interest_domains_json, []),
    difficultyPreference: row.difficulty_preference,
    weeklyHours: row.weekly_hours,
    preferredIssueTypes: fromJson(row.preferred_issue_types_json, []),
    excludeKeywords: fromJson(row.exclude_keywords_json, []),
    excludeLicenses: fromJson(row.exclude_licenses_json, []),
    repoSizePreference: row.repo_size_preference
  };
}

export async function createScanRun(snapshot: QuerySnapshot): Promise<number> {
  const db = await getDatabase();
  await db.execute(
    `
      INSERT INTO scan_runs (
        created_at,
        status,
        query_snapshot_json,
        rate_limit_json,
        repo_count,
        issue_count
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [new Date().toISOString(), "running", toJson(snapshot), toJson({}), 0, 0]
  );
  const row = await db.select<{ id: number }[]>("SELECT last_insert_rowid() as id");
  return row[0]?.id ?? 0;
}

export async function finalizeScanRun(
  id: number,
  result: Pick<ScanRun, "status" | "rateLimit" | "repoCount" | "issueCount" | "errorMessage">
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `
      UPDATE scan_runs
      SET status = ?, rate_limit_json = ?, repo_count = ?, issue_count = ?, error_message = ?
      WHERE id = ?
    `,
    [
      result.status,
      toJson(result.rateLimit),
      result.repoCount,
      result.issueCount,
      result.errorMessage ?? null,
      id
    ]
  );
}

export async function insertRepoCandidates(
  scanRunId: number,
  repos: RepoCandidate[]
): Promise<Map<number, number>> {
  const db = await getDatabase();
  const map = new Map<number, number>();

  for (const repo of repos) {
    await db.execute(
      `
        INSERT INTO repo_candidates (
          scan_run_id,
          repo_id,
          owner_login,
          name,
          full_name,
          html_url,
          description,
          primary_language,
          topics_json,
          license_spdx,
          stars,
          forks,
          open_issues,
          archived,
          pushed_at,
          health_score,
          profile_score,
          total_score,
          match_reasons_json,
          readme_excerpt,
          contributing_excerpt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        scanRunId,
        repo.repoId,
        repo.ownerLogin,
        repo.name,
        repo.fullName,
        repo.htmlUrl,
        repo.description,
        repo.primaryLanguage,
        toJson(repo.topics),
        repo.licenseSpdx,
        repo.stars,
        repo.forks,
        repo.openIssues,
        repo.archived ? 1 : 0,
        repo.pushedAt,
        repo.healthScore,
        repo.profileScore,
        repo.totalScore,
        toJson(repo.matchReasons),
        repo.readmeExcerpt ?? null,
        repo.contributingExcerpt ?? null
      ]
    );

    const row = await db.select<{ id: number }[]>("SELECT last_insert_rowid() as id");
    const insertedId = row[0]?.id ?? 0;
    map.set(repo.repoId, insertedId);
  }

  return map;
}

export async function insertIssueCandidates(
  scanRunId: number,
  repoIdMap: Map<number, number>,
  issues: IssueCandidate[]
): Promise<void> {
  const db = await getDatabase();

  for (const issue of issues) {
    const repoCandidateId = repoIdMap.get(issue.repo.repoId);
    if (!repoCandidateId) {
      continue;
    }

    await db.execute(
      `
        INSERT INTO issue_candidates (
          scan_run_id,
          repo_candidate_id,
          issue_id,
          issue_number,
          title,
          body_excerpt,
          html_url,
          labels_json,
          comments,
          created_at,
          updated_at,
          author,
          assignees_json,
          score_breakdown_json,
          recommendation_summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        scanRunId,
        repoCandidateId,
        issue.issueId,
        issue.number,
        issue.title,
        issue.bodyExcerpt,
        issue.htmlUrl,
        toJson(issue.labels),
        issue.comments,
        issue.createdAt,
        issue.updatedAt,
        issue.author,
        toJson(issue.assignees),
        toJson(issue.scoreBreakdown),
        issue.recommendationSummary
      ]
    );
  }
}

export async function insertDraftPrArtifact(
  issueCandidateId: number,
  artifact: DraftPrArtifact
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `
      INSERT INTO draft_pr_artifacts (
        issue_candidate_id,
        created_at,
        branch_name,
        title,
        summary,
        problem_statement,
        implementation_plan_json,
        validation_checklist_json,
        commit_plan_json,
        pr_body,
        assistant_prompt,
        provider_used,
        warnings_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      issueCandidateId,
      artifact.createdAt,
      artifact.branchName,
      artifact.title,
      artifact.summary,
      artifact.problemStatement,
      toJson(artifact.implementationPlan),
      toJson(artifact.validationChecklist),
      toJson(artifact.commitPlan),
      artifact.prBody,
      artifact.assistantPrompt,
      artifact.providerUsed,
      toJson(artifact.warnings ?? [])
    ]
  );
}

export async function loadLatestScanWorkspace(): Promise<ScanWorkspace> {
  const db = await getDatabase();
  const scanRows = await db.select<
    {
      id: number;
      created_at: string;
      status: ScanRun["status"];
      query_snapshot_json: string;
      rate_limit_json: string;
      repo_count: number;
      issue_count: number;
      error_message: string | null;
    }[]
  >("SELECT * FROM scan_runs ORDER BY id DESC LIMIT 1");

  const latest = scanRows[0];
  if (!latest) {
    return { run: null, issues: [] };
  }

  const issueRows = await db.select<
    {
      issue_candidate_id: number;
      repo_candidate_id: number;
      repo_id: number;
      owner_login: string;
      name: string;
      full_name: string;
      repo_html_url: string;
      description: string;
      primary_language: string | null;
      topics_json: string;
      license_spdx: string | null;
      stars: number;
      forks: number;
      open_issues: number;
      archived: number;
      pushed_at: string | null;
      health_score: number;
      profile_score: number;
      repo_total_score: number;
      match_reasons_json: string;
      readme_excerpt: string | null;
      contributing_excerpt: string | null;
      issue_id: number;
      issue_number: number;
      title: string;
      body_excerpt: string;
      issue_html_url: string;
      labels_json: string;
      comments: number;
      issue_created_at: string;
      issue_updated_at: string;
      author: string;
      assignees_json: string;
      score_breakdown_json: string;
      recommendation_summary: string;
    }[]
  >(
    `
      SELECT
        i.id as issue_candidate_id,
        r.id as repo_candidate_id,
        r.repo_id,
        r.owner_login,
        r.name,
        r.full_name,
        r.html_url as repo_html_url,
        r.description,
        r.primary_language,
        r.topics_json,
        r.license_spdx,
        r.stars,
        r.forks,
        r.open_issues,
        r.archived,
        r.pushed_at,
        r.health_score,
        r.profile_score,
        r.total_score as repo_total_score,
        r.match_reasons_json,
        r.readme_excerpt,
        r.contributing_excerpt,
        i.issue_id,
        i.issue_number,
        i.title,
        i.body_excerpt,
        i.html_url as issue_html_url,
        i.labels_json,
        i.comments,
        i.created_at as issue_created_at,
        i.updated_at as issue_updated_at,
        i.author,
        i.assignees_json,
        i.score_breakdown_json,
        i.recommendation_summary
      FROM issue_candidates i
      JOIN repo_candidates r ON r.id = i.repo_candidate_id
      WHERE i.scan_run_id = ?
      ORDER BY json_extract(i.score_breakdown_json, '$.total') DESC, i.updated_at DESC
    `,
    [latest.id]
  );

  const issues = issueRows.map((row) => ({
    id: row.issue_candidate_id,
    scanRunId: latest.id,
    repoCandidateId: row.repo_candidate_id,
    issueId: row.issue_id,
    number: row.issue_number,
    title: row.title,
    bodyExcerpt: row.body_excerpt,
    htmlUrl: row.issue_html_url,
    labels: fromJson(row.labels_json, []),
    comments: row.comments,
    createdAt: row.issue_created_at,
    updatedAt: row.issue_updated_at,
    author: row.author,
    assignees: fromJson(row.assignees_json, []),
    scoreBreakdown: fromJson<ScoreBreakdown>(row.score_breakdown_json, {
      labelBonus: 0,
      difficultyScore: 0,
      timeFitScore: 0,
      maintainerScore: 0,
      riskPenalty: 0,
      total: 0,
      reasons: [],
      riskFlags: []
    }),
    recommendationSummary: row.recommendation_summary,
    repo: {
      id: row.repo_candidate_id,
      scanRunId: latest.id,
      repoId: row.repo_id,
      ownerLogin: row.owner_login,
      name: row.name,
      fullName: row.full_name,
      htmlUrl: row.repo_html_url,
      description: row.description,
      primaryLanguage: row.primary_language,
      topics: fromJson(row.topics_json, []),
      licenseSpdx: row.license_spdx,
      stars: row.stars,
      forks: row.forks,
      openIssues: row.open_issues,
      archived: row.archived === 1,
      pushedAt: row.pushed_at,
      healthScore: row.health_score,
      profileScore: row.profile_score,
      totalScore: row.repo_total_score,
      matchReasons: fromJson(row.match_reasons_json, []),
      readmeExcerpt: row.readme_excerpt,
      contributingExcerpt: row.contributing_excerpt
    }
  }));

  return {
    run: {
      id: latest.id,
      createdAt: latest.created_at,
      status: latest.status,
      querySnapshot: fromJson<QuerySnapshot>(latest.query_snapshot_json, {
        repositoryQuery: "",
        requestedLanguages: [],
        requestedFrameworks: [],
        requestedDomains: []
      }),
      rateLimit: fromJson<RateLimitSnapshot>(latest.rate_limit_json, {
        limit: null,
        remaining: null,
        reset: null,
        used: null,
        resource: null
      }),
      repoCount: latest.repo_count,
      issueCount: latest.issue_count,
      errorMessage: latest.error_message
    },
    issues
  };
}

