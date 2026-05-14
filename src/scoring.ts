import type {
  IssueCandidate,
  IssueScoreBreakdown,
  IssueScoreResult,
  RepoCandidate,
  RepoScoreBreakdown,
  RepoScoreResult,
} from "./types.js";

const REPO_WEIGHTS = {
  languageMatch: 0.3,
  topicMatch: 0.25,
  activity: 0.15,
  community: 0.1,
  issueFriendliness: 0.1,
  freshness: 0.1,
} as const;

const ISSUE_WEIGHTS = {
  labelMatch: 0.3,
  clarity: 0.2,
  discussionLoad: 0.15,
  freshness: 0.15,
  beginnerFriendliness: 0.2,
} as const;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function daysSince(isoString?: string | null): number | null {
  if (!isoString) {
    return null;
  }

  const parsed = Date.parse(isoString);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return (Date.now() - parsed) / (1000 * 60 * 60 * 24);
}

function scaleStars(stars: number, minStars?: number, maxStars?: number): number {
  if (minStars === undefined && maxStars === undefined) {
    if (stars >= 1000) {
      return 100;
    }
    if (stars >= 250) {
      return 85;
    }
    if (stars >= 50) {
      return 70;
    }
    if (stars >= 10) {
      return 55;
    }
    return 35;
  }

  if (minStars !== undefined && stars < minStars) {
    return Math.max(0, Math.round((stars / Math.max(minStars, 1)) * 70));
  }

  if (maxStars !== undefined && stars > maxStars) {
    const overflow = stars - maxStars;
    const divisor = Math.max(maxStars, 1);
    return Math.max(35, Math.round(100 - (overflow / divisor) * 60));
  }

  return 100;
}

export function scoreRepo(
  repo: RepoCandidate,
  preferences: {
    languages?: string[];
    topics?: string[];
    minStars?: number;
    maxStars?: number;
  } = {},
): RepoScoreResult {
  const preferredLanguages = preferences.languages?.map(normalize) ?? [];
  const preferredTopics = preferences.topics?.map(normalize) ?? [];
  const repoLanguage = repo.language ? normalize(repo.language) : null;
  const repoTopics = repo.topics.map(normalize);
  const repoDescription = normalize(repo.description ?? "");

  const breakdown: RepoScoreBreakdown = {
    languageMatch:
      preferredLanguages.length === 0
        ? 70
        : repoLanguage && preferredLanguages.includes(repoLanguage)
          ? 100
          : 0,
    topicMatch: 0,
    activity: 0,
    community: scaleStars(repo.stars, preferences.minStars, preferences.maxStars),
    issueFriendliness: 0,
    freshness: 0,
  };
  const reasons: string[] = [];

  if (preferredTopics.length === 0) {
    breakdown.topicMatch = 60;
  } else {
    const matches = preferredTopics.filter(
      (topic) => repoTopics.includes(topic) || repoDescription.includes(topic),
    );
    breakdown.topicMatch = Math.round((matches.length / preferredTopics.length) * 100);
    if (matches.length > 0) {
      reasons.push(`Matches preferred topics: ${matches.slice(0, 3).join(", ")}`);
    }
  }

  if (breakdown.languageMatch === 100 && repo.language) {
    reasons.push(`Matches preferred language: ${repo.language}`);
  }

  const pushedDays = daysSince(repo.pushedAt);
  if (pushedDays === null) {
    breakdown.activity = 40;
  } else if (pushedDays <= 7) {
    breakdown.activity = 100;
    reasons.push("Recently active repository");
  } else if (pushedDays <= 30) {
    breakdown.activity = 85;
  } else if (pushedDays <= 90) {
    breakdown.activity = 65;
  } else if (pushedDays <= 180) {
    breakdown.activity = 45;
  } else {
    breakdown.activity = 20;
    reasons.push("Repository activity is stale");
  }

  if (repo.openIssues >= 100) {
    breakdown.issueFriendliness = 95;
  } else if (repo.openIssues >= 30) {
    breakdown.issueFriendliness = 80;
  } else if (repo.openIssues >= 10) {
    breakdown.issueFriendliness = 65;
  } else if (repo.openIssues >= 1) {
    breakdown.issueFriendliness = 45;
  } else {
    breakdown.issueFriendliness = 10;
  }

  if (repo.openIssues >= 10) {
    reasons.push("Has an active issue queue for contributors");
  }

  const freshnessSource = daysSince(repo.createdAt ?? repo.pushedAt);
  if (freshnessSource === null) {
    breakdown.freshness = 50;
  } else if (freshnessSource <= 30) {
    breakdown.freshness = 95;
  } else if (freshnessSource <= 180) {
    breakdown.freshness = 80;
  } else if (freshnessSource <= 365) {
    breakdown.freshness = 65;
  } else if (freshnessSource <= 365 * 3) {
    breakdown.freshness = 50;
  } else {
    breakdown.freshness = 30;
  }

  if (breakdown.community >= 85) {
    reasons.push("Repository has healthy community signals");
  }

  const score = Math.round(
    breakdown.languageMatch * REPO_WEIGHTS.languageMatch +
      breakdown.topicMatch * REPO_WEIGHTS.topicMatch +
      breakdown.activity * REPO_WEIGHTS.activity +
      breakdown.community * REPO_WEIGHTS.community +
      breakdown.issueFriendliness * REPO_WEIGHTS.issueFriendliness +
      breakdown.freshness * REPO_WEIGHTS.freshness,
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown,
    reasons,
  };
}

export function scoreIssue(
  issue: IssueCandidate,
  preferredLabels: string[] = [],
): IssueScoreResult {
  const normalizedLabels = issue.labels.map(normalize);
  const preferred = preferredLabels.map(normalize);
  const bodyLength = (issue.body ?? "").trim().length;
  const freshnessDays = daysSince(issue.updatedAt ?? issue.createdAt);

  const preferredMatches = preferred.filter((label) => normalizedLabels.includes(label));
  const beginnerSignals = [
    "good first issue",
    "help wanted",
    "beginner",
    "documentation",
    "bug",
  ];

  const breakdown: IssueScoreBreakdown = {
    labelMatch:
      preferred.length === 0
        ? 60
        : Math.min(100, preferredMatches.length * 30),
    clarity: 0,
    discussionLoad: 0,
    freshness: 0,
    beginnerFriendliness: 0,
  };
  const reasons: string[] = [];

  if (preferredMatches.length > 0) {
    reasons.push(`Matches preferred labels: ${preferredMatches.join(", ")}`);
  }

  if (bodyLength >= 800) {
    breakdown.clarity = 100;
  } else if (bodyLength >= 300) {
    breakdown.clarity = 85;
    reasons.push("Issue body has enough implementation context");
  } else if (bodyLength >= 120) {
    breakdown.clarity = 65;
  } else if (bodyLength > 0) {
    breakdown.clarity = 35;
    reasons.push("Issue body is short");
  } else {
    breakdown.clarity = 10;
    reasons.push("Issue body is missing");
  }

  if (issue.comments <= 2) {
    breakdown.discussionLoad = 100;
    reasons.push("Discussion is lightweight");
  } else if (issue.comments <= 5) {
    breakdown.discussionLoad = 85;
  } else if (issue.comments <= 10) {
    breakdown.discussionLoad = 65;
  } else if (issue.comments <= 20) {
    breakdown.discussionLoad = 40;
  } else {
    breakdown.discussionLoad = 10;
    reasons.push("Heavy discussion may increase complexity");
  }

  if (freshnessDays === null) {
    breakdown.freshness = 50;
  } else if (freshnessDays <= 7) {
    breakdown.freshness = 100;
    reasons.push("Recently updated issue");
  } else if (freshnessDays <= 30) {
    breakdown.freshness = 85;
  } else if (freshnessDays <= 90) {
    breakdown.freshness = 65;
  } else if (freshnessDays <= 180) {
    breakdown.freshness = 45;
  } else {
    breakdown.freshness = 20;
    reasons.push("Issue has been inactive for a while");
  }

  const beginnerMatches = beginnerSignals.filter((label) => normalizedLabels.includes(label));
  breakdown.beginnerFriendliness = Math.min(100, beginnerMatches.length * 25);
  if (beginnerMatches.length > 0) {
    reasons.push(`Beginner-friendly labels present: ${beginnerMatches.join(", ")}`);
  }

  const score = Math.round(
    breakdown.labelMatch * ISSUE_WEIGHTS.labelMatch +
      breakdown.clarity * ISSUE_WEIGHTS.clarity +
      breakdown.discussionLoad * ISSUE_WEIGHTS.discussionLoad +
      breakdown.freshness * ISSUE_WEIGHTS.freshness +
      breakdown.beginnerFriendliness * ISSUE_WEIGHTS.beginnerFriendliness,
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown,
    reasons,
  };
}

export function estimateIssueDifficulty(
  issue: IssueCandidate,
  score: number,
): "easy" | "medium" | "hard" {
  const labels = issue.labels.map(normalize);
  if (
    labels.includes("good first issue") ||
    labels.includes("beginner") ||
    (score >= 80 && issue.comments <= 5)
  ) {
    return "easy";
  }

  if (issue.comments > 20 || (issue.body ?? "").length < 60 || score < 45) {
    return "hard";
  }

  return "medium";
}

export function estimateIssueTime(
  difficulty: "easy" | "medium" | "hard",
): string {
  switch (difficulty) {
    case "easy":
      return "30-120 minutes";
    case "medium":
      return "2-6 hours";
    case "hard":
      return "1-3 days";
    default:
      return "Unknown";
  }
}
