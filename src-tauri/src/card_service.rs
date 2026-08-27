use crate::{
    local_dictionary::{find_local_dictionary_entry, normalize_card_key},
    sentence_context::extract_sentence_context,
    Database,
};
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

fn now() -> String {
    Utc::now().to_rfc3339()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkInput {
    pub article_id: i64,
    pub word: String,
    pub context_sentence: String,
    pub start_index: i64,
    pub end_index: i64,
    pub line_number: i64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Marking {
    pub id: i64,
    pub word: String,
    pub start_index: i64,
    pub end_index: i64,
    pub line_number: i64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub id: i64,
    pub word: String,
    pub line_number: i64,
    pub context_sentence: String,
    pub translation: String,
    pub phonetic: String,
    pub definition: String,
    pub note: String,
    pub references: Vec<CardReference>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CardReference {
    pub id: i64,
    pub article_id: i64,
    pub article_title: String,
    pub line_number: i64,
    pub context_sentence: String,
    pub contextual_meaning: String,
    pub sentence_translation: String,
    pub usage_note: String,
    pub learning_note: String,
    pub analysis_source: String,
    pub is_user_edited: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardInput {
    pub article_id: i64,
    pub word: String,
    pub start_index: i64,
    pub end_index: i64,
    pub line_number: i64,
    pub translation: String,
    pub contextual_meaning: String,
    pub sentence_translation: String,
    pub usage_note: String,
    pub analysis_source: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardContextUpdate {
    pub id: i64,
    pub contextual_meaning: String,
    pub sentence_translation: String,
    pub usage_note: String,
    pub learning_note: String,
    pub source: String,
    pub overwrite_user_edits: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiContextSaveInput {
    pub article_id: i64,
    pub start_index: i64,
    pub end_index: i64,
    pub contextual_meaning: String,
    pub sentence_translation: String,
    pub usage_note: String,
    pub overwrite_user_edits: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CardCreateResult {
    pub created: bool,
    pub word: String,
    pub context_count: i64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardUpdate {
    pub id: i64,
    pub translation: String,
    pub phonetic: String,
    pub definition: String,
    pub note: String,
}
#[tauri::command]
pub fn get_markings_by_article(
    article_id: i64,
    db: State<Database>,
) -> Result<Vec<Marking>, String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    let mut s=db.prepare("SELECT id,word,start_index,end_index,line_number FROM markings WHERE article_id=? ORDER BY start_index").map_err(|e|e.to_string())?;
    let markings = s
        .query_map([article_id], |r| {
            Ok(Marking {
                id: r.get(0)?,
                word: r.get(1)?,
                start_index: r.get(2)?,
                end_index: r.get(3)?,
                line_number: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<_, _>>()
        .map_err(|e| e.to_string())?;
    Ok(markings)
}
#[tauri::command]
pub fn get_cards_by_article(article_id: i64, db: State<Database>) -> Result<Vec<Card>, String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    let mut s = db.prepare("SELECT cards.id,COALESCE((SELECT markings.word FROM card_contexts JOIN markings ON markings.id=card_contexts.marking_id WHERE card_contexts.card_id=cards.id AND markings.article_id=? ORDER BY markings.start_index ASC LIMIT 1),cards.word),COALESCE((SELECT markings.line_number FROM card_contexts JOIN markings ON markings.id=card_contexts.marking_id WHERE card_contexts.card_id=cards.id AND markings.article_id=? ORDER BY markings.start_index ASC LIMIT 1),cards.line_number),COALESCE((SELECT markings.context_sentence FROM card_contexts JOIN markings ON markings.id=card_contexts.marking_id WHERE card_contexts.card_id=cards.id AND markings.article_id=? ORDER BY markings.start_index ASC LIMIT 1),''),cards.translation,cards.phonetic,cards.definition,cards.note FROM word_cards cards WHERE EXISTS(SELECT 1 FROM card_contexts JOIN markings ON markings.id=card_contexts.marking_id WHERE card_contexts.card_id=cards.id AND markings.article_id=?) ORDER BY (SELECT MIN(markings.start_index) FROM card_contexts JOIN markings ON markings.id=card_contexts.marking_id WHERE card_contexts.card_id=cards.id AND markings.article_id=?) ASC,cards.id ASC").map_err(|e| e.to_string())?;
    let mut cards: Vec<Card> = s
        .query_map(
            params![article_id, article_id, article_id, article_id, article_id],
            |r| {
                Ok(Card {
                    id: r.get(0)?,
                    word: r.get(1)?,
                    line_number: r.get(2)?,
                    context_sentence: r.get(3)?,
                    translation: r.get(4)?,
                    phonetic: r.get(5)?,
                    definition: r.get(6)?,
                    note: r.get(7)?,
                    references: Vec::new(),
                })
            },
        )
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<Card>, _>>()
        .map_err(|e| e.to_string())?;
    drop(s);
    let mut reference_statement = db.prepare("SELECT card_contexts.card_id,card_contexts.id,markings.article_id,articles.title,markings.line_number,markings.context_sentence,card_contexts.contextual_meaning,card_contexts.sentence_translation,card_contexts.usage_note,card_contexts.learning_note,card_contexts.analysis_source,card_contexts.is_user_edited,articles.content,markings.start_index,markings.end_index,markings.id FROM card_contexts JOIN markings ON markings.id=card_contexts.marking_id JOIN articles ON articles.id=markings.article_id LEFT JOIN books ON books.id=articles.book_id LEFT JOIN chapters ON chapters.id=articles.chapter_id WHERE card_contexts.card_id IN (SELECT cards.id FROM word_cards cards WHERE EXISTS(SELECT 1 FROM card_contexts contexts JOIN markings scope_markings ON scope_markings.id=contexts.marking_id WHERE contexts.card_id=cards.id AND scope_markings.article_id=?)) ORDER BY card_contexts.card_id,COALESCE(books.id,0),COALESCE(chapters.position,0),COALESCE(articles.position,0),markings.start_index,markings.id").map_err(|e| e.to_string())?;
    let references = reference_statement
        .query_map(
            [article_id],
            |row| -> rusqlite::Result<(i64, CardReference, i64, String, String)> {
                let stored_context: String = row.get(5)?;
                let content: String = row.get(12)?;
                let corrected_context =
                    extract_sentence_context(&content, row.get(13)?, row.get(14)?);
                let context_sentence = if corrected_context.is_empty() {
                    stored_context.clone()
                } else {
                    corrected_context
                };
                Ok((
                    row.get(0)?,
                    CardReference {
                        id: row.get(1)?,
                        article_id: row.get(2)?,
                        article_title: row.get(3)?,
                        line_number: row.get(4)?,
                        context_sentence: context_sentence.clone(),
                        contextual_meaning: row.get(6)?,
                        sentence_translation: row.get(7)?,
                        usage_note: row.get(8)?,
                        learning_note: row.get(9)?,
                        analysis_source: row.get(10)?,
                        is_user_edited: row.get::<_, i64>(11)? != 0,
                    },
                    row.get(15)?,
                    stored_context,
                    context_sentence,
                ))
            },
        )
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<(i64, CardReference, i64, String, String)>, _>>()
        .map_err(|e| e.to_string())?;
    drop(reference_statement);
    let mut references_by_card: HashMap<i64, Vec<CardReference>> = HashMap::new();
    for (card_id, reference, marking_id, stored_context, corrected_context) in references {
        if stored_context != corrected_context {
            db.execute(
                "UPDATE markings SET context_sentence=? WHERE id=?",
                params![corrected_context, marking_id],
            )
            .map_err(|error| error.to_string())?;
        }
        references_by_card
            .entry(card_id)
            .or_default()
            .push(reference);
    }
    for card in &mut cards {
        card.references = references_by_card.remove(&card.id).unwrap_or_default();
    }
    Ok(cards)
}
#[tauri::command]
pub fn get_review_cards(db: State<Database>) -> Result<Vec<Card>, String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    let mut statement = db.prepare("SELECT cards.id,COALESCE((SELECT markings.word FROM card_contexts JOIN markings ON markings.id=card_contexts.marking_id JOIN articles references_article ON references_article.id=markings.article_id LEFT JOIN books references_book ON references_book.id=references_article.book_id LEFT JOIN chapters references_chapter ON references_chapter.id=references_article.chapter_id WHERE card_contexts.card_id=cards.id ORDER BY COALESCE(references_book.id,0),COALESCE(references_chapter.position,0),COALESCE(references_article.position,0),markings.start_index,markings.id LIMIT 1),cards.word),cards.line_number,'',cards.translation,cards.phonetic,cards.definition,cards.note FROM word_cards cards ORDER BY lower(cards.word),cards.id").map_err(|error| error.to_string())?;
    let mut cards = statement
        .query_map([], |row| {
            Ok(Card {
                id: row.get(0)?,
                word: row.get(1)?,
                line_number: row.get(2)?,
                context_sentence: row.get(3)?,
                translation: row.get(4)?,
                phonetic: row.get(5)?,
                definition: row.get(6)?,
                note: row.get(7)?,
                references: Vec::new(),
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<Card>, _>>()
        .map_err(|error| error.to_string())?;
    drop(statement);
    let mut reference_statement = db.prepare("SELECT card_contexts.card_id,card_contexts.id,markings.article_id,articles.title,markings.line_number,markings.context_sentence,card_contexts.contextual_meaning,card_contexts.sentence_translation,card_contexts.usage_note,card_contexts.learning_note,card_contexts.analysis_source,card_contexts.is_user_edited,articles.content,markings.start_index,markings.end_index,markings.id FROM card_contexts JOIN markings ON markings.id=card_contexts.marking_id JOIN articles ON articles.id=markings.article_id LEFT JOIN books ON books.id=articles.book_id LEFT JOIN chapters ON chapters.id=articles.chapter_id ORDER BY card_contexts.card_id,COALESCE(books.id,0),COALESCE(chapters.position,0),COALESCE(articles.position,0),markings.start_index,markings.id").map_err(|error| error.to_string())?;
    let references = reference_statement
        .query_map(
            [],
            |row| -> rusqlite::Result<(i64, CardReference, i64, String, String)> {
                let stored_context: String = row.get(5)?;
                let content: String = row.get(12)?;
                let corrected_context =
                    extract_sentence_context(&content, row.get(13)?, row.get(14)?);
                let context_sentence = if corrected_context.is_empty() {
                    stored_context.clone()
                } else {
                    corrected_context
                };
                Ok((
                    row.get(0)?,
                    CardReference {
                        id: row.get(1)?,
                        article_id: row.get(2)?,
                        article_title: row.get(3)?,
                        line_number: row.get(4)?,
                        context_sentence: context_sentence.clone(),
                        contextual_meaning: row.get(6)?,
                        sentence_translation: row.get(7)?,
                        usage_note: row.get(8)?,
                        learning_note: row.get(9)?,
                        analysis_source: row.get(10)?,
                        is_user_edited: row.get::<_, i64>(11)? != 0,
                    },
                    row.get(15)?,
                    stored_context,
                    context_sentence,
                ))
            },
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<(i64, CardReference, i64, String, String)>, _>>()
        .map_err(|error| error.to_string())?;
    let mut references_by_card: HashMap<i64, Vec<CardReference>> = HashMap::new();
    for (card_id, reference, marking_id, stored_context, corrected_context) in references {
        if stored_context != corrected_context {
            db.execute(
                "UPDATE markings SET context_sentence=? WHERE id=?",
                params![corrected_context, marking_id],
            )
            .map_err(|error| error.to_string())?;
        }
        references_by_card
            .entry(card_id)
            .or_default()
            .push(reference);
    }
    for card in &mut cards {
        card.references = references_by_card.remove(&card.id).unwrap_or_default();
    }
    Ok(cards)
}
#[tauri::command]
pub fn delete_card(id: i64, db: State<Database>) -> Result<(), String> {
    let mut db = db.0.lock().map_err(|_| "database locked")?;
    let transaction = db.transaction().map_err(|error| error.to_string())?;
    let deleted = transaction
        .execute(
            "DELETE FROM markings WHERE id IN (SELECT marking_id FROM card_contexts WHERE card_id=?)",
            [id],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM word_cards WHERE id=?", [id])
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    if deleted == 0 {
        return Err("CARD_NOT_FOUND".into());
    }
    Ok(())
}
#[tauri::command]
pub fn create_marking(input: MarkInput, db: State<Database>) -> Result<(), String> {
    if input.end_index <= input.start_index || input.word.trim().is_empty() {
        return Err("Invalid selection".into());
    };
    let mut db = db.0.lock().map_err(|_| "database locked")?;
    let tx = db.transaction().map_err(|e| e.to_string())?;
    let t = now();
    let article_content: String = tx
        .query_row(
            "SELECT content FROM articles WHERE id=?",
            [input.article_id],
            |row| row.get(0),
        )
        .map_err(|_| "未找到对应文章".to_string())?;
    let context_sentence =
        extract_sentence_context(&article_content, input.start_index, input.end_index);
    tx.execute("INSERT INTO markings(article_id,word,context_sentence,start_index,end_index,line_number,created_at)VALUES(?,?,?,?,?,?,?)",params![input.article_id,input.word.trim(),if context_sentence.is_empty() { input.context_sentence.trim() } else { context_sentence.as_str() },input.start_index,input.end_index,input.line_number,t]).map_err(|e|if e.to_string().contains("UNIQUE"){String::from("This text is already marked")}else{e.to_string()})?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn delete_marking(
    article_id: i64,
    start_index: i64,
    end_index: i64,
    db: State<Database>,
) -> Result<(), String> {
    let changed =
        db.0.lock()
            .map_err(|_| "database locked")?
            .execute(
                "DELETE FROM markings WHERE article_id=? AND start_index=? AND end_index=?",
                params![article_id, start_index, end_index],
            )
            .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("未找到对应的高亮标记".into());
    }
    Ok(())
}
#[tauri::command]
pub fn create_card(input: CardInput, db: State<Database>) -> Result<CardCreateResult, String> {
    let canonical_key = normalize_card_key(&input.word);
    if canonical_key.is_empty() {
        return Err("请选择有效的词语或短语".into());
    }
    let article_language =
        db.0.lock()
            .map_err(|_| "database locked")?
            .query_row(
                "SELECT language FROM articles WHERE id=?",
                [input.article_id],
                |row| row.get::<_, String>(0),
            )
            .unwrap_or_else(|_| "en".to_string());
    let dictionary_entry = find_local_dictionary_entry(&input.word, &article_language)
        .ok()
        .flatten();
    let (word, phonetic, translation, definition) = dictionary_entry
        .map(|(word, phonetic, definition, translation, _, _)| {
            (word, phonetic, translation, definition)
        })
        .unwrap_or_else(|| {
            (
                input.word.trim().to_string(),
                String::new(),
                input.translation.trim().to_string(),
                String::new(),
            )
        });
    let canonical_key = normalize_card_key(&word);
    let mut db = db.0.lock().map_err(|_| "database locked")?;
    let transaction = db.transaction().map_err(|error| error.to_string())?;
    let marking_id: i64 = transaction
        .query_row(
            "SELECT id FROM markings WHERE article_id=? AND start_index=? AND end_index=?",
            params![input.article_id, input.start_index, input.end_index],
            |row| row.get(0),
        )
        .map_err(|_| "请先标记该单词或短语".to_string())?;
    if transaction
        .query_row(
            "SELECT card_id FROM card_contexts WHERE marking_id=?",
            [marking_id],
            |row| row.get::<_, i64>(0),
        )
        .is_ok()
    {
        return Err("该出处已收录到单词卡片".into());
    }
    let existing_card = transaction
        .query_row(
            "SELECT id FROM word_cards WHERE canonical_key=?",
            [canonical_key.as_str()],
            |row| row.get::<_, i64>(0),
        )
        .ok();
    let (card_id, created) = match existing_card {
        Some(card_id) => (card_id, false),
        None => {
            transaction
                .execute(
                    "INSERT INTO word_cards(marking_id,article_id,word,line_number,created_at,translation,phonetic,definition,note,updated_at,canonical_key)VALUES(NULL,?,?,?,?,?,?,?,?,?,?)",
                    params![input.article_id, word, input.line_number, now(), translation, phonetic, definition, "", now(), canonical_key],
                )
                .map_err(|error| error.to_string())?;
            (transaction.last_insert_rowid(), true)
        }
    };
    let context_sentence: String = transaction
        .query_row(
            "SELECT context_sentence FROM markings WHERE id=?",
            [marking_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let article_translation =
        imported_translation_for_context(&transaction, input.article_id, &context_sentence);
    let sentence_translation = if article_translation.trim().is_empty() {
        input.sentence_translation.trim()
    } else {
        article_translation.trim()
    };
    transaction
        .execute(
            "INSERT INTO card_contexts(card_id,marking_id,contextual_meaning,sentence_translation,usage_note,learning_note,analysis_source,is_user_edited,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?)",
            params![card_id, marking_id, input.contextual_meaning.trim(), sentence_translation, input.usage_note.trim(), "", input.analysis_source.trim(), 0, now(), now()],
        )
        .map_err(|error| {
            if error.to_string().contains("UNIQUE") {
                "该出处已收录到单词卡片".to_string()
            } else {
                error.to_string()
            }
        })?;
    transaction
        .execute(
            "UPDATE word_cards SET updated_at=? WHERE id=?",
            params![now(), card_id],
        )
        .map_err(|error| error.to_string())?;
    let context_count: i64 = transaction
        .query_row(
            "SELECT COUNT(*) FROM card_contexts WHERE card_id=?",
            [card_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(CardCreateResult {
        created,
        word: input.word.trim().to_string(),
        context_count,
    })
}
#[tauri::command]
pub fn update_card(input: CardUpdate, db: State<Database>) -> Result<(), String> {
    db.0.lock().map_err(|_| "database locked")?.execute("UPDATE word_cards SET translation=?,phonetic=?,definition=?,note=?,updated_at=? WHERE id=?", params![input.translation.trim(),input.phonetic.trim(),input.definition.trim(),input.note.trim(),now(),input.id]).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn imported_translation_for_context(
    db: &Connection,
    article_id: i64,
    context_sentence: &str,
) -> String {
    let mut statement = match db.prepare("SELECT source_text,translation FROM article_paragraphs WHERE article_id=? AND trim(translation)<>'' ORDER BY position") { Ok(statement) => statement, Err(_) => return String::new() };
    statement
        .query_map([article_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .ok()
        .and_then(|rows| {
            rows.filter_map(Result::ok)
                .find_map(|(source, translation)| {
                    let normalized_source = source.split_whitespace().collect::<Vec<_>>().join(" ");
                    let normalized_context = context_sentence
                        .split_whitespace()
                        .collect::<Vec<_>>()
                        .join(" ");
                    (normalized_source == normalized_context).then_some(translation)
                })
        })
        .unwrap_or_default()
}

pub fn update_card_context_record(
    db: &Connection,
    input: &CardContextUpdate,
) -> Result<(), String> {
    let is_ai_update = input.source.trim() == "ai";
    let user_edited: i64 = db
        .query_row(
            "SELECT is_user_edited FROM card_contexts WHERE id=?",
            [input.id],
            |row| row.get(0),
        )
        .map_err(|_| "CARD_CONTEXT_NOT_FOUND".to_string())?;
    if is_ai_update && user_edited != 0 && !input.overwrite_user_edits {
        return Err("CONTEXT_HAS_USER_EDITS".into());
    }
    let (article_id, context_sentence): (i64, String) = db
        .query_row(
            "SELECT markings.article_id,markings.context_sentence FROM card_contexts JOIN markings ON markings.id=card_contexts.marking_id WHERE card_contexts.id=?",
            [input.id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "CARD_CONTEXT_NOT_FOUND".to_string())?;
    let imported_translation = imported_translation_for_context(db, article_id, &context_sentence);
    let sentence_translation = if imported_translation.trim().is_empty() {
        input.sentence_translation.trim()
    } else {
        imported_translation.trim()
    };
    let (analysis_source, is_user_edited) = if is_ai_update { ("ai", 0) } else { ("user", 1) };
    db.execute(
        "UPDATE card_contexts SET contextual_meaning=?,sentence_translation=?,usage_note=?,learning_note=?,analysis_source=?,is_user_edited=?,updated_at=? WHERE id=?",
        params![input.contextual_meaning.trim(), sentence_translation, input.usage_note.trim(), input.learning_note.trim(), analysis_source, is_user_edited, now(), input.id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_card_context(input: CardContextUpdate, db: State<Database>) -> Result<(), String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    update_card_context_record(&db, &input)
}

#[tauri::command]
pub fn save_ai_analysis_to_context(
    input: AiContextSaveInput,
    db: State<Database>,
) -> Result<(), String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    let (context_id, learning_note, context_sentence): (i64, String, String) = db
        .query_row(
            "SELECT card_contexts.id,card_contexts.learning_note,markings.context_sentence FROM card_contexts JOIN markings ON markings.id=card_contexts.marking_id WHERE markings.article_id=? AND markings.start_index=? AND markings.end_index=?",
            params![input.article_id, input.start_index, input.end_index],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "CARD_CONTEXT_NOT_FOUND".to_string())?;
    update_card_context_record(
        &db,
        &CardContextUpdate {
            id: context_id,
            contextual_meaning: input.contextual_meaning,
            sentence_translation: {
                let imported =
                    imported_translation_for_context(&db, input.article_id, &context_sentence);
                if imported.trim().is_empty() {
                    input.sentence_translation
                } else {
                    imported
                }
            },
            usage_note: input.usage_note,
            learning_note,
            source: "ai".to_string(),
            overwrite_user_edits: input.overwrite_user_edits,
        },
    )
}
