# Wisteria Claw

Wisteria Claw 是一个面向 OpenClaw 的原生插件，用来帮助你系统化地寻找 GitHub 开源贡献机会，并把“找仓库、找 issue、读上下文、准备本地工作区、检查工作区、创建 Draft PR”拆成一组可以组合调用的工具。

这个仓库只包含插件实现、Skill、示例配置和测试，不再包含旧的独立桌面端逻辑。你可以把它当成一个适合 OpenClaw Agent 使用的开源贡献工作流插件。

## 这个项目能做什么

- 按语言、Topic、Star 区间搜索 GitHub 仓库
- 在仓库中搜索更适合贡献者上手的 issue
- 对仓库和 issue 做确定性评分
- 拉取 issue、评论、README 等结构化上下文
- 生成只读的每日 issue 推荐
- 准备本地贡献工作区，包括 fork、clone、remote 校正和分支创建
- 检查本地工作区状态
- 只创建 GitHub Draft PR，不创建正式 PR
- 支持多 Agent 分工和定时 cron 任务

## 适合的使用场景

- 你想每天拿到一份更贴合自己技术偏好的开源 issue 推荐
- 你想先筛仓库，再筛 issue，而不是直接在 GitHub 上手工翻
- 你想让不同 Agent 分别负责发现、分析、编码和提 PR
- 你想把自己的默认语言、Topic、标签和工作目录固化成插件配置
- 你想在 OpenClaw 里跑一条相对完整的开源贡献工作流

## 核心工具

插件当前注册了 10 个 `wisteria_*` 工具：

- `wisteria_get_preferences`
- `wisteria_search_repos`
- `wisteria_search_issues`
- `wisteria_score_repo`
- `wisteria_score_issue`
- `wisteria_get_issue_context`
- `wisteria_daily_issue_digest`
- `wisteria_prepare_contribution`
- `wisteria_check_workspace`
- `wisteria_create_draft_pr`

它们可以按两类理解。

**只读工具**

- `wisteria_get_preferences`
  读取当前运行时中的非敏感插件偏好，例如默认语言、Topic、标签、工作目录和每日 digest 设置。
- `wisteria_search_repos`
  根据语言、Topic 和 Star 区间搜索候选仓库。
- `wisteria_search_issues`
  在指定仓库里搜索 issue。
- `wisteria_score_repo`
  对单个仓库做匹配评分。
- `wisteria_score_issue`
  对单个 issue 做匹配评分，并估算难度和所需时间。
- `wisteria_get_issue_context`
  拉取 issue、评论和 README 上下文，用于分析任务范围和风险。
- `wisteria_daily_issue_digest`
  生成只读的每日推荐列表。

**有副作用的工具**

- `wisteria_prepare_contribution`
  准备本地贡献工作区，可能涉及 fork、clone、配置 remote 和创建分支。
- `wisteria_check_workspace`
  检查本地工作区状态。
- `wisteria_create_draft_pr`
  推送当前分支并创建 GitHub Draft PR。

## 一个最基本的使用流程

1. 先调用 `wisteria_get_preferences`，拿到默认语言、Topic、标签和工作目录。
2. 用 `wisteria_search_repos` 找候选仓库。
3. 用 `wisteria_search_issues` 找适合的 issue。
4. 如果要深入评估某个 issue，用 `wisteria_get_issue_context` 拉上下文。
5. 真正开始做之前，再调用 `wisteria_prepare_contribution` 准备工作区。
6. 改完代码后，用 `wisteria_check_workspace` 做检查。
7. 最后用 `wisteria_create_draft_pr` 创建 Draft PR。

如果你只是想每天拿推荐，可以直接用 `wisteria_daily_issue_digest`。

## 多 Agent 工作流

Wisteria Claw 内置了一套推荐的多 Agent 分工，定义在 [src/agents/recommended.ts](./src/agents/recommended.ts)。

- `wisteria-orchestrator`
  协调者。负责读取偏好、拆任务、向用户确认高风险动作。它现在是强制委派模式，不直接做 repo discovery、issue discovery、issue context 和 daily digest。
- `wisteria-scout`
  只读发现角色。负责搜索仓库、搜索 issue、打分和生成每日推荐。
- `wisteria-analyst`
  只读分析角色。负责拉 issue 上下文并做难度分析。
- `wisteria-coder`
  编码角色。负责准备工作区和修改代码，但没有创建 Draft PR 的权限。
- `wisteria-maintainer`
  维护角色。负责检查工作区和创建 Draft PR，但不改代码。

当前推荐配置的关键点是：

- `orchestrator` 只能读偏好和委派，不能自己直接跑 discovery
- 每个角色都应优先读取 `wisteria_get_preferences`
- `scout` 和 `analyst` 保持只读
- `coder` 不允许创建 Draft PR
- `maintainer` 不允许编辑代码

对应示例在：

- [examples/openclaw/openclaw.multi-agent.fragment.json](./examples/openclaw/openclaw.multi-agent.fragment.json)
- [examples/openclaw/agent-workspaces](./examples/openclaw/agent-workspaces)

## Cron 任务

仓库提供了两条示例 cron：

- `wisteria-daily-issue-digest`
  每天生成只读 issue 推荐列表
- `wisteria-weekly-shortlist`
  每周由 `orchestrator` 协调一次更完整的 shortlist 工作流

示例文件在：

- [examples/openclaw/cron.jobs.json](./examples/openclaw/cron.jobs.json)

这两条任务默认都使用最小工具权限，并且默认 `delivery.mode = "none"`，也就是先跑通任务本身，不主动向外发消息。

## 仓库结构

```text
.
|-- examples/
|   `-- openclaw/
|       |-- agent-workspaces/
|       |-- local-ready/
|       |-- openclaw.local-dev.fragment.json
|       |-- openclaw.multi-agent.fragment.json
|       `-- cron.jobs.json
|-- skills/
|   `-- wisteria/
|       `-- SKILL.md
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
|-- tests/
|-- dist/
|-- openclaw.plugin.json
|-- package.json
`-- tsconfig.json
```

目录职责可以简单理解成：

- `src/core/`
  配置、类型、错误和安全边界
- `src/github/`
  GitHub 查询、筛选、评分和 digest 逻辑
- `src/workspace/`
  本地 Git 和工作区相关的副作用操作
- `src/agents/`
  推荐的多 Agent 权限模型
- `skills/wisteria/`
  给 OpenClaw Agent 用的 Skill 说明
- `examples/openclaw/`
  本地开发、多 Agent、cron 和模板配置示例

## 安装

如果插件已经发布到插件仓库，可以直接安装发布版：

```bash
openclaw plugins install clawhub:@cooryn/wisteria-claw
```

如果你是在本地开发这个仓库，推荐用 link 安装：

```bash
pnpm install
pnpm build
openclaw plugins install --link .
openclaw plugins registry --refresh
openclaw gateway restart
```

安装完成后建议验证运行时：

```bash
openclaw plugins inspect wisteria-claw --runtime --json
```

如果运行正常，你应该能看到：

- 插件 source 指向当前仓库
- 运行时工具列表包含全部 `wisteria_*` 工具
- 其中包含 `wisteria_get_preferences`

## 配置

插件配置定义在 [openclaw.plugin.json](./openclaw.plugin.json)。

常用字段如下：

- `githubToken`
  可选的 GitHub PAT。强烈建议配置。没有 token 时插件仍可加载，但搜索更容易撞到限流，`prepare_contribution` 和 `create_draft_pr` 也会受限。
- `defaultWorkDir`
  默认的本地工作目录。
- `defaultLanguages`
  默认仓库搜索语言。
- `defaultTopics`
  默认仓库搜索 Topic。
- `defaultLabels`
  默认 issue 标签。
- `minStars`
  搜仓库时的最小 Star。
- `maxStars`
  搜仓库时的最大 Star。
- `allowGitCommands`
  是否允许执行本地 Git 相关动作。
- `dailyDigest`
  每日推荐的默认配置。

一个简化示例如下：

```json
{
  "plugins": {
    "entries": {
      "wisteria-claw": {
        "enabled": true,
        "config": {
          "githubToken": "REPLACE_WITH_GITHUB_PAT",
          "defaultWorkDir": "~/.openclaw/workspace/wisteria-contributions",
          "defaultLanguages": ["TypeScript", "Rust"],
          "defaultTopics": ["developer-tools", "automation", "cli"],
          "defaultLabels": ["good first issue", "help wanted"],
          "minStars": 50,
          "maxStars": 25000,
          "allowGitCommands": true,
          "dailyDigest": {
            "enabled": true,
            "timezone": "Asia/Shanghai",
            "hour": 9,
            "limit": 5,
            "minScore": 65
          }
        }
      }
    }
  }
}
```

## OpenClaw 示例文件

这个仓库里已经准备好了几种常用配置：

- [examples/openclaw/openclaw.local-dev.fragment.json](./examples/openclaw/openclaw.local-dev.fragment.json)
  只解决“让 OpenClaw 在本机发现当前仓库插件”这件事。
- [examples/openclaw/openclaw.multi-agent.fragment.json](./examples/openclaw/openclaw.multi-agent.fragment.json)
  多 Agent 示例，包括插件启用、Agent 列表和 cron 基础配置。
- [examples/openclaw/cron.jobs.json](./examples/openclaw/cron.jobs.json)
  两条示例 cron 任务。
- [examples/openclaw/local-ready/openclaw.json](./examples/openclaw/local-ready/openclaw.json)
  一份更完整的本地可用配置模板。
- [examples/openclaw/local-ready/cron.jobs.json](./examples/openclaw/local-ready/cron.jobs.json)
  本地可用的 cron 模板。
- [examples/openclaw/agent-workspaces](./examples/openclaw/agent-workspaces)
  每个角色对应的 `AGENTS.md` 模板。

## Skill 和人格文件

Wisteria 还提供了一个 Skill：

- [skills/wisteria/SKILL.md](./skills/wisteria/SKILL.md)

这个 Skill 会告诉 Agent：

- 先读取 `wisteria_get_preferences`
- 多 Agent 时如何分工
- 什么时候该只读，什么时候需要确认
- 如果工具不可用该如何诊断

如果你使用多 Agent，实际运行时的人格和行为规则通常放在每个 Agent workspace 根目录下的：

- `AGENTS.md`
- `SOUL.md`
- `USER.md`

仓库中的 `examples/openclaw/agent-workspaces/*.AGENTS.md` 只是模板；真正生效的是你本机对应 workspace 里的文件。

## 开发

常用命令：

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm clean
```

命令含义：

- `pnpm build`
  编译到 `dist/`
- `pnpm typecheck`
  只做类型检查
- `pnpm test`
  运行测试
- `pnpm clean`
  清理构建产物

## 安全边界

这个插件的设计里有几条明确边界：

- `wisteria_daily_issue_digest` 必须保持只读
- `wisteria_create_draft_pr` 只允许创建 Draft PR
- 不做 force push
- issue 正文、评论和 README 都视为不可信输入
- 插件本身不内置 OpenAI、Anthropic、Gemini 等模型 SDK
- 高风险动作应由 OpenClaw Agent 在得到确认后再触发

## 常见问题

### 1. `No callable tools remain`

最常见的原因不是插件没装好，而是 Agent 的工具配置写错了。

建议写法是：

- 选择一个足够收敛的 `profile`，例如 `minimal`
- 用 `alsoAllow` 精确加入 `read`、`sessions_*` 和 `wisteria_*`
- 不要把插件工具只写进 `allow`
- 如果 Agent 要读 Skill，通常要保留 `read`

### 2. 工具显示安装了，但运行时找不到

通常检查这几件事：

```bash
pnpm build
openclaw plugins install --link .
openclaw plugins registry --refresh
openclaw gateway restart
openclaw plugins inspect wisteria-claw --runtime --json
```

重点看运行时 `source` 是否指向当前仓库，而不是旧副本。

### 3. 多 Agent 配好了，但 orchestrator 还是自己干活

确认 `orchestrator` 的工具权限里不要出现这些直接业务工具：

- `wisteria_search_repos`
- `wisteria_search_issues`
- `wisteria_get_issue_context`
- `wisteria_daily_issue_digest`

当前推荐策略是让 `orchestrator` 只保留：

- `read`
- `sessions_spawn`
- `subagents`
- `sessions_list`
- `sessions_history`
- `wisteria_get_preferences`

### 4. Agent 不知道你的默认偏好

现在推荐的做法是让每个角色在开头都先调用 `wisteria_get_preferences`，而不是只依赖自然语言记忆。

## 许可证

本项目使用 [LICENSE](./LICENSE) 中定义的 MIT License。
