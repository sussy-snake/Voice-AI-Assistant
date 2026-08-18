use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CalendarEventItem {
    pub id: String,
    pub summary: String,
    pub start_time: String,
    pub end_time: String,
    pub description: Option<String>,
    pub html_link: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleOperationResult {
    pub success: bool,
    pub message: String,
    pub details: Option<String>,
}

#[tauri::command]
pub async fn gmail_send_message(
    access_token: String,
    to: String,
    subject: String,
    body: String,
) -> Result<GoogleOperationResult, String> {
    if access_token.trim().is_empty() {
        return Err("Google OAuth Access Token is required to send emails.".into());
    }

    let client = reqwest::Client::new();
    let raw_email = format!(
        "To: {}\r\nSubject: {}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{}",
        to, subject, body
    );

    // Base64URL encoding (without padding)
    let encoded = base64_url_encode(raw_email.as_bytes());

    let payload = serde_json::json!({
        "raw": encoded
    });

    let res = client
        .post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
        .bearer_auth(access_token.trim())
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send Gmail request: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Gmail API error: {}", err_text));
    }

    Ok(GoogleOperationResult {
        success: true,
        message: format!("Email sent successfully to {}!", to),
        details: Some(format!("Subject: {}", subject)),
    })
}

#[tauri::command]
pub async fn calendar_add_event(
    access_token: String,
    title: String,
    start_time: String, // ISO-8601 string
    end_time: String,   // ISO-8601 string
    description: Option<String>,
) -> Result<GoogleOperationResult, String> {
    if access_token.trim().is_empty() {
        return Err("Google OAuth Access Token is required to create calendar events.".into());
    }

    let client = reqwest::Client::new();
    let payload = serde_json::json!({
        "summary": title,
        "description": description.unwrap_or_else(|| "Event scheduled via Voice AI Assistant".into()),
        "start": { "dateTime": start_time },
        "end": { "dateTime": end_time }
    });

    let res = client
        .post("https://www.googleapis.com/calendar/v3/calendars/primary/events")
        .bearer_auth(access_token.trim())
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to create Google Calendar event: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Google Calendar API error: {}", err_text));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let link = json["htmlLink"].as_str().map(|s| s.to_string());

    Ok(GoogleOperationResult {
        success: true,
        message: format!("Event '{}' added to Google Calendar!", title),
        details: link,
    })
}

#[tauri::command]
pub async fn calendar_list_events(
    access_token: String,
    max_results: Option<usize>,
) -> Result<Vec<CalendarEventItem>, String> {
    if access_token.trim().is_empty() {
        return Err("Google OAuth Access Token is missing.".into());
    }

    let client = reqwest::Client::new();
    let limit = max_results.unwrap_or(10);
    let now_iso = chrono::Utc::now().to_rfc3339();

    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={}&maxResults={}&singleEvents=true&orderBy=startTime",
        now_iso, limit
    );

    let res = client
        .get(&url)
        .bearer_auth(access_token.trim())
        .send()
        .await
        .map_err(|e| format!("Failed to retrieve calendar events: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Google Calendar API status: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let items = json["items"].as_array().cloned().unwrap_or_default();

    let events = items
        .into_iter()
        .map(|item| {
            let start = item["start"]["dateTime"]
                .as_str()
                .or_else(|| item["start"]["date"].as_str())
                .unwrap_or("")
                .to_string();
            let end = item["end"]["dateTime"]
                .as_str()
                .or_else(|| item["end"]["date"].as_str())
                .unwrap_or("")
                .to_string();

            CalendarEventItem {
                id: item["id"].as_str().unwrap_or("").to_string(),
                summary: item["summary"].as_str().unwrap_or("Untitled Event").to_string(),
                start_time: start,
                end_time: end,
                description: item["description"].as_str().map(|s| s.to_string()),
                html_link: item["htmlLink"].as_str().map(|s| s.to_string()),
            }
        })
        .collect();

    Ok(events)
}

fn base64_url_encode(input: &[u8]) -> String {
    const STANDARD_ALPHABET: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut result = String::new();
    let mut i = 0;

    while i < input.len() {
        let b0 = input[i] as u32;
        let b1 = if i + 1 < input.len() { input[i + 1] as u32 } else { 0 };
        let b2 = if i + 2 < input.len() { input[i + 2] as u32 } else { 0 };

        let triple = (b0 << 16) | (b1 << 8) | b2;

        result.push(STANDARD_ALPHABET[((triple >> 18) & 0x3F) as usize] as char);
        result.push(STANDARD_ALPHABET[((triple >> 12) & 0x3F) as usize] as char);

        if i + 1 < input.len() {
            result.push(STANDARD_ALPHABET[((triple >> 6) & 0x3F) as usize] as char);
        }
        if i + 2 < input.len() {
            result.push(STANDARD_ALPHABET[(triple & 0x3F) as usize] as char);
        }

        i += 3;
    }

    result
}
