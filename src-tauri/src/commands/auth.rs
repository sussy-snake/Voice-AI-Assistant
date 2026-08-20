use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthTestResult {
    pub is_valid: bool,
    pub is_expiring_soon: bool,
    pub expires_in_seconds: Option<u64>,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthRefreshResult {
    pub success: bool,
    pub access_token: Option<String>,
    pub message: String,
}

#[tauri::command]
pub async fn auth_test_github_token(token: String) -> Result<AuthTestResult, String> {
    if token.trim().is_empty() {
        return Ok(AuthTestResult {
            is_valid: false,
            is_expiring_soon: false,
            expires_in_seconds: None,
            message: "No GitHub token configured.".into(),
            details: None,
        });
    }

    let client = reqwest::Client::new();
    let res = client
        .get("https://api.github.com/user")
        .bearer_auth(token.trim())
        .header("User-Agent", "Voice-AI-Assistant")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if res.status().is_success() {
        let data: serde_json::Value = res.json().await.unwrap_or_default();
        let login = data["login"].as_str().unwrap_or("user");
        let name = data["name"].as_str().unwrap_or(login);
        Ok(AuthTestResult {
            is_valid: true,
            is_expiring_soon: false,
            expires_in_seconds: None,
            message: format!("Connected as @{} ({})", login, name),
            details: Some(data),
        })
    } else {
        Ok(AuthTestResult {
            is_valid: false,
            is_expiring_soon: false,
            expires_in_seconds: None,
            message: format!("GitHub Token rejected (Status: {})", res.status()),
            details: None,
        })
    }
}

#[tauri::command]
pub async fn auth_test_gemini_key(api_key: String) -> Result<AuthTestResult, String> {
    if api_key.trim().is_empty() {
        return Ok(AuthTestResult {
            is_valid: false,
            is_expiring_soon: false,
            expires_in_seconds: None,
            message: "No Gemini API key configured.".into(),
            details: None,
        });
    }

    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models?key={}",
        api_key.trim()
    );

    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if res.status().is_success() {
        let data: serde_json::Value = res.json().await.unwrap_or_default();
        let count = data["models"].as_array().map(|a| a.len()).unwrap_or(0);
        Ok(AuthTestResult {
            is_valid: true,
            is_expiring_soon: false,
            expires_in_seconds: None,
            message: format!("Gemini 2.0 Flash is Active ({} models accessible).", count),
            details: Some(serde_json::json!({ "model_count": count })),
        })
    } else {
        Ok(AuthTestResult {
            is_valid: false,
            is_expiring_soon: false,
            expires_in_seconds: None,
            message: format!("Gemini API key is invalid or quota exceeded (Status: {})", res.status()),
            details: None,
        })
    }
}

#[tauri::command]
pub async fn auth_test_google_token(access_token: String) -> Result<AuthTestResult, String> {
    if access_token.trim().is_empty() {
        return Ok(AuthTestResult {
            is_valid: false,
            is_expiring_soon: false,
            expires_in_seconds: None,
            message: "No Google OAuth Access Token configured.".into(),
            details: None,
        });
    }

    let client = reqwest::Client::new();
    let url = format!(
        "https://www.googleapis.com/oauth2/v1/tokeninfo?access_token={}",
        access_token.trim()
    );

    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if res.status().is_success() {
        let data: serde_json::Value = res.json().await.unwrap_or_default();
        let expires_in = data["expires_in"].as_u64().unwrap_or(0);
        let is_expiring_soon = expires_in < 300;
        let email = data["email"].as_str().unwrap_or("Connected Google User");

        Ok(AuthTestResult {
            is_valid: true,
            is_expiring_soon,
            expires_in_seconds: Some(expires_in),
            message: if is_expiring_soon {
                format!("Token for {} expiring in {}m (Auto-refresh armed)", email, expires_in / 60)
            } else {
                format!("Token for {} is active ({}m remaining)", email, expires_in / 60)
            },
            details: Some(data),
        })
    } else {
        Ok(AuthTestResult {
            is_valid: false,
            is_expiring_soon: true,
            expires_in_seconds: Some(0),
            message: "Google OAuth token is expired or invalid.".into(),
            details: None,
        })
    }
}

#[tauri::command]
pub async fn auth_refresh_google_token(refresh_token: String) -> Result<AuthRefreshResult, String> {
    if refresh_token.trim().is_empty() {
        return Ok(AuthRefreshResult {
            success: false,
            access_token: None,
            message: "No refresh token provided.".into(),
        });
    }

    let client = reqwest::Client::new();
    let params = [
        ("client_id", "407408718192.apps.googleusercontent.com"),
        ("refresh_token", refresh_token.trim()),
        ("grant_type", "refresh_token"),
    ];

    let res = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network error during token refresh: {}", e))?;

    if res.status().is_success() {
        let data: serde_json::Value = res.json().await.unwrap_or_default();
        if let Some(new_token) = data["access_token"].as_str() {
            return Ok(AuthRefreshResult {
                success: true,
                access_token: Some(new_token.to_string()),
                message: "Successfully auto-refreshed Google Access Token!".into(),
            });
        }
    }

    let err_body = res.text().await.unwrap_or_default();
    Ok(AuthRefreshResult {
        success: false,
        access_token: None,
        message: format!("Google OAuth refresh failed: {}", err_body),
    })
}
