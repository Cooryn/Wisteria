# Wisteria Claw

Wisteria Claw 是一个面向 OpenClaw 的原生插件，用来把 GitHub 开源贡献流程拆成一组可组合的工具：发现仓库、筛选 issue、读取上下文、准备本地工作区、检查状态，以及创建 Draft PR。

这个仓库包含插件实现、Skill、示例配置和测试，不再包含旧的独立桌面端逻辑。它适合被 OpenClaw Agent 作为开源贡献工作流插件直接使用。

## 功能概览

- 按语言、Topic、Star 区间发现 GitHub 仓库
- 搜索并筛选更适合上手贡献的 issue
- 对仓库和 issue 做确定性评分
- 拉取 issue、评论和 README 等结构化上下文
- 生成只读的每日 issue 推荐
- 准备和检查本地贡献工作区
- 只创建 GitHub Draft PR，不创建正式 PR
- 支持多 Agent 分工和 cron 任务

## 工具范围

当前插件注册 11 个 `wisteria_*` 工具，分为两组：

- 发现与分析：`wisteria_get_preferences`、`wisteria_update_preferences`、`wisteria_search_repos`、`wisteria_search_issues`、`wisteria_score_repo`、`wisteria_score_issue`、`wisteria_get_issue_context`、`wisteria_daily_issue_digest`
- 工作区与发布：`wisteria_prepare_contribution`、`wisteria_check_workspace`、`wisteria_create_draft_pr`

## 架构解析

这个插件采用比较直接的分层结构：

- `openclaw.plugin.json` 定义插件元数据、配置模式和对外工具契约
- `src/index.ts` 是运行时入口，负责注册工具、声明参数 Schema、标记风险等级，并把每个工具路由到对应的领域模块
- `src/core/` 负责配置解析、偏好更新、类型定义、错误封装和安全约束，是各层共用的基础设施
- `src/github/` 负责 GitHub 查询、仓库与 issue 评分、issue 上下文拼装和每日 digest 生成
- `src/workspace/` 负责本地副作用操作，包括 fork/clone、remote 校正、分支准备、工作区检查和 Draft PR 创建

运行时数据流也比较清晰：

- Agent 调用某个 `wisteria_*` 工具后，先由 `src/index.ts` 的 Schema 做参数校验
- 工具执行前会读取当前运行时配置，而不是只依赖插件启动时的静态快照
- 只读类工具把请求转发到 `src/github/`，副作用类工具转发到 `src/workspace/`
- 所有结果最终都通过统一的结构化 JSON 返回，错误也会被包装成一致的工具错误格式

有一个值得注意的设计点：

- `wisteria_update_preferences` 会直接写回运行时配置文件
- 其他工具通过 `getConfig()` 每次重新解析配置，所以偏好修改会立刻影响后续搜索、digest 和工作区相关操作
- 安全边界不散落在文档里，而是集中在 `src/core/safety.ts` 和工具元数据里控制高风险动作

## 仓库结构

```text
.
|-- examples/
|   `-- openclaw/
|       |-- agent-workspaces/
|       |-- openclaw.local-dev.fragment.json
|       |-- openclaw.local-ready.json
|       |-- openclaw.multi-agent.fragment.json
|       `-- cron.jobs.json
|-- skills/
|   `-- wisteria/
|       `-- SKILL.md
|-- src/
|-- tests/
|-- openclaw.plugin.json
|-- package.json
`-- tsconfig.json
```

- `src/`：插件源码，包含配置、GitHub 查询、评分、工作区和工具注册逻辑
- `skills/wisteria/`：给 OpenClaw Agent 使用的 Skill 说明
- `examples/openclaw/`：本地开发、多 Agent 和 cron 的示例配置
- `tests/`：回归测试

## 相关文件

- 插件清单：[openclaw.plugin.json](./openclaw.plugin.json)
- Skill 说明：[skills/wisteria/SKILL.md](./skills/wisteria/SKILL.md)
- 多 Agent 示例：[examples/openclaw/openclaw.multi-agent.fragment.json](./examples/openclaw/openclaw.multi-agent.fragment.json)
- 本地完整示例：[examples/openclaw/openclaw.local-ready.json](./examples/openclaw/openclaw.local-ready.json)
- cron 示例：[examples/openclaw/cron.jobs.json](./examples/openclaw/cron.jobs.json)

## 许可证

本项目使用 [LICENSE](./LICENSE) 中定义的 MIT License。
