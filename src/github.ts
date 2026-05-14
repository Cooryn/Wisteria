import { Buffer } from "node:buffer";

import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";

import type {
  CreateDraftPrResult,
  IssueContextComment,
  RepoCandidate,
  RepoRecommendation,
  RepoSearchParams,
  RepoSearchRound,
} from "./types.js";
import { WisteriaError } from "./errors.js";
import { scoreRepo } from "./scoring.js";

type SearchRepoItem =
  RestEndpointMethodTypes["search"]["repos"]["response"]["data"]["items"][number];
type RepoResponse = RestEndpointMethodTypes["repos"]["get"]["response"]["data"];
type PullListItem =
  RestEndpointMethodTypes["pulls"]["list"]["response"]["data"][number];
type IssueCommentResponse =
  RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][number];

function quoteSearchValue(value: string): string {
  return /[^A-Za-z0-9_-]/.test(value) ? `"${value}"` : value;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeRepo(item: SearchRepoItem): RepoCandidate {
  return {
    fullName: item.full_name,
    name: item.name,
    owner: item.owner?.login ?? item.full_name.split("/")[0] ?? "",
    description: item.description ?? null,
    url: item.html_url,
    language: item.language ?? null,
    topics: item.topics ?? [],
    stars: item.stargazers_count ?? 0,
    forks: item.forks_count ?? 0,
    openIssues: item.open_issues_count ?? 0,
    pushedAt: item.pushed_at ?? null,
    createdAt: item.created_at ?? null,
    archived: item.archived ?? false,
    disabled: item.disabled ?? false,
  };
}

export function createGitHubClient(token?: string): Octokit {
  return new Octokit({
    auth: token?.trim() ? token.trim() : undefined,
    userAgent: "@cooryn/wisteria-claw",
  });
}

export function splitRepoFullName(repoFullName: string): { owner: string; repo: string } {
  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) {
    throw new WisteriaError(`Invalid repo full name: ${repoFullName}`, "INVALID_REPO");
  }

  return { owner, repo };
}

export function buildRepoSearchQuery(
  params: {
    language?: string;
    topics?: string[];
    minStars?: number;
    maxStars?: number;
    includeArchived?: boolean;
  },
  fallbackLevel: 0 | 1 | 2 | 3,
): string {
  const parts: string[] = [];

  if (params.language && fallbackLevel <= 2) {
    parts.push(`language:${quoteSearchValue(params.language)}`);
  }

  if (fallbackLevel === 0) {
    for (const topic of uniqueStrings(params.topics ?? [])) {
      parts.push(`topic:${quoteSearchValue(topic)}`);
    }
  }

  if (fallbackLevel <= 1 && (params.minStars !== undefined || params.maxStars !== undefined)) {
    const min = params.minStars ?? 0;
    const max = params.maxStars ?? "*";
    parts.push(`stars:${min}..${max}`);
  }

  parts.push("has:issues");
  if (!params.includeArchived) {
    parts.push("archived:false");
  }

  return parts.join(" ");
}

export function buildRepoSearchPlan(params: RepoSearchParams): RepoSearchRound[] {
  const languages = uniqueStrings(params.languages ?? []);
  const rounds: RepoSearchRound[] = [];
  const fallbackLevels: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];

  for (const fallbackLevel of fallbackLevels) {
    if (languages.length === 0) {
      rounds.push({
        fallbackLevel,
        query: buildRepoSearchQuery(params, fallbackLevel),
      });
      continue;
    }

    for (const language of languages) {
      rounds.push({
        fallbackLevel,
        language,
        query: buildRepoSearchQuery(
          {
            ...params,
            language,
          },
          fallbackLevel,
        ),
      });
    }
  }

  const seen = new Set<string>();
  return rounds.filter((round) => {
    if (seen.has(round.query)) {
      return false;
    }
    seen.add(round.query);
    return true;
  });
}

export async function searchRepositories(
  client: Octokit,
  params: RepoSearchParams,
): Promise<{ repos: RepoRecommendation[]; rounds: RepoSearchRound[] }> {
  const limit = params.limit ?? 10;
  const plan = buildRepoSearchPlan(params);
  const collected = new Map<string, RepoRecommendation>();

  for (const round of plan) {
    const { data } = await client.rest.search.repos({
      q: round.query,
      sort: "updated",
      order: "desc",
      per_page: Math.min(100, Math.max(limit * 3, 30)),
      page: 1,
    });

    for (const item of data.items) {
      const repo = normalizeRepo(item);
      if (!params.includeArchived && (repo.archived || repo.disabled)) {
        continue;
      }

      const scoringPreferences: {
        languages?: string[];
        topics?: string[];
        minStars?: number;
        maxStars?: number;
      } = {};
      if (params.languages) {
        scoringPreferences.languages = params.languages;
      }
      if (params.topics) {
        scoringPreferences.topics = params.topics;
      }
      if (params.minStars !== undefined) {
        scoringPreferences.minStars = params.minStars;
      }
      if (params.maxStars !== undefined) {
        scoringPreferences.maxStars = params.maxStars;
      }

      const scored = scoreRepo(
        {
          ...repo,
          fallbackLevel: round.fallbackLevel,
        },
        scoringPreferences,
      );

      const recommendation: RepoRecommendation = {
        ...repo,
        fallbackLevel: round.fallbackLevel,
        score: scored.score,
        scoreBreakdown: scored.breakdown,
        reasons: scored.reasons,
      };

      const existing = collected.get(repo.fullName);
      if (!existing || recommendation.score > existing.score) {
        collected.set(repo.fullName, recommendation);
      }
    }

    if (collected.size >= limit) {
      break;
    }
  }

  const repos = [...collected.values()]
    .sort((left, right) => right.score - left.score || right.stars - left.stars)
    .slice(0, limit);

  return { repos, rounds: plan };
}

export async function getRepoDetails(
  client: Octokit,
  repoFullName: string,
): Promise<RepoResponse> {
  const { owner, repo } = splitRepoFullName(repoFullName);
  const { data } = await client.rest.repos.get({ owner, repo });
  return data;
}

export async function getIssueDetails(
  client: Octokit,
  repoFullName: string,
  issueNumber: number,
): Promise<RestEndpointMethodTypes["issues"]["get"]["response"]["data"]> {
  const { owner, repo } = splitRepoFullName(repoFullName);
  const { data } = await client.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });
  return data;
}

export async function listIssueComments(
  client: Octokit,
  repoFullName: string,
  issueNumber: number,
  limit: number,
): Promise<IssueContextComment[]> {
  const { owner, repo } = splitRepoFullName(repoFullName);
  const { data } = await client.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
    per_page: Math.min(100, Math.max(limit, 1)),
    page: 1,
  });

  return data.slice(0, limit).map((comment: IssueCommentResponse) => ({
    author: comment.user?.login ?? null,
    body: comment.body ?? null,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at ?? comment.created_at,
    url: comment.html_url,
  }));
}

export async function getReadmeExcerpt(
  client: Octokit,
  repoFullName: string,
): Promise<{ path: string; excerpt: string | null } | null> {
  const { owner, repo } = splitRepoFullName(repoFullName);

  try {
    const { data } = await client.rest.repos.getReadme({ owner, repo });
    const content =
      typeof data.content === "string"
        ? Buffer.from(data.content, "base64").toString("utf8")
        : "";
    return {
      path: data.path,
      excerpt: content.trim().slice(0, 4000) || null,
    };
  } catch {
    return null;
  }
}

export async function ensureForkExists(
  client: Octokit,
  repoFullName: string,
): Promise<{ forkFullName: string; ownerLogin: string }> {
  const { owner, repo } = splitRepoFullName(repoFullName);
  const { data: me } = await client.rest.users.getAuthenticated();

  try {
    const { data } = await client.rest.repos.get({
      owner: me.login,
      repo,
    });
    return {
      forkFullName: data.full_name,
      ownerLogin: me.login,
    };
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status !== 404) {
      throw error;
    }
  }

  await client.rest.repos.createFork({ owner, repo });

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const { data } = await client.rest.repos.get({
        owner: me.login,
        repo,
      });
      return {
        forkFullName: data.full_name,
        ownerLogin: me.login,
      };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  throw new WisteriaError(
    `Fork for ${repoFullName} is not ready yet.`,
    "FORK_NOT_READY",
  );
}

export async function findOpenPullRequestByHead(
  client: Octokit,
  repoFullName: string,
  head: string,
): Promise<PullListItem | null> {
  const { owner, repo } = splitRepoFullName(repoFullName);
  const { data } = await client.rest.pulls.list({
    owner,
    repo,
    state: "open",
    head,
    per_page: 1,
  });

  return data[0] ?? null;
}

export async function createDraftPullRequest(
  client: Octokit,
  params: {
    repoFullName: string;
    head: string;
    base: string;
    title: string;
    body: string;
  },
): Promise<CreateDraftPrResult> {
  const existing = await findOpenPullRequestByHead(client, params.repoFullName, params.head);
  if (existing) {
    return {
      prUrl: existing.html_url,
      prNumber: existing.number,
      repoFullName: params.repoFullName,
      branchName: params.head.split(":")[1] ?? params.head,
      baseBranch: params.base,
      headRef: params.head,
      reusedExistingPullRequest: true,
    };
  }

  const { owner, repo } = splitRepoFullName(params.repoFullName);
  const { data } = await client.rest.pulls.create({
    owner,
    repo,
    head: params.head,
    base: params.base,
    title: params.title,
    body: params.body,
    draft: true,
  });

  return {
    prUrl: data.html_url,
    prNumber: data.number,
    repoFullName: params.repoFullName,
    branchName: params.head.split(":")[1] ?? params.head,
    baseBranch: params.base,
    headRef: params.head,
    reusedExistingPullRequest: false,
  };
}

export function extractGitHubRepoFullName(remoteUrl: string | null): string | null {
  if (!remoteUrl) {
    return null;
  }

  const match = remoteUrl
    .trim()
    .match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/i);
  const owner = match?.groups?.owner;
  const repo = match?.groups?.repo;

  return owner && repo ? `${owner}/${repo}` : null;
}
