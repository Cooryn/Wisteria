import { describe, expect, it } from "vitest";

import { scoreIssue, scoreRepo } from "../src/scoring.js";
import type { IssueCandidate, RepoCandidate } from "../src/types.js";

function createRepo(overrides: Partial<RepoCandidate> = {}): RepoCandidate {
  return {
    fullName: "octo/example",
    name: "example",
    owner: "octo",
    description: "TypeScript React contribution helper",
    url: "https://github.com/octo/example",
    language: "TypeScript",
    topics: ["react", "tooling"],
    stars: 500,
    forks: 80,
    openIssues: 40,
    pushedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createIssue(overrides: Partial<IssueCandidate> = {}): IssueCandidate {
  return {
    repoFullName: "octo/example",
    number: 1,
    title: "Improve docs",
    body: "A detailed issue body that explains the expected change in enough detail for a contributor.".repeat(
      5,
    ),
    url: "https://github.com/octo/example/issues/1",
    labels: ["documentation"],
    comments: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: "open",
    ...overrides,
  };
}

describe("scoreRepo", () => {
  it("rewards exact language matches", () => {
    const match = scoreRepo(createRepo(), { languages: ["TypeScript"] });
    const mismatch = scoreRepo(createRepo({ language: "Rust" }), {
      languages: ["TypeScript"],
    });

    expect(match.score).toBeGreaterThan(mismatch.score);
    expect(match.breakdown.languageMatch).toBe(100);
  });

  it("rewards topic matches", () => {
    const match = scoreRepo(createRepo(), { topics: ["react"] });
    const mismatch = scoreRepo(
      createRepo({ topics: ["cli"], description: "CLI tooling repository" }),
      { topics: ["react"] },
    );

    expect(match.score).toBeGreaterThan(mismatch.score);
    expect(match.breakdown.topicMatch).toBeGreaterThan(mismatch.breakdown.topicMatch);
  });

  it("penalizes stale repositories", () => {
    const fresh = scoreRepo(createRepo({ pushedAt: new Date().toISOString() }));
    const stale = scoreRepo(
      createRepo({
        pushedAt: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    );

    expect(fresh.score).toBeGreaterThan(stale.score);
    expect(fresh.breakdown.activity).toBeGreaterThan(stale.breakdown.activity);
  });
});

describe("scoreIssue", () => {
  it("rewards good first issue labels", () => {
    const beginner = scoreIssue(createIssue({ labels: ["good first issue"] }), [
      "good first issue",
    ]);
    const generic = scoreIssue(createIssue({ labels: ["maintenance"] }), [
      "good first issue",
    ]);

    expect(beginner.score).toBeGreaterThan(generic.score);
  });

  it("penalizes heavy discussion", () => {
    const light = scoreIssue(createIssue({ comments: 2 }));
    const heavy = scoreIssue(createIssue({ comments: 40 }));

    expect(light.score).toBeGreaterThan(heavy.score);
    expect(light.breakdown.discussionLoad).toBeGreaterThan(heavy.breakdown.discussionLoad);
  });
});
