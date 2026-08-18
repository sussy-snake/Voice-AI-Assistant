use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub due_date: String,
    pub recurring: Option<String>, // "daily", "weekly", "monthly", "none"
    pub reminder_offset_mins: i32,
    pub is_completed: bool,
    pub notified: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new() -> Result<Self> {
        let db_path = Self::get_db_path();
        if let Some(parent) = db_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let conn = Connection::open(&db_path)?;
        let db = Database {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn get_db_path() -> PathBuf {
        let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push("LocalVoiceAI");
        path.push("voice_assistant.db");
        path
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                due_date TEXT NOT NULL,
                recurring TEXT,
                reminder_offset_mins INTEGER DEFAULT 0,
                is_completed INTEGER DEFAULT 0,
                notified INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );",
            [],
        )?;

        Ok(())
    }

    pub fn insert_task(&self, task: &Task) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO tasks (id, title, description, due_date, recurring, reminder_offset_mins, is_completed, notified, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                task.id,
                task.title,
                task.description,
                task.due_date,
                task.recurring,
                task.reminder_offset_mins,
                if task.is_completed { 1 } else { 0 },
                if task.notified { 1 } else { 0 },
                task.created_at,
                task.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_all_tasks(&self) -> Result<Vec<Task>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, description, due_date, recurring, reminder_offset_mins, is_completed, notified, created_at, updated_at
             FROM tasks ORDER BY due_date ASC",
        )?;

        let task_iter = stmt.query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                due_date: row.get(3)?,
                recurring: row.get(4)?,
                reminder_offset_mins: row.get(5)?,
                is_completed: row.get::<_, i32>(6)? != 0,
                notified: row.get::<_, i32>(7)? != 0,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut tasks = Vec::new();
        for task in task_iter {
            tasks.push(task?);
        }
        Ok(tasks)
    }

    pub fn get_pending_due_tasks(&self, now_iso: &str) -> Result<Vec<Task>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, description, due_date, recurring, reminder_offset_mins, is_completed, notified, created_at, updated_at
             FROM tasks WHERE is_completed = 0 AND notified = 0 AND due_date <= ?1",
        )?;

        let task_iter = stmt.query_map([now_iso], |row| {
            Ok(Task {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                due_date: row.get(3)?,
                recurring: row.get(4)?,
                reminder_offset_mins: row.get(5)?,
                is_completed: row.get::<_, i32>(6)? != 0,
                notified: row.get::<_, i32>(7)? != 0,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut tasks = Vec::new();
        for task in task_iter {
            tasks.push(task?);
        }
        Ok(tasks)
    }

    pub fn mark_task_notified(&self, task_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE tasks SET notified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![task_id],
        )?;
        Ok(())
    }

    pub fn toggle_task_completed(&self, task_id: &str, is_completed: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE tasks SET is_completed = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![if is_completed { 1 } else { 0 }, task_id],
        )?;
        Ok(())
    }

    pub fn delete_task(&self, task_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM tasks WHERE id = ?1", params![task_id])?;
        Ok(())
    }
}
