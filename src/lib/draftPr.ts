import type { DraftPrArtifact, IssueCandidate, RepoCandidate, UserProfile } from "../domain/types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function createTemplateDraftPr(
  profile: UserProfile,
  issue: IssueCandidate,
  repo: RepoCandidate,
  providerUsed = "template-fallback",
  warnings: string[] = []
): DraftPrArtifact {
  const branchName = `issue/${issue.number}-${slugify(issue.title)}`;
  const title = `[${repo.name}] ${issue.title}`;
  const implementationPlan = [
    "Read the touched module boundaries and confirm existing contribution guidance.",
    "Reproduce or restate the current issue in terms of user-visible behavior.",
    "Implement the narrowest change that resolves the issue without broad refactors.",
    "Add or update tests/docs only where the change introduces new behavior.",
    "Validate with the repository's documented local checks before opening the PR."
  ];
  const validationChecklist = [
    "Behavior matches the issue acceptance criteria",
    "No unrelated refactor slipped into the change",
    "Tests or manual verification notes are included",
    "PR body explains tradeoffs and any follow-up ideas"
  ];
  const commitPlan = [
    "chore: capture failing behavior or notes",
    "fix: implement the focused issue change",
    "test/docs: cover the behavior and update supporting notes"
  ];

  const prBody = [
    "## Summary",
    `- Addresses #${issue.number} in \`${repo.fullName}\`.`,
    `- Focuses on a narrow change aligned with ${profile.displayName || "the configured contributor profile"}.`,
    "",
    "## Proposed Implementation",
    bulletList(implementationPlan),
    "",
    "## Validation",
    bulletList(validationChecklist)
  ].join("\n");

  const assistantPrompt = [
    `You are helping implement GitHub issue #${issue.number} from ${repo.fullName}.`,
    `Issue title: ${issue.title}`,
    `Issue summary: ${issue.bodyExcerpt}`,
    `Repository context: ${repo.description}`,
    `Contributor profile: ${JSON.stringify(profile)}`,
    `Scoring rationale: ${issue.scoreBreakdown.reasons.join("; ") || "No positive reasons recorded."}`,
    "Produce a minimal implementation plan and code change outline that avoids broad refactors."
  ].join("\n");

  return {
    createdAt: new Date().toISOString(),
    branchName,
    title,
    summary: `Focused draft PR for issue #${issue.number} in ${repo.fullName}.`,
    problemStatement: issue.bodyExcerpt || issue.title,
    implementationPlan,
    validationChecklist,
    commitPlan,
    prBody,
    assistantPrompt,
    providerUsed,
    warnings
  };
}

