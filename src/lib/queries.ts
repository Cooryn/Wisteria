import type { QuerySnapshot, UserProfile } from "../domain/types";

const LOOKBACK_DAYS = 365;

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function uniqueNormalized(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function limit(items: string[], count: number): string[] {
  return items.slice(0, count);
}

export function buildRepositoryQuery(profile: UserProfile): QuerySnapshot {
  const languages = limit(uniqueNormalized(profile.languages), 3);
  const frameworks = limit(uniqueNormalized(profile.frameworks), 4);
  const domains = limit(uniqueNormalized(profile.interestDomains), 4);
  const keywords = [...frameworks, ...domains].map((item) =>
    item.replace(/\s+/g, "-")
  );

  const clauses = [
    "is:public",
    "archived:false",
    "stars:>=20",
    `pushed:>=${daysAgoIso(LOOKBACK_DAYS)}`
  ];

  for (const language of languages) {
    clauses.push(`language:${JSON.stringify(language)}`);
  }

  for (const keyword of keywords) {
    clauses.push(JSON.stringify(keyword));
  }

  return {
    repositoryQuery: clauses.join(" "),
    requestedLanguages: languages,
    requestedFrameworks: frameworks,
    requestedDomains: domains
  };
}

export function describeQuery(snapshot: QuerySnapshot): string[] {
  const reasons: string[] = [];

  if (snapshot.requestedLanguages.length > 0) {
    reasons.push(`Language focus: ${snapshot.requestedLanguages.join(", ")}`);
  }

  if (snapshot.requestedFrameworks.length > 0) {
    reasons.push(`Framework keywords: ${snapshot.requestedFrameworks.join(", ")}`);
  }

  if (snapshot.requestedDomains.length > 0) {
    reasons.push(`Interest domains: ${snapshot.requestedDomains.join(", ")}`);
  }

  return reasons;
}

