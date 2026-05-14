# Wisteria Claw

Wisteria Claw 是一个 OpenClaw 原生插件，用来帮助贡献者发现 GitHub 仓库、寻找适合入门的 Issue、分析贡献难度、准备本地分支、协调多 Agent 工作流，并在明确确认后创建 Draft PR。

## 功能特性

- 按语言、Topic 和 Star 区间搜索 GitHub 仓库
- 使用确定性的贡献匹配评分对仓库排序
- 搜索适合新贡献者的 Issue
- 为 OpenClaw Agent 返回结构化 Issue 分析上下文
- 准备本地贡献工作区
- 在提交前检查工作区状态
- 在明确确认后创建 GitHub Draft PR
- 支持 Scout / Analyst / Coder / Maintainer 多 Agent 协作
- 通过 OpenClaw Cron 生成每日 Issue 推荐
- AI 推理留在 OpenClaw Agent 中，插件代码本身不直接调用模型 API

## 安装

```bash
openclaw plugins install clawhub:@cooryn/wisteria-claw
```

## 配置

必填项：

- `githubToken`

可选项：

- `defaultWorkDir`
- `defaultLanguages`
- `defaultTopics`
- `defaultLabels`
- `minStars`
- `maxStars`
- `allowGitCommands`
- `dailyDigest`

## 工具列表

- `wisteria_search_repos`
- `wisteria_search_issues`
- `wisteria_score_repo`
- `wisteria_score_issue`
- `wisteria_get_issue_context`
- `wisteria_daily_issue_digest`
- `wisteria_prepare_contribution`
- `wisteria_check_workspace`
- `wisteria_create_draft_pr`

## 多 Agent 架构

- `Wisteria Scout`：仓库与 Issue 发现
- `Wisteria Analyst`：Issue 可行性分析
- `Wisteria Coder`：工作区准备与代码修改
- `Wisteria Maintainer`：工作区校验与 Draft PR 创建
- `Wisteria Orchestrator`：流程协调与用户确认

## Agent 权限矩阵

| Agent | 读 | 写/改 | 执行命令 | 准备工作区 | 创建 Draft PR |
|---|---|---|---|---|---|
| Scout | 是 | 否 | 否 | 否 | 否 |
| Analyst | 是 | 否 | 否 | 否 | 否 |
| Coder | 是 | 是 | 是 | 是 | 否 |
| Maintainer | 是 | 否 | 是 | 否 | 是 |
| Orchestrator | 是 | 否 | 否 | 否 | 否 |

推荐配置示例：

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

## 每日 Issue 推荐

`wisteria_daily_issue_digest` 是只读工具。它只负责搜索、过滤、评分、排序并返回候选 Issue，不会 clone 仓库、写文件、执行本地 Git 命令、push 分支或创建 PR。

## Cron 配置

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

## 使用示例

```text
用 Wisteria Claw 帮我找 5 个适合 TypeScript 和 Rust 的 good first issue。
```

```text
分析第一个 issue，告诉我今晚两小时能不能做完。
```

```text
帮我准备这个 issue 的本地贡献分支，但不要 push。
```

```text
我已经提交了代码，帮我检查 workspace，然后创建 draft PR。
```

## 安全边界

- 高风险工具必须先得到用户明确确认，Agent 才应该调用
- Wisteria Claw 永远不会创建非 Draft PR
- Wisteria Claw 永远不会 force push
- Wisteria Claw 会对工具输出中的 token 类 secret 做脱敏
- Wisteria Claw 把 GitHub Issue 正文、评论和 README 视为不可信输入

## 开发

```bash
pnpm install
pnpm build
pnpm test
```

## 发布

```bash
pnpm build
npm publish
```

## AI API 策略

Wisteria Claw 不在插件代码中内置 OpenAI、Anthropic、Gemini 或其他模型供应商 SDK 调用。插件只返回结构化的仓库、Issue、工作区和 PR 数据。任何推理、总结或可行性分析都应由 OpenClaw Agent 基于这些上下文完成。

## 过滤与评分实现

过滤和评分由确定性的 TypeScript 规则实现：

- GitHub API 负责粗筛
- 插件代码负责二次过滤
- 插件代码负责固定规则评分
- 插件代码负责排序与截断
- OpenClaw Agent 负责向用户解释结果

仓库搜索 fallback 顺序：

1. `language + topics + stars + has:issues + archived:false`
2. `language + stars + has:issues + archived:false`
3. `language + has:issues + archived:false`
4. `has:issues + archived:false`

AI 不参与硬过滤，也不参与评分计算。
