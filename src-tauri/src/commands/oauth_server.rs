use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const DEFAULT_CLIENT_ID: &str = "407408718192.apps.googleusercontent.com";
const LOOPBACK_PORT: u16 = 8989;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokensPayload {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<u64>,
    pub token_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthStartResult {
    pub success: bool,
    pub auth_url: String,
    pub message: String,
}

#[tauri::command]
pub async fn start_oauth_loopback_flow(
    app: AppHandle,
    client_id: Option<String>,
) -> Result<OAuthStartResult, String> {
    let cid = client_id.unwrap_or_else(|| DEFAULT_CLIENT_ID.to_string());
    let redirect_uri = format!("http://127.0.0.1:{}/callback", LOOPBACK_PORT);

    let scopes = [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ]
    .join(" ");

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
        urlencoding::encode(&cid),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&scopes)
    );

    // Spawn async background TCP server to catch the redirect code
    let app_handle = app.clone();
    let cid_clone = cid.clone();
    let redirect_uri_clone = redirect_uri.clone();

    tokio::spawn(async move {
        if let Err(e) = run_loopback_listener(app_handle, cid_clone, redirect_uri_clone).await {
            log::error!("OAuth loopback server error: {}", e);
        }
    });

    // Automatically launch default system browser
    if let Err(e) = open_browser(&auth_url) {
        log::warn!("Could not launch browser automatically: {}", e);
    }

    Ok(OAuthStartResult {
        success: true,
        auth_url,
        message: "OAuth loopback server is listening on port 8989. Browser launched!".into(),
    })
}

async fn run_loopback_listener(
    app: AppHandle,
    client_id: String,
    redirect_uri: String,
) -> Result<(), String> {
    let addr: SocketAddr = format!("127.0.0.1:{}", LOOPBACK_PORT)
        .parse()
        .map_err(|e| format!("Invalid socket address: {}", e))?;

    let listener = TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind loopback TCP server: {}", e))?;

    log::info!("OAuth loopback server listening on {}", addr);

    // Accept single connection
    if let Ok((mut stream, _)) = listener.accept().await {
        let mut buffer = [0u8; 4096];
        let bytes_read = stream
            .read(&mut buffer)
            .await
            .map_err(|e| format!("Failed to read from TCP stream: {}", e))?;

        let request_str = String::from_utf8_lossy(&buffer[..bytes_read]);

        // Extract authorization code from GET query
        let code_opt = extract_query_param(&request_str, "code");

        if let Some(code) = code_opt {
            // Exchange code for tokens via Google OAuth token endpoint
            let exchange_res = exchange_code_for_tokens(&code, &client_id, &redirect_uri).await;

            match exchange_res {
                Ok(tokens) => {
                    // Send success glassmorphic HTML page
                    let response_body = build_success_html();
                    let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        response_body.len(),
                        response_body
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                    let _ = stream.flush().await;

                    // Emit tokens event to Tauri frontend
                    let _ = app.emit("oauth-tokens-received", tokens);
                }
                Err(err) => {
                    let err_body = format!("<html><body><h2>Authentication Error</h2><p>{}</p></body></html>", err);
                    let response = format!(
                        "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        err_body.len(),
                        err_body
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
        } else {
            let not_found = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
            let _ = stream.write_all(not_found.as_bytes()).await;
        }
    }

    Ok(())
}

async fn exchange_code_for_tokens(
    code: &str,
    client_id: &str,
    redirect_uri: &str,
) -> Result<OAuthTokensPayload, String> {
    let client = reqwest::Client::new();
    let params = [
        ("code", code),
        ("client_id", client_id),
        ("redirect_uri", redirect_uri),
        ("grant_type", "authorization_code"),
    ];

    let res = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to call token endpoint: {}", e))?;

    if res.status().is_success() {
        let data: serde_json::Value = res.json().await.unwrap_or_default();
        let access_token = data["access_token"]
            .as_str()
            .ok_or_else(|| "Missing access_token in response".to_string())?
            .to_string();

        let refresh_token = data["refresh_token"].as_str().map(|s| s.to_string());
        let expires_in = data["expires_in"].as_u64();
        let token_type = data["token_type"].as_str().map(|s| s.to_string());

        Ok(OAuthTokensPayload {
            access_token,
            refresh_token,
            expires_in,
            token_type,
        })
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(format!("Token exchange failed: {}", err_text))
    }
}

fn extract_query_param(request: &str, param_name: &str) -> Option<String> {
    let first_line = request.lines().next()?;
    let path = first_line.split_whitespace().nth(1)?;
    let query_str = path.split('?').nth(1)?;

    for pair in query_str.split('&') {
        let mut parts = pair.split('=');
        if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
            if k == param_name {
                return Some(urlencoding::decode(v).unwrap_or_default().into_owned());
            }
        }
    }
    None
}

fn open_browser(url: &str) -> Result<(), std::io::Error> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(url).spawn()?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(url).spawn()?;
    }
    Ok(())
}

fn build_success_html() -> String {
    r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Voice AI Assistant - Authenticated</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: radial-gradient(circle at 50% 50%, #1e1b4b 0%, #030712 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .card {
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 24px;
      padding: 40px 48px;
      text-align: center;
      max-width: 440px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
      display: inline-block;
      animation: pulse 2s infinite ease-in-out;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 12px 0;
      background: linear-gradient(135deg, #38bdf8, #818cf8, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 24px 0;
    }
    .badge {
      display: inline-block;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 16px;
      border-radius: 9999px;
      letter-spacing: 0.5px;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.08); }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✨</div>
    <h1>Google Account Connected!</h1>
    <p>Your Voice AI Assistant has captured and securely stored your authentication tokens. You can now close this tab and return to the assistant window.</p>
    <span class="badge">✓ TOKENS SYNCED SECURELY</span>
  </div>
</body>
</html>"#
        .to_string()
}
