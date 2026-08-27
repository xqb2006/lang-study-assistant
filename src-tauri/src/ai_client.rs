use reqwest::blocking::Client;
use serde_json::Value;
use std::{thread, time::Duration};

pub fn post_ai_chat(
    client: &Client,
    endpoint: &str,
    api_key: &str,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    const MAX_ATTEMPTS: u32 = 3;
    for attempt in 0..MAX_ATTEMPTS {
        let response = match client
            .post(endpoint)
            .bearer_auth(api_key)
            .json(&payload)
            .send()
        {
            Ok(response) => response,
            Err(error) => {
                let retryable = error.is_timeout() || error.is_connect();
                if retryable && attempt + 1 < MAX_ATTEMPTS {
                    thread::sleep(Duration::from_millis(500 * (1 << attempt)));
                    continue;
                }
                return Err(format!("请求失败：{error}"));
            }
        };
        let status = response.status();
        let body = response
            .text()
            .map_err(|error| format!("读取响应失败：{error}"))?;
        if status.is_success() {
            return serde_json::from_str(&body)
                .map_err(|error| format!("AI 响应不是有效 JSON：{error}"));
        }
        let detail = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|value| {
                value["error"]["message"]
                    .as_str()
                    .map(str::to_string)
                    .or_else(|| value["message"].as_str().map(str::to_string))
            })
            .unwrap_or_else(|| body.chars().take(240).collect());
        let retryable = matches!(status.as_u16(), 429 | 502 | 503 | 504);
        if retryable && attempt + 1 < MAX_ATTEMPTS {
            thread::sleep(Duration::from_millis(500 * (1 << attempt)));
            continue;
        }
        if status.as_u16() == 503 {
            return Err(format!(
                "AI 服务暂时不可用，已自动重试 {MAX_ATTEMPTS} 次，请稍后再试：{detail}"
            ));
        }
        return Err(format!("服务返回 {status}：{detail}"));
    }
    Err("AI 请求未完成，请稍后重试".into())
}
pub fn parse_ai_json_object(content: &str, error_message: &str) -> Result<Value, String> {
    let trimmed = content
        .trim()
        .trim_matches(char::from(96u8))
        .trim_start_matches("json")
        .trim();
    let candidate = match (trimmed.find('{'), trimmed.rfind('}')) {
        (Some(start), Some(end)) if start <= end => &trimmed[start..=end],
        _ => trimmed,
    };
    serde_json::from_str(candidate).map_err(|_| error_message.to_string())
}

pub fn parse_ai_json_array(content: &str, error_message: &str) -> Result<Value, String> {
    let trimmed = content
        .trim()
        .trim_matches(char::from(96u8))
        .trim_start_matches("json")
        .trim();
    let candidate = match (trimmed.find('['), trimmed.rfind(']')) {
        (Some(start), Some(end)) if start <= end => &trimmed[start..=end],
        _ => trimmed,
    };
    serde_json::from_str(candidate).map_err(|_| error_message.to_string())
}
