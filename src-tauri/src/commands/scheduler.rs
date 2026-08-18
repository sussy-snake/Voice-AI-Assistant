use crate::db::{Database, Task};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct ScheduleTaskPayload {
    pub title: String,
    pub description: Option<String>,
    pub due_date: String, // ISO-8601 string, e.g. "2026-08-19T10:00:00Z"
    pub recurring: Option<String>, // "daily", "weekly", "monthly", "none"
    pub reminder_offset_mins: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskResponse {
    pub success: bool,
    pub task: Option<Task>,
    pub message: String,
}

#[tauri::command]
pub async fn schedule_task(
    payload: ScheduleTaskPayload,
    db: tauri::State<'_, Arc<Database>>,
    app_handle: AppHandle,
) -> Result<TaskResponse, String> {
    if payload.title.trim().is_empty() {
        return Err("Task title cannot be empty".into());
    }

    let now_iso = Utc::now().to_rfc3339();
    let task_id = Uuid::new_v4().to_string();

    let task = Task {
        id: task_id,
        title: payload.title.clone(),
        description: payload.description.clone(),
        due_date: payload.due_date,
        recurring: payload.recurring,
        reminder_offset_mins: payload.reminder_offset_mins.unwrap_or(0),
        is_completed: false,
        notified: false,
        created_at: now_iso.clone(),
        updated_at: now_iso,
    };

    db.insert_task(&task)
        .map_err(|e| format!("Failed to schedule task: {}", e))?;

    // Fire native notification confirmation
    let _ = app_handle
        .notification()
        .builder()
        .title("Task Scheduled")
        .body(&format!("'{}' scheduled for {}", task.title, task.due_date))
        .show();

    let _ = app_handle.emit("tasks-updated", ());

    Ok(TaskResponse {
        success: true,
        task: Some(task),
        message: "Task scheduled successfully in SQLite database.".into(),
    })
}

#[tauri::command]
pub async fn list_tasks(db: tauri::State<'_, Arc<Database>>) -> Result<Vec<Task>, String> {
    db.get_all_tasks()
        .map_err(|e| format!("Failed to retrieve tasks: {}", e))
}

#[tauri::command]
pub async fn toggle_task_completed(
    task_id: String,
    completed: bool,
    db: tauri::State<'_, Arc<Database>>,
    app_handle: AppHandle,
) -> Result<bool, String> {
    db.toggle_task_completed(&task_id, completed)
        .map_err(|e| format!("Failed to toggle task: {}", e))?;
    let _ = app_handle.emit("tasks-updated", ());
    Ok(true)
}

#[tauri::command]
pub async fn delete_task(
    task_id: String,
    db: tauri::State<'_, Arc<Database>>,
    app_handle: AppHandle,
) -> Result<bool, String> {
    db.delete_task(&task_id)
        .map_err(|e| format!("Failed to delete task: {}", e))?;
    let _ = app_handle.emit("tasks-updated", ());
    Ok(true)
}

#[tauri::command]
pub async fn send_desktop_notification(
    title: String,
    body: String,
    app_handle: AppHandle,
) -> Result<bool, String> {
    app_handle
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())?;
    Ok(true)
}

// Background scheduler checker spawned on app startup
pub fn spawn_scheduler_worker(app_handle: AppHandle, db: Arc<Database>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(15));
        loop {
            interval.tick().await;
            let now_iso = Utc::now().to_rfc3339();
            if let Ok(due_tasks) = db.get_pending_due_tasks(&now_iso) {
                for task in due_tasks {
                    let _ = app_handle
                        .notification()
                        .builder()
                        .title(&format!("Reminder: {}", task.title))
                        .body(task.description.as_deref().unwrap_or("Task is due now!"))
                        .show();

                    let _ = db.mark_task_notified(&task.id);
                    let _ = app_handle.emit("task-due", task.clone());
                }
            }
        }
    });
}
