pub mod commands;

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

fn is_git_executable(path: &str) -> bool {
    Path::new(path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map(|stem| stem.eq_ignore_ascii_case("git"))
        .unwrap_or(false)
}

fn resolve_git_path(override_path: Option<&str>) -> &str {
    override_path
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .unwrap_or("git")
}

fn build_github_auth_args(token: Option<&str>) -> Vec<String> {
    let token = match token.map(str::trim).filter(|t| !t.is_empty()) {
        Some(t) => t,
        None => return Vec::new(),
    };

    let credential = format!("x-access-token:{token}");
    let encoded = STANDARD.encode(credential.as_bytes());
    vec![
        "-c".to_string(),
        format!("http.https://github.com/.extraheader=AUTHORIZATION: basic {encoded}"),
    ]
}

fn run_git(
    args: &[&str],
    cwd: Option<&str>,
    git_path: &str,
    prefix_args: &[String],
) -> GitResult {
    if git_path != "git" && !is_git_executable(git_path) {
        return GitResult {
            success: false,
            stdout: String::new(),
            stderr: "Configured Git path must point to a git executable.".into(),
        };
    }

    let mut command = Command::new(git_path);

    for arg in prefix_args {
        command.arg(arg);
    }
    command.args(args);

    if let Some(dir) = cwd.map(str::trim).filter(|d| !d.is_empty()) {
        command.current_dir(dir);
    }

    // Prevent git from prompting for credentials on Windows.
    command.env("GIT_TERMINAL_PROMPT", "0");

    match command.output() {
        Ok(output) => GitResult {
            success: output.status.success(),
            stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
        },
        Err(err) => GitResult {
            success: false,
            stdout: String::new(),
            stderr: err.to_string(),
        },
    }
}

// ---- Public helpers used by the command layer ----

pub fn git_run(args: &[&str], cwd: Option<&str>, git_path: Option<&str>) -> GitResult {
    let path = resolve_git_path(git_path);
    run_git(args, cwd, path, &[])
}

pub fn git_run_with_auth(
    args: &[&str],
    cwd: Option<&str>,
    git_path: Option<&str>,
    token: Option<&str>,
) -> GitResult {
    let path = resolve_git_path(git_path);
    let auth = build_github_auth_args(token);
    run_git(args, cwd, path, &auth)
}
