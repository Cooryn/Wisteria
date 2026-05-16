import type { Octokit } from "@octokit/rest";

import { withDigestDefaults } from "../core/config.js";
import { searchRepositories } from "./client.js";
import { searchIssues } from "./issues.js";
import { assertReadOnlyDigest } from "../core/safety.js";
import { estimateIssueDifficulty, estimateIssueTime } from "./scoring.js";
import type {
  DailyDigestEntry,
  DailyDigestParams,
  DailyDigestResult,
  RepoRecommendation,
  WisteriaConfig,
} from "../core/types.js";

export interface DailyDigestDependencies {
  searchRepositories: typeof searchRepositories;
  searchIssues: typeof searchIssues;
}

const defaultDependencies: DailyDigestDependencies = {
  searchRepositories,
  searchIssues,
};

function formatDateInTimeZone(timeZone: string, date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildSuggestedNextAction(
  repo: RepoRecommendation,
  issueNumber: number,
): string {
  return `Inspect ${repo.fullName} issue #${issueNumber} and ask Wisteria Analyst for a structured feasibility review.`;
}

export async function generateDailyIssueDigest(
  client: Octokit,
  config: WisteriaConfig,
  params: DailyDigestParams,
  dependencies: DailyDigestDependencies = defaultDependencies,
): Promise<DailyDigestResult> {
  assertReadOnlyDigest();

  const effective = withDigestDefaults(config, params);
  const now = new Date();
  const timezone = config.dailyDigest?.timezone ?? "Asia/Tokyo";

  const repoSearchParams = {
    limit: Math.max(effective.limit * 2, 8),
  } as {
    languages?: string[];
    topics?: string[];
    minStars?: number;
    maxStars?: number;
    limit: number;
  };
  if (effective.languages) {
    repoSearchParams.languages = effective.languages;
  }
  if (effective.topics) {
    repoSearchParams.topics = effective.topics;
  }
  if (config.minStars !== undefined) {
    repoSearchParams.minStars = config.minStars;
  }
  if (config.maxStars !== undefined) {
    repoSearchParams.maxStars = config.maxStars;
  }

  const { repos } = await dependencies.searchRepositories(client, repoSearchParams);

  const collected = new Map<string, DailyDigestEntry>();

  for (const repo of repos) {
    const issueSearchParams = {
      repoFullName: repo.fullName,
      state: "open" as const,
      limit: Math.max(effective.maxIssuesPerRepo * 3, 6),
    } as {
      repoFullName: string;
      labels?: string[];
      state: "open";
      limit: number;
    };
    if (effective.labels) {
      issueSearchParams.labels = effective.labels;
    }

    const { issues } = await dependencies.searchIssues(client, issueSearchParams);

    const shortlisted = issues
      .filter((issue) => issue.score >= effective.minScore)
      .slice(0, effective.maxIssuesPerRepo);

    for (const issue of shortlisted) {
      const difficulty = estimateIssueDifficulty(issue, issue.score);
      const recommendation: DailyDigestEntry = {
        repoFullName: repo.fullName,
        repoUrl: repo.url,
        issueNumber: issue.number,
        issueTitle: issue.title,
        issueUrl: issue.url,
        score: issue.score,
        difficulty,
        estimatedTime: estimateIssueTime(difficulty),
        reasons: issue.reasons,
        suggestedNextAction: buildSuggestedNextAction(repo, issue.number),
      };

      collected.set(`${repo.fullName}#${issue.number}`, recommendation);
    }
  }

  const recommendations = [...collected.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, effective.limit);

  return {
    date: formatDateInTimeZone(timezone, now),
    generatedAt: now.toISOString(),
    timezone,
    recommendations,
  };
}
