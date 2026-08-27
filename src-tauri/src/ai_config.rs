use crate::paths::{ai_config_path, app_data_dir};
use serde::{Deserialize, Serialize};
use std::{ffi::c_void, fs, ptr};

#[derive(Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderProfile {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub chat_model: String,
    pub translation_model: String,
    #[serde(default)]
    pub models: Vec<String>,
}
#[derive(Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    #[serde(default)]
    pub profiles: Vec<AiProviderProfile>,
    #[serde(default)]
    pub active_profile_id: String,
    // 保留旧字段，读取旧版配置时会自动迁移为“默认配置”。
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub chat_model: String,
    #[serde(default)]
    pub translation_model: String,
    #[serde(default)]
    pub models: Vec<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAiProviderProfileInput {
    pub profile: AiProviderProfile,
    pub activate: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderProfileIdInput {
    pub profile_id: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderStatus {
    pub configured: bool,
    pub active_profile_id: String,
    pub profiles: Vec<AiProviderProfile>,
    pub chat_model: String,
    pub translation_model: String,
    pub models: Vec<String>,
}
#[cfg(windows)]
#[repr(C)]
struct DataBlob {
    cb_data: u32,
    pb_data: *mut u8,
}
#[cfg(windows)]
#[link(name = "Crypt32")]
extern "system" {
    fn CryptProtectData(
        data_in: *const DataBlob,
        description: *const u16,
        entropy: *const DataBlob,
        reserved: *mut c_void,
        prompt: *mut c_void,
        flags: u32,
        data_out: *mut DataBlob,
    ) -> i32;
    fn CryptUnprotectData(
        data_in: *const DataBlob,
        description: *mut *mut u16,
        entropy: *const DataBlob,
        reserved: *mut c_void,
        prompt: *mut c_void,
        flags: u32,
        data_out: *mut DataBlob,
    ) -> i32;
}
#[cfg(windows)]
#[link(name = "Kernel32")]
extern "system" {
    fn LocalFree(memory: *mut c_void) -> *mut c_void;
}
fn hex_decode(value: &str) -> Option<Vec<u8>> {
    if value.len() % 2 != 0 {
        return None;
    };
    (0..value.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&value[i..i + 2], 16).ok())
        .collect()
}
fn hex_encode(value: &[u8]) -> String {
    value.iter().map(|byte| format!("{byte:02x}")).collect()
}
#[cfg(windows)]
fn protect_api_key(value: &str) -> Result<String, String> {
    if value.is_empty() || value.starts_with("dpapi:") {
        return Ok(value.to_string());
    }
    let mut input = value.as_bytes().to_vec();
    let data = DataBlob {
        cb_data: input.len() as u32,
        pb_data: input.as_mut_ptr(),
    };
    let mut output = DataBlob {
        cb_data: 0,
        pb_data: ptr::null_mut(),
    };
    if unsafe {
        CryptProtectData(
            &data,
            ptr::null(),
            ptr::null(),
            ptr::null_mut(),
            ptr::null_mut(),
            0,
            &mut output,
        )
    } == 0
    {
        return Err("无法使用 Windows 凭据保护 API Key".into());
    };
    let encrypted =
        unsafe { std::slice::from_raw_parts(output.pb_data, output.cb_data as usize).to_vec() };
    unsafe {
        LocalFree(output.pb_data.cast::<c_void>());
    };
    Ok(format!("dpapi:{}", hex_encode(&encrypted)))
}
#[cfg(not(windows))]
fn protect_api_key(value: &str) -> Result<String, String> {
    Ok(value.to_string())
}
fn protect_ai_config(mut config: AiProviderConfig) -> Result<AiProviderConfig, String> {
    config.api_key = protect_api_key(&config.api_key)?;
    for profile in &mut config.profiles {
        profile.api_key = protect_api_key(&profile.api_key)?;
    }
    Ok(config)
}
#[cfg(windows)]
fn unprotect_api_key(value: &str) -> String {
    let Some(value) = value.strip_prefix("dpapi:") else {
        return value.to_string();
    };
    let Some(mut input) = hex_decode(value) else {
        return String::new();
    };
    let data = DataBlob {
        cb_data: input.len() as u32,
        pb_data: input.as_mut_ptr(),
    };
    let mut output = DataBlob {
        cb_data: 0,
        pb_data: ptr::null_mut(),
    };
    if unsafe {
        CryptUnprotectData(
            &data,
            ptr::null_mut(),
            ptr::null(),
            ptr::null_mut(),
            ptr::null_mut(),
            0,
            &mut output,
        )
    } == 0
    {
        return String::new();
    };
    let plain =
        unsafe { std::slice::from_raw_parts(output.pb_data, output.cb_data as usize).to_vec() };
    unsafe {
        LocalFree(output.pb_data.cast::<c_void>());
    };
    String::from_utf8(plain).unwrap_or_default()
}
#[cfg(not(windows))]
fn unprotect_api_key(value: &str) -> String {
    value.to_string()
}
fn unprotect_ai_config(mut config: AiProviderConfig) -> AiProviderConfig {
    config.api_key = unprotect_api_key(&config.api_key);
    for profile in &mut config.profiles {
        profile.api_key = unprotect_api_key(&profile.api_key);
    }
    config
}
pub fn read_ai_config() -> AiProviderConfig {
    let stored = fs::read_to_string(ai_config_path())
        .ok()
        .and_then(|value| serde_json::from_str::<AiProviderConfig>(&value).ok())
        .unwrap_or_default();
    normalize_ai_config(unprotect_ai_config(stored))
}
pub fn normalize_base_url(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.ends_with("/v1") || trimmed.ends_with("/api/v3") {
        trimmed.to_string()
    } else {
        format!("{trimmed}/v1")
    }
}
fn profile_models(profile: &AiProviderProfile) -> Vec<String> {
    let mut models = profile
        .models
        .iter()
        .map(|model| model.trim())
        .filter(|model| !model.is_empty())
        .fold(Vec::new(), |mut items, model| {
            if !items.iter().any(|item: &String| item == model) {
                items.push(model.to_string());
            }
            items
        });
    if models.is_empty() && !profile.translation_model.trim().is_empty() {
        models.push(profile.translation_model.trim().to_string());
    }
    if !profile.chat_model.trim().is_empty() && !models.contains(&profile.chat_model) {
        models.push(profile.chat_model.trim().to_string());
    }
    models
}
pub fn normalize_ai_profile(mut profile: AiProviderProfile, index: usize) -> AiProviderProfile {
    if profile.id.trim().is_empty() {
        profile.id = format!("profile-{}", index + 1);
    }
    if profile.name.trim().is_empty() {
        profile.name = format!("模型配置 {}", index + 1);
    }
    profile.base_url = if profile.base_url.trim().is_empty() {
        String::new()
    } else {
        normalize_base_url(&profile.base_url)
    };
    profile.models = profile_models(&profile);
    if profile.translation_model.trim().is_empty() {
        profile.translation_model = profile.models.first().cloned().unwrap_or_default();
    }
    profile
}
pub fn normalize_ai_config(mut config: AiProviderConfig) -> AiProviderConfig {
    if config.profiles.is_empty()
        && (!config.base_url.trim().is_empty()
            || !config.api_key.trim().is_empty()
            || !config.chat_model.trim().is_empty()
            || !config.translation_model.trim().is_empty()
            || !config.models.is_empty())
    {
        config.profiles.push(AiProviderProfile {
            id: "default".into(),
            name: "默认配置".into(),
            base_url: config.base_url.clone(),
            api_key: config.api_key.clone(),
            chat_model: config.chat_model.clone(),
            translation_model: config.translation_model.clone(),
            models: config.models.clone(),
        });
    }
    config.profiles = config
        .profiles
        .into_iter()
        .enumerate()
        .map(|(index, profile)| normalize_ai_profile(profile, index))
        .collect();
    if config.profiles.is_empty() {
        return config;
    }
    let active_index = config
        .profiles
        .iter()
        .position(|profile| profile.id == config.active_profile_id)
        .unwrap_or(0);
    let active = config.profiles[active_index].clone();
    config.active_profile_id = active.id.clone();
    config.base_url = active.base_url;
    config.api_key = active.api_key;
    config.chat_model = active.chat_model;
    config.translation_model = active.translation_model;
    config.models = active.models;
    config
}
pub fn ai_provider_status(config: AiProviderConfig) -> AiProviderStatus {
    let models = ai_models(&config);
    AiProviderStatus {
        configured: ai_is_configured(&config),
        active_profile_id: config.active_profile_id.clone(),
        profiles: config.profiles.clone(),
        chat_model: config.chat_model,
        translation_model: config.translation_model,
        models,
    }
}
pub fn write_ai_config(config: AiProviderConfig) -> Result<AiProviderStatus, String> {
    let config = normalize_ai_config(config);
    fs::create_dir_all(app_data_dir()).map_err(|error| error.to_string())?;
    let stored = protect_ai_config(config.clone())?;
    fs::write(
        ai_config_path(),
        serde_json::to_string(&stored).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    Ok(ai_provider_status(config))
}
pub fn ai_models(config: &AiProviderConfig) -> Vec<String> {
    let mut models = config.models.clone();
    if models.is_empty() && !config.translation_model.trim().is_empty() {
        models.push(config.translation_model.clone());
    }
    models
}
pub fn ai_is_configured(config: &AiProviderConfig) -> bool {
    !config.base_url.trim().is_empty()
        && !config.api_key.trim().is_empty()
        && !ai_models(config).is_empty()
}
#[tauri::command]
pub fn get_ai_provider_status() -> AiProviderStatus {
    ai_provider_status(read_ai_config())
}
#[tauri::command]
pub fn save_ai_provider_config(input: AiProviderConfig) -> Result<AiProviderStatus, String> {
    let mut config = normalize_ai_config(input);
    if config.profiles.is_empty() {
        return Err("请至少添加一条 AI 模型配置".into());
    }
    for profile in &config.profiles {
        if profile.base_url.trim().is_empty() || profile.api_key.trim().is_empty() {
            return Err(format!("请填写“{}”的 Base URL 与 API Key", profile.name));
        }
        if profile.models.is_empty() {
            return Err(format!("请至少为“{}”添加一个 AI 模型", profile.name));
        }
    }
    config = normalize_ai_config(config);
    write_ai_config(config)
}
#[tauri::command]
pub fn save_ai_provider_profile(
    input: SaveAiProviderProfileInput,
) -> Result<AiProviderStatus, String> {
    let mut config = read_ai_config();
    let existing_index = config
        .profiles
        .iter()
        .position(|profile| profile.id == input.profile.id);
    let profile = normalize_ai_profile(
        input.profile,
        existing_index.unwrap_or(config.profiles.len()),
    );
    if profile.base_url.trim().is_empty() || profile.api_key.trim().is_empty() {
        return Err("请填写 Base URL 与 API Key".into());
    }
    if profile.models.is_empty() {
        return Err("请至少添加一个 AI 模型".into());
    }
    if let Some(index) = existing_index {
        config.profiles[index] = profile.clone();
    } else if config.profiles.iter().any(|item| item.id == profile.id) {
        return Err("配置标识重复，请新建后重试".into());
    } else {
        config.profiles.push(profile.clone());
    }
    if input.activate || config.active_profile_id.trim().is_empty() {
        config.active_profile_id = profile.id;
    }
    write_ai_config(config)
}
#[tauri::command]
pub fn activate_ai_provider_profile(
    input: AiProviderProfileIdInput,
) -> Result<AiProviderStatus, String> {
    let mut config = read_ai_config();
    if !config
        .profiles
        .iter()
        .any(|profile| profile.id == input.profile_id)
    {
        return Err("未找到要启用的模型配置".into());
    }
    config.active_profile_id = input.profile_id;
    write_ai_config(config)
}
#[tauri::command]
pub fn delete_ai_provider_profile(
    input: AiProviderProfileIdInput,
) -> Result<AiProviderStatus, String> {
    let mut config = read_ai_config();
    let previous_count = config.profiles.len();
    config
        .profiles
        .retain(|profile| profile.id != input.profile_id);
    if config.profiles.len() == previous_count {
        return Err("未找到要删除的模型配置".into());
    }
    if config.active_profile_id == input.profile_id {
        if let Some(profile) = config.profiles.first() {
            config.active_profile_id = profile.id.clone();
        } else {
            config.active_profile_id.clear();
            config.base_url.clear();
            config.api_key.clear();
            config.chat_model.clear();
            config.translation_model.clear();
            config.models.clear();
        }
    }
    write_ai_config(config)
}
#[cfg(all(test, windows))]
mod tests {
    use super::*;

    fn profile(id: &str, api_key: &str) -> AiProviderProfile {
        AiProviderProfile {
            id: id.into(),
            name: format!("配置 {id}"),
            base_url: "https://example.invalid/v1".into(),
            api_key: api_key.into(),
            chat_model: "chat-model".into(),
            translation_model: "translation-model".into(),
            models: vec!["chat-model".into(), "translation-model".into()],
        }
    }

    #[test]
    fn dpapi_round_trip_preserves_plaintext_for_runtime() {
        let config = AiProviderConfig {
            profiles: vec![
                profile("primary", "primary-secret"),
                profile("backup", "backup-secret"),
            ],
            active_profile_id: "primary".into(),
            base_url: "https://example.invalid/v1".into(),
            api_key: "legacy-secret".into(),
            chat_model: "chat-model".into(),
            translation_model: "translation-model".into(),
            models: vec!["chat-model".into(), "translation-model".into()],
        };

        let stored =
            protect_ai_config(config.clone()).expect("DPAPI should protect the configuration");
        assert_ne!(stored.api_key, config.api_key);
        assert!(stored.api_key.starts_with("dpapi:"));
        assert!(stored
            .profiles
            .iter()
            .all(|item| item.api_key.starts_with("dpapi:")));

        let restored = unprotect_ai_config(stored);
        assert_eq!(restored.api_key, config.api_key);
        assert_eq!(restored.profiles[0].api_key, config.profiles[0].api_key);
        assert_eq!(restored.profiles[1].api_key, config.profiles[1].api_key);
    }
}
