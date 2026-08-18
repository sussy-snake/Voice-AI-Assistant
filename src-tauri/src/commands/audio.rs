use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct WhisperHealthStatus {
    pub is_available: bool,
    pub endpoint: String,
    pub model: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VadAudioStats {
    pub is_speech: bool,
    pub rms_volume: f32,
    pub peak_volume: f32,
}

#[tauri::command]
pub async fn check_whisper_server(endpoint: String) -> Result<WhisperHealthStatus, String> {
    let client = reqwest_like_client(&endpoint).await;
    Ok(WhisperHealthStatus {
        is_available: client,
        endpoint: endpoint.clone(),
        model: "base.en (local-whisper)".into(),
    })
}

async fn reqwest_like_client(endpoint: &str) -> bool {
    let url = format!("{}/health", endpoint.trim_end_matches('/'));
    // Simple TCP or HTTP probe check if available
    let host_port = url
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .split('/')
        .next()
        .unwrap_or("127.0.0.1:8000");

    tokio::net::TcpStream::connect(host_port).await.is_ok()
}

#[tauri::command]
pub async fn process_pcm_chunk(samples: Vec<f32>, threshold: f32) -> Result<VadAudioStats, String> {
    if samples.is_empty() {
        return Ok(VadAudioStats {
            is_speech: false,
            rms_volume: 0.0,
            peak_volume: 0.0,
        });
    }

    let mut sum_sq = 0.0f32;
    let mut peak = 0.0f32;

    for &s in &samples {
        let abs_val = s.abs();
        if abs_val > peak {
            peak = abs_val;
        }
        sum_sq += s * s;
    }

    let rms = (sum_sq / samples.len() as f32).sqrt();
    let is_speech = rms > threshold;

    Ok(VadAudioStats {
        is_speech,
        rms_volume: rms,
        peak_volume: peak,
    })
}
