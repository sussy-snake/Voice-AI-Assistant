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

#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseQueryResult {
    pub success: bool,
    pub rows: Vec<serde_json::Value>,
    pub rows_affected: usize,
    pub message: String,
}

#[tauri::command]
pub async fn query_database(
    _connection_string: Option<String>,
    sql_query: String,
    db: tauri::State<'_, Arc<Database>>,
) -> Result<DatabaseQueryResult, String> {
    if sql_query.trim().is_empty() {
        return Err("SQL query cannot be empty".into());
    }

    let conn_guard = db.conn.lock().map_err(|e| e.to_string())?;
    let trimmed_sql = sql_query.trim();

    if trimmed_sql.to_uppercase().starts_with("SELECT") || trimmed_sql.to_uppercase().starts_with("PRAGMA") {
        let mut stmt = conn_guard.prepare(trimmed_sql).map_err(|e| e.to_string())?;
        let col_names: Vec<String> = stmt.column_names().into_iter().map(|s| s.to_string()).collect();

        let rows = stmt
            .query_map([], |row| {
                let mut obj = serde_json::Map::new();
                for (idx, name) in col_names.iter().enumerate() {
                    let val_res = row.get_ref(idx);
                    let json_val = match val_res {
                        Ok(rusqlite::types::ValueRef::Null) => serde_json::Value::Null,
                        Ok(rusqlite::types::ValueRef::Integer(i)) => serde_json::json!(i),
                        Ok(rusqlite::types::ValueRef::Real(r)) => serde_json::json!(r),
                        Ok(rusqlite::types::ValueRef::Text(t)) => serde_json::json!(String::from_utf8_lossy(t)),
                        Ok(rusqlite::types::ValueRef::Blob(b)) => serde_json::json!(format!("<blob {} bytes>", b.len())),
                        Err(_) => serde_json::Value::Null,
                    };
                    obj.insert(name.clone(), json_val);
                }
                Ok(serde_json::Value::Object(obj))
            })
            .map_err(|e| e.to_string())?;

        let mut row_list = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                row_list.push(item);
            }
        }

        Ok(DatabaseQueryResult {
            success: true,
            rows: row_list.clone(),
            rows_affected: row_list.len(),
            message: format!("Query executed successfully ({} rows returned).", row_list.len()),
        })
    } else {
        let affected = conn_guard.execute(trimmed_sql, []).map_err(|e| e.to_string())?;
        Ok(DatabaseQueryResult {
            success: true,
            rows: Vec::new(),
            rows_affected: affected,
            message: format!("Executed statement successfully ({} rows affected).", affected),
        })
    }
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
