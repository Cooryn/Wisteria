# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Wisteria** is a desktop app (Tauri 2 + React 19 + TypeScript + Rust) that helps developers discover GitHub projects matching their tech stack, find suitable issues, and orchestrate fork→clone→branch→commit→PR contribution workflows.

## Commands

```bash
pnpm dev              # Start Vite dev server only (port 5432)
pnpm tauri dev        # Launch full desktop app in dev mode (runs frontend + Rust backend)
pnpm build            # TypeScript compile + Vite bundle
pnpm tauri build      # Build distributable desktop installer
pnpm knip             # Scan for unused exports/code
```

There is no test suite or lint script configured. TypeScript strict mode is on — `pnpm build` is the type-check step.

## Architecture

### Stack

- **Frontend:** React 19, TypeScript 5.8, Material-UI 6, Zustand 5 (state), Vite 7
- **Backend:** Rust (Tauri 2), rusqlite (SQLite), reqwest (HTTP), tauri-plugin-shell (git)
- **Bridge:** Tauri IPC via `invoke()` — all frontend↔Rust calls are typed wrappers in `src/services/`

### Data Flow

```
React Pages → Zustand Store → Services (src/services/*.ts)
                                  ↓
                         Tauri invoke() calls
                                  ↓
                    Rust handlers (src-tauri/src/)
                     ├── db/  → SQLite (~/.wisteria/wisteria.db)
                     ├── git/ → system git CLI (shelled out)
                     └── llm/ → OpenAI-compatible HTTP API
```

GitHub API calls (Octokit) happen entirely on the frontend in `src/services/github.ts`.

### Frontend Structure

| Layer | Location | Responsibility |
|---|---|---|
| Pages | `src/pages/*.tsx` | Route components, coordinate data loading, local page state |
| Components | `src/components/` | Reusable UI (cards, sidebar, layout) |
| Services | `src/services/*.ts` | Business logic, API calls, Tauri invokes — no React deps |
| Store | `src/store/index.ts` | Single Zustand store for all global state |
| Types | `src/types/index.ts` | All TypeScript interfaces |
| Theme | `src/theme/index.ts` | MUI light/dark/system theme (brand: `#7C4DFF` purple + `#00E5FF` cyan) |

Routing is a simple `switch(currentPage)` in `App.tsx` driven by `setCurrentPage()` in Zustand — no React Router.

### Tauri IPC Pattern

```typescript
// Frontend (src/services/database.ts, git.ts, etc.)
import { invoke } from '@tauri-apps/api/core';
const result = await invoke<T>('command_name', { arg1, arg2 });
```

```rust
// Rust (src-tauri/src/lib.rs registers; db/, git/, llm/ implement)
#[tauri::command]
fn command_name(arg1: String, db: State<Database>) -> Result<T, String> { ... }
```

All Tauri commands are registered in `src-tauri/src/lib.rs` and implemented in submodules.

### Database

SQLite at `~/.wisteria/wisteria.db` with 6 tables: `preferences`, `tech_tags`, `saved_repos`, `saved_issues`, `app_settings`, `pr_history`, `contribution_sessions`.

Schema migrations run automatically on startup via `run_migrations()` in `src-tauri/src/db/mod.rs`. When adding columns, add a new migration version there.

### Scoring Engine

`src/services/scorer.ts` — deterministic 6-dimension weighted scoring:
- `languageMatch` (30%), `techStackMatch` (25%), `activeness` (15%), `community` (10%), `issueFriendliness` (10%), `freshness` (10%)

Results displayed via `ScoreBadge` component (conic-gradient visualization).

### Contribution Workflow

`src/services/contribution.ts` orchestrates: fork check → clone → fetch upstream → create branch → user edits → commit → push → create draft PR → save session to DB. Each step calls the appropriate Tauri git command.

### App Bootstrap

`useAppBootstrap` in `App.tsx` runs on startup: loads all settings + preferences in parallel (`Promise.allSettled`), initializes Octokit if GitHub token exists, validates OpenAI key if configured.
