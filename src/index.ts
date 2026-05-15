import { Type } from "@sinclair/typebox";
import {
  buildJsonPluginConfigSchema,
  definePluginEntry,
  jsonResult,
} from "openclaw/plugin-sdk/core";

import {
  pluginConfigJsonSchema,
  pluginConfigUiHints,
  resolveConfig,
  withRepoSearchDefaults,
} from "./core/config.js";
import { generateDailyIssueDigest } from "./github/daily-digest.js";
import { toToolError } from "./core/errors.js";
import { createGitHubClient, searchRepositories } from "./github/client.js";
import { getIssueContext, searchIssues } from "./github/issues.js";
import { createDraftPrFromWorkspace } from "./workspace/pr.js";
import { estimateIssueDifficulty, estimateIssueTime, scoreIssue, scoreRepo } from "./github/scoring.js";
import { checkWorkspaceStatus, prepareContributionWorkspace } from "./workspace/workspace.js";
import type {
  DailyDigestParams,
  IssueCandidate,
  IssueSearchParams,
  WisteriaPreferencesResult,
  RepoCandidate,
  RepoSearchParams,
  ToolResult,
} from "./core/types.js";

export const wisteriaToolNames = [
  "wisteria_get_preferences",
  "wisteria_search_repos",
  "wisteria_search_issues",
  "wisteria_score_repo",
  "wisteria_score_issue",
  "wisteria_get_issue_context",
  "wisteria_daily_issue_digest",
  "wisteria_prepare_contribution",
  "wisteria_check_workspace",
  "wisteria_create_draft_pr",
] as const;

function ok<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}

async function executeSafely<T>(run: () => Promise<T>) {
  try {
    return jsonResult(ok(await run()));
  } catch (error) {
    return jsonResult(toToolError(error));
  }
}

const repoSearchSchema = Type.Object(
  {
    languages: Type.Optional(Type.Array(Type.String())),
    topics: Type.Optional(Type.Array(Type.String())),
    minStars: Type.Optional(Type.Number({ minimum: 0 })),
    maxStars: Type.Optional(Type.Number({ minimum: 0 })),
    includeArchived: Type.Optional(Type.Boolean()),
    limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
  },
  { additionalProperties: false },
);

const getPreferencesSchema = Type.Object({}, { additionalProperties: false });

const issueSearchSchema = Type.Object(
  {
    repoFullName: Type.String({ minLength: 3 }),
    labels: Type.Optional(Type.Array(Type.String())),
    state: Type.Optional(
      Type.Union([Type.Literal("open"), Type.Literal("closed"), Type.Literal("all")]),
    ),
    limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
  },
  { additionalProperties: false },
);

const scoreRepoSchema = Type.Object(
  {
    repo: Type.Object(
      {
        fullName: Type.String(),
        language: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        topics: Type.Optional(Type.Array(Type.String())),
        stars: Type.Optional(Type.Number({ minimum: 0 })),
        forks: Type.Optional(Type.Number({ minimum: 0 })),
        openIssues: Type.Optional(Type.Number({ minimum: 0 })),
        pushedAt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        createdAt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      },
      { additionalProperties: false },
    ),
    preferences: Type.Optional(
      Type.Object(
        {
          languages: Type.Optional(Type.Array(Type.String())),
          topics: Type.Optional(Type.Array(Type.String())),
          minStars: Type.Optional(Type.Number({ minimum: 0 })),
          maxStars: Type.Optional(Type.Number({ minimum: 0 })),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const scoreIssueSchema = Type.Object(
  {
    issue: Type.Object(
      {
        title: Type.String(),
        body: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        labels: Type.Optional(Type.Array(Type.String())),
        comments: Type.Optional(Type.Number({ minimum: 0 })),
        createdAt: Type.Optional(Type.String()),
        updatedAt: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    preferredLabels: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

const issueContextSchema = Type.Object(
  {
    repoFullName: Type.String(),
    issueNumber: Type.Number({ minimum: 1 }),
    includeComments: Type.Optional(Type.Boolean()),
    maxComments: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

const dailyDigestSchema = Type.Object(
  {
    languages: Type.Optional(Type.Array(Type.String())),
    topics: Type.Optional(Type.Array(Type.String())),
    labels: Type.Optional(Type.Array(Type.String())),
    limit: Type.Optional(Type.Number({ minimum: 1, maximum: 20 })),
    maxIssuesPerRepo: Type.Optional(Type.Number({ minimum: 1, maximum: 10 })),
    minScore: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  },
  { additionalProperties: false },
);

const prepareContributionSchema = Type.Object(
  {
    repoFullName: Type.String(),
    issueNumber: Type.Optional(Type.Number({ minimum: 1 })),
    workDir: Type.String(),
    branchName: Type.String(),
    forkIfNeeded: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

const checkWorkspaceSchema = Type.Object(
  {
    workspacePath: Type.String(),
  },
  { additionalProperties: false },
);

const createDraftPrSchema = Type.Object(
  {
    workspacePath: Type.String(),
    repoFullName: Type.String(),
    branchName: Type.String(),
    title: Type.String(),
    body: Type.String(),
    baseBranch: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export default definePluginEntry({
  id: "wisteria-claw",
  name: "Wisteria Claw",
  description:
    "Open source contribution assistant for discovering GitHub repositories, analyzing issues, preparing contribution workspaces, and creating draft PRs.",
  configSchema: buildJsonPluginConfigSchema(pluginConfigJsonSchema, {
    uiHints: pluginConfigUiHints,
  }),
  register(api) {
    const config = resolveConfig(api.pluginConfig);

    api.registerToolMetadata({
      toolName: "wisteria_prepare_contribution",
      displayName: "Wisteria Prepare Contribution",
      risk: "high",
      tags: ["git", "workspace"],
    });
    api.registerToolMetadata({
      toolName: "wisteria_check_workspace",
      displayName: "Wisteria Check Workspace",
      risk: "medium",
      tags: ["git", "verification"],
    });
    api.registerToolMetadata({
      toolName: "wisteria_create_draft_pr",
      displayName: "Wisteria Create Draft PR",
      risk: "high",
      tags: ["git", "github", "draft-pr"],
    });

    api.registerTool({
      name: "wisteria_get_preferences",
      label: "Wisteria Get Preferences",
      description:
        "Return the effective non-secret Wisteria plugin preferences configured for this runtime.",
      parameters: getPreferencesSchema,
      async execute() {
        return executeSafely(async () => {
          const preferences: WisteriaPreferencesResult = {
            source: "plugin-config",
            hasGitHubToken: config.githubToken.trim().length > 0,
            allowGitCommands: config.allowGitCommands ?? false,
            defaultWorkDir: config.defaultWorkDir ?? null,
            defaultLanguages: [...(config.defaultLanguages ?? [])],
            defaultTopics: [...(config.defaultTopics ?? [])],
            defaultLabels: [...(config.defaultLabels ?? [])],
            minStars: config.minStars ?? null,
            maxStars: config.maxStars ?? null,
            dailyDigest: {
              enabled: config.dailyDigest?.enabled ?? false,
              timezone: config.dailyDigest?.timezone ?? "Asia/Tokyo",
              hour: config.dailyDigest?.hour ?? 9,
              limit: config.dailyDigest?.limit ?? 5,
              minScore: config.dailyDigest?.minScore ?? 60,
            },
          };

          return preferences;
        });
      },
    });

    api.registerTool({
      name: "wisteria_search_repos",
      label: "Wisteria Search Repositories",
      description: "Search GitHub repositories matching contribution preferences.",
      parameters: repoSearchSchema,
      async execute(_toolCallId, params) {
        return executeSafely(async () => {
          const client = createGitHubClient(config.githubToken);
          const effective = withRepoSearchDefaults(config, params as RepoSearchParams);
          const result = await searchRepositories(client, effective);
          return { repos: result.repos };
        });
      },
    });

    api.registerTool({
      name: "wisteria_search_issues",
      label: "Wisteria Search Issues",
      description: "Search beginner-friendly issues inside a GitHub repository.",
      parameters: issueSearchSchema,
      async execute(_toolCallId, params) {
        return executeSafely(async () => {
          const client = createGitHubClient(config.githubToken);
          const result = await searchIssues(client, params as IssueSearchParams);
          return { issues: result.issues };
        });
      },
    });

    api.registerTool({
      name: "wisteria_score_repo",
      label: "Wisteria Score Repository",
      description: "Score a single GitHub repository against contribution preferences.",
      parameters: scoreRepoSchema,
      async execute(_toolCallId, params) {
        return executeSafely(async () => {
          const input = params as {
            repo: {
              fullName: string;
              language?: string | null;
              topics?: string[];
              stars?: number;
              forks?: number;
              openIssues?: number;
              pushedAt?: string | null;
              createdAt?: string | null;
            };
            preferences?: RepoSearchParams;
          };

          const repo: RepoCandidate = {
            fullName: input.repo.fullName,
            name: input.repo.fullName.split("/")[1] ?? input.repo.fullName,
            owner: input.repo.fullName.split("/")[0] ?? "",
            description: null,
            url: `https://github.com/${input.repo.fullName}`,
            language: input.repo.language ?? null,
            topics: input.repo.topics ?? [],
            stars: input.repo.stars ?? 0,
            forks: input.repo.forks ?? 0,
            openIssues: input.repo.openIssues ?? 0,
            pushedAt: input.repo.pushedAt ?? null,
            createdAt: input.repo.createdAt ?? null,
          };

          const scored = scoreRepo(repo, input.preferences);
          return {
            score: scored.score,
            breakdown: scored.breakdown,
            reasons: scored.reasons,
          };
        });
      },
    });

    api.registerTool({
      name: "wisteria_score_issue",
      label: "Wisteria Score Issue",
      description: "Score a single issue for contribution suitability.",
      parameters: scoreIssueSchema,
      async execute(_toolCallId, params) {
        return executeSafely(async () => {
          const input = params as {
            issue: {
              title: string;
              body?: string | null;
              labels?: string[];
              comments?: number;
              createdAt?: string;
              updatedAt?: string;
            };
            preferredLabels?: string[];
          };

          const issue: IssueCandidate = {
            repoFullName: "unknown/unknown",
            number: 0,
            title: input.issue.title,
            body: input.issue.body ?? null,
            url: "",
            labels: input.issue.labels ?? [],
            comments: input.issue.comments ?? 0,
            createdAt: input.issue.createdAt ?? new Date(0).toISOString(),
            updatedAt:
              input.issue.updatedAt ??
              input.issue.createdAt ??
              new Date(0).toISOString(),
            state: "open",
          };

          const scored = scoreIssue(issue, input.preferredLabels);
          const difficulty = estimateIssueDifficulty(issue, scored.score);
          return {
            score: scored.score,
            breakdown: scored.breakdown,
            reasons: scored.reasons,
            difficulty,
            estimatedTime: estimateIssueTime(difficulty),
          };
        });
      },
    });

    api.registerTool({
      name: "wisteria_get_issue_context",
      label: "Wisteria Get Issue Context",
      description: "Fetch structured repository, issue, comment, and README context for issue analysis.",
      parameters: issueContextSchema,
      async execute(_toolCallId, params) {
        return executeSafely(async () => {
          const client = createGitHubClient(config.githubToken);
          return getIssueContext(client, params as {
            repoFullName: string;
            issueNumber: number;
            includeComments?: boolean;
            maxComments?: number;
          });
        });
      },
    });

    api.registerTool({
      name: "wisteria_daily_issue_digest",
      label: "Wisteria Daily Issue Digest",
      description: "Generate a read-only digest of recommended GitHub issues.",
      parameters: dailyDigestSchema,
      async execute(_toolCallId, params) {
        return executeSafely(async () => {
          const client = createGitHubClient(config.githubToken);
          return generateDailyIssueDigest(client, config, params as DailyDigestParams);
        });
      },
    });

    api.registerTool(
      {
        name: "wisteria_prepare_contribution",
        label: "Wisteria Prepare Contribution",
        description:
          "Fork, clone, configure remotes, and create a contribution branch.",
        parameters: prepareContributionSchema,
        async execute(_toolCallId, params) {
          return executeSafely(async () =>
            prepareContributionWorkspace(
              params as {
                repoFullName: string;
                issueNumber?: number;
                workDir: string;
                branchName: string;
                forkIfNeeded?: boolean;
              },
              config,
            ),
          );
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "wisteria_check_workspace",
        label: "Wisteria Check Workspace",
        description: "Check the local contribution workspace status.",
        parameters: checkWorkspaceSchema,
        async execute(_toolCallId, params) {
          return executeSafely(async () =>
            checkWorkspaceStatus(
              (params as { workspacePath: string }).workspacePath,
              config,
            ),
          );
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "wisteria_create_draft_pr",
        label: "Wisteria Create Draft PR",
        description: "Push the current branch and create a GitHub Draft PR.",
        parameters: createDraftPrSchema,
        async execute(_toolCallId, params) {
          return executeSafely(async () =>
            createDraftPrFromWorkspace(
              params as {
                workspacePath: string;
                repoFullName: string;
                branchName: string;
                title: string;
                body: string;
                baseBranch?: string;
              },
              config,
            ),
          );
        },
      },
      { optional: true },
    );
  },
});
