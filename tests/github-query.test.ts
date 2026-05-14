import { describe, expect, it } from "vitest";

import { buildRepoSearchPlan, buildRepoSearchQuery } from "../src/github.js";

describe("buildRepoSearchQuery", () => {
  it("includes language filters", () => {
    const query = buildRepoSearchQuery({ language: "TypeScript" }, 0);
    expect(query).toContain("language:TypeScript");
  });

  it("includes topic filters", () => {
    const query = buildRepoSearchQuery({ language: "TypeScript", topics: ["react"] }, 0);
    expect(query).toContain("topic:react");
  });

  it("includes star ranges", () => {
    const query = buildRepoSearchQuery(
      { language: "TypeScript", minStars: 100, maxStars: 5000 },
      0,
    );
    expect(query).toContain("stars:100..5000");
  });

  it("includes has:issues by default", () => {
    const query = buildRepoSearchQuery({ language: "TypeScript" }, 0);
    expect(query).toContain("has:issues");
  });

  it("excludes archived repositories by default", () => {
    const query = buildRepoSearchQuery({ language: "TypeScript" }, 0);
    expect(query).toContain("archived:false");
  });
});

describe("buildRepoSearchPlan", () => {
  it("builds the documented fallback order", () => {
    const plan = buildRepoSearchPlan({
      languages: ["TypeScript"],
      topics: ["react"],
      minStars: 100,
      maxStars: 5000,
    });

    expect(plan.map((round) => round.fallbackLevel)).toEqual([0, 1, 2, 3]);
    expect(plan[0]?.query).toContain("topic:react");
    expect(plan[1]?.query).not.toContain("topic:react");
    expect(plan[2]?.query).not.toContain("stars:");
    expect(plan[3]?.query).toBe("has:issues archived:false");
  });
});
