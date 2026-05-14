import type { Repo, Issue, TechTag, ScoreResult, ScoreBreakdown } from '../types';

// ---- Weights (sum to 1.0) ----
const WEIGHTS = {
  languageMatch: 0.30,
  techStackMatch: 0.25,
  activeness: 0.15,
  community: 0.10,
  issueFriendliness: 0.10,
  freshness: 0.10,
};

// ---- Score a single repo against user preferences ----
export function scoreRepo(
  repo: Repo,
  preferences: {
    languages: TechTag[];
    frameworks: TechTag[];
    tools: TechTag[];
    minStars: number;
    maxStars: number;
    issueLabels: string[];
  }
): ScoreResult {
  const allTags = [
    ...preferences.languages,
    ...preferences.frameworks,
    ...preferences.tools,
  ];

  const matchedTags: string[] = [];
  const breakdown: ScoreBreakdown = {
    languageMatch: 0,
    techStackMatch: 0,
    activeness: 0,
    community: 0,
    issueFriendliness: 0,
    freshness: 0,
  };

  // 1. Language Match (0-100)
  if (repo.language) {
    const langTag = preferences.languages.find(
      (t) => t.name.toLowerCase() === repo.language!.toLowerCase()
    );
    if (langTag) {
      breakdown.languageMatch = 100 * langTag.weight;
      matchedTags.push(repo.language);
    }
  }

  // 2. Tech Stack Match (0-100) — match topics against user tags
  if (repo.topics && repo.topics.length > 0) {
    const repoTopicsLower = repo.topics.map((t) => t.toLowerCase());
    const descLower = (repo.description ?? '').toLowerCase();
    let matchScore = 0;
    let maxPossible = 0;

    for (const tag of allTags) {
      maxPossible += tag.weight;
      const tagLower = tag.name.toLowerCase();
      if (repoTopicsLower.includes(tagLower) || descLower.includes(tagLower)) {
        matchScore += tag.weight;
        matchedTags.push(tag.name);
      }
    }

    if (maxPossible > 0) {
      breakdown.techStackMatch = (matchScore / maxPossible) * 100;
    }
  }

  // 3. Activeness (0-100) — based on last update time
  const now = Date.now();
  const updatedAt = new Date(repo.updated_at).getTime();
  const daysSinceUpdate = (now - updatedAt) / (1000 * 60 * 60 * 24);

  if (daysSinceUpdate < 7) breakdown.activeness = 100;
  else if (daysSinceUpdate < 30) breakdown.activeness = 80;
  else if (daysSinceUpdate < 90) breakdown.activeness = 60;
  else if (daysSinceUpdate < 180) breakdown.activeness = 40;
  else if (daysSinceUpdate < 365) breakdown.activeness = 20;
  else breakdown.activeness = 5;

  // 4. Community / Stars (0-100) — bonus if in preferred range
  const stars = repo.stargazers_count;
  if (stars >= preferences.minStars && stars <= preferences.maxStars) {
    // Sweet spot — full score
    breakdown.community = 100;
  } else if (stars < preferences.minStars) {
    breakdown.community = Math.max(0, (stars / preferences.minStars) * 80);
  } else {
    // Over max — still decent but less ideal for new contributors
    breakdown.community = Math.max(40, 100 - ((stars - preferences.maxStars) / preferences.maxStars) * 60);
  }

  // 5. Issue Friendliness — based on open issue count
  if (repo.open_issues_count > 50) breakdown.issueFriendliness = 100;
  else if (repo.open_issues_count > 20) breakdown.issueFriendliness = 80;
  else if (repo.open_issues_count > 5) breakdown.issueFriendliness = 60;
  else if (repo.open_issues_count > 0) breakdown.issueFriendliness = 40;
  else breakdown.issueFriendliness = 0;

  // 6. Freshness — based on creation date (newer repos may have more low-hanging fruit)
  const createdAt = new Date(repo.created_at).getTime();
  const ageInDays = (now - createdAt) / (1000 * 60 * 60 * 24);

  if (ageInDays < 365) breakdown.freshness = 90;
  else if (ageInDays < 365 * 2) breakdown.freshness = 70;
  else if (ageInDays < 365 * 4) breakdown.freshness = 50;
  else breakdown.freshness = 30;

  // Calculate total
  const total = Math.round(
    breakdown.languageMatch * WEIGHTS.languageMatch +
    breakdown.techStackMatch * WEIGHTS.techStackMatch +
    breakdown.activeness * WEIGHTS.activeness +
    breakdown.community * WEIGHTS.community +
    breakdown.issueFriendliness * WEIGHTS.issueFriendliness +
    breakdown.freshness * WEIGHTS.freshness
  );

  // Generate recommendation
  const recommendation = generateRecommendation(total, matchedTags, breakdown);

  return {
    total: Math.min(100, total),
    breakdown,
    matchedTags: [...new Set(matchedTags)],
    recommendation,
  };
}

// ---- Score an issue ----
export function scoreIssue(
  issue: Issue,
  preferredLabels: string[]
): number {
  let score = 50; // Base score

  // Label matching
  const labelNames = issue.labels.map((l) => l.name.toLowerCase());
  for (const preferred of preferredLabels) {
    if (labelNames.includes(preferred.toLowerCase())) {
      score += 15;
    }
  }

  // Fewer comments = less competition = higher score
  if (issue.comments === 0) score += 15;
  else if (issue.comments < 3) score += 10;
  else if (issue.comments < 10) score += 5;

  // Freshness
  const now = Date.now();
  const createdAt = new Date(issue.created_at).getTime();
  const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);

  if (daysSinceCreation < 7) score += 15;
  else if (daysSinceCreation < 30) score += 10;
  else if (daysSinceCreation < 90) score += 5;

  // Body length — well-described issues are better
  if (issue.body) {
    const bodyLen = issue.body.length;
    if (bodyLen > 500) score += 10;
    else if (bodyLen > 200) score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

// ---- Generate recommendation text ----
function generateRecommendation(
  total: number,
  matchedTags: string[],
  breakdown: ScoreBreakdown
): string {
  if (total >= 80) {
    return `⭐ 高度匹配！技术栈完美契合${matchedTags.length > 0 ? `（${matchedTags.slice(0, 3).join('、')}）` : ''}，项目活跃，非常适合贡献。`;
  } else if (total >= 60) {
    const strengths: string[] = [];
    if (breakdown.languageMatch > 70) strengths.push('语言匹配');
    if (breakdown.activeness > 70) strengths.push('项目活跃');
    if (breakdown.community > 70) strengths.push('社区友好');
    return `👍 推荐！${strengths.join('、') || '多项指标'}表现良好，值得关注。`;
  } else if (total >= 40) {
    return `🔍 部分匹配。可以关注，但可能需要学习一些新技术。`;
  } else {
    return `💡 匹配度较低。如果对该领域感兴趣，也可以尝试。`;
  }
}

// ---- Get score color ----
export function getScoreColor(score: number): string {
  if (score >= 80) return '#66BB6A';
  if (score >= 60) return '#7C4DFF';
  if (score >= 40) return '#FFA726';
  return '#EF5350';
}

// ---- Get score label ----
export function getScoreLabel(score: number): string {
  if (score >= 80) return '极佳';
  if (score >= 60) return '推荐';
  if (score >= 40) return '一般';
  return '较低';
}
