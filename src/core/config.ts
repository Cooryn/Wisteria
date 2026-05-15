import type { DailyDigestParams, RepoSearchParams, WisteriaConfig } from "./types.js";

export const DEFAULT_ISSUE_LABELS = [
  "good first issue",
  "help wanted",
  "beginner",
  "documentation",
  "bug",
] as const;

export const DEFAULT_DAILY_DIGEST = {
  enabled: false,
  timezone: "Asia/Tokyo",
  hour: 9,
  limit: 5,
  minScore: 60,
} as const;

export const pluginConfigJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    githubToken: {
      type: "string",
      description:
        "Optional GitHub personal access token. Strongly recommended for search to avoid rate limits and required for fork, branch push, and draft pull request creation.",
    },
    defaultWorkDir: {
      type: "string",
      description: "Default local directory where repositories are cloned.",
    },
    defaultLanguages: {
      type: "array",
      items: { type: "string" },
      description:
        "Default programming languages used for repository discovery.",
    },
    defaultTopics: {
      type: "array",
      items: { type: "string" },
      description: "Default GitHub topics or frameworks used for repository discovery.",
    },
    defaultLabels: {
      type: "array",
      items: { type: "string" },
      default: [...DEFAULT_ISSUE_LABELS],
      description: "Default issue labels used for issue discovery.",
    },
    minStars: {
      type: "number",
      minimum: 0,
      description: "Minimum repository stars.",
    },
    maxStars: {
      type: "number",
      minimum: 0,
      description: "Maximum repository stars.",
    },
    allowGitCommands: {
      type: "boolean",
      default: false,
      description: "Whether tools that execute local git commands may run.",
    },
    dailyDigest: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean", default: false },
        timezone: { type: "string", default: "Asia/Tokyo" },
        hour: { type: "number", default: 9, minimum: 0, maximum: 23 },
        limit: { type: "number", default: 5, minimum: 1, maximum: 20 },
        minScore: { type: "number", default: 60, minimum: 0, maximum: 100 },
      },
    },
  },
} as const;

export const pluginConfigUiHints = {
  githubToken: {
    label: "GitHub Token",
    sensitive: true,
  },
  defaultWorkDir: {
    label: "Default working directory",
    placeholder: "~/code/open-source",
  },
  allowGitCommands: {
    label: "Allow local Git commands",
  },
  dailyDigest: {
    label: "Daily Issue Digest",
  },
} as const;

function normalizeStringList(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const normalized = [...new Set(
    input
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean),
  )];

  return normalized.length > 0 ? normalized : undefined;
}

function readOptionalString(input: unknown): string | undefined {
  if (typeof input !== "string") {
    return undefined;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalNumber(input: unknown): number | undefined {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return undefined;
  }

  return input;
}

function readOptionalBoolean(input: unknown): boolean | undefined {
  return typeof input === "boolean" ? input : undefined;
}

export function resolveConfig(raw: unknown): WisteriaConfig {
  const record =
    raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const dailyDigestRaw =
    record.dailyDigest !== null && typeof record.dailyDigest === "object"
      ? (record.dailyDigest as Record<string, unknown>)
      : {};

  const minStars = readOptionalNumber(record.minStars);
  const maxStars = readOptionalNumber(record.maxStars);
  const config: WisteriaConfig = {
    githubToken: typeof record.githubToken === "string" ? record.githubToken.trim() : "",
    defaultLabels:
      normalizeStringList(record.defaultLabels) ?? [...DEFAULT_ISSUE_LABELS],
    allowGitCommands: readOptionalBoolean(record.allowGitCommands) ?? false,
    dailyDigest: {
      enabled: readOptionalBoolean(dailyDigestRaw.enabled) ?? DEFAULT_DAILY_DIGEST.enabled,
      timezone:
        readOptionalString(dailyDigestRaw.timezone) ?? DEFAULT_DAILY_DIGEST.timezone,
      hour: readOptionalNumber(dailyDigestRaw.hour) ?? DEFAULT_DAILY_DIGEST.hour,
      limit: readOptionalNumber(dailyDigestRaw.limit) ?? DEFAULT_DAILY_DIGEST.limit,
      minScore:
        readOptionalNumber(dailyDigestRaw.minScore) ?? DEFAULT_DAILY_DIGEST.minScore,
    },
  };

  const defaultWorkDir = readOptionalString(record.defaultWorkDir);
  if (defaultWorkDir) {
    config.defaultWorkDir = defaultWorkDir;
  }

  const defaultLanguages = normalizeStringList(record.defaultLanguages);
  if (defaultLanguages) {
    config.defaultLanguages = defaultLanguages;
  }

  const defaultTopics = normalizeStringList(record.defaultTopics);
  if (defaultTopics) {
    config.defaultTopics = defaultTopics;
  }

  if (minStars !== undefined) {
    config.minStars = minStars;
  }

  const normalizedMaxStars =
    minStars !== undefined && maxStars !== undefined && maxStars < minStars
      ? minStars
      : maxStars;
  if (normalizedMaxStars !== undefined) {
    config.maxStars = normalizedMaxStars;
  }

  return config;
}

export function withRepoSearchDefaults(
  config: WisteriaConfig,
  params: RepoSearchParams,
): Required<Pick<RepoSearchParams, "includeArchived" | "limit">> & RepoSearchParams {
  const result: Required<Pick<RepoSearchParams, "includeArchived" | "limit">> &
    RepoSearchParams = {
    includeArchived: params.includeArchived ?? false,
    limit: params.limit ?? 10,
  };

  const languages = params.languages?.length ? params.languages : config.defaultLanguages;
  if (languages) {
    result.languages = languages;
  }

  const topics = params.topics?.length ? params.topics : config.defaultTopics;
  if (topics) {
    result.topics = topics;
  }

  const minStars = params.minStars ?? config.minStars;
  if (minStars !== undefined) {
    result.minStars = minStars;
  }

  const maxStars = params.maxStars ?? config.maxStars;
  if (maxStars !== undefined) {
    result.maxStars = maxStars;
  }

  return result;
}

export function withDigestDefaults(
  config: WisteriaConfig,
  params: DailyDigestParams,
): Required<Pick<DailyDigestParams, "limit" | "maxIssuesPerRepo" | "minScore">> &
  DailyDigestParams {
  const result: Required<Pick<DailyDigestParams, "limit" | "maxIssuesPerRepo" | "minScore">> &
    DailyDigestParams = {
    limit: params.limit ?? config.dailyDigest?.limit ?? DEFAULT_DAILY_DIGEST.limit,
    maxIssuesPerRepo: params.maxIssuesPerRepo ?? 2,
    minScore:
      params.minScore ?? config.dailyDigest?.minScore ?? DEFAULT_DAILY_DIGEST.minScore,
  };

  const languages = params.languages?.length ? params.languages : config.defaultLanguages;
  if (languages) {
    result.languages = languages;
  }

  const topics = params.topics?.length ? params.topics : config.defaultTopics;
  if (topics) {
    result.topics = topics;
  }

  const labels = params.labels?.length ? params.labels : config.defaultLabels;
  if (labels) {
    result.labels = labels;
  }

  return result;
}

export function ensureGitHubToken(config: WisteriaConfig): string {
  return config.githubToken.trim();
}
