import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { generateDailyIssueDigest } from "../src/dailyDigest.js";
import type { RepoRecommendation, WisteriaConfig } from "../src/types.js";

const baseConfig: WisteriaConfig = {
  githubToken: "",
  defaultLabels: ["good first issue", "help wanted"],
  dailyDigest: {
    enabled: true,
    timezone: "Asia/Tokyo",
    hour: 9,
    limit: 5,
    minScore: 60,
  },
};

function repo(fullName: string): RepoRecommendation {
  return {
    fullName,
    name: fullName.split("/")[1] ?? fullName,
    owner: fullName.split("/")[0] ?? "",
    description: null,
    url: `https://github.com/${fullName}`,
    language: "TypeScript",
    topics: ["react"],
    stars: 100,
    forks: 10,
    openIssues: 20,
    pushedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    score: 80,
    scoreBreakdown: {
      languageMatch: 100,
      topicMatch: 100,
      activity: 80,
      community: 70,
      issueFriendliness: 70,
      freshness: 70,
    },
    reasons: ["Good match"],
  };
}

describe("generateDailyIssueDigest", () => {
  it("returns issues sorted by score", async () => {
    const digest = await generateDailyIssueDigest(
      {} as never,
      baseConfig,
      { limit: 2, maxIssuesPerRepo: 1 },
      {
        searchRepositories: vi.fn().mockResolvedValue({
          repos: [repo("octo/a"), repo("octo/b")],
        }),
        searchIssues: vi
          .fn()
          .mockResolvedValueOnce({
            issues: [
              {
                repoFullName: "octo/a",
                number: 1,
                title: "A",
                body: "Detailed body".repeat(20),
                url: "https://github.com/octo/a/issues/1",
                labels: ["good first issue"],
                comments: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                state: "open",
                score: 70,
                scoreBreakdown: {
                  labelMatch: 80,
                  clarity: 80,
                  discussionLoad: 90,
                  freshness: 80,
                  beginnerFriendliness: 90,
                },
                reasons: ["A"],
              },
            ],
          })
          .mockResolvedValueOnce({
            issues: [
              {
                repoFullName: "octo/b",
                number: 2,
                title: "B",
                body: "Detailed body".repeat(20),
                url: "https://github.com/octo/b/issues/2",
                labels: ["good first issue"],
                comments: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                state: "open",
                score: 92,
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

    expect(digest.recommendations.map((item) => item.score)).toEqual([92, 70]);
  });

  it("respects the final limit", async () => {
    const digest = await generateDailyIssueDigest(
      {} as never,
      baseConfig,
      { limit: 1, maxIssuesPerRepo: 2 },
      {
        searchRepositories: vi.fn().mockResolvedValue({
          repos: [repo("octo/a"), repo("octo/b")],
        }),
        searchIssues: vi.fn().mockResolvedValue({
          issues: [
            {
              repoFullName: "octo/a",
              number: 1,
              title: "A",
              body: "Detailed body".repeat(20),
              url: "https://github.com/octo/a/issues/1",
              labels: ["good first issue"],
              comments: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              state: "open",
              score: 80,
              scoreBreakdown: {
                labelMatch: 100,
                clarity: 90,
                discussionLoad: 90,
                freshness: 90,
                beginnerFriendliness: 100,
              },
              reasons: ["A"],
            },
          ],
        }),
      },
    );

    expect(digest.recommendations).toHaveLength(1);
  });

  it("uses default labels when labels are omitted", async () => {
    const searchIssues = vi.fn().mockResolvedValue({ issues: [] });

    await generateDailyIssueDigest(
      {} as never,
      baseConfig,
      { limit: 1 },
      {
        searchRepositories: vi.fn().mockResolvedValue({
          repos: [repo("octo/a")],
        }),
        searchIssues,
      },
    );

    expect(searchIssues).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ labels: ["good first issue", "help wanted"] }),
    );
  });

  it("filters out low-score issues when minScore is set", async () => {
    const digest = await generateDailyIssueDigest(
      {} as never,
      baseConfig,
      { minScore: 80, limit: 5 },
      {
        searchRepositories: vi.fn().mockResolvedValue({
          repos: [repo("octo/a")],
        }),
        searchIssues: vi.fn().mockResolvedValue({
          issues: [
            {
              repoFullName: "octo/a",
              number: 1,
              title: "A",
              body: "Detailed body".repeat(20),
              url: "https://github.com/octo/a/issues/1",
              labels: ["good first issue"],
              comments: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              state: "open",
              score: 70,
              scoreBreakdown: {
                labelMatch: 100,
                clarity: 90,
                discussionLoad: 90,
                freshness: 90,
                beginnerFriendliness: 100,
              },
              reasons: ["A"],
            },
          ],
        }),
      },
    );

    expect(digest.recommendations).toHaveLength(0);
  });

  it("respects maxIssuesPerRepo", async () => {
    const digest = await generateDailyIssueDigest(
      {} as never,
      baseConfig,
      { maxIssuesPerRepo: 1, limit: 5 },
      {
        searchRepositories: vi.fn().mockResolvedValue({
          repos: [repo("octo/a")],
        }),
        searchIssues: vi.fn().mockResolvedValue({
          issues: [
            {
              repoFullName: "octo/a",
              number: 1,
              title: "A",
              body: "Detailed body".repeat(20),
              url: "https://github.com/octo/a/issues/1",
              labels: ["good first issue"],
              comments: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              state: "open",
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
              repoFullName: "octo/a",
              number: 2,
              title: "B",
              body: "Detailed body".repeat(20),
              url: "https://github.com/octo/a/issues/2",
              labels: ["good first issue"],
              comments: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              state: "open",
              score: 90,
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
  });

  it("does not depend on workspace, git, or PR modules", () => {
    const source = readFileSync(new URL("../src/dailyDigest.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/workspace/i);
    expect(source).not.toMatch(/from "\.\/git\.js"/);
    expect(source).not.toMatch(/from "\.\/pr\.js"/);
  });
});
