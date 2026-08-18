use serde::{Deserialize, Serialize};
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, RefreshKind, System};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskMetric {
    pub name: String,
    pub mount_point: String,
    pub total_space_gb: f64,
    pub available_space_gb: f64,
    pub used_space_gb: f64,
    pub usage_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatus {
    pub cpu_usage_percent: f32,
    pub cpu_cores: usize,
    pub cpu_brand: String,
    pub total_memory_mb: u64,
    pub used_memory_mb: u64,
    pub memory_usage_percent: f64,
    pub total_swap_mb: u64,
    pub used_swap_mb: u64,
    pub uptime_seconds: u64,
    pub os_name: String,
    pub kernel_version: String,
    pub host_name: String,
    pub disks: Vec<DiskMetric>,
}

#[tauri::command]
pub async fn system_status() -> Result<SystemStatus, String> {
    let mut sys = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    );

    // Wait a brief moment for CPU delta calculation
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    sys.refresh_cpu();
    sys.refresh_memory();

    let cpu_usage_percent = sys.global_cpu_info().cpu_usage();
    let cpu_cores = sys.cpus().len();
    let cpu_brand = sys
        .cpus()
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());

    let total_memory_mb = sys.total_memory() / (1024 * 1024);
    let used_memory_mb = sys.used_memory() / (1024 * 1024);
    let memory_usage_percent = if total_memory_mb > 0 {
        (used_memory_mb as f64 / total_memory_mb as f64) * 100.0
    } else {
        0.0
    };

    let total_swap_mb = sys.total_swap() / (1024 * 1024);
    let used_swap_mb = sys.used_swap() / (1024 * 1024);
    let uptime_seconds = System::uptime();

    let os_name = System::name().unwrap_or_else(|| "Unknown OS".to_string());
    let kernel_version = System::kernel_version().unwrap_or_else(|| "Unknown Kernel".to_string());
    let host_name = System::host_name().unwrap_or_else(|| "localhost".to_string());

    let disks_info = Disks::new_with_refreshed_list();
    let mut disks = Vec::new();

    for d in disks_info.list() {
        let total = d.total_space() as f64 / (1024.0 * 1024.0 * 1024.0);
        let available = d.available_space() as f64 / (1024.0 * 1024.0 * 1024.0);
        let used = (total - available).max(0.0);
        let usage_percent = if total > 0.0 { (used / total) * 100.0 } else { 0.0 };

        disks.push(DiskMetric {
            name: d.name().to_string_lossy().to_string(),
            mount_point: d.mount_point().to_string_lossy().to_string(),
            total_space_gb: (total * 100.0).round() / 100.0,
            available_space_gb: (available * 100.0).round() / 100.0,
            used_space_gb: (used * 100.0).round() / 100.0,
            usage_percent: (usage_percent * 10.0).round() / 10.0,
        });
    }

    Ok(SystemStatus {
        cpu_usage_percent: (cpu_usage_percent * 10.0).round() / 10.0,
        cpu_cores,
        cpu_brand,
        total_memory_mb,
        used_memory_mb,
        memory_usage_percent: (memory_usage_percent * 10.0).round() / 10.0,
        total_swap_mb,
        used_swap_mb,
        uptime_seconds,
        os_name,
        kernel_version,
        host_name,
        disks,
    })
}
