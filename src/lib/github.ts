import { Octokit } from "@octokit/core";
import type {
  IssueCandidate,
  QuerySnapshot,
  RateLimitSnapshot,
  RepoCandidate,
  UserProfile
} from "../domain/types";
import { buildRepositoryQuery } from "./queries";
import { scoreIssue, scoreRepository, summarizeIssueRecommendation } from "./scoring";

interface ScanResult {
  querySnapshot: QuerySnapshot;
  rateLimit: RateLimitSnapshot;
  repos: RepoCandidate[];
  issues: IssueCandidate[];
}

const README_ACCEPT_HEADER = "application/vnd.github.raw+json";
const CONTRIBUTING_PATHS = [
  "CONTRIBUTING.md",
  ".github/CONTRIBUTING.md",
  "docs/CONTRIBUTING.md"
];

function createOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: "Wisteria MVP",
    request: {
      headers: {
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  });
}

function parseRateLimit(headers: Record<string, string | undefined>): RateLimitSnapshot {
  return {
    limit: headers["x-ratelimit-limit"] ? Number(headers["x-ratelimit-limit"]) : null,
    remaining: headers["x-ratelimit-remaining"]
      ? Number(headers["x-ratelimit-remaining"])
      : null,
    reset: headers["x-ratelimit-reset"] ? Number(headers["x-ratelimit-reset"]) : null,
    used: headers["x-ratelimit-used"] ? Number(headers["x-ratelimit-used"]) : null,
    resource: headers["x-ratelimit-resource"] ?? null
  };
}

function excerpt(text: string | null | undefined, max = 440): string {
  if (!text) {
    return "";
  }

  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) {
    return compact;
  }

  return `${compact.slice(0, max).trimEnd()}...`;
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
  const results: TOutput[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      results.push(await mapper(current));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

async function fetchReadmeExcerpt(octokit: Octokit, owner: string, repo: string) {
  try {
    const response = await octokit.request("GET /repos/{owner}/{repo}/readme", {
      owner,
      repo,
      headers: {
        accept: README_ACCEPT_HEADER
      }
    });
    return excerpt(String(response.data));
  } catch {
    return null;
  }
}

async function fetchContributingExcerpt(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string | null> {
  for (const path of CONTRIBUTING_PATHS) {
    try {
      const response = await octokit.request(
        "GET /repos/{owner}/{repo}/contents/{path}",
        {
          owner,
          repo,
          path,
          headers: {
            accept: README_ACCEPT_HEADER
          }
        }
      );
      return excerpt(String(response.data));
    } catch {
      continue;
    }
  }

  return null;
}

export async function scanGitHubForIssues(
  token: string,
  profile: UserProfile
): Promise<ScanResult> {
  const octokit = createOctokit(token);
  const querySnapshot = buildRepositoryQuery(profile);
  const repoResponse = await octokit.request("GET /search/repositories", {
    q: querySnapshot.repositoryQuery,
    per_page: 10,
    sort: "updated",
    order: "desc"
  });

  let latestRateLimit = parseRateLimit(repoResponse.headers as Record<string, string>);

  const repos = await mapWithConcurrency(repoResponse.data.items, 3, async (item) => {
    const owner = item.owner?.login ?? "";
    const name = item.name;
    const [readmeExcerpt, contributingExcerpt] = await Promise.all([
      fetchReadmeExcerpt(octokit, owner, name),
      fetchContributingExcerpt(octokit, owner, name)
    ]);

    const repo = scoreRepository(profile, {
      repoId: item.id,
      ownerLogin: owner,
      name,
      fullName: item.full_name,
      htmlUrl: item.html_url,
      description: item.description ?? "",
      primaryLanguage: item.language ?? null,
      topics: item.topics ?? [],
      licenseSpdx: item.license?.spdx_id ?? null,
      stars: item.stargazers_count ?? 0,
      forks: item.forks_count ?? 0,
      openIssues: item.open_issues_count ?? 0,
      archived: item.archived ?? false,
      pushedAt: item.pushed_at ?? null,
      healthScore: 0,
      profileScore: 0,
      totalScore: 0,
      matchReasons: [],
      readmeExcerpt,
      contributingExcerpt
    });

    return repo;
  });

  const hydratedRepos = repos
    .filter((repo) => !repo.archived)
    .filter(
      (repo) => !repo.licenseSpdx || !profile.excludeLicenses.includes(repo.licenseSpdx)
    )
    .sort((left, right) => right.totalScore - left.totalScore)
    .slice(0, 8);

  const issueLists = await mapWithConcurrency(hydratedRepos, 2, async (repo) => {
    const response = await octokit.request("GET /repos/{owner}/{repo}/issues", {
      owner: repo.ownerLogin,
      repo: repo.name,
      state: "open",
      sort: "updated",
      direction: "desc",
      per_page: 12
    });
    latestRateLimit = parseRateLimit(response.headers as Record<string, string>);

    const issues: IssueCandidate[] = response.data
      .filter((item) => !("pull_request" in item))
      .map((item) => {
        const labels = item.labels
          .map((label) => (typeof label === "string" ? label : label.name ?? ""))
          .filter(Boolean);
        const scoreBreakdown = scoreIssue(profile, {
          title: item.title,
          body: item.body ?? "",
          labels,
          comments: item.comments ?? 0,
          updatedAt: item.updated_at ?? item.created_at ?? new Date().toISOString(),
          assignees: item.assignees?.map((assignee) => assignee.login ?? "").filter(Boolean) ?? []
        });

        return {
          issueId: item.id,
          number: item.number,
          title: item.title,
          bodyExcerpt: excerpt(item.body, 600),
          htmlUrl: item.html_url,
          labels,
          comments: item.comments ?? 0,
          createdAt: item.created_at ?? new Date().toISOString(),
          updatedAt: item.updated_at ?? item.created_at ?? new Date().toISOString(),
          author: item.user?.login ?? "unknown",
          assignees:
            item.assignees?.map((assignee) => assignee.login ?? "").filter(Boolean) ?? [],
          scoreBreakdown,
          recommendationSummary: "",
          repo
        };
      })
      .filter((issue) => issue.scoreBreakdown.total >= 35)
      .map((issue) => ({
        ...issue,
        recommendationSummary: summarizeIssueRecommendation(issue)
      }));

    return issues;
  });

  const issues = issueLists
    .flat()
    .sort((left, right) => {
      if (right.scoreBreakdown.total !== left.scoreBreakdown.total) {
        return right.scoreBreakdown.total - left.scoreBreakdown.total;
      }

      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    })
    .slice(0, 24);

  return {
    querySnapshot,
    rateLimit: latestRateLimit,
    repos: hydratedRepos,
    issues
  };
}

