use chrono::Utc;
use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use rusqlite::{Connection, DatabaseName};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
};
use tar::{Archive, Builder, Header};
use tauri::State;

use crate::{
    database::migrate_database,
    paths::{
        activate_local_dictionary, app_data_dir, local_dictionary_path, local_dictionary_temp_path,
    },
    Database,
};

const BACKUP_FORMAT_VERSION: u32 = 1;
const MANIFEST_FILE: &str = "manifest.json";
const DATABASE_FILE: &str = "data.db";
const DICTIONARY_FILE: &str = "custom-dictionary.db";

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupManifest {
    format_version: u32,
    created_at: String,
    app_version: String,
    database_size: u64,
    database_checksum: String,
    #[serde(default)]
    dictionary_size: Option<u64>,
    #[serde(default)]
    dictionary_checksum: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupPathInput {
    pub path: String,
    #[serde(default)]
    pub include_dictionary: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupPreview {
    pub format_version: u32,
    pub created_at: String,
    pub app_version: String,
    pub books: i64,
    pub chapters: i64,
    pub articles: i64,
    pub cards: i64,
    pub questions: i64,
    pub dictionary_included: bool,
    pub custom_dictionaries: i64,
    pub custom_dictionary_entries: i64,
    pub dictionary_size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRestoreResult {
    pub preview: BackupPreview,
    pub rollback_backup_path: String,
}

fn backup_error(message: &str) -> String {
    format!("迁移包无效：{message}")
}

fn timestamp() -> String {
    Utc::now().to_rfc3339()
}

fn temporary_database_path(label: &str) -> PathBuf {
    app_data_dir().join(format!(
        "{label}-{}-{}.db",
        std::process::id(),
        Utc::now().timestamp_millis(),
    ))
}

fn checksum(bytes: &[u8]) -> String {
    let value = bytes.iter().fold(0xcbf29ce484222325_u64, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    });
    format!("fnv1a64:{value:016x}")
}

fn write_archive(
    path: &Path,
    manifest: &BackupManifest,
    database: &[u8],
    dictionary: Option<&[u8]>,
) -> Result<(), String> {
    let output = File::create(path).map_err(|error| error.to_string())?;
    let encoder = GzEncoder::new(output, Compression::default());
    let mut archive = Builder::new(encoder);
    let manifest = serde_json::to_vec_pretty(manifest).map_err(|error| error.to_string())?;
    let mut entries = vec![
        (MANIFEST_FILE, manifest.as_slice()),
        (DATABASE_FILE, database),
    ];
    if let Some(dictionary) = dictionary {
        entries.push((DICTIONARY_FILE, dictionary));
    }

    for (name, content) in entries {
        let mut header = Header::new_gnu();
        header.set_size(content.len() as u64);
        header.set_mode(0o600);
        header.set_cksum();
        archive
            .append_data(&mut header, name, content)
            .map_err(|error| error.to_string())?;
    }

    archive.finish().map_err(|error| error.to_string())?;
    let encoder = archive.into_inner().map_err(|error| error.to_string())?;
    encoder.finish().map_err(|error| error.to_string())?;
    Ok(())
}

fn read_archive(path: &Path) -> Result<(BackupManifest, Vec<u8>, Option<Vec<u8>>), String> {
    let input = File::open(path).map_err(|error| error.to_string())?;
    let decoder = GzDecoder::new(input);
    let mut archive = Archive::new(decoder);
    let mut manifest = None;
    let mut database = None;
    let mut dictionary = None;

    for entry in archive
        .entries()
        .map_err(|error| backup_error(&error.to_string()))?
    {
        let mut entry = entry.map_err(|error| backup_error(&error.to_string()))?;
        let path = entry
            .path()
            .map_err(|error| backup_error(&error.to_string()))?;
        match path.to_string_lossy().as_ref() {
            MANIFEST_FILE if manifest.is_none() => {
                let mut value = String::new();
                entry
                    .read_to_string(&mut value)
                    .map_err(|error| backup_error(&error.to_string()))?;
                manifest = Some(
                    serde_json::from_str::<BackupManifest>(&value)
                        .map_err(|error| backup_error(&error.to_string()))?,
                );
            }
            DATABASE_FILE if database.is_none() => {
                let mut value = Vec::new();
                entry
                    .read_to_end(&mut value)
                    .map_err(|error| backup_error(&error.to_string()))?;
                database = Some(value);
            }
            DICTIONARY_FILE if dictionary.is_none() => {
                let mut value = Vec::new();
                entry
                    .read_to_end(&mut value)
                    .map_err(|error| backup_error(&error.to_string()))?;
                dictionary = Some(value);
            }
            _ => {}
        }
    }

    let manifest = manifest.ok_or_else(|| backup_error("缺少清单"))?;
    let database = database.ok_or_else(|| backup_error("缺少学习数据"))?;
    if manifest.format_version != BACKUP_FORMAT_VERSION {
        return Err(backup_error("格式版本不受支持"));
    }
    if manifest.database_size != database.len() as u64
        || manifest.database_checksum != checksum(&database)
    {
        return Err(backup_error("学习数据校验失败"));
    }
    if manifest.dictionary_size.is_some() != manifest.dictionary_checksum.is_some() {
        return Err(backup_error("词典资源校验失败"));
    }
    if manifest.dictionary_size.is_some() != dictionary.is_some() {
        return Err(backup_error("词典资源校验失败"));
    }
    if let Some(dictionary) = dictionary.as_ref() {
        let dictionary_checksum = checksum(dictionary);
        if manifest.dictionary_size != Some(dictionary.len() as u64)
            || manifest.dictionary_checksum.as_deref() != Some(dictionary_checksum.as_str())
        {
            return Err(backup_error("词典资源校验失败"));
        }
    }

    Ok((manifest, database, dictionary))
}

fn count(connection: &Connection, table: &str) -> Result<i64, String> {
    connection
        .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
            row.get(0)
        })
        .map_err(|_| backup_error("学习数据库结构不完整"))
}

fn inspect_database(manifest: BackupManifest, database: &[u8]) -> Result<BackupPreview, String> {
    let path = temporary_database_path("migration-preview");
    let result = (|| {
        fs::write(&path, database).map_err(|error| error.to_string())?;
        let connection =
            Connection::open(&path).map_err(|error| backup_error(&error.to_string()))?;
        Ok(BackupPreview {
            format_version: manifest.format_version,
            created_at: manifest.created_at,
            app_version: manifest.app_version,
            books: count(&connection, "books")?,
            chapters: count(&connection, "chapters")?,
            articles: count(&connection, "articles")?,
            cards: count(&connection, "word_cards")?,
            questions: count(&connection, "questions")?,
            dictionary_included: false,
            custom_dictionaries: 0,
            custom_dictionary_entries: 0,
            dictionary_size: 0,
        })
    })();
    let _ = fs::remove_file(path);
    result
}

fn inspect_dictionary_at(dictionary: &[u8], path: &Path) -> Result<(bool, i64, i64), String> {
    let result = (|| {
        fs::write(path, dictionary).map_err(|error| backup_error(&error.to_string()))?;
        let connection = Connection::open(path)
            .map_err(|error| backup_error(&format!("词典资源无法读取：{error}")))?;
        let dictionaries = connection
            .query_row(
                "SELECT COUNT(*) FROM dictionary_packages WHERE id LIKE 'custom:%'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);
        let entries = connection
            .query_row(
                "SELECT COUNT(*) FROM custom_entries WHERE dictionary_id LIKE 'custom:%'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);
        Ok((true, dictionaries, entries))
    })();
    let _ = fs::remove_file(path);
    result
}

fn inspect_dictionary(dictionary: Option<&[u8]>) -> Result<(bool, i64, i64), String> {
    let Some(dictionary) = dictionary else {
        return Ok((false, 0, 0));
    };
    inspect_dictionary_at(
        dictionary,
        &temporary_database_path("migration-dictionary-preview"),
    )
}
fn inspect_backup(
    manifest: BackupManifest,
    database: &[u8],
    dictionary: Option<&[u8]>,
) -> Result<BackupPreview, String> {
    let dictionary_size = manifest.dictionary_size.unwrap_or(0);
    let mut preview = inspect_database(manifest, database)?;
    let (dictionary_included, custom_dictionaries, custom_dictionary_entries) =
        inspect_dictionary(dictionary)?;
    preview.dictionary_included = dictionary_included;
    preview.custom_dictionaries = custom_dictionaries;
    preview.custom_dictionary_entries = custom_dictionary_entries;
    preview.dictionary_size = dictionary_size;
    Ok(preview)
}

fn snapshot_database(connection: &Connection, destination: &Path) -> Result<(), String> {
    connection
        .backup(DatabaseName::Main, destination, None)
        .map_err(|error| error.to_string())
}

fn snapshot_local_dictionary() -> Result<Option<Vec<u8>>, String> {
    let source = local_dictionary_path();
    if !source.exists() {
        return Ok(None);
    }

    let snapshot = temporary_database_path("migration-dictionary-export");
    let result = (|| {
        let connection =
            Connection::open(&source).map_err(|error| format!("读取本地词典失败：{error}"))?;
        snapshot_database(&connection, &snapshot)
            .map_err(|error| format!("备份本地词典失败：{error}"))?;
        fs::read(&snapshot)
            .map(Some)
            .map_err(|error| format!("读取本地词典快照失败：{error}"))
    })();
    let _ = fs::remove_file(snapshot);
    result
}

fn dictionary_snapshot_for_backup(
    include_dictionary: bool,
    capture: impl FnOnce() -> Result<Option<Vec<u8>>, String>,
) -> Result<Option<Vec<u8>>, String> {
    if include_dictionary {
        capture()
    } else {
        Ok(None)
    }
}
fn create_backup_package(
    connection: &Connection,
    destination: &Path,
    include_dictionary: bool,
) -> Result<BackupPreview, String> {
    let snapshot = temporary_database_path("migration-export");
    let result = (|| {
        snapshot_database(connection, &snapshot)?;
        let database = fs::read(&snapshot).map_err(|error| error.to_string())?;
        let dictionary =
            dictionary_snapshot_for_backup(include_dictionary, snapshot_local_dictionary)?;
        let manifest = BackupManifest {
            format_version: BACKUP_FORMAT_VERSION,
            created_at: timestamp(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            database_size: database.len() as u64,
            database_checksum: checksum(&database),
            dictionary_size: dictionary.as_ref().map(|bytes| bytes.len() as u64),
            dictionary_checksum: dictionary.as_ref().map(|bytes| checksum(bytes)),
        };
        write_archive(destination, &manifest, &database, dictionary.as_deref())?;
        inspect_backup(manifest, &database, dictionary.as_deref())
    })();
    let _ = fs::remove_file(snapshot);
    result
}

#[tauri::command]
pub fn export_learning_backup(
    input: BackupPathInput,
    db: State<Database>,
) -> Result<BackupPreview, String> {
    let destination = PathBuf::from(input.path);
    if destination.as_os_str().is_empty() {
        return Err("请选择迁移包保存位置".into());
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let db = db.0.lock().map_err(|_| "database locked")?;
    create_backup_package(&db, &destination, input.include_dictionary.unwrap_or(true))
}

#[tauri::command]
pub fn inspect_learning_backup(input: BackupPathInput) -> Result<BackupPreview, String> {
    let path = PathBuf::from(input.path);
    let (manifest, database, dictionary) = read_archive(&path)?;
    inspect_backup(manifest, &database, dictionary.as_deref())
}

#[tauri::command]
pub fn restore_learning_backup(
    input: BackupPathInput,
    db: State<Database>,
) -> Result<BackupRestoreResult, String> {
    let path = PathBuf::from(input.path);
    let (manifest, database, dictionary) = read_archive(&path)?;
    let preview = inspect_backup(manifest, &database, dictionary.as_deref())?;
    let staged = temporary_database_path("migration-restore");
    let rollback_directory = app_data_dir().join("backups");
    fs::create_dir_all(&rollback_directory).map_err(|error| error.to_string())?;
    let rollback_path = rollback_directory.join(format!(
        "before-restore-{}.readingbackup",
        Utc::now().format("%Y%m%d-%H%M%S")
    ));
    let result = (|| {
        fs::write(&staged, database).map_err(|error| error.to_string())?;
        let mut db = db.0.lock().map_err(|_| "database locked")?;
        create_backup_package(&db, &rollback_path, true)?;
        db.restore(DatabaseName::Main, &staged, Some(|_| {}))
            .map_err(|error| format!("恢复迁移包失败；当前数据的自动回滚包已保留：{error}"))?;
        migrate_database(&db).map_err(|error| format!("恢复后升级数据库失败：{error}"))?;
        drop(db);

        if let Some(dictionary) = dictionary {
            let dictionary_staged = local_dictionary_temp_path();
            let dictionary_result = (|| {
                fs::write(&dictionary_staged, dictionary)
                    .map_err(|error| format!("写入待恢复词典失败：{error}"))?;
                activate_local_dictionary(&dictionary_staged)
                    .map_err(|error| format!("切换已恢复词典失败：{error}"))
            })();
            let _ = fs::remove_file(&dictionary_staged);
            dictionary_result.map_err(|error| {
                format!("学习数据已恢复，但本地词典恢复失败；可使用自动回滚包恢复：{error}")
            })?;
        }

        Ok(BackupRestoreResult {
            preview,
            rollback_backup_path: rollback_path.to_string_lossy().to_string(),
        })
    })();
    let _ = fs::remove_file(staged);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lightweight_backup_skips_dictionary_snapshot() {
        let dictionary = dictionary_snapshot_for_backup(false, || {
            panic!("dictionary capture must not run for a lightweight backup")
        })
        .unwrap();
        assert!(dictionary.is_none());
    }

    #[test]
    fn full_backup_requests_dictionary_snapshot() {
        let dictionary = dictionary_snapshot_for_backup(true, || Ok(Some(vec![1, 2, 3]))).unwrap();
        assert_eq!(dictionary, Some(vec![1, 2, 3]));
    }
    #[test]
    fn archive_round_trip_keeps_optional_dictionary() {
        let path = std::env::temp_dir().join(format!(
            "reading-agent-backup-{}.readingbackup",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let database = b"sqlite data";
        let dictionary = b"dictionary sqlite data";
        let manifest = BackupManifest {
            format_version: BACKUP_FORMAT_VERSION,
            created_at: timestamp(),
            app_version: "test".into(),
            database_size: database.len() as u64,
            database_checksum: checksum(database),
            dictionary_size: Some(dictionary.len() as u64),
            dictionary_checksum: Some(checksum(dictionary)),
        };
        write_archive(&path, &manifest, database, Some(dictionary)).unwrap();
        let (_, restored_database, restored_dictionary) = read_archive(&path).unwrap();
        assert_eq!(restored_database, database);
        assert_eq!(restored_dictionary.as_deref(), Some(dictionary.as_slice()));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn dictionary_preview_counts_custom_resources() {
        let path = std::env::temp_dir().join(format!(
            "reading-agent-dictionary-preview-{}.db",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let connection = Connection::open(&path).unwrap();
        connection
            .execute_batch(
                "CREATE TABLE dictionary_packages(id TEXT PRIMARY KEY);\
                 CREATE TABLE custom_entries(dictionary_id TEXT NOT NULL, word TEXT NOT NULL);\
                 INSERT INTO dictionary_packages(id) VALUES ('custom:phrases');\
                 INSERT INTO custom_entries(dictionary_id, word) VALUES ('custom:phrases', 'take off'), ('custom:phrases', 'carry on');",
            )
            .unwrap();
        drop(connection);
        let dictionary = fs::read(&path).unwrap();
        let preview =
            inspect_dictionary_at(&dictionary, &path.with_extension("preview.db")).unwrap();
        assert_eq!(preview, (true, 1, 2));
        let _ = fs::remove_file(path);
    }
    #[test]
    fn archive_round_trip_without_dictionary_remains_compatible() {
        let path = std::env::temp_dir().join(format!(
            "reading-agent-backup-no-dictionary-{}.readingbackup",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let database = b"sqlite data";
        let manifest = BackupManifest {
            format_version: BACKUP_FORMAT_VERSION,
            created_at: timestamp(),
            app_version: "test".into(),
            database_size: database.len() as u64,
            database_checksum: checksum(database),
            dictionary_size: None,
            dictionary_checksum: None,
        };
        write_archive(&path, &manifest, database, None).unwrap();
        let (_, restored_database, restored_dictionary) = read_archive(&path).unwrap();
        assert_eq!(restored_database, database);
        assert!(restored_dictionary.is_none());
        let _ = fs::remove_file(path);
    }

    #[test]
    fn archive_rejects_dictionary_with_invalid_checksum() {
        let path = std::env::temp_dir().join(format!(
            "reading-agent-backup-invalid-dictionary-{}.readingbackup",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let database = b"sqlite data";
        let dictionary = b"dictionary sqlite data";
        let manifest = BackupManifest {
            format_version: BACKUP_FORMAT_VERSION,
            created_at: timestamp(),
            app_version: "test".into(),
            database_size: database.len() as u64,
            database_checksum: checksum(database),
            dictionary_size: Some(dictionary.len() as u64),
            dictionary_checksum: Some("fnv1a64:0000000000000000".into()),
        };
        write_archive(&path, &manifest, database, Some(dictionary)).unwrap();
        assert!(read_archive(&path).is_err());
        let _ = fs::remove_file(path);
    }
}
