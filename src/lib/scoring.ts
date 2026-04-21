import type {
  IssueCandidate,
  RepoCandidate,
  RepoSizePreference,
  ScoreBreakdown,
  UserProfile
} from "../domain/types";

interface RawIssueLike {
  title: string;
  body: string;
  labels: string[];
  comments: number;
  updatedAt: string;
  assignees: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function daysSince(dateValue: string | null | undefined): number {
  if (!dateValue) {
    return 9999;
  }

  const timestamp = Date.parse(dateValue);
  if (Number.isNaN(timestamp)) {
    return 9999;
  }

  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
}

function lower(values: string[]): string[] {
  return values.map((value) => value.toLowerCase());
}

function bodyKeywordHit(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function estimateRepoSize(stars: number, openIssues: number): RepoSizePreference {
  if (stars < 200 && openIssues < 80) {
    return "small";
  }

  if (stars < 2000 && openIssues < 300) {
    return "medium";
  }

  return "mixed";
}

export function scoreRepository(profile: UserProfile, repo: RepoCandidate): RepoCandidate {
  const reasons: string[] = [];
  const languageMatches = profile.languages.filter(
    (language) =>
      language.toLowerCase() === (repo.primaryLanguage ?? "").toLowerCase()
  );
  const topicMatches = [
    ...profile.frameworks.filter((item) =>
      repo.topics.some((topic) => topic.toLowerCase() === item.toLowerCase())
    ),
    ...profile.interestDomains.filter((item) =>
      repo.topics.some((topic) => topic.toLowerCase() === item.toLowerCase())
    )
  ];

  let profileScore = 22;
  profileScore += languageMatches.length * 10;
  profileScore += topicMatches.length * 7;

  if (repo.description && bodyKeywordHit(repo.description, profile.frameworks)) {
    profileScore += 6;
    reasons.push("Description mirrors your framework interests");
  }

  if (repo.description && bodyKeywordHit(repo.description, profile.interestDomains)) {
    profileScore += 6;
    reasons.push("Description lines up with your interest domains");
  }

  let healthScore = 24;
  healthScore += repo.stars >= 100 ? 10 : 4;
  healthScore += repo.forks >= 20 ? 8 : 2;
  healthScore += repo.openIssues >= 10 ? 6 : 1;
  healthScore += daysSince(repo.pushedAt) <= 45 ? 10 : 2;
  healthScore -= repo.archived ? 30 : 0;

  const estimatedSize = estimateRepoSize(repo.stars, repo.openIssues);
  if (
    profile.repoSizePreference !== "mixed" &&
    profile.repoSizePreference === estimatedSize
  ) {
    profileScore += 6;
    reasons.push(`Repository size roughly matches your ${profile.repoSizePreference} preference`);
  }

  if (languageMatches.length > 0) {
    reasons.push(`Primary language matches: ${languageMatches.join(", ")}`);
  }

  if (topicMatches.length > 0) {
    reasons.push(`Topic overlap: ${[...new Set(topicMatches)].join(", ")}`);
  }

  if (repo.licenseSpdx && profile.excludeLicenses.includes(repo.licenseSpdx)) {
    profileScore -= 20;
    reasons.push(`Penalty for excluded license ${repo.licenseSpdx}`);
  }

  const totalScore = clamp(profileScore + healthScore, 0, 100);

  return {
    ...repo,
    profileScore: clamp(profileScore, 0, 50),
    healthScore: clamp(healthScore, 0, 50),
    totalScore,
    matchReasons: [...new Set(reasons)].slice(0, 5)
  };
}

export function scoreIssue(
  profile: UserProfile,
  issue: RawIssueLike
): ScoreBreakdown {
  const labels = lower(issue.labels);
  const titleAndBody = `${issue.title}\n${issue.body}`.toLowerCase();
  const reasons: string[] = [];
  const riskFlags: string[] = [];

  let labelBonus = 0;
  if (labels.some((label) => label.includes("good first issue"))) {
    labelBonus += 25;
    reasons.push("Tagged as a good first issue");
  }
  if (labels.some((label) => label.includes("help wanted"))) {
    labelBonus += 18;
    reasons.push("Maintainers are explicitly asking for help");
  }
  if (labels.some((label) => label.includes("documentation"))) {
    labelBonus += 10;
    reasons.push("Documentation work fits limited time budgets well");
  }
  if (labels.some((label) => label.includes("bug"))) {
    labelBonus += 9;
    reasons.push("Bug label keeps the task concrete");
  }
  if (labels.some((label) => label.includes("test"))) {
    labelBonus += 8;
    reasons.push("Testing work is often easier to scope");
  }
  labelBonus = clamp(labelBonus, 0, 35);

  const bodyLength = issue.body.trim().length;
  const discussionScore =
    issue.comments <= 6 ? 10 : issue.comments <= 14 ? 6 : issue.comments <= 25 ? 2 : -6;
  const scopePenalty =
    bodyKeywordHit(titleAndBody, ["rewrite", "architecture", "redesign", "migration", "security"]) ? 12 : 0;
  const sizePenalty = bodyLength > 3500 ? 8 : bodyLength > 1800 ? 4 : 0;

  let difficultyScore = 16 - scopePenalty - sizePenalty + discussionScore;
  if (profile.difficultyPreference === "easy") {
    difficultyScore += labels.some((label) => label.includes("good first issue")) ? 6 : -2;
  }
  if (profile.difficultyPreference === "medium") {
    difficultyScore += issue.comments > 3 ? 4 : 0;
  }
  difficultyScore = clamp(difficultyScore, -10, 22);

  let timeFitScore = profile.weeklyHours <= 4 ? 14 : profile.weeklyHours <= 8 ? 11 : 8;
  if (labels.some((label) => label.includes("documentation"))) {
    timeFitScore += 6;
  }
  if (labels.some((label) => label.includes("tests"))) {
    timeFitScore += 4;
  }
  if (bodyKeywordHit(titleAndBody, ["refactor across", "entire app", "all modules", "multi-package"])) {
    timeFitScore -= 10;
  }
  timeFitScore = clamp(timeFitScore, -8, 20);

  const updatedDays = daysSince(issue.updatedAt);
  let maintainerScore = updatedDays <= 14 ? 14 : updatedDays <= 45 ? 8 : 0;
  maintainerScore += issue.comments >= 1 && issue.comments <= 12 ? 5 : 0;
  maintainerScore -= issue.assignees.length > 1 ? 4 : 0;
  maintainerScore = clamp(maintainerScore, -6, 20);

  let riskPenalty = 0;
  if (scopePenalty > 0) {
    riskPenalty -= scopePenalty;
    riskFlags.push("Large-scope keywords suggest a broad change");
  }
  if (issue.comments > 25) {
    riskPenalty -= 10;
    riskFlags.push("Long discussion thread may hide coordination overhead");
  }
  if (issue.assignees.length > 1) {
    riskPenalty -= 10;
    riskFlags.push("Issue already has multiple assignees");
  }
  if (bodyLength < 120) {
    riskPenalty -= 8;
    riskFlags.push("Issue description is thin");
  }
  if (bodyKeywordHit(titleAndBody, profile.excludeKeywords)) {
    riskPenalty -= 14;
    riskFlags.push("Contains one of your excluded keywords");
  }
  riskPenalty = clamp(riskPenalty, -35, 0);

  const total = clamp(
    20 + labelBonus + difficultyScore + timeFitScore + maintainerScore + riskPenalty,
    0,
    100
  );

  return {
    labelBonus,
    difficultyScore,
    timeFitScore,
    maintainerScore,
    riskPenalty,
    total,
    reasons: [...new Set(reasons)],
    riskFlags
  };
}

export function summarizeIssueRecommendation(
  issue: Pick<IssueCandidate, "scoreBreakdown" | "repo">
): string {
  const highlights = issue.scoreBreakdown.reasons.slice(0, 2);
  const repoReason = issue.repo.matchReasons[0];
  return [repoReason, ...highlights].filter(Boolean).join(" · ");
}

