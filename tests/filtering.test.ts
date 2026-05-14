import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { generateDailyIssueDigest } from "../src/dailyDigest.js";
import { buildRepoSearchPlan, searchRepositories } from "../src/github.js";
import {
  filterContributionIssues,
  normalizeIssueLabel,
  searchIssues,
} from "../src/issues.js";
import type { IssueCandidate, WisteriaConfig } from "../src/types.js";

const config: WisteriaConfig = {
  githubToken: "",
  defaultLabels: ["good first issue", "help wanted"],
};

function issue(overrides: Partial<IssueCandidate> = {}): IssueCandidate {
  return {
    repoFullName: "octo/example",
    number: 1,
    title: "Improve docs",
    body: "Detailed body".repeat(10),
    url: "https://github.com/octo/example/issues/1",
    labels: ["documentation"],
    comments: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: "open",
    ...overrides,
  };
}

describe("filtering", () => {
  it("filters out pull requests", () => {
    const results = filterContributionIssues([
      issue({ isPullRequest: true }),
      issue({ number: 2 }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]?.number).toBe(2);
  });

  it("filters out closed issues", () => {
    const results = filterContributionIssues([
      issue({ state: "closed" }),
      issue({ number: 2 }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]?.number).toBe(2);
  });

  it("filters archived and disabled repositories during search", async () => {
    const result = await searchRepositories(
      {
        rest: {
          search: {
            repos: async () => ({
              data: {
                items: [
                  {
                    full_name: "octo/archived",
                    name: "archived",
                    owner: { login: "octo" },
                    description: null,
                    html_url: "https://github.com/octo/archived",
                    language: "TypeScript",
                    topics: [],
                    stargazers_count: 10,
                    forks_count: 0,
                    open_issues_count: 1,
                    pushed_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    archived: true,
                    disabled: false,
                  },
                  {
                    full_name: "octo/disabled",
                    name: "disabled",
                    owner: { login: "octo" },
                    description: null,
                    html_url: "https://github.com/octo/disabled",
                    language: "TypeScript",
                    topics: [],
                    stargazers_count: 10,
                    forks_count: 0,
                    open_issues_count: 1,
                    pushed_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    archived: false,
                    disabled: true,
                  },
                  {
                    full_name: "octo/live",
                    name: "live",
                    owner: { login: "octo" },
                    description: null,
                    html_url: "https://github.com/octo/live",
                    language: "TypeScript",
                    topics: [],
                    stargazers_count: 10,
                    forks_count: 0,
                    open_issues_count: 1,
                    pushed_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    archived: false,
                    disabled: false,
                  },
                ],
              },
            }),
          },
        },
      } as never,
      { languages: ["TypeScript"], limit: 10 },
    );

    expect(result.repos.map((repo) => repo.fullName)).toEqual(["octo/live"]);
  });

  it("normalizes string and object labels", () => {
    expect(normalizeIssueLabel("bug")).toBe("bug");
    expect(normalizeIssueLabel({ name: "good first issue" })).toBe("good first issue");
  });

  it("builds query fallback levels in the right order", () => {
    expect(
      buildRepoSearchPlan({
        languages: ["TypeScript"],
        topics: ["react"],
        minStars: 100,
        maxStars: 1000,
      }).map((round) => round.fallbackLevel),
    ).toEqual([0, 1, 2, 3]);
  });

  it("sorts issues by score descending", async () => {
    const result = await searchIssues(
      {
        rest: {
          issues: {
            listForRepo: async () => ({
              data: [
                {
                  number: 1,
                  title: "Hard",
                  body: "",
                  html_url: "https://github.com/octo/example/issues/1",
                  labels: [{ name: "maintenance" }],
                  comments: 30,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  state: "open",
                  user: { login: "octo" },
                },
                {
                  number: 2,
                  title: "Easy",
                  body: "Detailed body".repeat(20),
                  html_url: "https://github.com/octo/example/issues/2",
                  labels: [{ name: "good first issue" }],
                  comments: 1,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  state: "open",
                  user: { login: "octo" },
                },
              ],
            }),
          },
        },
      } as never,
      { repoFullName: "octo/example", labels: ["good first issue"], limit: 10 },
    );

    expect(result.issues[0]?.number).toBe(2);
  });

  it("respects minScore and maxIssuesPerRepo in daily digest", async () => {
    const digest = await generateDailyIssueDigest(
      {} as never,
      config,
      { minScore: 80, maxIssuesPerRepo: 1, limit: 5 },
      {
        searchRepositories: async () => ({
          repos: [
            {
              fullName: "octo/example",
              name: "example",
              owner: "octo",
              description: null,
              url: "https://github.com/octo/example",
              language: "TypeScript",
              topics: [],
              stars: 100,
              forks: 10,
              openIssues: 10,
              pushedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              score: 80,
              scoreBreakdown: {
                languageMatch: 100,
                topicMatch: 50,
                activity: 80,
                community: 80,
                issueFriendliness: 70,
                freshness: 70,
              },
              reasons: ["Good"],
            },
          ],
        }),
        searchIssues: async () => ({
          issues: [
            {
              ...issue({ number: 1 }),
              score: 95,
              scoreBreakdown: {
                labelMatch: 100,
                clarity: 90,
                discussionLoad: 90,
                freshness: 90,
                beginnerFriendliness: 100,
              },
              reasons: ["A"],
            },
            {
              ...issue({ number: 2 }),
              score: 70,
              scoreBreakdown: {
                labelMatch: 100,
                clarity: 90,
                discussionLoad: 90,
                freshness: 90,
                beginnerFriendliness: 100,
              },
              reasons: ["B"],
            },
          ],
        }),
      },
    );

    expect(digest.recommendations).toHaveLength(1);
    expect(digest.recommendations[0]?.issueNumber).toBe(1);
  });

  it("keeps daily digest independent from workspace, git, and PR code", () => {
    const source = readFileSync(new URL("../src/dailyDigest.ts", import.meta.url), "utf8");
    expect(source).not.toContain("./workspace.js");
    expect(source).not.toContain("./git.js");
    expect(source).not.toContain("./pr.js");
  });
});
