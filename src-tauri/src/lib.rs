pub mod commands;
pub mod db;

use db::Database;
use std::sync::Arc;
use tauri::Manager;

pub fn run() {
    let database = Arc::new(Database::new().expect("Failed to initialize SQLite database"));

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .manage(database.clone())
        .setup(move |app| {
            let app_handle = app.handle().clone();
            commands::scheduler::spawn_scheduler_worker(app_handle, database.clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Filesystem Crawler
            commands::scanner::scan_filesystem,
            commands::scanner::open_file_path,

            // SQLite Task Scheduler
            commands::scheduler::schedule_task,
            commands::scheduler::list_tasks,
            commands::scheduler::toggle_task_completed,
            commands::scheduler::delete_task,
            commands::scheduler::send_desktop_notification,

            // Hardware Telemetry & NPU Compute
            commands::system::system_status,
            commands::hardware_compute::get_hardware_compute_profile,
            commands::hardware_compute::run_hardware_compute,

            // Git & GitHub Automation
            commands::git::git_status_check,
            commands::git::git_commit_and_push,
            commands::git::git_create_repo,
            commands::git::git_list_user_repos,

            // Google Suite (Gmail & Google Calendar)
            commands::google::gmail_send_message,
            commands::google::calendar_add_event,
            commands::google::calendar_list_events,

            // Audio & VAD
            commands::audio::check_whisper_server,
            commands::audio::process_pcm_chunk,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
