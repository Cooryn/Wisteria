# Wisteria

Wisteria is a local-first desktop app that helps you:

- describe your contributor profile and weekly bandwidth
- scan GitHub for public repositories and issues that fit that profile
- rank issues with explainable rule-based scoring
- generate a local Draft PR workspace for the issue you choose

## Stack

- Tauri 2
- React + TypeScript + Vite
- Rust for sensitive/system commands
- SQLite for local state
- Octokit for GitHub API calls
- Stronghold guest bindings for local secret storage

## Current MVP Shape

- single local profile
- manual scan only
- public GitHub issues only
- no cloning, pushing, or remote Draft PR creation yet
- Rust-side LLM relay with frontend fallback template generation

## Local Setup

1. Install Rust via `rustup` and ensure `cargo` / `rustc` are on PATH.
2. Install project dependencies with `npm install`.
3. Run the frontend with `npm run dev`.
4. Once Rust is installed, launch the desktop shell with `npm run tauri dev`.

## Notes

- The app uses a Stronghold-backed local vault for persisted GitHub and LLM credentials, then hydrates them into the Rust session on startup.
- If the LLM relay is not configured or fails, Draft PR generation falls back to a deterministic local template.
