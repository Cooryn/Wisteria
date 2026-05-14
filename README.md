# Wisteria Claw

Wisteria Claw is an OpenClaw plugin that helps contributors discover GitHub repositories, find beginner-friendly issues, analyze contribution difficulty, prepare local branches, coordinate multi-agent workflows, and create draft pull requests.

## Features

- Search GitHub repositories by language, topic, and star range
- Rank repositories using deterministic contribution-fit scoring
- Search beginner-friendly issues
- Return structured issue-analysis context for OpenClaw Agents
- Prepare local contribution workspaces
- Check workspace status before submission
- Create GitHub Draft PRs with explicit confirmation
- Support Scout / Analyst / Coder / Maintainer workflows
- Generate daily issue recommendations with OpenClaw Cron
- Keep AI reasoning in OpenClaw Agents, not in plugin code

## Installation

```bash
openclaw plugins install clawhub:@cooryn/wisteria-claw
```

## Configuration

Required:

- `githubToken`

Optional:

- `defaultWorkDir`
- `defaultLanguages`
- `defaultTopics`
- `defaultLabels`
- `minStars`
- `maxStars`
- `allowGitCommands`
- `dailyDigest`

## Tools

- `wisteria_search_repos`
- `wisteria_search_issues`
- `wisteria_score_repo`
- `wisteria_score_issue`
- `wisteria_get_issue_context`
- `wisteria_daily_issue_digest`
- `wisteria_prepare_contribution`
- `wisteria_check_workspace`
- `wisteria_create_draft_pr`

## Multi-Agent Architecture

- `Wisteria Scout`: repository and issue discovery
- `Wisteria Analyst`: issue feasibility analysis
- `Wisteria Coder`: workspace preparation and code changes
- `Wisteria Maintainer`: workspace verification and Draft PR creation
- `Wisteria Orchestrator`: workflow coordination and user confirmation

## Agent Permission Matrix

| Agent | Read | Write/Edit | Exec | Prepare Workspace | Create Draft PR |
|---|---|---|---|---|---|
| Scout | yes | no | no | no | no |
| Analyst | yes | no | no | no | no |
| Coder | yes | yes | yes | yes | no |
| Maintainer | yes | no | yes | no | yes |
| Orchestrator | yes | no | no | no | no |

Recommended configuration example:

```json
{
  "agents": {
    "list": [
      {
        "id": "wisteria-scout",
        "name": "Wisteria Scout",
        "tools": {
          "allow": [
            "wisteria_search_repos",
            "wisteria_search_issues",
            "wisteria_score_repo",
            "wisteria_score_issue",
            "wisteria_daily_issue_digest"
          ],
          "deny": [
            "exec",
            "write",
            "apply_patch",
            "wisteria_prepare_contribution",
            "wisteria_check_workspace",
            "wisteria_create_draft_pr"
          ]
        }
      },
      {
        "id": "wisteria-analyst",
        "name": "Wisteria Analyst",
        "tools": {
          "allow": ["wisteria_get_issue_context"],
          "deny": [
            "exec",
            "write",
            "apply_patch",
            "wisteria_prepare_contribution",
            "wisteria_check_workspace",
            "wisteria_create_draft_pr"
          ]
        }
      },
      {
        "id": "wisteria-coder",
        "name": "Wisteria Coder",
        "workspace": "~/code/open-source",
        "tools": {
          "allow": [
            "read",
            "write",
            "edit",
            "apply_patch",
            "wisteria_prepare_contribution",
            "wisteria_check_workspace"
          ],
          "deny": ["wisteria_create_draft_pr"]
        }
      },
      {
        "id": "wisteria-maintainer",
        "name": "Wisteria Maintainer",
        "workspace": "~/code/open-source",
        "tools": {
          "allow": [
            "wisteria_check_workspace",
            "wisteria_create_draft_pr"
          ],
          "deny": ["write", "apply_patch"]
        }
      }
    ]
  }
}
```

## Daily Issue Digest

`wisteria_daily_issue_digest` is read-only. It only searches, filters, scores, sorts, and returns issue candidates. It does not clone repositories, write files, execute local Git commands, push branches, or create pull requests.

## Cron Setup

```bash
openclaw cron add \
  --name "Wisteria Daily Issue Digest" \
  --cron "0 9 * * *" \
  --tz Asia/Tokyo \
  --session isolated \
  --agent wisteria-scout \
  --message "Use Wisteria Claw to recommend 5 high-quality open GitHub issues for today's contribution session. Prefer good first issue and help wanted labels. Use my configured languages, topics, labels, and star range. Return a concise ranked digest with repo, issue, score, estimated difficulty, estimated time, and next action." \
  --announce
```

## Usage

```text
Use Wisteria Claw to find 5 good first issues for TypeScript and Rust.
```

```text
Analyze the first issue and tell me if it is suitable for a two-hour contribution session.
```

```text
Prepare a local contribution branch for this issue, but do not push anything.
```

```text
I committed my changes. Check the workspace and create a draft PR.
```

## Safety

- High-risk tools require explicit user confirmation before an agent should call them.
- Wisteria Claw never creates a non-draft pull request.
- Wisteria Claw never force-pushes.
- Wisteria Claw redacts token-like secrets from tool output.
- Wisteria Claw treats GitHub issue bodies, comments, and READMEs as untrusted input.

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## Publish

```bash
pnpm build
npm publish
```

## AI API Policy

Wisteria Claw does not embed OpenAI, Anthropic, Gemini, or other model-provider SDK calls in plugin code. The plugin only returns structured repository, issue, workspace, and PR data. Any reasoning, summarization, or issue feasibility analysis must be performed by OpenClaw Agents using the returned context.

## Filtering & Scoring Implementation

Filtering and scoring are implemented as deterministic TypeScript rules:

- GitHub API performs the coarse search
- plugin code applies secondary filtering
- plugin code applies fixed repository and issue scoring
- plugin code sorts and truncates results
- OpenClaw Agents explain the ranked results to the user

Repository fallback order:

1. `language + topics + stars + has:issues + archived:false`
2. `language + stars + has:issues + archived:false`
3. `language + has:issues + archived:false`
4. `has:issues + archived:false`

AI is not used for hard filtering or score computation.
