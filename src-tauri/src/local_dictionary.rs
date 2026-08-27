use crate::paths::{activate_local_dictionary, local_dictionary_path, local_dictionary_temp_path};
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::Serialize;
use std::fs;
use tauri::{AppHandle, Emitter};

fn now() -> String {
    Utc::now().to_rfc3339()
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryInstallProgress {
    pub phase: String,
    pub percent: u8,
    pub detail: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDictionaryResult {
    pub found: bool,
    pub word: String,
    pub phonetic: String,
    pub translation: String,
    pub definition: String,
    pub part_of_speech: String,
    pub exchange: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomDictionaryStatus {
    pub id: String,
    pub name: String,
    pub entry_count: i64,
    pub source: String,
    pub installed_at: String,
    pub language: String,
    pub definition_language: String,
    pub resource_type: String,
    pub enabled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceImportAnalysis {
    pub suggested_name: String,
    pub lookup_language: String,
    pub definition_language: String,
    pub resource_type: String,
    pub confidence: String,
    pub sample_count: usize,
    pub note: String,
}
#[tauri::command]
pub fn get_custom_dictionary_status() -> Result<Vec<CustomDictionaryStatus>, String> {
    let path = local_dictionary_path();
    if !path.exists() {
        return Ok(Vec::new());
    }
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    ensure_dictionary_schema(&connection)?;
    let mut statement = connection
        .prepare("SELECT id,source,entry_count,installed_at,language,definition_language,resource_type,enabled FROM dictionary_packages WHERE id LIKE 'custom:%' ORDER BY priority DESC, installed_at DESC")
        .map_err(|error| error.to_string())?;
    let resources = statement
        .query_map([], |row| {
            let source: String = row.get(1)?;
            let (source, name) = source
                .split_once('|')
                .map(|(kind, name)| (kind.to_string(), name.to_string()))
                .unwrap_or_else(|| ("导入资源".to_string(), source));
            Ok(CustomDictionaryStatus {
                id: row.get(0)?,
                name,
                entry_count: row.get(2)?,
                source,
                installed_at: row.get(3)?,
                language: row.get(4)?,
                definition_language: row.get(5)?,
                resource_type: row.get(6)?,
                enabled: row.get::<_, i64>(7)? != 0,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(resources)
}

fn normalize_resource_language(language: &str) -> String {
    match language.trim().to_ascii_lowercase().as_str() {
        "en" | "english" => "en".to_string(),
        "ja" | "japanese" => "ja".to_string(),
        "ko" | "korean" => "ko".to_string(),
        "fr" | "french" => "fr".to_string(),
        "de" | "german" => "de".to_string(),
        "es" | "spanish" => "es".to_string(),
        value if !value.is_empty() && value.len() <= 16 => value.to_string(),
        _ => "en".to_string(),
    }
}

fn normalize_resource_type(resource_type: &str) -> String {
    match resource_type.trim().to_ascii_lowercase().as_str() {
        "wordlist" => "wordlist".to_string(),
        "terminology" => "terminology".to_string(),
        "examples" => "examples".to_string(),
        _ => "dictionary".to_string(),
    }
}
fn ensure_dictionary_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch("CREATE TABLE IF NOT EXISTS entries(word TEXT PRIMARY KEY COLLATE NOCASE, phonetic TEXT NOT NULL, definition TEXT NOT NULL, translation TEXT NOT NULL, part_of_speech TEXT NOT NULL, exchange TEXT NOT NULL); CREATE INDEX IF NOT EXISTS entries_word_index ON entries(word COLLATE NOCASE); CREATE TABLE IF NOT EXISTS dictionary_packages(id TEXT PRIMARY KEY, entry_count INTEGER NOT NULL, source TEXT NOT NULL, installed_at TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'en', definition_language TEXT NOT NULL DEFAULT '', resource_type TEXT NOT NULL DEFAULT 'dictionary', enabled INTEGER NOT NULL DEFAULT 1, priority INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS custom_entries(dictionary_id TEXT NOT NULL, word TEXT NOT NULL COLLATE NOCASE, phonetic TEXT NOT NULL DEFAULT '', definition TEXT NOT NULL DEFAULT '', translation TEXT NOT NULL DEFAULT '', part_of_speech TEXT NOT NULL DEFAULT '', exchange TEXT NOT NULL DEFAULT '', PRIMARY KEY(dictionary_id, word)); CREATE INDEX IF NOT EXISTS custom_entries_word_index ON custom_entries(word COLLATE NOCASE);")
        .map_err(|error| error.to_string())?;
    for (column, definition) in [
        ("language", "TEXT NOT NULL DEFAULT 'en'"),
        ("definition_language", "TEXT NOT NULL DEFAULT ''"),
        ("resource_type", "TEXT NOT NULL DEFAULT 'dictionary'"),
        ("enabled", "INTEGER NOT NULL DEFAULT 1"),
        ("priority", "INTEGER NOT NULL DEFAULT 0"),
    ] {
        if let Err(error) = connection.execute(
            &format!("ALTER TABLE dictionary_packages ADD COLUMN {column} {definition}"),
            [],
        ) {
            if !error.to_string().contains("duplicate column name") {
                return Err(error.to_string());
            }
        }
    }
    connection
        .execute("UPDATE dictionary_packages SET language='en', resource_type='dictionary', enabled=1, priority=0 WHERE id LIKE 'custom:%' AND (trim(language)='' OR language IS NULL)", [])
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE dictionary_packages SET definition_language=CASE WHEN language='en' THEN 'zh' ELSE '' END WHERE id LIKE 'custom:%' AND (definition_language IS NULL OR trim(definition_language)='')",
            [],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn normalize_definition_language(language: &str) -> String {
    if language.trim().is_empty() {
        String::new()
    } else {
        normalize_resource_language(language)
    }
}

fn infer_language_from_text(value: &str) -> String {
    let mut han = 0usize;
    let mut japanese = 0usize;
    let mut korean = 0usize;
    let mut cyrillic = 0usize;
    let mut arabic = 0usize;
    let mut latin = 0usize;
    for character in value.chars().take(800) {
        match character as u32 {
            0x3040..=0x30ff => japanese += 1,
            0xac00..=0xd7af => korean += 1,
            0x0400..=0x052f => cyrillic += 1,
            0x0600..=0x06ff => arabic += 1,
            0x4e00..=0x9fff => han += 1,
            _ if character.is_ascii_alphabetic() => latin += 1,
            _ => {}
        }
    }
    if japanese > 0 {
        "ja".into()
    } else if korean > 0 {
        "ko".into()
    } else if arabic > 0 {
        "ar".into()
    } else if cyrillic > 0 {
        "ru".into()
    } else if han > 0 {
        "zh".into()
    } else if latin > 0 {
        "en".into()
    } else {
        String::new()
    }
}

#[tauri::command]
pub fn analyze_custom_dictionary_file(path: String) -> Result<ResourceImportAnalysis, String> {
    let content = fs::read(&path).map_err(|error| format!("无法读取资源文件：{error}"))?;
    if content.is_empty() {
        return Err("资源文件为空".into());
    }
    let extension = std::path::Path::new(&path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let delimiter = if extension == "tsv" { b'\t' } else { b',' };
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(delimiter)
        .flexible(true)
        .from_reader(content.as_slice());
    let headers = reader
        .headers()
        .map_err(|error| format!("无法读取资源表头：{error}"))?
        .clone();
    let header_values = headers
        .iter()
        .map(|header| header.trim().to_ascii_lowercase())
        .collect::<Vec<_>>();
    let find_column = |names: &[&str], fallback: usize| {
        headers
            .iter()
            .position(|header| {
                names
                    .iter()
                    .any(|name| header.trim().eq_ignore_ascii_case(name))
            })
            .unwrap_or(fallback)
    };
    let word_column = find_column(
        &["word", "词", "单词", "词头", "headword", "lemma", "term"],
        0,
    );
    let definition_column = find_column(
        &[
            "definition",
            "释义",
            "英文释义",
            "meaning",
            "translation",
            "中文释义",
            "翻译",
            "中文",
            "gloss",
        ],
        1,
    );
    let has_examples = header_values.iter().any(|value| {
        ["sentence", "example", "context", "例句", "语境"]
            .iter()
            .any(|name| value.contains(name))
    });
    let has_terms = header_values.iter().any(|value| {
        ["term", "terminology", "术语", "领域", "domain"]
            .iter()
            .any(|name| value.contains(name))
    });
    let has_definitions = header_values.iter().any(|value| {
        [
            "definition",
            "meaning",
            "translation",
            "释义",
            "翻译",
            "gloss",
        ]
        .iter()
        .any(|name| value.contains(name))
    });
    let resource_type = if has_examples {
        "examples"
    } else if has_terms {
        "terminology"
    } else if has_definitions {
        "dictionary"
    } else {
        "wordlist"
    }
    .to_string();
    let mut words = String::new();
    let mut definitions = String::new();
    let mut sample_count = 0usize;
    for record in reader.records().take(50) {
        let record = record.map_err(|error| format!("资源文件格式错误：{error}"))?;
        let word = record.get(word_column).unwrap_or_default().trim();
        if word.is_empty() {
            continue;
        }
        words.push_str(word);
        words.push(' ');
        definitions.push_str(record.get(definition_column).unwrap_or_default().trim());
        definitions.push(' ');
        sample_count += 1;
    }
    if sample_count == 0 {
        return Err("没有识别到有效词条，请检查表格是否包含词条列".into());
    }
    let inferred_lookup = infer_language_from_text(&words);
    let lookup_language = if inferred_lookup.is_empty() {
        "en".to_string()
    } else {
        inferred_lookup
    };
    let confidence = if has_examples || has_terms || has_definitions {
        "high"
    } else if sample_count >= 8 {
        "medium"
    } else {
        "low"
    }
    .to_string();
    let suggested_name = std::path::Path::new(&path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("我的语言资源")
        .trim()
        .to_string();
    Ok(ResourceImportAnalysis {
        suggested_name,
        lookup_language,
        definition_language: infer_language_from_text(&definitions),
        resource_type,
        confidence,
        sample_count,
        note: "已根据表头与前 50 条有效记录识别，可在导入前调整".to_string(),
    })
}

#[tauri::command]
pub async fn import_custom_dictionary(
    path: String,
    name: String,
    language: String,
    definition_language: String,
    resource_type: String,
    app: AppHandle,
) -> Result<CustomDictionaryStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err("请输入资源名称".into());
        }        let language = normalize_resource_language(&language);
        let definition_language = normalize_definition_language(&definition_language);
        let resource_type = normalize_resource_type(&resource_type);
        let content = fs::read(&path).map_err(|error| format!("无法读取资源文件：{error}"))?;
        if content.is_empty() {
            return Err("资源文件为空".into());
        }
        let extension = std::path::Path::new(&path)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        let delimiter = if extension == "tsv" { b'\t' } else { b',' };
        let mut reader = csv::ReaderBuilder::new()
            .delimiter(delimiter)
            .flexible(true)
            .from_reader(content.as_slice());
        let headers = reader
            .headers()
            .map_err(|error| format!("无法读取资源表头：{error}"))?
            .clone();
        let find_column = |names: &[&str], fallback: usize| {
            headers
                .iter()
                .position(|header| names.iter().any(|name| header.trim().eq_ignore_ascii_case(name)))
                .unwrap_or(fallback)
        };
        let word_column = find_column(&["word", "词", "单词", "词头", "headword"], 0);
        let phonetic_column = find_column(&["phonetic", "音标", "pronunciation"], 1);
        let definition_column = find_column(&["definition", "释义", "英文释义", "meaning"], 2);
        let translation_column = find_column(&["translation", "中文释义", "翻译", "中文"], 3);
        let part_of_speech_column = find_column(&["part_of_speech", "part of speech", "词性", "pos"], 4);
        let dictionary_id = format!("custom:{}", Utc::now().timestamp_millis());
        let path_db = local_dictionary_path();
        let creates_dictionary_store = !path_db.exists();
        let working_path = if creates_dictionary_store {
            local_dictionary_temp_path()
        } else {
            path_db
        };
        let connection = Connection::open(&working_path).map_err(|error| error.to_string())?;
        ensure_dictionary_schema(&connection)?;
        let transaction = connection.unchecked_transaction().map_err(|error| error.to_string())?;
        let mut entry_count = 0_i64;
        for record in reader.records() {
            let record = record.map_err(|error| format!("资源文件格式错误：{error}"))?;
            let word = record.get(word_column).unwrap_or_default().trim();
            if word.is_empty() {
                continue;
            }
            transaction.execute("INSERT OR REPLACE INTO custom_entries(dictionary_id,word,phonetic,definition,translation,part_of_speech,exchange)VALUES(?,?,?,?,?,?,?)", params![dictionary_id, word, record.get(phonetic_column).unwrap_or_default().trim(), record.get(definition_column).unwrap_or_default().trim(), record.get(translation_column).unwrap_or_default().trim(), record.get(part_of_speech_column).unwrap_or_default().trim(), ""]).map_err(|error| error.to_string())?;
            entry_count += 1;
            if entry_count % 5000 == 0 {
                let _ = app.emit("dictionary-install-progress", DictionaryInstallProgress {
                    phase: "custom".to_string(),
                    percent: ((entry_count / 5000).min(98)) as u8,
                    detail: format!("正在导入语言资源：{} 个词条", entry_count),
                });
            }
        }
        if entry_count == 0 {
            return Err("没有识别到有效词条，请检查表格是否包含词条列".into());
        }
        let enabled = true;
        let installed_at = now();
        transaction.execute("INSERT INTO dictionary_packages(id,entry_count,source,installed_at,language,definition_language,resource_type,enabled,priority)VALUES(?,?,?,?,?,?,?,?,0)", params![dictionary_id, entry_count, format!("导入资源|{}", name), installed_at, language, definition_language, resource_type, i64::from(enabled)]).map_err(|error| error.to_string())?;
        transaction.commit().map_err(|error| error.to_string())?;
        drop(connection);
        if creates_dictionary_store {
            activate_local_dictionary(&working_path)?;
        }
        let _ = app.emit("dictionary-install-progress", DictionaryInstallProgress { phase: "custom".to_string(), percent: 100, detail: format!("语言资源导入完成，共 {} 个词条", entry_count) });
        Ok(CustomDictionaryStatus {
            id: dictionary_id,
            name,
            entry_count,
            source: "导入资源".to_string(),
            installed_at,
            language,
            definition_language,
            resource_type,
            enabled,
        })
    })
    .await
    .map_err(|error| format!("语言资源导入任务异常：{error}"))?
}
#[tauri::command]
pub fn rename_custom_dictionary(
    id: String,
    name: String,
) -> Result<CustomDictionaryStatus, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("资源名称不能为空".into());
    }
    let connection =
        Connection::open(local_dictionary_path()).map_err(|error| error.to_string())?;
    ensure_dictionary_schema(&connection)?;
    let changed = connection
        .execute(
            "UPDATE dictionary_packages SET source=? WHERE id=? AND id LIKE 'custom:%'",
            params![format!("导入资源|{}", name), id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("未找到要修改的语言资源".into());
    }
    connection
        .query_row(
            "SELECT id,source,entry_count,installed_at,language,definition_language,resource_type,enabled FROM dictionary_packages WHERE id=?",
            [id],
            |row| {
                let source: String = row.get(1)?;
                let (source, name) = source
                    .split_once('|')
                    .map(|(kind, name)| (kind.to_string(), name.to_string()))
                    .unwrap_or_else(|| ("导入资源".to_string(), source));
                Ok(CustomDictionaryStatus {
                    id: row.get(0)?,
                    name,
                    entry_count: row.get(2)?,
                    source,
                    installed_at: row.get(3)?,
                    language: row.get(4)?,
                definition_language: row.get(5)?,
                resource_type: row.get(6)?,
                enabled: row.get::<_, i64>(7)? != 0,
                })
            },
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_custom_dictionary_enabled(id: String, enabled: bool) -> Result<(), String> {
    let connection =
        Connection::open(local_dictionary_path()).map_err(|error| error.to_string())?;
    ensure_dictionary_schema(&connection)?;
    let changed = connection
        .execute(
            "UPDATE dictionary_packages SET enabled=? WHERE id=? AND id LIKE 'custom:%'",
            params![i64::from(enabled), id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("未找到要更新的语言资源".into());
    }
    Ok(())
}
#[tauri::command]
pub fn delete_custom_dictionary(id: String) -> Result<(), String> {
    let connection =
        Connection::open(local_dictionary_path()).map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM custom_entries WHERE dictionary_id=?", [&id])
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "DELETE FROM dictionary_packages WHERE id=? AND id LIKE 'custom:%'",
            [&id],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}
fn dictionary_candidates(word: &str) -> Vec<String> {
    let mut candidates = vec![word.to_string()];
    if word.contains(' ') {
        return candidates;
    }
    for suffix in ["ing", "ed"] {
        if let Some(stem) = word.strip_suffix(suffix) {
            if stem.len() >= 2 {
                candidates.push(stem.to_string());
                candidates.push(format!("{stem}e"));
                if stem.len() > 2 && stem.as_bytes()[stem.len() - 1] == stem.as_bytes()[stem.len() - 2] {
                    candidates.push(stem[..stem.len() - 1].to_string());
                }
            }
        }
    }
    for suffix in ["es", "s"] {
        if let Some(stem) = word.strip_suffix(suffix) {
            if stem.len() >= 2 { candidates.push(stem.to_string()); }
        }
    }
    candidates.sort();
    candidates.dedup();
    candidates
}

fn japanese_dictionary_candidates(word: &str) -> Vec<String> {
    let mut candidates = vec![word.to_string()];
    for suffix in [
        "ます", "です", "を", "に", "が", "は", "の", "と", "へ", "で",
    ] {
        if let Some(stem) = word.strip_suffix(suffix) {
            if !stem.is_empty() {
                candidates.push(stem.to_string());
            }
        }
    }
    candidates.sort();
    candidates.dedup();
    candidates
}

pub fn normalize_card_key(word: &str) -> String {
    word.trim()
        .trim_matches(|character: char| !character.is_alphabetic() && character != '\'')
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}
pub type LocalDictionaryEntry = (String, String, String, String, String, String);
pub fn find_local_dictionary_entry(
    word: &str,
    language: &str,
) -> Result<Option<LocalDictionaryEntry>, String> {
    let language = normalize_resource_language(language);
    let normalized = if language == "en" {
        normalize_card_key(word)
    } else {
        word.trim().split_whitespace().collect::<Vec<_>>().join(" ")
    };
    if normalized.is_empty() {
        return Ok(None);
    }
    let path = local_dictionary_path();
    if !path.exists() {
        return Ok(None);
    }
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let candidates = if language == "en" {
        dictionary_candidates(&normalized)
    } else if language == "ja" {
        japanese_dictionary_candidates(&normalized)
    } else {
        vec![normalized.clone()]
    };
    for candidate in candidates {
        if language == "en" {
            let entry = connection
                .query_row("SELECT word,phonetic,definition,translation,part_of_speech,exchange FROM entries WHERE word=? COLLATE NOCASE", [candidate.as_str()], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, String>(3)?, row.get::<_, String>(4)?, row.get::<_, String>(5)?)))
                .ok();
            if entry.is_some() {
                return Ok(entry);
            }
        }
        let custom_entry = connection
            .query_row("SELECT word,phonetic,definition,translation,part_of_speech,exchange FROM custom_entries WHERE word=? COLLATE NOCASE AND dictionary_id IN (SELECT id FROM dictionary_packages WHERE id LIKE 'custom:%' AND enabled=1 AND language=?) ORDER BY rowid DESC LIMIT 1", params![candidate, language], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, String>(3)?, row.get::<_, String>(4)?, row.get::<_, String>(5)?)))
            .ok();
        if custom_entry.is_some() {
            return Ok(custom_entry);
        }
    }
    Ok(None)
}
#[tauri::command]
pub fn lookup_local_dictionary(
    word: String,
    language: Option<String>,
) -> Result<LocalDictionaryResult, String> {
    let language = normalize_resource_language(language.as_deref().unwrap_or("en"));
    let normalized = if language == "en" {
        normalize_card_key(&word)
    } else {
        word.trim().split_whitespace().collect::<Vec<_>>().join(" ")
    };
    if normalized.is_empty() {
        return Err("请输入要查询的词语".into());
    }
    if !local_dictionary_path().exists() {
        return Err("尚未安装语言资源，请在语言资源中心按需安装或导入".into());
    }
    match find_local_dictionary_entry(&normalized, &language)? {
        Some((word, phonetic, definition, translation, part_of_speech, exchange)) => {
            Ok(LocalDictionaryResult {
                found: true,
                word,
                phonetic,
                translation,
                definition,
                part_of_speech,
                exchange,
            })
        }
        None => Ok(LocalDictionaryResult {
            found: false,
            word: normalized,
            phonetic: String::new(),
            translation: String::new(),
            definition: String::new(),
            part_of_speech: String::new(),
            exchange: String::new(),
        }),
    }
}
