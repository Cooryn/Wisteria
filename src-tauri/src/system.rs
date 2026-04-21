use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemProbe {
    pub git_version: Option<String>,
    pub cargo_available: bool,
    pub rustc_available: bool,
    pub webview2_available: bool,
    pub tauri_packages_present: bool,
    pub notes: Vec<String>,
}

fn command_output(binary: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(binary).args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

#[cfg(target_os = "windows")]
fn detect_webview2() -> bool {
    let registry_check = Command::new("reg")
        .args([
            "query",
            "HKLM\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
            "/v",
            "pv",
        ])
        .output();

    if let Ok(output) = registry_check {
        if output.status.success() {
            return true;
        }
    }

    Path::new("C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application").exists()
        || Path::new("C:\\Program Files\\Microsoft\\EdgeWebView\\Application").exists()
}

#[cfg(not(target_os = "windows"))]
fn detect_webview2() -> bool {
    true
}

pub fn probe() -> SystemProbe {
    let git_version = command_output("git", &["--version"]);
    let cargo_version = command_output("cargo", &["--version"]);
    let rustc_version = command_output("rustc", &["--version"]);
    let mut notes = Vec::new();

    if cargo_version.is_none() || rustc_version.is_none() {
        notes.push(
            "Rust is not currently available on PATH. Install rustup before building the desktop shell."
                .to_string(),
        );
    }
    if !detect_webview2() {
        notes.push("WebView2 runtime could not be detected on this machine.".to_string());
    }

    let tauri_packages_present = Path::new("../package.json").exists();

    SystemProbe {
        git_version,
        cargo_available: cargo_version.is_some(),
        rustc_available: rustc_version.is_some(),
        webview2_available: detect_webview2(),
        tauri_packages_present,
        notes,
    }
}

