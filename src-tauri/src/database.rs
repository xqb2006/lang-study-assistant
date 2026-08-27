use crate::paths::app_data_dir;
use chrono::Utc;
use rusqlite::Connection;
use std::{fs, sync::Mutex};

pub struct Database(pub Mutex<Connection>);
pub fn init_db() -> Connection {
    let dir = app_data_dir();
    fs::create_dir_all(&dir).expect("create directory");
    let db = Connection::open(dir.join("data.db")).expect("open database");
    migrate_database(&db).expect("migrate");
    db
}

pub fn migrate_database(db: &Connection) -> Result<(), rusqlite::Error> {
    db.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS app_preferences(key TEXT PRIMARY KEY, value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS articles(id INTEGER PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS collections(id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS books(id INTEGER PRIMARY KEY, collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL, title TEXT NOT NULL, author TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS chapters(id INTEGER PRIMARY KEY, book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE, title TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS article_paragraphs(id INTEGER PRIMARY KEY, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, position INTEGER NOT NULL, source_text TEXT NOT NULL, translation TEXT NOT NULL DEFAULT '', translation_source TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, UNIQUE(article_id,position));
 CREATE TABLE IF NOT EXISTS questions(id INTEGER PRIMARY KEY, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, position INTEGER NOT NULL DEFAULT 0, question_type TEXT NOT NULL, prompt TEXT NOT NULL, answer TEXT NOT NULL DEFAULT '', explanation TEXT NOT NULL DEFAULT '', source_line INTEGER, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS question_options(id INTEGER PRIMARY KEY, question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE, position INTEGER NOT NULL, content TEXT NOT NULL, is_correct INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS question_attempts(id INTEGER PRIMARY KEY, question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE, answer TEXT NOT NULL, is_correct INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS article_notes(id INTEGER PRIMARY KEY, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, paragraph_position INTEGER, content TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS study_sessions(id INTEGER PRIMARY KEY, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'not_started', reading_seconds INTEGER NOT NULL DEFAULT 0, completed_at TEXT);
 CREATE TABLE IF NOT EXISTS markings(id INTEGER PRIMARY KEY, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, word TEXT NOT NULL, context_sentence TEXT NOT NULL, start_index INTEGER NOT NULL, end_index INTEGER NOT NULL, line_number INTEGER NOT NULL, created_at TEXT NOT NULL, UNIQUE(article_id,start_index,end_index));
 CREATE TABLE IF NOT EXISTS word_cards(id INTEGER PRIMARY KEY, marking_id INTEGER UNIQUE REFERENCES markings(id) ON DELETE SET NULL, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, word TEXT NOT NULL, line_number INTEGER NOT NULL, created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_articles_updated_at ON articles(updated_at DESC);
 CREATE INDEX IF NOT EXISTS idx_chapters_book_position ON chapters(book_id,position,id);
 CREATE INDEX IF NOT EXISTS idx_paragraphs_article_position ON article_paragraphs(article_id,position);
 CREATE INDEX IF NOT EXISTS idx_questions_article_position ON questions(article_id,position);
 CREATE INDEX IF NOT EXISTS idx_question_options_question_position ON question_options(question_id,position);
 CREATE INDEX IF NOT EXISTS idx_markings_article_start ON markings(article_id,start_index);
 CREATE INDEX IF NOT EXISTS idx_markings_word_lower ON markings(lower(word));
 CREATE INDEX IF NOT EXISTS idx_cards_article_id ON word_cards(article_id,id DESC);")?;
    for statement in ["ALTER TABLE word_cards ADD COLUMN translation TEXT NOT NULL DEFAULT ''", "ALTER TABLE word_cards ADD COLUMN phonetic TEXT NOT NULL DEFAULT ''", "ALTER TABLE word_cards ADD COLUMN definition TEXT NOT NULL DEFAULT ''", "ALTER TABLE word_cards ADD COLUMN note TEXT NOT NULL DEFAULT ''", "ALTER TABLE word_cards ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''", "ALTER TABLE word_cards ADD COLUMN canonical_key TEXT NOT NULL DEFAULT ''", "ALTER TABLE articles ADD COLUMN book_id INTEGER REFERENCES books(id) ON DELETE SET NULL", "ALTER TABLE articles ADD COLUMN chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL", "ALTER TABLE articles ADD COLUMN position INTEGER NOT NULL DEFAULT 0", "ALTER TABLE articles ADD COLUMN learning_status TEXT NOT NULL DEFAULT 'not_started'", "ALTER TABLE books ADD COLUMN language TEXT NOT NULL DEFAULT 'en'", "ALTER TABLE articles ADD COLUMN language TEXT NOT NULL DEFAULT 'en'"] { let _ = db.execute(statement, []); }
    db.execute_batch("CREATE INDEX IF NOT EXISTS idx_articles_book_id ON articles(book_id); CREATE INDEX IF NOT EXISTS idx_articles_chapter_id ON articles(chapter_id); CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language);")?;
    db.execute("UPDATE books SET language='en' WHERE trim(language)=''", [])?;
    db.execute(
        "UPDATE articles SET language='en' WHERE trim(language)=''",
        [],
    )?;
    let marking_not_null: i64 = db
        .query_row(
            "SELECT \"notnull\" FROM pragma_table_info('word_cards') WHERE name='marking_id'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if marking_not_null == 1 {
        db.execute_batch("PRAGMA foreign_keys=OFF; BEGIN; CREATE TABLE word_cards_migrated(id INTEGER PRIMARY KEY, marking_id INTEGER UNIQUE REFERENCES markings(id) ON DELETE SET NULL, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, word TEXT NOT NULL, line_number INTEGER NOT NULL, created_at TEXT NOT NULL, translation TEXT NOT NULL DEFAULT '', phonetic TEXT NOT NULL DEFAULT '', definition TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '', canonical_key TEXT NOT NULL DEFAULT ''); INSERT INTO word_cards_migrated(id,marking_id,article_id,word,line_number,created_at,translation,phonetic,definition,note,updated_at,canonical_key) SELECT id,marking_id,article_id,word,line_number,created_at,translation,phonetic,definition,note,updated_at,canonical_key FROM word_cards; DROP TABLE word_cards; ALTER TABLE word_cards_migrated RENAME TO word_cards; COMMIT; PRAGMA foreign_keys=ON;")?;
    }
    db.execute_batch("CREATE TABLE IF NOT EXISTS card_contexts(id INTEGER PRIMARY KEY, card_id INTEGER NOT NULL REFERENCES word_cards(id) ON DELETE CASCADE, marking_id INTEGER NOT NULL UNIQUE REFERENCES markings(id) ON DELETE CASCADE, contextual_meaning TEXT NOT NULL DEFAULT '', sentence_translation TEXT NOT NULL DEFAULT '', usage_note TEXT NOT NULL DEFAULT '', learning_note TEXT NOT NULL DEFAULT '', analysis_source TEXT NOT NULL DEFAULT '', is_user_edited INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT ''); CREATE INDEX IF NOT EXISTS idx_card_contexts_card_id ON card_contexts(card_id,id DESC); CREATE INDEX IF NOT EXISTS idx_card_contexts_marking_id ON card_contexts(marking_id);")?;
    for statement in [
        "ALTER TABLE card_contexts ADD COLUMN learning_note TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE card_contexts ADD COLUMN analysis_source TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE card_contexts ADD COLUMN is_user_edited INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE card_contexts ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''",
    ] {
        let _ = db.execute(statement, []);
    }
    db.execute(
        "UPDATE word_cards SET canonical_key=lower(trim(word)) WHERE trim(canonical_key)=''",
        [],
    )?;
    let card_context_migration_done: bool = db
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_version WHERE version=3)",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);
    if !card_context_migration_done {
        create_migration_backup(db)?;
        db.execute_batch("BEGIN IMMEDIATE; INSERT OR IGNORE INTO card_contexts(card_id,marking_id,contextual_meaning,sentence_translation,usage_note,created_at,updated_at) SELECT id,marking_id,translation,'',note,COALESCE(NULLIF(updated_at,''),created_at),COALESCE(NULLIF(updated_at,''),created_at) FROM word_cards WHERE marking_id IS NOT NULL; UPDATE card_contexts SET card_id=(SELECT MIN(cards.id) FROM word_cards cards WHERE cards.canonical_key=word_cards.canonical_key) FROM word_cards WHERE card_contexts.card_id=word_cards.id; DELETE FROM word_cards WHERE id NOT IN (SELECT MIN(id) FROM word_cards GROUP BY canonical_key); CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_canonical_key ON word_cards(canonical_key); INSERT INTO schema_version(version,applied_at) VALUES(3,strftime('%Y-%m-%dT%H:%M:%fZ','now')); COMMIT;")?;
    }

    let orphan_article_cleanup_done: bool = db
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_version WHERE version=4)",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);
    if !orphan_article_cleanup_done {
        db.execute_batch("BEGIN IMMEDIATE; DELETE FROM articles WHERE book_id IS NULL OR chapter_id IS NULL OR NOT EXISTS(SELECT 1 FROM books WHERE books.id=articles.book_id) OR NOT EXISTS(SELECT 1 FROM chapters WHERE chapters.id=articles.chapter_id AND chapters.book_id=articles.book_id); INSERT INTO schema_version(version,applied_at) VALUES(4,strftime('%Y-%m-%dT%H:%M:%fZ','now')); COMMIT;")?;
    }
    Ok(())
}

fn create_migration_backup(db: &Connection) -> Result<(), rusqlite::Error> {
    let database_path: String = db
        .query_row(
            "SELECT file FROM pragma_database_list WHERE name='main'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_default();
    if database_path.is_empty() || database_path == ":memory:" {
        return Ok(());
    }
    let source_path = std::path::PathBuf::from(database_path);
    if !source_path.exists()
        || source_path
            .metadata()
            .map(|metadata| metadata.len())
            .unwrap_or(0)
            == 0
    {
        return Ok(());
    }
    let backup_path = source_path.with_file_name(format!(
        "data-before-card-context-migration-{}.db",
        Utc::now().timestamp_millis()
    ));
    let escaped_path = backup_path.to_string_lossy().replace('\'', "''");
    db.execute_batch(&format!("VACUUM INTO '{}'", escaped_path))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::migrate_database;
    use rusqlite::Connection;

    #[test]
    fn cleanup_removes_articles_without_a_valid_book_and_chapter() {
        let db = Connection::open_in_memory().unwrap();
        migrate_database(&db).unwrap();
        db.execute(
            "INSERT INTO books(title,created_at) VALUES('Book', 'now')",
            [],
        )
        .unwrap();
        db.execute(
            "INSERT INTO chapters(book_id,title,position) VALUES(1, 'Chapter', 1)",
            [],
        )
        .unwrap();
        db.execute("INSERT INTO articles(title,content,created_at,updated_at,book_id,chapter_id) VALUES('Valid', 'Text', 'now', 'now', 1, 1)", [])
            .unwrap();
        db.execute("INSERT INTO articles(title,content,created_at,updated_at) VALUES('Orphan', 'Old text', 'now', 'now')", [])
            .unwrap();
        db.execute("DELETE FROM schema_version WHERE version=4", [])
            .unwrap();

        migrate_database(&db).unwrap();

        let remaining: Vec<String> = db
            .prepare("SELECT title FROM articles ORDER BY id")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(remaining, vec!["Valid"]);
    }
}
