use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatusResult {
    pub is_repo: bool,
    pub current_branch: String,
    pub status_text: String,
    pub modified_files: Vec<String>,
    pub untracked_files: Vec<String>,
    pub clean: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubRepo {
    pub name: String,
    pub html_url: String,
    pub clone_url: String,
    pub private: bool,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitOperationResult {
    pub success: bool,
    pub message: String,
    pub output: Option<String>,
    pub repo_url: Option<String>,
}

#[tauri::command]
pub async fn git_status_check(folder_path: Option<String>) -> Result<GitStatusResult, String> {
    let path = folder_path.unwrap_or_else(|| ".".to_string());

    let branch_output = Command::new("git")
        .current_dir(&path)
        .args(["branch", "--show-current"])
        .output();

    let branch = match branch_output {
        Ok(out) if out.status.success() => {
            String::from_utf8_lossy(&out.stdout).trim().to_string()
        }
        _ => "main".to_string(),
    };

    let status_cmd = Command::new("git")
        .current_dir(&path)
        .args(["status", "--porcelain"])
        .output();

    match status_cmd {
        Ok(out) if out.status.success() => {
            let output_str = String::from_utf8_lossy(&out.stdout).to_string();
            let mut modified = Vec::new();
            let mut untracked = Vec::new();

            for line in output_str.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("??") {
                    untracked.push(trimmed.trim_start_matches("??").trim().to_string());
                } else if !trimmed.is_empty() {
                    modified.push(trimmed.to_string());
                }
            }

            Ok(GitStatusResult {
                is_repo: true,
                current_branch: if branch.is_empty() { "main".into() } else { branch },
                status_text: output_str.clone(),
                modified_files: modified,
                untracked_files: untracked,
                clean: output_str.trim().is_empty(),
            })
        }
        _ => Ok(GitStatusResult {
            is_repo: false,
            current_branch: "none".into(),
            status_text: "Directory is not a git repository.".into(),
            modified_files: vec![],
            untracked_files: vec![],
            clean: true,
        }),
    }
}

#[tauri::command]
pub async fn git_commit_and_push(
    folder_path: Option<String>,
    commit_message: String,
    branch: Option<String>,
) -> Result<GitOperationResult, String> {
    let path = folder_path.unwrap_or_else(|| ".".to_string());
    let target_branch = branch.unwrap_or_else(|| "main".to_string());

    // 1. Stage changes
    let add_res = Command::new("git")
        .current_dir(&path)
        .args(["add", "."])
        .output()
        .map_err(|e| format!("Failed to run git add: {}", e))?;

    if !add_res.status.success() {
        return Err(format!(
            "git add failed: {}",
            String::from_utf8_lossy(&add_res.stderr)
        ));
    }

    // 2. Commit
    let msg = if commit_message.trim().is_empty() {
        "Auto-commit by Voice AI Assistant".to_string()
    } else {
        commit_message
    };

    let commit_res = Command::new("git")
        .current_dir(&path)
        .args(["commit", "-m", &msg])
        .output()
        .map_err(|e| format!("Failed to run git commit: {}", e))?;

    let commit_output = String::from_utf8_lossy(&commit_res.stdout).to_string();

    // 3. Push
    let push_res = Command::new("git")
        .current_dir(&path)
        .args(["push", "origin", &target_branch])
        .output();

    let push_msg = match push_res {
        Ok(p) if p.status.success() => "Pushed changes successfully to remote repository.".into(),
        Ok(p) => format!(
            "Committed locally. Push note: {}",
            String::from_utf8_lossy(&p.stderr)
        ),
        Err(e) => format!("Committed locally. Push error: {}", e),
    };

    Ok(GitOperationResult {
        success: true,
        message: format!("Commit complete! {}", push_msg),
        output: Some(commit_output),
        repo_url: None,
    })
}

#[tauri::command]
pub async fn git_create_repo(
    github_token: String,
    repo_name: String,
    is_private: bool,
    description: Option<String>,
    local_folder_path: Option<String>,
) -> Result<GitOperationResult, String> {
    if github_token.trim().is_empty() {
        return Err("GitHub Personal Access Token is required to create a repository.".into());
    }

    let client = reqwest::Client::new();
    let payload = serde_json::json!({
        "name": repo_name,
        "private": is_private,
        "description": description.unwrap_or_else(|| "Repository created with Local Voice AI Assistant".into()),
        "auto_init": false
    });

    let res = client
        .post("https://api.github.com/user/repos")
        .header("Authorization", format!("Bearer {}", github_token.trim()))
        .header("User-Agent", "Local-Voice-AI-Assistant")
        .header("Accept", "application/vnd.github.v3+json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to GitHub API: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("GitHub API error: {}", err_text));
    }

    let repo_json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

    let clone_url = repo_json["clone_url"].as_str().unwrap_or("").to_string();
    let html_url = repo_json["html_url"].as_str().unwrap_or("").to_string();

    // Link local directory if requested
    if let Some(path) = local_folder_path {
        let _ = Command::new("git").current_dir(&path).args(["init"]).output();
        let _ = Command::new("git")
            .current_dir(&path)
            .args(["remote", "add", "origin", &clone_url])
            .output();
        let _ = Command::new("git")
            .current_dir(&path)
            .args(["branch", "-M", "main"])
            .output();
        let _ = Command::new("git").current_dir(&path).args(["add", "."]).output();
        let _ = Command::new("git")
            .current_dir(&path)
            .args(["commit", "-m", "Initial commit from Voice AI Assistant"])
            .output();
        let _ = Command::new("git")
            .current_dir(&path)
            .args(["push", "-u", "origin", "main"])
            .output();
    }

    Ok(GitOperationResult {
        success: true,
        message: format!("GitHub repository '{}' created successfully!", repo_name),
        output: Some(format!("Remote URL: {}", clone_url)),
        repo_url: Some(html_url),
    })
}

#[tauri::command]
pub async fn git_list_user_repos(github_token: String) -> Result<Vec<GitHubRepo>, String> {
    if github_token.trim().is_empty() {
        return Err("GitHub token missing".into());
    }

    let client = reqwest::Client::new();
    let res = client
        .get("https://api.github.com/user/repos?sort=updated&per_page=15")
        .header("Authorization", format!("Bearer {}", github_token.trim()))
        .header("User-Agent", "Local-Voice-AI-Assistant")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("GitHub API returned status: {}", res.status()));
    }

    let repos: Vec<serde_json::Value> = res.json().await.map_err(|e| e.to_string())?;
    let list = repos
        .into_iter()
        .map(|r| GitHubRepo {
            name: r["name"].as_str().unwrap_or("").to_string(),
            html_url: r["html_url"].as_str().unwrap_or("").to_string(),
            clone_url: r["clone_url"].as_str().unwrap_or("").to_string(),
            private: r["private"].as_bool().unwrap_or(false),
            description: r["description"].as_str().map(|s| s.to_string()),
        })
        .collect();

    Ok(list)
}
