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
pub struct GmailMessageSummary {
    pub id: String,
    pub thread_id: String,
    pub snippet: String,
    pub sender: Option<String>,
    pub subject: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GmailMessageDetail {
    pub id: String,
    pub thread_id: String,
    pub sender: String,
    pub to: String,
    pub subject: String,
    pub date: String,
    pub snippet: String,
    pub body_plain: String,
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
pub async fn gmail_list_messages(
    access_token: String,
    query: Option<String>,
    max_results: Option<usize>,
) -> Result<Vec<GmailMessageSummary>, String> {
    if access_token.trim().is_empty() {
        return Err("Google OAuth Access Token is required.".into());
    }

    let client = reqwest::Client::new();
    let limit = max_results.unwrap_or(10);
    let mut url = format!(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults={}",
        limit
    );

    if let Some(ref q) = query {
        if !q.trim().is_empty() {
            url.push_str(&format!("&q={}", urlencoding(q.trim())));
        }
    }

    let res = client
        .get(&url)
        .bearer_auth(access_token.trim())
        .send()
        .await
        .map_err(|e| format!("Failed to fetch Gmail messages: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Gmail API error: {}", err_text));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let raw_messages = json["messages"].as_array().cloned().unwrap_or_default();

    let mut summaries = Vec::new();

    for msg in raw_messages {
        let id = match msg["id"].as_str() {
            Some(id) => id,
            None => continue,
        };

        // Fetch snippet & headers for each message
        let detail_url = format!(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/{}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date",
            id
        );

        if let Ok(detail_res) = client.get(&detail_url).bearer_auth(access_token.trim()).send().await {
            if let Ok(detail_json) = detail_res.json::<serde_json::Value>().await {
                let mut sender = None;
                let mut subject = None;
                let mut date = None;

                if let Some(headers) = detail_json["payload"]["headers"].as_array() {
                    for h in headers {
                        let name = h["name"].as_str().unwrap_or("");
                        let val = h["value"].as_str().unwrap_or("").to_string();
                        if name.eq_ignore_ascii_case("from") {
                            sender = Some(val);
                        } else if name.eq_ignore_ascii_case("subject") {
                            subject = Some(val);
                        } else if name.eq_ignore_ascii_case("date") {
                            date = Some(val);
                        }
                    }
                }

                summaries.push(GmailMessageSummary {
                    id: id.to_string(),
                    thread_id: detail_json["threadId"].as_str().unwrap_or("").to_string(),
                    snippet: detail_json["snippet"].as_str().unwrap_or("").to_string(),
                    sender,
                    subject,
                    date,
                });
            }
        }
    }

    Ok(summaries)
}

#[tauri::command]
pub async fn gmail_read_message(
    access_token: String,
    message_id: String,
) -> Result<GmailMessageDetail, String> {
    if access_token.trim().is_empty() {
        return Err("Google OAuth Access Token is required.".into());
    }

    let client = reqwest::Client::new();
    let url = format!(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/{}?format=full",
        message_id
    );

    let res = client
        .get(&url)
        .bearer_auth(access_token.trim())
        .send()
        .await
        .map_err(|e| format!("Failed to read Gmail message: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Gmail API error: {}", err_text));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    let mut sender = "Unknown Sender".to_string();
    let mut to = "Me".to_string();
    let mut subject = "No Subject".to_string();
    let mut date = "".to_string();

    if let Some(headers) = json["payload"]["headers"].as_array() {
        for h in headers {
            let name = h["name"].as_str().unwrap_or("");
            let val = h["value"].as_str().unwrap_or("").to_string();
            if name.eq_ignore_ascii_case("from") {
                sender = val;
            } else if name.eq_ignore_ascii_case("to") {
                to = val;
            } else if name.eq_ignore_ascii_case("subject") {
                subject = val;
            } else if name.eq_ignore_ascii_case("date") {
                date = val;
            }
        }
    }

    let snippet = json["snippet"].as_str().unwrap_or("").to_string();
    let body_plain = extract_plain_body(&json["payload"]);

    Ok(GmailMessageDetail {
        id: message_id,
        thread_id: json["threadId"].as_str().unwrap_or("").to_string(),
        sender,
        to,
        subject,
        date,
        snippet,
        body_plain: if body_plain.is_empty() { snippet.clone() } else { body_plain },
    })
}

#[tauri::command]
pub async fn calendar_add_event(
    access_token: String,
    title: String,
    start_time: String,
    end_time: String,
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

fn extract_plain_body(payload: &serde_json::Value) -> String {
    if let Some(mime) = payload["mimeType"].as_str() {
        if mime == "text/plain" {
            if let Some(data) = payload["body"]["data"].as_str() {
                if let Ok(bytes) = base64_url_decode(data) {
                    return String::from_utf8_lossy(&bytes).to_string();
                }
            }
        }
    }

    if let Some(parts) = payload["parts"].as_array() {
        for part in parts {
            let res = extract_plain_body(part);
            if !res.is_empty() {
                return res;
            }
        }
    }

    "".to_string()
}

fn urlencoding(input: &str) -> String {
    input.replace(' ', "+").replace(':', "%3A").replace('@', "%40")
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

fn base64_url_decode(input: &str) -> Result<Vec<u8>, ()> {
    let mut s = input.replace('-', "+").replace('_', "/");
    while s.len() % 4 != 0 {
        s.push('=');
    }

    // Basic decoder
    let bytes = base64_simple_decode(&s).map_err(|_| ())?;
    Ok(bytes)
}

fn base64_simple_decode(input: &str) -> Result<Vec<u8>, ()> {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = Vec::new();
    let bytes: Vec<u8> = input.bytes().filter(|&b| b != b'\r' && b != b'\n').collect();

    for chunk in bytes.chunks(4) {
        if chunk.len() < 2 { break; }
        let mut buf = [0u8; 4];
        let mut count = 0;

        for &c in chunk {
            if c == b'=' { break; }
            if let Some(pos) = TABLE.iter().position(|&x| x == c) {
                buf[count] = pos as u8;
                count += 1;
            }
        }

        if count >= 2 {
            out.push((buf[0] << 2) | (buf[1] >> 4));
        }
        if count >= 3 {
            out.push(((buf[1] & 0x0F) << 4) | (buf[2] >> 2));
        }
        if count >= 4 {
            out.push(((buf[2] & 0x03) << 6) | buf[3]);
        }
    }

    Ok(out)
}
