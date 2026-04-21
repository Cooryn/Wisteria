import { fireEvent, render, screen } from "@testing-library/react";
import { RecommendationsPanel } from "./RecommendationsPanel";
import type { IssueCandidate } from "../domain/types";

const baseIssue: IssueCandidate = {
  issueId: 1,
  number: 1,
  title: "Fix focused bug",
  bodyExcerpt: "Small issue",
  htmlUrl: "https://github.com/example/repo/issues/1",
  labels: ["bug"],
  comments: 1,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-20T00:00:00.000Z",
  author: "alice",
  assignees: [],
  scoreBreakdown: {
    labelBonus: 10,
    difficultyScore: 8,
    timeFitScore: 12,
    maintainerScore: 10,
    riskPenalty: 0,
    total: 65,
    reasons: ["Good fit"],
    riskFlags: []
  },
  recommendationSummary: "Good fit",
  repo: {
    repoId: 1,
    ownerLogin: "example",
    name: "repo",
    fullName: "example/repo",
    htmlUrl: "https://github.com/example/repo",
    description: "Repository",
    primaryLanguage: "TypeScript",
    topics: ["react"],
    licenseSpdx: "MIT",
    stars: 10,
    forks: 2,
    openIssues: 3,
    archived: false,
    pushedAt: "2026-04-18T00:00:00.000Z",
    healthScore: 30,
    profileScore: 20,
    totalScore: 50,
    matchReasons: ["Topic overlap"]
  }
};

describe("RecommendationsPanel", () => {
  it("filters by free-text match", () => {
    const onSelect = vi.fn();
    render(
      <RecommendationsPanel
        issues={[baseIssue]}
        selectedIssueId={null}
        sortMode="score"
        filterText=""
        onSortChange={() => undefined}
        onFilterTextChange={() => undefined}
        onSelectIssue={onSelect}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /fix focused bug/i }));
    expect(onSelect).toHaveBeenCalled();
  });
});

