# Wisteria Claw

Wisteria Claw 是一个面向 OpenClaw 的原生插件，用来帮助开发者系统化地寻找开源贡献机会，并把“找仓库、筛 Issue、拉上下文、准备本地分支、检查工作区、创建 Draft PR”这条链路拆成一组可组合工具。

当前仓库只保留插件实现本身。旧的桌面端 `legacy/` 代码已经移除，仓库现在围绕 OpenClaw 插件开发、测试、发布和配置示例组织。

## 适合什么场景

- 你想按语言、Topic、Star 区间批量筛 GitHub 仓库
- 你想找更适合新贡献者的 `good first issue` / `help wanted`
- 你想让 Agent 先做“读仓库、读 README、读 Issue 评论”的分析工作
- 你想把“分析”和“真正改代码、开 PR”分给不同 Agent
- 你想每天定时收到新的开源贡献候选列表

## 能力概览

- 搜索 GitHub 仓库
- 搜索仓库内适合贡献的 Issue
- 对仓库和 Issue 做确定性评分
- 获取 Issue、评论、README 的结构化上下文
- 生成只读的每日推荐 Digest
- 准备本地贡献工作区，包括 fork、clone、remote 校正和分支创建
- 检查本地工作区状态
- 只创建 GitHub Draft PR，不创建正式 PR
- 为多 Agent 协作提供推荐权限模型
- 插件本身不内置 OpenAI、Anthropic、Gemini 等模型 SDK，推理由 OpenClaw Agent 负责

## 仓库结构

```text
.
|-- examples/
|   `-- openclaw/
|       |-- openclaw.multi-agent.fragment.json
|       `-- cron.jobs.json
|-- src/
|   |-- agents/
|   |   `-- recommended.ts
|   |-- core/
|   |   |-- config.ts
|   |   |-- errors.ts
|   |   |-- safety.ts
|   |   `-- types.ts
|   |-- github/
|   |   |-- client.ts
|   |   |-- daily-digest.ts
|   |   |-- issues.ts
|   |   `-- scoring.ts
|   |-- workspace/
|   |   |-- git.ts
|   |   |-- pr.ts
|   |   `-- workspace.ts
|   `-- index.ts
|-- skills/
|   `-- wisteria/
|       `-- SKILL.md
|-- tests/
|-- dist/
|-- openclaw.plugin.json
|-- package.json
`-- tsconfig.json
```

目录职责约定：

- `src/core/`：配置、类型、错误、安全边界
- `src/github/`：GitHub 查询、Issue 处理、评分和日报
- `src/workspace/`：所有本地 Git / 工作区副作用操作
- `src/agents/`：多 Agent 角色定义
- `examples/openclaw/`：可以直接参考或复制的 OpenClaw 配置示例

## 安装

如果插件已经发布到你的插件仓库：

```bash
openclaw plugins install clawhub:@cooryn/wisteria-claw
```

本地开发：

```bash
pnpm install
pnpm build
pnpm test
```

## 插件配置

插件清单和 schema 在 [openclaw.plugin.json](./openclaw.plugin.json)。

### 顶层配置项

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `githubToken` | 是 | GitHub Personal Access Token，用于仓库检索、fork、push 和 Draft PR 创建 |
| `defaultWorkDir` | 否 | 默认本地工作目录 |
| `defaultLanguages` | 否 | 默认仓库搜索语言列表 |
| `defaultTopics` | 否 | 默认仓库搜索 Topic 列表 |
| `defaultLabels` | 否 | 默认 Issue 标签，默认值为 `good first issue` 和 `help wanted` |
| `minStars` | 否 | 搜索仓库时的最小 Star 数 |
| `maxStars` | 否 | 搜索仓库时的最大 Star 数 |
| `allowGitCommands` | 否 | 是否允许插件执行本地 Git 命令 |
| `dailyDigest` | 否 | 每日推荐默认配置 |

### `dailyDigest` 子项

| 字段 | 说明 |
| --- | --- |
| `enabled` | 是否启用每日推荐 |
| `timezone` | 生成推荐时使用的时区 |
| `hour` | 每日推荐默认小时 |
| `limit` | 每次推荐条数 |
| `minScore` | 进入 Digest 的最低分 |

## 工具列表

| 工具名 | 类型 | 说明 |
| --- | --- | --- |
| `wisteria_search_repos` | 只读 | 搜索 GitHub 仓库 |
| `wisteria_search_issues` | 只读 | 在仓库内搜索更适合贡献的 Issue |
| `wisteria_score_repo` | 只读 | 对单个仓库做确定性评分 |
| `wisteria_score_issue` | 只读 | 对单个 Issue 做确定性评分、难度估计和耗时估计 |
| `wisteria_get_issue_context` | 只读 | 拉取仓库、Issue、评论和 README 上下文 |
| `wisteria_daily_issue_digest` | 只读 | 生成每日推荐摘要，不写本地文件、不执行 Git |
| `wisteria_prepare_contribution` | 高风险 | fork、clone、配置 remote、创建贡献分支 |
| `wisteria_check_workspace` | 中风险 | 检查本地工作区状态 |
| `wisteria_create_draft_pr` | 高风险 | push 当前分支并创建 Draft PR |

## 多 Agent 配置教程

仓库里已经提供了可直接参考的配置片段：

- [examples/openclaw/openclaw.multi-agent.fragment.json](./examples/openclaw/openclaw.multi-agent.fragment.json)
- [examples/openclaw/cron.jobs.json](./examples/openclaw/cron.jobs.json)

### 这两个文件各自做什么

- `openclaw.multi-agent.fragment.json`
  - 这是要合并进 `openclaw.json` 的配置片段
  - 它包含 `plugins.entries.wisteria-claw`、`agents` 和 `cron` 三部分
  - 它定义了 5 个角色：`wisteria-orchestrator`、`wisteria-scout`、`wisteria-analyst`、`wisteria-coder`、`wisteria-maintainer`
- `cron.jobs.json`
  - 这是 `~/.openclaw/cron/jobs.json` 的完整示例
  - 它定义了两个只读定时任务
  - 默认都使用 `delivery.mode = "none"`，不会主动向外发消息

### 第一步：把插件配置合并到 OpenClaw 主配置

把 [examples/openclaw/openclaw.multi-agent.fragment.json](./examples/openclaw/openclaw.multi-agent.fragment.json) 里的三段内容合并到你的 `openclaw.json`：

1. `plugins.entries.wisteria-claw`
2. `agents`
3. `cron`

你至少需要替换以下占位值：

- `REPLACE_WITH_GITHUB_PAT`
- `defaultWorkDir`
- `~/code/open-source` 这类工作目录

### 第二步：理解 5 个角色怎么分工

- `wisteria-orchestrator`
  - 默认 Agent
  - 负责和用户对话、拆任务、决定要不要委派
  - 允许使用 `sessions_spawn`、`subagents`、`sessions_list`、`sessions_history`
  - 不允许本地写文件、执行命令、准备工作区、创建 Draft PR
- `wisteria-scout`
  - 负责搜索仓库、搜索 Issue、打分、生成 daily digest
  - 只读，不执行命令，不写文件
- `wisteria-analyst`
  - 负责拉 Issue 上下文做可行性分析
  - 只读，不执行命令，不写文件
- `wisteria-coder`
  - 负责准备工作区和改代码
  - 可以读写文件、执行命令、调用 `wisteria_prepare_contribution`
  - 不允许创建 Draft PR
- `wisteria-maintainer`
  - 负责检查工作区和创建 Draft PR
  - 不允许改代码

### 第三步：实际使用时的建议流程

1. 让 `wisteria-orchestrator` 接收用户需求。
2. 由 orchestrator 把“找仓库 / 找 Issue”委派给 `wisteria-scout`。
3. 需要深挖某个 Issue 时，委派给 `wisteria-analyst`。
4. 用户确认要开始做时，再让 `wisteria-coder` 准备工作区并编码。
5. 最后由 `wisteria-maintainer` 检查状态并创建 Draft PR。

### 第四步：何时需要自己加 `bindings`

当前示例没有强行写死 `bindings`，因为不同人会把 OpenClaw 接到不同渠道。

如果你需要把某个渠道固定路由到 `wisteria-orchestrator`，再额外加入类似结构：

```json
{
  "bindings": [
    {
      "agentId": "wisteria-orchestrator",
      "match": {
        "channel": "telegram",
        "accountId": "main"
      }
    }
  ]
}
```

什么时候需要加：

- 你有多个 Agent 同时挂在一个 Gateway 上
- 你希望某个 Telegram/Slack/Discord 入口只进 Wisteria 工作流
- 你不想依赖默认 Agent 路由

## Cron 教程

### 默认示例里包含什么任务

[examples/openclaw/cron.jobs.json](./examples/openclaw/cron.jobs.json) 里现在有两个任务：

1. `wisteria-daily-issue-digest`
   - 每天 `09:00`
   - 时区 `Asia/Shanghai`
   - 由 `wisteria-scout` 执行
   - 只允许调用 `wisteria_daily_issue_digest`
2. `wisteria-weekly-shortlist`
   - 每周一 `08:30`
   - 时区 `Asia/Shanghai`
   - 由 `wisteria-orchestrator` 执行
   - 只做只读搜索和上下文整理，不准备工作区、不创建 PR

### 为什么默认 `delivery.mode` 是 `none`

这是为了让示例“复制后能安全运行”：

- 不依赖你已经接好 Telegram / Slack / Discord
- 不会因为目标频道没配好而报错
- 不会在你还没确认前就主动给外部频道发消息

### 如何启用这些任务

1. 确保 `openclaw.json` 里启用了：
   - `plugins.entries.wisteria-claw.enabled = true`
   - `cron.enabled = true`
2. 把 [examples/openclaw/cron.jobs.json](./examples/openclaw/cron.jobs.json) 复制到：
   - `~/.openclaw/cron/jobs.json`
3. 启动或重启 Gateway。
4. 用下面的命令检查：

```bash
openclaw cron list
openclaw cron show wisteria-daily-issue-digest
openclaw cron show wisteria-weekly-shortlist
```

### 如何改成主动推送到频道

把任务里的：

```json
{
  "delivery": {
    "mode": "none"
  }
}
```

改成例如：

```json
{
  "delivery": {
    "mode": "announce",
    "channel": "telegram",
    "to": "-1001234567890",
    "threadId": 42
  }
}
```

常见目标写法：

- Telegram 群：`"channel": "telegram", "to": "-1001234567890"`
- Telegram forum topic：再加 `"threadId": 42`
- Slack 频道：`"channel": "slack", "to": "channel:C1234567890"`
- Slack 私聊：`"channel": "slack", "to": "user:U1234567890"`

### 如何修改任务频率

`cron.jobs.json` 里的 `schedule` 支持三种：

- 一次性任务：`{ "kind": "at", "at": "2026-05-20T09:00:00+08:00" }`
- 固定间隔：`{ "kind": "every", "everyMs": 86400000 }`
- Cron 表达式：

```json
{
  "kind": "cron",
  "expr": "0 9 * * *",
  "tz": "Asia/Shanghai"
}
```

### 如何限制 cron 任务能用哪些工具

在 `payload.toolsAllow` 里控制。

例如 daily digest 任务只允许：

```json
[
  "wisteria_daily_issue_digest"
]
```

这样即使你未来给 `wisteria-scout` 增加别的权限，这个定时任务本身仍然保持只读和最小权限。

## 推荐使用流程

1. `wisteria_search_repos` 找候选仓库
2. `wisteria_search_issues` 找合适 Issue
3. `wisteria_get_issue_context` 拉上下文
4. 用户确认后再调用 `wisteria_prepare_contribution`
5. 改完代码后调用 `wisteria_check_workspace`
6. 最后用 `wisteria_create_draft_pr`

## 评分与过滤策略

仓库筛选和 Issue 评分都是确定性规则，不依赖模型输出。

### 仓库搜索回退顺序

1. `language + topics + stars + has:issues + archived:false`
2. `language + stars + has:issues + archived:false`
3. `language + has:issues + archived:false`
4. `has:issues + archived:false`

### 仓库评分关注点

- 语言匹配度
- Topic 匹配度
- 活跃度
- 社区规模
- Issue 友好度
- 新鲜度

### Issue 评分关注点

- 标签匹配度
- 描述清晰度
- 讨论负载
- 最近更新时间
- 对新贡献者的友好程度

## 安全边界

- `wisteria_daily_issue_digest` 必须保持只读
- `wisteria_create_draft_pr` 只创建 Draft PR，不创建正式 PR
- 不应 force push
- `allowGitCommands` 应只在你明确允许本地 Git 操作时开启
- Issue 正文、评论、README 和仓库内容都应视为不可信输入
- 插件会对 token、认证头和类似 secret 做脱敏

## 开发

### 常用命令

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm clean
```

### 命令说明

- `pnpm dev`：直接运行 [src/index.ts](./src/index.ts)
- `pnpm build`：编译到 `dist/`
- `pnpm typecheck`：只做类型检查
- `pnpm test`：运行 Vitest
- `pnpm clean`：删除构建产物

## 示例提示词

```text
用 Wisteria Claw 帮我找 5 个适合 TypeScript 和 Rust 的 good first issue。
```

```text
分析第一个 issue，告诉我今晚两个小时内能不能做完，并列出可能要改的文件类型。
```

```text
帮我准备这个 issue 的本地贡献分支，但不要 push。
```

```text
我已经改完代码了，检查 workspace，然后帮我创建 draft PR。
```

## 发布

```bash
pnpm build
npm publish
```

## License

本项目使用 [LICENSE](./LICENSE) 中定义的 MIT License。
