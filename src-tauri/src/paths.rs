use chrono::Utc;
use std::{
    fs,
    path::{Path, PathBuf},
};

pub fn app_data_dir() -> PathBuf {
    dirs::data_dir()
        .expect("data directory")
        .join("ReadingAgent")
}

pub fn ai_config_path() -> PathBuf {
    app_data_dir().join("ai-provider.json")
}

pub fn local_dictionary_path() -> PathBuf {
    let directory = app_data_dir();
    let pointer = directory.join("local-dictionary-current.txt");
    if let Ok(name) = fs::read_to_string(pointer) {
        let candidate = directory.join(name.trim());
        if candidate.exists() {
            return candidate;
        }
    }
    directory.join("local-dictionary.db")
}

pub fn local_dictionary_temp_path() -> PathBuf {
    app_data_dir().join(format!(
        "local-dictionary-import-{}-{}.tmp.db",
        std::process::id(),
        Utc::now().timestamp_millis()
    ))
}

pub fn activate_local_dictionary(temporary_path: &Path) -> Result<(), String> {
    let directory = app_data_dir();
    let file_name = format!(
        "local-dictionary-{}-{}.db",
        std::process::id(),
        Utc::now().timestamp_millis()
    );
    let destination = directory.join(&file_name);
    fs::rename(temporary_path, destination).map_err(|error| error.to_string())?;
    fs::write(directory.join("local-dictionary-current.txt"), file_name)
        .map_err(|error| error.to_string())
}
