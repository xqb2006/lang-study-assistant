use crate::Database;
use chrono::Utc;
use rusqlite::{params, Connection, Transaction};
use serde::{Deserialize, Serialize};
use tauri::State;

fn now() -> String {
    Utc::now().to_rfc3339()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub id: i64,
    pub position: i64,
    pub question_type: String,
    pub prompt: String,
    pub answer: String,
    pub explanation: String,
    pub source_line: Option<i64>,
    pub options: Vec<QuestionOption>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionOption {
    pub id: i64,
    pub position: i64,
    pub content: String,
    pub is_correct: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionInput {
    pub article_id: i64,
    pub position: i64,
    pub question_type: String,
    pub prompt: String,
    pub answer: String,
    pub explanation: String,
    pub source_line: Option<i64>,
    pub options: Vec<QuestionOptionInput>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionOptionInput {
    pub content: String,
    pub is_correct: bool,
}
fn parse_inline_options(prompt: &str) -> Option<(String, Vec<(char, String)>)> {
    let characters: Vec<(usize, char)> = prompt.char_indices().collect();
    let mut markers: Vec<(usize, char, usize)> = Vec::new();
    for index in 0..characters.len() {
        let (offset, label) = characters[index];
        if !(('A'..='H').contains(&label) || ('a'..='h').contains(&label)) {
            continue;
        }
        let has_boundary = index == 0 || characters[index - 1].1.is_whitespace();
        let delimiter = characters.get(index + 1).map(|(_, value)| *value);
        if !has_boundary || !matches!(delimiter, Some(')') | Some('.') | Some('、')) {
            continue;
        }
        let content_offset = characters
            .get(index + 2)
            .map(|(next_offset, _)| *next_offset)
            .unwrap_or(prompt.len());
        markers.push((offset, label.to_ascii_uppercase(), content_offset));
    }
    if markers.len() < 2 {
        return None;
    }
    let stem = prompt[..markers[0].0].trim().to_string();
    if stem.is_empty() {
        return None;
    }
    let options = markers
        .iter()
        .enumerate()
        .filter_map(|(index, (_, label, content_offset))| {
            let end_offset = markers
                .get(index + 1)
                .map(|(next_offset, _, _)| *next_offset)
                .unwrap_or(prompt.len());
            let content = prompt[*content_offset..end_offset].trim().to_string();
            (!content.is_empty()).then_some((*label, content))
        })
        .collect::<Vec<_>>();
    (options.len() >= 2).then_some((stem, options))
}

fn backfill_inline_question_options(db: &mut Connection, article_id: i64) -> Result<usize, String> {
    let mut statement = db.prepare("SELECT id,prompt,answer FROM questions WHERE article_id=? AND NOT EXISTS (SELECT 1 FROM question_options WHERE question_options.question_id=questions.id)").map_err(|error| error.to_string())?;
    let legacy_questions = statement
        .query_map([article_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    drop(statement);
    if legacy_questions.is_empty() {
        return Ok(0);
    }
    let transaction = db.transaction().map_err(|error| error.to_string())?;
    let mut migrated = 0;
    for (question_id, prompt, answer) in legacy_questions {
        let Some((stem, options)) = parse_inline_options(&prompt) else {
            continue;
        };
        transaction
            .execute(
                "UPDATE questions SET prompt=? WHERE id=?",
                params![stem, question_id],
            )
            .map_err(|error| error.to_string())?;
        for (position, (label, content)) in options.iter().enumerate() {
            let is_correct = answer_position(&answer) == Some(position)
                || content.trim().eq_ignore_ascii_case(answer.trim())
                || label.to_string().eq_ignore_ascii_case(answer.trim());
            transaction.execute("INSERT INTO question_options(question_id,position,content,is_correct)VALUES(?,?,?,?)", params![question_id, position as i64, content, if is_correct { 1 } else { 0 }]).map_err(|error| error.to_string())?;
        }
        migrated += 1;
    }
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(migrated)
}
#[tauri::command]
pub fn get_questions(article_id: i64, db: State<Database>) -> Result<Vec<Question>, String> {
    let mut db = db.0.lock().map_err(|_| "database locked")?;
    backfill_inline_question_options(&mut db, article_id)?;
    let mut question_statement = db.prepare("SELECT id,position,question_type,prompt,answer,explanation,source_line FROM questions WHERE article_id=? ORDER BY position,id").map_err(|e| e.to_string())?;
    let mut questions: Vec<Question> = question_statement
        .query_map([article_id], |row| {
            Ok(Question {
                id: row.get(0)?,
                position: row.get(1)?,
                question_type: row.get(2)?,
                prompt: row.get(3)?,
                answer: row.get(4)?,
                explanation: row.get(5)?,
                source_line: row.get(6)?,
                options: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<Question>, _>>()
        .map_err(|e| e.to_string())?;
    drop(question_statement);
    let mut option_statement = db.prepare("SELECT id,position,content,is_correct FROM question_options WHERE question_id=? ORDER BY position,id").map_err(|e| e.to_string())?;
    for question in &mut questions {
        question.options = option_statement
            .query_map([question.id], |row| {
                Ok(QuestionOption {
                    id: row.get(0)?,
                    position: row.get(1)?,
                    content: row.get(2)?,
                    is_correct: row.get::<_, i64>(3)? != 0,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<QuestionOption>, _>>()
            .map_err(|e| e.to_string())?;
    }
    Ok(questions)
}
fn answer_position(answer: &str) -> Option<usize> {
    let answer = answer.trim();
    let mut chars = answer.chars();
    let label = chars.next()?.to_ascii_uppercase();
    if chars.next().is_some() {
        return None;
    }
    label
        .to_digit(36)
        .and_then(|value| value.checked_sub(10))
        .map(|position| position as usize)
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionBatchInput {
    pub article_id: i64,
    pub questions: Vec<QuestionInput>,
}

fn save_question_in_transaction(
    transaction: &Transaction<'_>,
    input: &QuestionInput,
) -> Result<i64, String> {
    if input.prompt.trim().is_empty() {
        return Err("题干不能为空".into());
    }
    let correct_position = input
        .options
        .iter()
        .position(|option| option.is_correct)
        .or_else(|| {
            answer_position(&input.answer).filter(|position| *position < input.options.len())
        })
        .or_else(|| {
            input.options.iter().position(|option| {
                option
                    .content
                    .trim()
                    .eq_ignore_ascii_case(input.answer.trim())
            })
        });
    let saved_answer = correct_position
        .and_then(|position| char::from_u32(b'A' as u32 + position as u32))
        .map(|label| label.to_string())
        .unwrap_or_else(|| input.answer.trim().to_string());
    transaction
        .execute(
            "INSERT INTO questions(article_id,position,question_type,prompt,answer,explanation,source_line,created_at)VALUES(?,?,?,?,?,?,?,?)",
            params![input.article_id, input.position, input.question_type.trim(), input.prompt.trim(), saved_answer, input.explanation.trim(), input.source_line, now()],
        )
        .map_err(|error| error.to_string())?;
    let question_id = transaction.last_insert_rowid();
    for (position, option) in input.options.iter().enumerate() {
        transaction
            .execute(
                "INSERT INTO question_options(question_id,position,content,is_correct)VALUES(?,?,?,?)",
                params![question_id, position as i64, option.content.trim(), if correct_position == Some(position) { 1 } else { 0 }],
            )
            .map_err(|error| error.to_string())?;
    }
    Ok(question_id)
}
#[tauri::command]
pub fn save_questions(input: QuestionBatchInput, db: State<Database>) -> Result<usize, String> {
    if input.questions.is_empty() {
        return Err("请至少保存一道题目".into());
    }
    let question_count = input.questions.len();
    let article_id = input.article_id;
    let mut db = db.0.lock().map_err(|_| "database locked")?;
    let transaction = db.transaction().map_err(|error| error.to_string())?;
    for (position, mut question) in input.questions.into_iter().enumerate() {
        question.article_id = article_id;
        question.position = (position + 1) as i64;
        save_question_in_transaction(&transaction, &question)?;
    }
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(question_count)
}
pub fn is_submission_correct(
    db: &Connection,
    question_id: i64,
    answer: &str,
) -> Result<bool, rusqlite::Error> {
    let mut option_statement =
        db.prepare("SELECT content FROM question_options WHERE question_id=? AND is_correct=1")?;
    let correct_options = option_statement
        .query_map([question_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<String>, _>>()?;
    if correct_options.is_empty() {
        let expected: String = db.query_row(
            "SELECT answer FROM questions WHERE id=?",
            [question_id],
            |row| row.get(0),
        )?;
        Ok(answer.trim().eq_ignore_ascii_case(expected.trim()))
    } else {
        Ok(correct_options
            .iter()
            .any(|content| answer.trim().eq_ignore_ascii_case(content.trim())))
    }
}
#[tauri::command]
pub fn submit_question_answer(
    question_id: i64,
    answer: String,
    db: State<Database>,
) -> Result<bool, String> {
    let db = db.0.lock().map_err(|_| "database locked")?;
    let correct = is_submission_correct(&db, question_id, &answer).map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO question_attempts(question_id,answer,is_correct,created_at)VALUES(?,?,?,?)",
        params![
            question_id,
            answer.trim(),
            if correct { 1 } else { 0 },
            now()
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(correct)
}

#[cfg(test)]
mod tests {
    use super::parse_inline_options;

    #[test]
    fn parses_legacy_inline_multiple_choice_question() {
        let (stem, options) =
            parse_inline_options("What is correct? A) First B) Second C) Third D) Fourth")
                .expect("options should be parsed");
        assert_eq!(stem, "What is correct?");
        assert_eq!(options.len(), 4);
        assert_eq!(options[1], ('B', "Second".to_string()));
    }

    #[test]
    fn ignores_regular_sentence_without_multiple_choice_markers() {
        assert!(parse_inline_options("The letter A is not an answer.").is_none());
    }
}
