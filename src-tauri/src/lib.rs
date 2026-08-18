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

            // Hardware Telemetry
            commands::system::system_status,

            // Audio & VAD
            commands::audio::check_whisper_server,
            commands::audio::process_pcm_chunk,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
