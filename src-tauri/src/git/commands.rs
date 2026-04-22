use tauri::State;

use crate::db::Database;

use super::{git_run, git_run_with_auth, GitResult};

/// Read gitPath and githubToken from the database so callers don't need to pass them.
fn read_git_settings(db: &Database) -> (Option<String>, Option<String>) {
    let conn = db.conn();

    let git_path: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'gitPath'",
            [],
            |row| row.get(0),
        )
        .ok()
        .filter(|v: &String| !v.trim().is_empty());

    let github_token: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'githubToken'",
            [],
            |row| row.get(0),
        )
        .ok()
        .filter(|v: &String| !v.trim().is_empty());

    (git_path, github_token)
}

// ---- Basic git info commands ----

#[tauri::command]
pub fn git_is_available(
    db: State<'_, Database>,
    git_path: Option<String>,
) -> Result<bool, String> {
    let (saved_path, _) = read_git_settings(&db);
    let path = git_path.or(saved_path);
    let result = git_run(&["--version"], None, path.as_deref());
    Ok(result.success)
}

#[tauri::command]
pub fn git_get_version(
    db: State<'_, Database>,
    git_path: Option<String>,
) -> Result<String, String> {
    let (saved_path, _) = read_git_settings(&db);
    let path = git_path.or(saved_path);
    let result = git_run(&["--version"], None, path.as_deref());
    Ok(result.stdout)
}

// ---- Clone ----

#[tauri::command]
pub fn git_clone(
    db: State<'_, Database>,
    url: String,
    target_dir: String,
    github_token: Option<String>,
) -> GitResult {
    let (saved_path, saved_token) = read_git_settings(&db);
    let token = github_token.or(saved_token);
    git_run_with_auth(
        &["clone", &url, &target_dir],
        None,
        saved_path.as_deref(),
        token.as_deref(),
    )
}

// ---- Checkout ----

#[tauri::command]
pub fn git_checkout_new_branch(
    db: State<'_, Database>,
    repo_dir: String,
    branch_name: String,
) -> GitResult {
    let (saved_path, _) = read_git_settings(&db);
    git_run(
        &["checkout", "-b", &branch_name],
        Some(&repo_dir),
        saved_path.as_deref(),
    )
}

#[tauri::command]
pub fn git_checkout(
    db: State<'_, Database>,
    repo_dir: String,
    branch_name: String,
) -> GitResult {
    let (saved_path, _) = read_git_settings(&db);
    git_run(
        &["checkout", &branch_name],
        Some(&repo_dir),
        saved_path.as_deref(),
    )
}

#[tauri::command]
pub fn git_checkout_branch_from(
    db: State<'_, Database>,
    repo_dir: String,
    branch_name: String,
    start_point: String,
) -> GitResult {
    let (saved_path, _) = read_git_settings(&db);
    git_run(
        &["checkout", "-B", &branch_name, &start_point],
        Some(&repo_dir),
        saved_path.as_deref(),
    )
}

// ---- Stage & Commit ----

#[tauri::command]
pub fn git_add_all(db: State<'_, Database>, repo_dir: String) -> GitResult {
    let (saved_path, _) = read_git_settings(&db);
    git_run(&["add", "-A"], Some(&repo_dir), saved_path.as_deref())
}

#[tauri::command]
pub fn git_commit(
    db: State<'_, Database>,
    repo_dir: String,
    message: String,
) -> GitResult {
    let (saved_path, _) = read_git_settings(&db);
    git_run(
        &["commit", "-m", &message],
        Some(&repo_dir),
        saved_path.as_deref(),
    )
}

// ---- Push ----

#[tauri::command]
pub fn git_push(
    db: State<'_, Database>,
    repo_dir: String,
    remote: String,
    branch: String,
) -> GitResult {
    let (saved_path, _) = read_git_settings(&db);
    git_run(
        &["push", &remote, &branch],
        Some(&repo_dir),
        saved_path.as_deref(),
    )
}

#[tauri::command]
pub fn git_push_with_upstream(
    db: State<'_, Database>,
    repo_dir: String,
    remote: String,
    branch: String,
    github_token: Option<String>,
) -> GitResult {
    let (saved_path, saved_token) = read_git_settings(&db);
    let token = github_token.or(saved_token);
    git_run_with_auth(
        &["push", "-u", &remote, &branch],
        Some(&repo_dir),
        saved_path.as_deref(),
        token.as_deref(),
    )
}

// ---- Fetch ----

#[tauri::command]
pub fn git_fetch(
    db: State<'_, Database>,
    repo_dir: String,
    remote: Option<String>,
    github_token: Option<String>,
) -> GitResult {
    let (saved_path, saved_token) = read_git_settings(&db);
    let token = github_token.or(saved_token);
    let args: Vec<String> = match remote {
        Some(ref r) => vec!["fetch".into(), r.clone(), "--prune".into()],
        None => vec!["fetch".into(), "--all".into(), "--prune".into()],
    };
    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    git_run_with_auth(
        &str_args,
        Some(&repo_dir),
        saved_path.as_deref(),
        token.as_deref(),
    )
}

// ---- Remote management ----

#[tauri::command]
pub fn git_list_remotes(db: State<'_, Database>, repo_dir: String) -> Result<Vec<String>, String> {
    let (saved_path, _) = read_git_settings(&db);
    let result = git_run(&["remote"], Some(&repo_dir), saved_path.as_deref());
    if !result.success || result.stdout.trim().is_empty() {
        return Ok(Vec::new());
    }
    Ok(result
        .stdout
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect())
}

#[tauri::command]
pub fn git_get_remote_url(
    db: State<'_, Database>,
    repo_dir: String,
    name: String,
) -> Result<Option<String>, String> {
    let (saved_path, _) = read_git_settings(&db);
    let result = git_run(
        &["remote", "get-url", &name],
        Some(&repo_dir),
        saved_path.as_deref(),
    );
    if !result.success {
        return Ok(None);
    }
    let val = result.stdout.trim().to_string();
    Ok(if val.is_empty() { None } else { Some(val) })
}

#[tauri::command]
pub fn git_set_remote_url(
    db: State<'_, Database>,
    repo_dir: String,
    name: String,
    url: String,
) -> GitResult {
    let (saved_path, _) = read_git_settings(&db);
    // Check if remote exists first.
    let check = git_run(
        &["remote", "get-url", &name],
        Some(&repo_dir),
        saved_path.as_deref(),
    );
    if check.success {
        git_run(
            &["remote", "set-url", &name, &url],
            Some(&repo_dir),
            saved_path.as_deref(),
        )
    } else {
        git_run(
            &["remote", "add", &name, &url],
            Some(&repo_dir),
            saved_path.as_deref(),
        )
    }
}

#[tauri::command]
pub fn git_add_remote(
    db: State<'_, Database>,
    repo_dir: String,
    name: String,
    url: String,
) -> GitResult {
    let (saved_path, _) = read_git_settings(&db);
    git_run(
        &["remote", "add", &name, &url],
        Some(&repo_dir),
        saved_path.as_deref(),
    )
}

// ---- Branch & status ----

#[tauri::command]
pub fn git_get_current_branch(
    db: State<'_, Database>,
    repo_dir: String,
) -> Result<String, String> {
    let (saved_path, _) = read_git_settings(&db);
    let result = git_run(
        &["rev-parse", "--abbrev-ref", "HEAD"],
        Some(&repo_dir),
        saved_path.as_deref(),
    );
    Ok(result.stdout.trim().to_string())
}

#[tauri::command]
pub fn git_is_repository(
    db: State<'_, Database>,
    repo_dir: String,
) -> Result<bool, String> {
    let (saved_path, _) = read_git_settings(&db);
    let result = git_run(
        &["rev-parse", "--is-inside-work-tree"],
        Some(&repo_dir),
        saved_path.as_deref(),
    );
    Ok(result.success && result.stdout.trim() == "true")
}

#[tauri::command]
pub fn git_status(db: State<'_, Database>, repo_dir: String) -> GitResult {
    let (saved_path, _) = read_git_settings(&db);
    git_run(
        &["status", "--porcelain"],
        Some(&repo_dir),
        saved_path.as_deref(),
    )
}

#[tauri::command]
pub fn git_is_working_tree_clean(
    db: State<'_, Database>,
    repo_dir: String,
) -> Result<bool, String> {
    let (saved_path, _) = read_git_settings(&db);
    let result = git_run(
        &["status", "--porcelain"],
        Some(&repo_dir),
        saved_path.as_deref(),
    );
    Ok(result.success && result.stdout.trim().is_empty())
}

#[tauri::command]
pub fn git_count_commits_ahead(
    db: State<'_, Database>,
    repo_dir: String,
    base_ref: String,
    head_ref: String,
) -> Result<i64, String> {
    let (saved_path, _) = read_git_settings(&db);
    let range = format!("{base_ref}..{head_ref}");
    let result = git_run(
        &["rev-list", "--count", &range],
        Some(&repo_dir),
        saved_path.as_deref(),
    );
    if !result.success {
        return Ok(0);
    }
    Ok(result.stdout.trim().parse::<i64>().unwrap_or(0))
}
