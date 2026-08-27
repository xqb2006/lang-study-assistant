use crate::Database;
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use tauri::State;

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn normalize_language(language: &str) -> String {
    match language.trim().to_ascii_lowercase().as_str() {
        "en" | "english" => "en".to_string(),
        "ja" | "japanese" => "ja".to_string(),
        "ko" | "korean" => "ko".to_string(),
        "fr" | "french" => "fr".to_string(),
        "de" | "german" => "de".to_string(),
        "es" | "spanish" => "es".to_string(),
        _ => "other".to_string(),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleMeta {
    pub id: i64,
    pub title: String,
    pub created_at: String,
    pub word_count: i64,
    pub language: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Article {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub language: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub id: i64,
    pub title: String,
    pub author: String,
    pub description: String,
    pub article_count: i64,
    pub language: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookInput {
    pub title: String,
    pub author: String,
    pub description: String,
    #[serde(default = "default_language")]
    pub language: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookRenameInput {
    pub id: i64,
    pub title: String,
    pub author: String,
    pub description: String,
    #[serde(default = "default_language")]
    pub language: String,
}

fn default_language() -> String {
    "en".to_string()
}

fn default_display_language() -> String {
    "zh-CN".to_string()
}

fn normalize_display_language(language: &str) -> String {
    match language.trim() {
        "zh-CN" | "zh-TW" | "en" | "ja" | "ko" | "fr" | "de" | "es" => language.trim().to_string(),
        _ => "zh-CN".to_string(),
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Chapter {
    pub id: i64,
    pub book_id: i64,
    pub title: String,
    pub position: i64,
    pub article_id: Option<i64>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterContentInput {
    pub book_id: i64,
    pub title: String,
    pub source_text: String,
    pub translation_text: String,
    pub auto_translate: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchChapterInput {
    pub title: String,
    pub source_text: String,
    #[serde(default)]
    pub translation_text: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchBookImportInput {
    #[serde(default)]
    pub book_id: Option<i64>,
    pub title: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default)]
    pub auto_translate: bool,
    pub chapters: Vec<BatchChapterInput>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchBookImportResult {
    pub book_id: i64,
    pub article_ids: Vec<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterDuplicateCheckInput {
    pub book_id: i64,
    pub chapters: Vec<BatchChapterInput>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterDuplicateCheckResult {
    pub duplicate_indexes: Vec<usize>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookContentExportChapter {
    pub title: String,
    pub source_text: String,
    pub translation_text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookContentExport {
    pub title: String,
    pub author: String,
    pub description: String,
    pub language: String,
    pub chapters: Vec<BookContentExportChapter>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterRenameInput {
    pub id: i64,
    pub title: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterMoveInput {
    pub id: i64,
    pub book_id: i64,
    pub direction: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Paragraph {
    pub id: i64,
    pub position: i64,
    pub source_text: String,
    pub translation: String,
    pub translation_source: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditableParagraphInput {
    pub position: i64,
    pub source_text: String,
    pub translation: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleParagraphsInput {
    pub article_id: i64,
    pub paragraphs: Vec<EditableParagraphInput>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleParagraphsSaveResult {
    pub source_changed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPreferences {
    pub default_learning_language: String,
    pub display_language: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPreferencesInput {
    pub default_learning_language: String,
    #[serde(default = "default_display_language")]
    pub display_language: String,
}
#[tauri::command]
pub fn get_project_preferences(db: State<Database>) -> Result<ProjectPreferences, String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    let language = db
        .query_row(
            "SELECT value FROM app_preferences WHERE key='default_learning_language'",
            [],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "en".to_string());
    let display_language = db
        .query_row(
            "SELECT value FROM app_preferences WHERE key='display_language'",
            [],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| default_display_language());
    Ok(ProjectPreferences {
        default_learning_language: normalize_language(&language),
        display_language: normalize_display_language(&display_language),
    })
}

#[tauri::command]
pub fn save_project_preferences(
    input: ProjectPreferencesInput,
    db: State<Database>,
) -> Result<ProjectPreferences, String> {
    let language = normalize_language(&input.default_learning_language);
    let display_language = normalize_display_language(&input.display_language);
    let db = db.0.lock().map_err(|_| "database locked")?;
    db.execute(
        "INSERT INTO app_preferences(key,value)VALUES('default_learning_language',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [language.as_str()],
    )
    .map_err(|error| error.to_string())?;
    db.execute(
        "INSERT INTO app_preferences(key,value)VALUES('display_language',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [display_language.as_str()],
    )
    .map_err(|error| error.to_string())?;
    Ok(ProjectPreferences {
        default_learning_language: language,
        display_language,
    })
}

#[tauri::command]
pub fn get_articles(db: State<Database>) -> Result<Vec<ArticleMeta>, String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    let mut s = db
        .prepare("SELECT articles.id,articles.title,articles.created_at,length(trim(articles.content))-length(replace(trim(articles.content),' ',''))+1,articles.language FROM articles INNER JOIN books ON books.id=articles.book_id INNER JOIN chapters ON chapters.id=articles.chapter_id AND chapters.book_id=books.id ORDER BY articles.updated_at DESC")
        .map_err(|e| e.to_string())?;
    let articles = s
        .query_map([], |r| {
            Ok(ArticleMeta {
                id: r.get(0)?,
                title: r.get(1)?,
                created_at: r.get(2)?,
                word_count: r.get(3)?,
                language: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<_, _>>()
        .map_err(|e| e.to_string())?;
    Ok(articles)
}
#[tauri::command]
pub fn get_article(id: i64, db: State<Database>) -> Result<Article, String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    db.query_row(
        "SELECT articles.id,articles.title,articles.content,articles.created_at,articles.language FROM articles INNER JOIN books ON books.id=articles.book_id INNER JOIN chapters ON chapters.id=articles.chapter_id AND chapters.book_id=books.id WHERE articles.id=?",
        [id],
        |r| {
            Ok(Article {
                id: r.get(0)?,
                title: r.get(1)?,
                content: r.get(2)?,
                created_at: r.get(3)?,
                language: r.get(4)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}
fn split_paragraphs(text: &str) -> Vec<String> {
    text.replace("\r\n", "\n")
        .split("\n\n")
        .map(str::trim)
        .filter(|paragraph| !paragraph.is_empty())
        .map(str::to_string)
        .collect()
}

fn chapter_duplicate_key(title: &str, source_text: &str) -> String {
    let normalized = |value: &str| {
        value
            .chars()
            .filter(|character| !character.is_whitespace())
            .flat_map(char::to_lowercase)
            .collect::<String>()
    };
    format!("{}\u{1f}{}", normalized(title), normalized(source_text))
}
#[tauri::command]
pub fn get_books(db: State<Database>) -> Result<Vec<Book>, String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    let mut statement = db.prepare("SELECT books.id,books.title,books.author,books.description,COUNT(articles.id),books.language FROM books LEFT JOIN articles ON articles.book_id=books.id GROUP BY books.id ORDER BY books.id DESC").map_err(|e| e.to_string())?;
    let books = statement
        .query_map([], |row| {
            Ok(Book {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                description: row.get(3)?,
                article_count: row.get(4)?,
                language: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<Book>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(books)
}
#[tauri::command]
pub fn save_book(input: BookInput, db: State<Database>) -> Result<i64, String> {
    if input.title.trim().is_empty() {
        return Err("书名不能为空".into());
    }
    let db = db.0.lock().map_err(|_| "database locked")?;
    db.execute(
        "INSERT INTO books(title,author,description,language,created_at)VALUES(?,?,?,?,?)",
        params![
            input.title.trim(),
            input.author.trim(),
            input.description.trim(),
            normalize_language(&input.language),
            now()
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(db.last_insert_rowid())
}
#[tauri::command]
pub fn update_book(input: BookRenameInput, db: State<Database>) -> Result<(), String> {
    if input.title.trim().is_empty() {
        return Err("书名不能为空".into());
    }
    db.0.lock()
        .map_err(|_| "database locked")?
        .execute(
            "UPDATE books SET title=?,author=?,description=?,language=? WHERE id=?",
            params![
                input.title.trim(),
                input.author.trim(),
                input.description.trim(),
                normalize_language(&input.language),
                input.id
            ],
        )
        .map_err(|error| error.to_string())?;
    let db = db.0.lock().map_err(|_| "database locked")?;
    db.execute(
        "UPDATE articles SET language=? WHERE book_id=?",
        params![normalize_language(&input.language), input.id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn delete_book(id: i64, db: State<Database>) -> Result<(), String> {
    let mut db = db.0.lock().map_err(|_| "database locked")?;
    let transaction = db.transaction().map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM articles WHERE book_id=?", [id])
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM books WHERE id=?", [id])
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn get_chapters(book_id: i64, db: State<Database>) -> Result<Vec<Chapter>, String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    let mut statement = db.prepare("SELECT chapters.id,chapters.book_id,chapters.title,chapters.position,articles.id FROM chapters LEFT JOIN articles ON articles.chapter_id=chapters.id WHERE chapters.book_id=? ORDER BY chapters.position,chapters.id").map_err(|e| e.to_string())?;
    let chapters = statement
        .query_map([book_id], |row| {
            Ok(Chapter {
                id: row.get(0)?,
                book_id: row.get(1)?,
                title: row.get(2)?,
                position: row.get(3)?,
                article_id: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<Chapter>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(chapters)
}
#[tauri::command]
pub fn create_chapter(input: ChapterContentInput, db: State<Database>) -> Result<i64, String> {
    let source_paragraphs = split_paragraphs(&input.source_text);
    if input.title.trim().is_empty() {
        return Err("章节标题不能为空".into());
    }
    if source_paragraphs.is_empty() {
        return Err("请至少导入一段正文原文".into());
    }
    let translation_paragraphs = split_paragraphs(&input.translation_text);
    let mut db = db.0.lock().map_err(|_| "database locked")?;
    let transaction = db.transaction().map_err(|error| error.to_string())?;
    let position: i64 = transaction
        .query_row(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM chapters WHERE book_id=?",
            [input.book_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "INSERT INTO chapters(book_id,title,position)VALUES(?,?,?)",
            params![input.book_id, input.title.trim(), position],
        )
        .map_err(|error| error.to_string())?;
    let chapter_id = transaction.last_insert_rowid();
    let language: String = transaction
        .query_row(
            "SELECT language FROM books WHERE id=?",
            [input.book_id],
            |row| row.get(0),
        )
        .map_err(|_| "书籍不存在或语言信息无效")?;
    let timestamp = now();
    let content = source_paragraphs.join("\n\n");
    transaction.execute("INSERT INTO articles(title,content,created_at,updated_at,book_id,chapter_id,position,language)VALUES(?,?,?,?,?,?,?,?)", params![input.title.trim(), content, timestamp, timestamp, input.book_id, chapter_id, position, language]).map_err(|error| error.to_string())?;
    let article_id = transaction.last_insert_rowid();
    for (index, source_text) in source_paragraphs.iter().enumerate() {
        let translation = translation_paragraphs
            .get(index)
            .map(String::as_str)
            .unwrap_or("")
            .trim();
        let source = if translation.is_empty() && input.auto_translate {
            "pending_ai"
        } else if translation.is_empty() {
            ""
        } else {
            "user"
        };
        transaction.execute("INSERT INTO article_paragraphs(article_id,position,source_text,translation,translation_source,updated_at)VALUES(?,?,?,?,?,?)", params![article_id, index as i64 + 1, source_text, translation, source, timestamp]).map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(article_id)
}
#[tauri::command]
pub fn import_book_chapters(
    input: BatchBookImportInput,
    db: State<Database>,
) -> Result<BatchBookImportResult, String> {
    if input.book_id.is_none() && input.title.trim().is_empty() {
        return Err("书名不能为空".into());
    }
    let chapters = input
        .chapters
        .into_iter()
        .filter_map(|chapter| {
            let source_paragraphs = split_paragraphs(&chapter.source_text);
            (!source_paragraphs.is_empty()).then(|| {
                (
                    chapter.title.trim().to_string(),
                    source_paragraphs,
                    split_paragraphs(&chapter.translation_text),
                )
            })
        })
        .collect::<Vec<_>>();
    if chapters.is_empty() {
        return Err("请至少保留一个包含正文的章节".into());
    }
    let language = normalize_language(&input.language);
    let mut db = db.0.lock().map_err(|_| "database locked")?;
    let transaction = db.transaction().map_err(|error| error.to_string())?;
    let timestamp = now();
    let (book_id, language) = if let Some(book_id) = input.book_id {
        let language = transaction
            .query_row("SELECT language FROM books WHERE id=?", [book_id], |row| {
                row.get(0)
            })
            .map_err(|_| "未找到目标书籍".to_string())?;
        (book_id, language)
    } else {
        transaction
            .execute(
                "INSERT INTO books(title,author,description,language,created_at)VALUES(?,?,?,?,?)",
                params![
                    input.title.trim(),
                    input.author.trim(),
                    input.description.trim(),
                    language,
                    timestamp
                ],
            )
            .map_err(|error| error.to_string())?;
        (transaction.last_insert_rowid(), language)
    };
    let first_position: i64 = transaction
        .query_row(
            "SELECT COALESCE(MAX(position),0) FROM chapters WHERE book_id=?",
            [book_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let mut article_ids = Vec::with_capacity(chapters.len());
    for (index, (chapter_title, source_paragraphs, translation_paragraphs)) in
        chapters.iter().enumerate()
    {
        let title = if chapter_title.is_empty() {
            format!("第 {} 章", first_position + index as i64 + 1)
        } else {
            chapter_title.clone()
        };
        let position = first_position + index as i64 + 1;
        transaction
            .execute(
                "INSERT INTO chapters(book_id,title,position)VALUES(?,?,?)",
                params![book_id, title, position],
            )
            .map_err(|error| error.to_string())?;
        let chapter_id = transaction.last_insert_rowid();
        transaction.execute("INSERT INTO articles(title,content,created_at,updated_at,book_id,chapter_id,position,language)VALUES(?,?,?,?,?,?,?,?)", params![title, source_paragraphs.join("\n\n"), timestamp, timestamp, book_id, chapter_id, position, language]).map_err(|error| error.to_string())?;
        let article_id = transaction.last_insert_rowid();
        for (paragraph_index, source_text) in source_paragraphs.iter().enumerate() {
            let translation = translation_paragraphs
                .get(paragraph_index)
                .map(String::as_str)
                .unwrap_or("")
                .trim();
            let translation_source = if translation.is_empty() && input.auto_translate {
                "pending_ai"
            } else if translation.is_empty() {
                ""
            } else {
                "user"
            };
            transaction.execute("INSERT INTO article_paragraphs(article_id,position,source_text,translation,translation_source,updated_at)VALUES(?,?,?,?,?,?)", params![article_id, paragraph_index as i64 + 1, source_text, translation, translation_source, timestamp]).map_err(|error| error.to_string())?;
        }
        article_ids.push(article_id);
    }
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(BatchBookImportResult {
        book_id,
        article_ids,
    })
}

#[tauri::command]
pub fn preview_book_chapter_duplicates(
    input: ChapterDuplicateCheckInput,
    db: State<Database>,
) -> Result<ChapterDuplicateCheckResult, String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    let mut statement = db
        .prepare(
            "SELECT chapters.title,articles.content
             FROM chapters JOIN articles ON articles.chapter_id=chapters.id
             WHERE chapters.book_id=?",
        )
        .map_err(|error| error.to_string())?;
    let existing = statement
        .query_map([input.book_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    let keys = existing
        .iter()
        .map(|(title, content)| chapter_duplicate_key(title, content))
        .collect::<HashSet<_>>();
    let duplicate_indexes = input
        .chapters
        .iter()
        .enumerate()
        .filter_map(|(index, chapter)| {
            keys.contains(&chapter_duplicate_key(&chapter.title, &chapter.source_text))
                .then_some(index)
        })
        .collect();
    Ok(ChapterDuplicateCheckResult { duplicate_indexes })
}

#[tauri::command]
pub fn export_book_content(id: i64, db: State<Database>) -> Result<BookContentExport, String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    let (title, author, description, language) = db
        .query_row(
            "SELECT title,author,description,language FROM books WHERE id=?",
            [id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "未找到要导出的书籍".to_string())?;
    let mut statement = db
        .prepare(
            "SELECT chapters.title,articles.id,articles.content
             FROM chapters
             JOIN articles ON articles.chapter_id=chapters.id
             WHERE chapters.book_id=?
             ORDER BY chapters.position,chapters.id",
        )
        .map_err(|error| error.to_string())?;
    let chapters = statement
        .query_map([id], |row| {
            let chapter_title: String = row.get(0)?;
            let article_id: i64 = row.get(1)?;
            let fallback_source: String = row.get(2)?;
            Ok((chapter_title, article_id, fallback_source))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut paragraph_statement = db
        .prepare(
            "SELECT source_text,translation FROM article_paragraphs WHERE article_id=? ORDER BY position,id",
        )
        .map_err(|error| error.to_string())?;
    let mut exported_chapters = Vec::with_capacity(chapters.len());
    for (chapter_title, article_id, fallback_source) in chapters {
        let paragraphs = paragraph_statement
            .query_map([article_id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        let source_text = if paragraphs.is_empty() {
            fallback_source
        } else {
            paragraphs
                .iter()
                .map(|(source, _)| source.as_str())
                .collect::<Vec<_>>()
                .join("\n\n")
        };
        let translation_text = if !paragraphs.is_empty()
            && paragraphs
                .iter()
                .all(|(_, translation)| !translation.trim().is_empty())
        {
            paragraphs
                .iter()
                .map(|(_, translation)| translation.trim())
                .collect::<Vec<_>>()
                .join("\n\n")
        } else {
            String::new()
        };
        exported_chapters.push(BookContentExportChapter {
            title: chapter_title,
            source_text,
            translation_text,
        });
    }
    Ok(BookContentExport {
        title,
        author,
        description,
        language,
        chapters: exported_chapters,
    })
}
#[tauri::command]
pub fn rename_chapter(input: ChapterRenameInput, db: State<Database>) -> Result<(), String> {
    if input.title.trim().is_empty() {
        return Err("章节标题不能为空".into());
    }
    let db = db.0.lock().map_err(|_| "database locked")?;
    db.execute(
        "UPDATE chapters SET title=? WHERE id=?",
        params![input.title.trim(), input.id],
    )
    .map_err(|error| error.to_string())?;
    db.execute(
        "UPDATE articles SET title=?,updated_at=? WHERE chapter_id=?",
        params![input.title.trim(), now(), input.id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn delete_chapter(id: i64, db: State<Database>) -> Result<(), String> {
    let mut db = db.0.lock().map_err(|_| "database locked")?;
    let transaction = db.transaction().map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM articles WHERE chapter_id=?", [id])
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM chapters WHERE id=?", [id])
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn move_chapter(input: ChapterMoveInput, db: State<Database>) -> Result<(), String> {
    let mut db = db.0.lock().map_err(|_| "database locked")?;
    let current: i64 = db
        .query_row(
            "SELECT position FROM chapters WHERE id=? AND book_id=?",
            params![input.id, input.book_id],
            |row| row.get(0),
        )
        .map_err(|_| "未找到章节".to_string())?;
    let comparison = if input.direction == "up" {
        "<"
    } else if input.direction == "down" {
        ">"
    } else {
        return Err("无效的排序方向".into());
    };
    let order = if input.direction == "up" {
        "DESC"
    } else {
        "ASC"
    };
    let sql = format!("SELECT id,position FROM chapters WHERE book_id=? AND position {comparison} ? ORDER BY position {order} LIMIT 1");
    let neighbor = db
        .query_row(&sql, params![input.book_id, current], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
        })
        .ok();
    let Some((neighbor_id, neighbor_position)) = neighbor else {
        return Ok(());
    };
    let transaction = db.transaction().map_err(|error| error.to_string())?;
    transaction
        .execute(
            "UPDATE chapters SET position=? WHERE id=?",
            params![neighbor_position, input.id],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "UPDATE chapters SET position=? WHERE id=?",
            params![current, neighbor_id],
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn get_paragraphs(article_id: i64, db: State<Database>) -> Result<Vec<Paragraph>, String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    let mut statement = db.prepare("SELECT id,position,source_text,translation,translation_source FROM article_paragraphs WHERE article_id=? ORDER BY position").map_err(|e| e.to_string())?;
    let paragraphs = statement
        .query_map([article_id], |row| {
            Ok(Paragraph {
                id: row.get(0)?,
                position: row.get(1)?,
                source_text: row.get(2)?,
                translation: row.get(3)?,
                translation_source: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<Paragraph>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(paragraphs)
}
#[tauri::command]
pub fn save_article_paragraphs(
    input: ArticleParagraphsInput,
    db: State<Database>,
) -> Result<ArticleParagraphsSaveResult, String> {
    let paragraphs: Vec<EditableParagraphInput> = input
        .paragraphs
        .into_iter()
        .filter(|paragraph| !paragraph.source_text.trim().is_empty())
        .collect();
    if paragraphs.is_empty() {
        return Err("请至少保留一段英文原文".into());
    }
    let mut db = db.0.lock().map_err(|_| "database locked")?;
    let previous_content: String = db
        .query_row(
            "SELECT content FROM articles WHERE id=?",
            [input.article_id],
            |row| row.get(0),
        )
        .map_err(|_| "未找到当前章节".to_string())?;
    let content = paragraphs
        .iter()
        .map(|paragraph| paragraph.source_text.trim())
        .collect::<Vec<_>>()
        .join("\n\n");
    let source_changed = previous_content != content;
    let transaction = db.transaction().map_err(|error| error.to_string())?;
    transaction
        .execute(
            "UPDATE articles SET content=?,updated_at=? WHERE id=?",
            params![content, now(), input.article_id],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "DELETE FROM article_paragraphs WHERE article_id=?",
            [input.article_id],
        )
        .map_err(|error| error.to_string())?;
    for paragraph in &paragraphs {
        transaction.execute("INSERT INTO article_paragraphs(article_id,position,source_text,translation,translation_source,updated_at)VALUES(?,?,?,?,?,?)", params![input.article_id, paragraph.position, paragraph.source_text.trim(), paragraph.translation.trim(), if paragraph.translation.trim().is_empty() { "" } else { "manual" }, now()]).map_err(|error| error.to_string())?;
    }
    if source_changed {
        transaction
            .execute(
                "DELETE FROM markings WHERE article_id=?",
                [input.article_id],
            )
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(ArticleParagraphsSaveResult { source_changed })
}

#[cfg(test)]
mod content_library_tests {
    use super::chapter_duplicate_key;

    #[test]
    fn duplicate_key_ignores_case_and_whitespace_but_keeps_content_distinct() {
        assert_eq!(
            chapter_duplicate_key("Chapter 1", "First\n\nparagraph"),
            chapter_duplicate_key(" chapter 1 ", "First paragraph"),
        );
        assert_ne!(
            chapter_duplicate_key("Chapter 1", "First paragraph"),
            chapter_duplicate_key("Chapter 1", "Another paragraph"),
        );
    }
}
