use serde::{Deserialize, Serialize};
use windows::{
    core::HSTRING,
    Globalization::Language,
    Graphics::Imaging::BitmapDecoder,
    Media::Ocr::OcrEngine,
    Storage::{FileAccessMode, StorageFile},
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalOcrInput {
    pub path: String,
    #[serde(default = "default_ocr_language")]
    pub language: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalOcrWord {
    pub text: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalOcrLine {
    pub text: String,
    pub words: Vec<LocalOcrWord>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalOcrResult {
    pub text: String,
    pub language: String,
    pub lines: Vec<LocalOcrLine>,
}

fn default_ocr_language() -> String {
    "en-US".to_string()
}

fn normalize_ocr_language(value: &str) -> &str {
    match value.trim().to_ascii_lowercase().as_str() {
        "zh" | "zh-cn" | "zh-hans" | "zh-hans-cn" => "zh-Hans-CN",
        _ => "en-US",
    }
}

fn recognize_local_ocr_blocking(input: LocalOcrInput) -> Result<LocalOcrResult, String> {
    let language_tag = normalize_ocr_language(&input.language).to_string();
    let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(input.path))
        .map_err(|error| format!("无法打开本地图片：{error}"))?
        .get()
        .map_err(|error| format!("无法读取本地图片：{error}"))?;
    let stream = file
        .OpenAsync(FileAccessMode::Read)
        .map_err(|error| format!("无法打开图片流：{error}"))?
        .get()
        .map_err(|error| format!("无法读取图片流：{error}"))?;
    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|error| format!("无法解码图片：{error}"))?
        .get()
        .map_err(|error| format!("无法解码图片：{error}"))?;
    let bitmap = decoder
        .GetSoftwareBitmapAsync()
        .map_err(|error| format!("无法读取图片像素：{error}"))?
        .get()
        .map_err(|error| format!("无法读取图片像素：{error}"))?;
    let language = Language::CreateLanguage(&HSTRING::from(&language_tag))
        .map_err(|error| format!("无法初始化 OCR 语言：{error}"))?;
    let engine = OcrEngine::TryCreateFromLanguage(&language)
        .map_err(|error| format!("无法创建 OCR 引擎：{error}"))?;
    let result = engine
        .RecognizeAsync(&bitmap)
        .map_err(|error| format!("无法启动本地 OCR：{error}"))?
        .get()
        .map_err(|error| format!("本地 OCR 识别失败：{error}"))?;

    let lines_view = result.Lines().map_err(|error| error.to_string())?;
    let mut lines = Vec::new();
    for line_index in 0..lines_view.Size().map_err(|error| error.to_string())? {
        let line = lines_view.GetAt(line_index).map_err(|error| error.to_string())?;
        let words_view = line.Words().map_err(|error| error.to_string())?;
        let mut words = Vec::new();
        for word_index in 0..words_view.Size().map_err(|error| error.to_string())? {
            let word = words_view.GetAt(word_index).map_err(|error| error.to_string())?;
            let rect = word.BoundingRect().map_err(|error| error.to_string())?;
            words.push(LocalOcrWord {
                text: word.Text().map_err(|error| error.to_string())?.to_string(),
                x: rect.X,
                y: rect.Y,
                width: rect.Width,
                height: rect.Height,
            });
        }
        lines.push(LocalOcrLine {
            text: line.Text().map_err(|error| error.to_string())?.to_string(),
            words,
        });
    }
    Ok(LocalOcrResult {
        text: result.Text().map_err(|error| error.to_string())?.to_string(),
        language: language_tag,
        lines,
    })
}

#[tauri::command]
pub async fn recognize_local_ocr(input: LocalOcrInput) -> Result<LocalOcrResult, String> {
    tauri::async_runtime::spawn_blocking(move || recognize_local_ocr_blocking(input))
        .await
        .map_err(|error| format!("本地 OCR 任务异常：{error}"))?
}
