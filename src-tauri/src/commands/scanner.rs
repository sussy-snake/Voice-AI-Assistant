use ignore::WalkBuilder;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMatch {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub extension: Option<String>,
    pub modified_at: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct ScanOptions {
    pub query: Option<String>,
    pub path: Option<String>,
    pub extensions: Option<Vec<String>>,
    pub max_depth: Option<usize>,
    pub max_results: Option<usize>,
    pub include_hidden: Option<bool>,
}

#[tauri::command]
pub async fn scan_filesystem(options: ScanOptions) -> Result<Vec<FileMatch>, String> {
    let start_path = match options.path {
        Some(ref p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")),
    };

    if !start_path.exists() {
        return Err(format!("Search root path does not exist: {:?}", start_path));
    }

    let max_results = options.max_results.unwrap_or(50);
    let extensions: Option<Vec<String>> = options
        .extensions
        .map(|exts| exts.into_iter().map(|e| e.to_lowercase().trim_start_matches('.').to_string()).collect());

    let regex_matcher = if let Some(ref q) = options.query {
        if !q.trim().is_empty() {
            Regex::new(&format!("(?i){}", regex::escape(q))).ok()
        } else {
            None
        }
    } else {
        None
    };

    let mut builder = WalkBuilder::new(&start_path);
    builder
        .hidden(!options.include_hidden.unwrap_or(false))
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .parents(true)
        .max_depth(options.max_depth);

    let walker = builder.build();
    let mut matches = Vec::new();

    for result in walker {
        if matches.len() >= max_results {
            break;
        }

        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        if path == start_path {
            continue;
        }

        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        // Filter by extension if specified
        let file_ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase());

        if let Some(ref target_exts) = extensions {
            if let Some(ref ext) = file_ext {
                if !target_exts.contains(ext) {
                    continue;
                }
            } else {
                continue;
            }
        }

        // Match query if specified
        if let Some(ref regex) = regex_matcher {
            if !regex.is_match(&file_name) && !regex.is_match(&path.to_string_lossy()) {
                continue;
            }
        }

        let metadata = entry.metadata().ok();
        let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified_at = metadata
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs());

        matches.push(FileMatch {
            name: file_name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            size_bytes,
            extension: file_ext,
            modified_at,
        });
    }

    Ok(matches)
}

#[tauri::command]
pub async fn open_file_path(path: String) -> Result<bool, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("File path does not exist".into());
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(true)
}
