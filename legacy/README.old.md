# Wisteria — 开源贡献助手 开发总结

## 项目概述

Wisteria 是一个桌面应用，帮助开发者根据自身技术栈偏好，自动搜索 GitHub 开源项目、寻找合适的 Issue、并支持一键生成 Draft PR。

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Tauri 2 | `2.10.x` |
| 前端框架 | React + TypeScript | `19.x` / `5.8` |
| UI 库 | Material UI | `6.5.0` |
| 状态管理 | Zustand | `5.x` |
| GitHub API | Octokit | `22.x` |
| 本地数据库 | SQLite (via tauri-plugin-sql) | `2.4.0` |
| Git 操作 | 系统 git (via tauri-plugin-shell) | `2.3.5` |
| LLM | OpenAI 兼容 API | — |
| 包管理器 | pnpm | `9.x` |

## 项目架构

```
Wisteria/
├── src/                          # React 前端
│   ├── main.tsx                  # 入口
│   ├── App.tsx                   # 根组件 (路由 + 布局 + Snackbar)
│   ├── theme/index.ts            # MUI 主题 (深色/浅色双主题)
│   ├── types/index.ts            # TypeScript 类型定义
│   ├── store/index.ts            # Zustand 全局状态
│   ├── components/
│   │   ├── ThemeProvider.tsx      # 深色/浅色/跟随系统主题切换
│   │   ├── Layout/
│   │   │   ├── Sidebar.tsx       # 可收放侧边导航
│   │   │   └── TopBar.tsx        # 顶栏 (标题+主题切换)
│   │   ├── RepoCard.tsx          # 仓库卡片
│   │   ├── IssueCard.tsx         # Issue 卡片
│   │   └── ScoreBadge.tsx        # 分数徽章 (conic-gradient)
│   ├── pages/
│   │   ├── Dashboard.tsx         # 仪表盘 (统计+推荐)
│   │   ├── Explorer.tsx          # 探索页 (搜索+双栏)
│   │   ├── Preferences.tsx       # 偏好设置
│   │   ├── IssueDetail.tsx       # Issue 详情 + AI 分析
│   │   └── Settings.tsx          # 应用设置
│   └── services/
│       ├── database.ts           # SQLite CRUD
│       ├── github.ts             # Octokit 封装
│       ├── scorer.ts             # 打分引擎
│       ├── git.ts                # Git CLI 封装
│       └── llm.ts                # OpenAI API 封装
├── src-tauri/
│   ├── src/lib.rs                # Rust 入口 (插件注册+迁移)
│   ├── capabilities/default.json # 权限配置
│   ├── tauri.conf.json           # 应用配置
│   └── Cargo.toml                # Rust 依赖
└── index.html                    # HTML 入口 (Inter 字体)
```

## 核心功能

### 1. 偏好管理
- 编程语言 / 框架 / 工具标签管理，每个标签可调权重
- 星标范围滑块
- Issue 标签偏好 (good first issue, help wanted 等)
- 自定义工作目录

### 2. 智能搜索 + 打分
6 维度加权打分系统：
- 语言匹配 (30%) — 仓库主语言是否在偏好中
- 技术栈匹配 (25%) — topics/描述与标签交集
- 活跃度 (15%) — 最近更新时间
- 社区 (10%) — 星标数在偏好范围内
- Issue 友好度 (10%) — 开放 Issue 数量
- 新鲜度 (10%) — 仓库年龄

### 3. Issue 分析
- Markdown 渲染 Issue 正文
- LLM (OpenAI) 智能分析：难度评估、时间预估、建议方向、涉及文件

### 4. Draft PR 流程 (预留)
- Fork 仓库 → Clone → 创建分支 → 提交 → 推送 → 创建 Draft PR
- 通过 Octokit API 和系统 git 命令实现

### 5. 主题系统
- 深色 / 浅色 / 跟随系统 三态切换
- 紫藤品牌色：Primary #7C4DFF, Secondary #00E5FF
- 玻璃拟态卡片、渐变按钮、conic-gradient 分数徽章

## 数据库设计

6 张表：`preferences`, `tech_tags`, `saved_repos`, `saved_issues`, `app_settings`, `pr_history`
- 通过 Rust 侧 `tauri-plugin-sql` 的 Migration 机制自动建表
- 所有数据存储在本地 SQLite，零网络传输

## 验证结果

- ✅ TypeScript 编译 — 零错误
- ✅ Rust 编译 — 成功
- ✅ `pnpm tauri dev` — 应用启动成功

## 运行方式

```bash
cd Wisteria
pnpm install
pnpm tauri dev
```

## 使用指南

1. 打开应用 → 前往「设置」页配置 GitHub Token
2. 前往「偏好设置」添加你的技术栈标签
3. 回到「仪表盘」查看推荐项目
4. 或前往「探索」页搜索指定项目
5. 点击仓库查看 Issue 列表
6. 点击 Issue 查看详情，使用 AI 分析功能
