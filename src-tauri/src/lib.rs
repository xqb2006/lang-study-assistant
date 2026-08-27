#[cfg(test)]
use rusqlite::Connection;

#[cfg(test)]
use std::fs;
use std::sync::Mutex;

mod diagnostics;
mod migration_service;
use diagnostics::get_app_diagnostics;
use migration_service::{export_learning_backup, inspect_learning_backup, restore_learning_backup};

mod ai_client;
mod local_ocr;
use local_ocr::recognize_local_ocr;

mod ai_config;
use ai_config::{
    activate_ai_provider_profile, delete_ai_provider_profile, get_ai_provider_status,
    save_ai_provider_config, save_ai_provider_profile,
};

mod question_service;
#[cfg(test)]
use question_service::is_submission_correct;
use question_service::{get_questions, save_questions, submit_question_answer};

mod sentence_context;

mod ai_workflows;
use ai_workflows::{
    ask_reading_assistant, classify_import_blocks, discover_ai_models, lookup_with_ai, organize_text_import_document, recognize_import_document, recognize_questions_image,
    test_ai_provider, translate_pending_paragraphs,
};

mod card_service;
use card_service::{
    create_card, create_marking, delete_card, delete_marking, get_cards_by_article,
    get_markings_by_article, get_review_cards, save_ai_analysis_to_context, update_card,
    update_card_context,
};
#[cfg(test)]
use card_service::{
    imported_translation_for_context, update_card_context_record, CardContextUpdate,
};

mod content_library;
use content_library::{
    create_chapter, delete_book, delete_chapter, export_book_content, get_article, get_articles,
    get_books, get_chapters, get_paragraphs, get_project_preferences, import_book_chapters,
    move_chapter, preview_book_chapter_duplicates, rename_chapter, save_article_paragraphs,
    save_book, save_project_preferences, update_book,
};

mod local_dictionary;
use local_dictionary::{
    analyze_custom_dictionary_file, delete_custom_dictionary, get_custom_dictionary_status,
    import_custom_dictionary, lookup_local_dictionary, rename_custom_dictionary,
    set_custom_dictionary_enabled,
};

mod database;
#[cfg(test)]
use database::migrate_database;
use database::{init_db, Database};

mod paths;

#[cfg(test)]
use sentence_context::extract_sentence_context;

mod pdf_export;
use pdf_export::{export_pdf, export_pdf_in_background};
#[cfg(test)]
use pdf_export::{
    PdfExportHighlight, PdfExportInput, PdfExportParagraph, PdfExportQuestion, PdfExportWord,
    PdfExportWordReference, PdfVocabularyWord,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(Database(Mutex::new(init_db())))
        .invoke_handler(tauri::generate_handler![
            get_project_preferences,
            save_project_preferences,
            get_articles,
            get_article,
            get_markings_by_article,
            get_cards_by_article,
            get_review_cards,
            create_marking,
            delete_marking,
            delete_card,
            create_card,
            update_card,
            update_card_context,
            save_ai_analysis_to_context,
            get_custom_dictionary_status,
            analyze_custom_dictionary_file,
            import_custom_dictionary,
            delete_custom_dictionary,
            rename_custom_dictionary,
            lookup_local_dictionary,
            set_custom_dictionary_enabled,
            get_ai_provider_status,
            save_ai_provider_config,
            save_ai_provider_profile,
            activate_ai_provider_profile,
            delete_ai_provider_profile,
            discover_ai_models,
            test_ai_provider,
            classify_import_blocks,
            organize_text_import_document,
            recognize_import_document,
            recognize_questions_image,
            recognize_local_ocr,
            translate_pending_paragraphs,
            lookup_with_ai,
            ask_reading_assistant,
            get_books,
            save_book,
            update_book,
            delete_book,
            get_chapters,
            create_chapter,
            import_book_chapters,
            preview_book_chapter_duplicates,
            export_book_content,
            rename_chapter,
            delete_chapter,
            move_chapter,
            export_pdf,
            export_pdf_in_background,
            get_paragraphs,
            save_article_paragraphs,
            get_questions,
            save_questions,
            submit_question_answer,
            get_app_diagnostics,
            export_learning_backup,
            inspect_learning_backup,
            restore_learning_backup
        ])
        .run(tauri::generate_context!())
        .expect("tauri error")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrates_legacy_cards_and_preserves_them_when_marks_are_removed() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch("PRAGMA foreign_keys=ON; CREATE TABLE schema_version(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL); INSERT INTO schema_version(version,applied_at) VALUES(4, 'now'); CREATE TABLE articles(id INTEGER PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE markings(id INTEGER PRIMARY KEY, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, word TEXT NOT NULL, context_sentence TEXT NOT NULL, start_index INTEGER NOT NULL, end_index INTEGER NOT NULL, line_number INTEGER NOT NULL, created_at TEXT NOT NULL); CREATE TABLE word_cards(id INTEGER PRIMARY KEY, marking_id INTEGER NOT NULL UNIQUE REFERENCES markings(id) ON DELETE CASCADE, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, word TEXT NOT NULL, line_number INTEGER NOT NULL, created_at TEXT NOT NULL); INSERT INTO articles VALUES(1, 'Test', 'Text', 'now', 'now'); INSERT INTO markings VALUES(1, 1, 'word', 'Text', 0, 4, 1, 'now'); INSERT INTO word_cards VALUES(1, 1, 1, 'word', 1, 'now');").unwrap();

        migrate_database(&db).unwrap();
        let is_not_null: i64 = db
            .query_row(
                "SELECT \"notnull\" FROM pragma_table_info('word_cards') WHERE name='marking_id'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(is_not_null, 0);
        db.execute("DELETE FROM markings WHERE id=1", []).unwrap();

        let marking_id: Option<i64> = db
            .query_row("SELECT marking_id FROM word_cards WHERE id=1", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(marking_id, None);
    }

    #[test]
    fn merges_legacy_cards_with_the_same_dictionary_key_into_contexts() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch("PRAGMA foreign_keys=ON; CREATE TABLE schema_version(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL); INSERT INTO schema_version(version,applied_at) VALUES(4, 'now'); CREATE TABLE articles(id INTEGER PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE markings(id INTEGER PRIMARY KEY, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, word TEXT NOT NULL, context_sentence TEXT NOT NULL, start_index INTEGER NOT NULL, end_index INTEGER NOT NULL, line_number INTEGER NOT NULL, created_at TEXT NOT NULL); CREATE TABLE word_cards(id INTEGER PRIMARY KEY, marking_id INTEGER NOT NULL UNIQUE REFERENCES markings(id) ON DELETE CASCADE, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, word TEXT NOT NULL, line_number INTEGER NOT NULL, created_at TEXT NOT NULL); INSERT INTO articles VALUES(1, 'Test', 'Text', 'now', 'now'); INSERT INTO markings VALUES(1, 1, 'Run', 'Run a company.', 0, 3, 1, 'now'); INSERT INTO markings VALUES(2, 1, 'run', 'Run every day.', 5, 8, 2, 'now'); INSERT INTO word_cards VALUES(1, 1, 1, 'Run', 1, 'now'); INSERT INTO word_cards VALUES(2, 2, 1, 'run', 2, 'now');").unwrap();

        migrate_database(&db).unwrap();
        let cards: i64 = db
            .query_row("SELECT COUNT(*) FROM word_cards", [], |row| row.get(0))
            .unwrap();
        let contexts: i64 = db
            .query_row("SELECT COUNT(*) FROM card_contexts", [], |row| row.get(0))
            .unwrap();
        assert_eq!(cards, 1);
        assert_eq!(contexts, 2);
    }

    #[test]
    fn extracts_the_selected_sentence_without_splitting_abbreviations() {
        let text =
            "Dr. Smith works in the U.S. market. However, Airbus remains optimistic about demand.";
        let start = text.find("optimistic").unwrap() as i64;
        let end = start + "optimistic".len() as i64;
        assert_eq!(
            extract_sentence_context(text, start, end),
            "However, Airbus remains optimistic about demand."
        );
    }

    #[test]
    fn preserves_manual_context_edits_until_ai_overwrite_is_confirmed() {
        let db = Connection::open_in_memory().unwrap();
        migrate_database(&db).unwrap();
        db.execute("INSERT INTO articles(title,content,created_at,updated_at) VALUES('Test', 'Text', 'now', 'now')", []).unwrap();
        db.execute("INSERT INTO markings(article_id,word,context_sentence,start_index,end_index,line_number,created_at) VALUES(1, 'word', 'Text', 0, 4, 1, 'now')", []).unwrap();
        db.execute("INSERT INTO word_cards(marking_id,article_id,word,line_number,created_at,updated_at,canonical_key) VALUES(NULL, 1, 'word', 1, 'now', 'now', 'word')", []).unwrap();
        db.execute("INSERT INTO card_contexts(card_id,marking_id,created_at,updated_at) VALUES(1, 1, 'now', 'now')", []).unwrap();
        let user_update = CardContextUpdate {
            id: 1,
            contextual_meaning: "manual".into(),
            sentence_translation: "".into(),
            usage_note: "".into(),
            learning_note: "note".into(),
            source: "user".into(),
            overwrite_user_edits: false,
        };
        update_card_context_record(&db, &user_update).unwrap();
        let ai_update = CardContextUpdate {
            id: 1,
            contextual_meaning: "ai".into(),
            sentence_translation: "".into(),
            usage_note: "".into(),
            learning_note: "note".into(),
            source: "ai".into(),
            overwrite_user_edits: false,
        };
        assert_eq!(
            update_card_context_record(&db, &ai_update).unwrap_err(),
            "CONTEXT_HAS_USER_EDITS"
        );
        let overwrite = CardContextUpdate {
            overwrite_user_edits: true,
            ..ai_update
        };
        update_card_context_record(&db, &overwrite).unwrap();
        let value: String = db
            .query_row(
                "SELECT contextual_meaning FROM card_contexts WHERE id=1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(value, "ai");
    }

    #[test]
    fn extracts_sentences_with_decimals_quotes_and_unicode() {
        let text = "Price is 3.14. \"Keep going!\" Next: \u{4ed6}\u{8bf4}\u{ff1a}\u{201c}\u{4fdd}\u{6301}\u{4e13}\u{6ce8}\u{3002}\u{201d} \u{1f600}";
        let byte_start = text.find("\u{4fdd}\u{6301}").unwrap();
        let byte_end = byte_start + "\u{4fdd}\u{6301}".len();
        let start = text[..byte_start].encode_utf16().count() as i64;
        let end = text[..byte_end].encode_utf16().count() as i64;
        assert_eq!(extract_sentence_context(text, start, end), "Next: \u{4ed6}\u{8bf4}\u{ff1a}\u{201c}\u{4fdd}\u{6301}\u{4e13}\u{6ce8}\u{3002}\u{201d}");
    }

    #[test]
    fn reuses_article_translation_only_for_an_exact_sentence_match() {
        let db = Connection::open_in_memory().unwrap();
        migrate_database(&db).unwrap();
        db.execute("INSERT INTO articles(title,content,created_at,updated_at) VALUES('Test', 'First. Second.', 'now', 'now')", []).unwrap();
        db.execute("INSERT INTO article_paragraphs(article_id,position,source_text,translation,translation_source,updated_at) VALUES(1, 1, 'First. Second.', 'Whole paragraph translation', 'manual', 'now')", []).unwrap();
        assert_eq!(imported_translation_for_context(&db, 1, "Second."), "");
        db.execute("INSERT INTO article_paragraphs(article_id,position,source_text,translation,translation_source,updated_at) VALUES(1, 2, 'Second.', 'Second sentence translation', 'manual', 'now')", []).unwrap();
        assert_eq!(
            imported_translation_for_context(&db, 1, "Second."),
            "Second sentence translation"
        );
    }

    #[test]
    fn exports_pdf_with_highlights_and_complete_word_contexts() {
        let preview_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("tmp")
            .join("pdfs");
        fs::create_dir_all(&preview_dir).unwrap();
        let preview_path = preview_dir.join("pdf-export-preview.pdf");
        export_pdf(PdfExportInput {
            path: preview_path.to_string_lossy().to_string(),
            title: "PDF export preview".to_string(),
            paragraphs: vec![PdfExportParagraph {
                source_text: "The company announced a new plan today.".to_string(),
                translation: "The company announced a new plan today.".to_string(),
                highlights: vec![PdfExportHighlight { start: 12, end: 21 }],
            }],
            questions: vec![PdfExportQuestion {
                prompt: "What did the company announce?".to_string(),
                answer: "A".to_string(),
                explanation: "The prompt asks what the company announced.".to_string(),
                options: vec!["A. A new plan".to_string(), "B. A new office".to_string()],
            }],
            marked_words: vec![PdfExportWord {
                word: "announced".to_string(),
                phonetic: "/announced/".to_string(),
                definition: "announce".to_string(),
                references: vec![PdfExportWordReference {
                    context_sentence: "The company announced a new plan today.".to_string(),
                    sentence_translation: "The company announced a new plan today.".to_string(),
                    contextual_meaning: "Used as a verb meaning to make something public."
                        .to_string(),
                    usage_note: "announce plus a noun".to_string(),
                    learning_note: "Notice the past-tense spelling.".to_string(),
                }],
            }],
            vocabulary_list: vec![PdfVocabularyWord {
                word: "announced".to_string(),
                phonetic: "/announced/".to_string(),
                definition: "announce".to_string(),
            }],
            vocabulary_only: false,
        })
        .unwrap();
        assert!(fs::metadata(preview_path).unwrap().len() > 1024);
    }

    #[test]
    fn exports_compact_vocabulary_pdf_without_contexts() {
        let preview_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("tmp")
            .join("pdfs");
        fs::create_dir_all(&preview_dir).unwrap();
        let preview_path = preview_dir.join("vocabulary-export-preview.pdf");
        export_pdf(PdfExportInput {
            path: preview_path.to_string_lossy().to_string(),
            title: "Vocabulary preview".to_string(),
            paragraphs: vec![],
            questions: vec![],
            marked_words: vec![],
            vocabulary_list: vec![
                PdfVocabularyWord {
                    word: "announced".to_string(),
                    phonetic: "/announced/".to_string(),
                    definition: "announce".to_string(),
                },
                PdfVocabularyWord {
                    word: "rapidly".to_string(),
                    phonetic: "/rapidly/".to_string(),
                    definition: "quickly".to_string(),
                },
            ],
            vocabulary_only: true,
        })
        .unwrap();
        assert!(fs::metadata(preview_path).unwrap().len() > 1024);
    }
    #[test]
    fn grades_using_the_correct_option_content() {
        let db = Connection::open_in_memory().unwrap();
        migrate_database(&db).unwrap();
        db.execute("INSERT INTO articles(title,content,created_at,updated_at) VALUES('Test', 'Text', 'now', 'now')", []).unwrap();
        db.execute("INSERT INTO questions(article_id,position,question_type,prompt,answer,explanation,created_at) VALUES(1, 1, 'single_choice', 'Question', 'A', '', 'now')", []).unwrap();
        db.execute("INSERT INTO question_options(question_id,position,content,is_correct) VALUES(1, 0, 'A. First option', 0)", []).unwrap();
        db.execute("INSERT INTO question_options(question_id,position,content,is_correct) VALUES(1, 1, 'B. Correct option', 1)", []).unwrap();

        assert!(is_submission_correct(&db, 1, "B. Correct option").unwrap());
        assert!(!is_submission_correct(&db, 1, "A. First option").unwrap());
    }
}
