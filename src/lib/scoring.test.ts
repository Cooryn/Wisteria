import { defaultProfile } from "../domain/types";
import { scoreIssue, scoreRepository } from "./scoring";

describe("scoreRepository", () => {
  it("rewards repositories that match preferred language and topics", () => {
    const result = scoreRepository(defaultProfile, {
      repoId: 1,
      ownerLogin: "tauri-apps",
      name: "wisteria",
      fullName: "tauri-apps/wisteria",
      htmlUrl: "https://github.com/tauri-apps/wisteria",
      description: "A React + Tauri developer-tooling app",
      primaryLanguage: "TypeScript",
      topics: ["react", "developer-tooling"],
      licenseSpdx: "MIT",
      stars: 500,
      forks: 120,
      openIssues: 42,
      archived: false,
      pushedAt: new Date().toISOString(),
      healthScore: 0,
      profileScore: 0,
      totalScore: 0,
      matchReasons: []
    });

    expect(result.totalScore).toBeGreaterThan(60);
    expect(result.matchReasons.join(" ")).toContain("Topic overlap");
  });
});

describe("scoreIssue", () => {
  it("rewards good-first-issue and help-wanted labels while penalizing risky keywords", () => {
    const result = scoreIssue(defaultProfile, {
      title: "Good first issue: fix docs typo in React desktop flow",
      body: "A small documentation fix. No refactor required.",
      labels: ["good first issue", "documentation", "help wanted"],
      comments: 2,
      updatedAt: new Date().toISOString(),
      assignees: []
    });

    expect(result.labelBonus).toBeGreaterThan(20);
    expect(result.total).toBeGreaterThan(55);
    expect(result.riskPenalty).toBeLessThanOrEqual(0);
  });
});

