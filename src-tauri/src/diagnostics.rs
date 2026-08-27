use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::Database;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppDiagnostics {
    pub app_version: String,
    pub books: i64,
    pub chapters: i64,
    pub articles: i64,
    pub cards: i64,
    pub questions: i64,
    pub questions_without_options: i64,
}

fn count(db: &Connection, sql: &str) -> Result<i64, String> {
    db.query_row(sql, [], |row| row.get(0))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_app_diagnostics(db: State<Database>) -> Result<AppDiagnostics, String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    Ok(AppDiagnostics {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        books: count(&db, "SELECT COUNT(*) FROM books")?,
        chapters: count(&db, "SELECT COUNT(*) FROM articles")?,
        articles: count(&db, "SELECT COUNT(*) FROM articles")?,
        cards: count(&db, "SELECT COUNT(*) FROM word_cards")?,
        questions: count(&db, "SELECT COUNT(*) FROM questions")?,
        questions_without_options: count(&db, "SELECT COUNT(*) FROM questions WHERE NOT EXISTS (SELECT 1 FROM question_options WHERE question_options.question_id=questions.id)")?,
    })
}
