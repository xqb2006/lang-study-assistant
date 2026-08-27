fn utf16_offset_to_char_index(chars: &[char], offset: i64) -> usize {
    let mut consumed = 0_i64;
    for (index, character) in chars.iter().enumerate() {
        if consumed >= offset {
            return index;
        }
        consumed += character.len_utf16() as i64;
        if consumed >= offset {
            return index + 1;
        }
    }
    chars.len()
}

fn is_initialism(token: &str) -> bool {
    let parts: Vec<&str> = token.split('.').filter(|part| !part.is_empty()).collect();
    parts.len() >= 2
        && parts.iter().all(|part| {
            part.chars().count() == 1
                && part
                    .chars()
                    .all(|character| character.is_ascii_alphabetic())
        })
}

fn is_sentence_boundary(chars: &[char], index: usize) -> bool {
    let character = chars[index];
    if matches!(character, '!' | '?' | '！' | '？' | '。') {
        return true;
    }
    if character != '.' {
        return false;
    }
    let previous = index.checked_sub(1).and_then(|value| chars.get(value));
    let next = chars.get(index + 1);
    if previous.is_some_and(|value| value.is_ascii_digit())
        && next.is_some_and(|value| value.is_ascii_digit())
    {
        return false;
    }
    let mut token_start = index;
    while token_start > 0 && !chars[token_start - 1].is_whitespace() {
        token_start -= 1;
    }
    let token: String = chars[token_start..=index]
        .iter()
        .collect::<String>()
        .to_lowercase();
    let abbreviations = [
        "mr.", "mrs.", "ms.", "dr.", "prof.", "sr.", "jr.", "e.g.", "i.e.", "etc.", "vs.", "no.",
        "fig.",
    ];
    if abbreviations.contains(&token.as_str()) || is_initialism(&token) {
        return false;
    }
    next.is_none_or(|value| {
        value.is_whitespace() || matches!(value, '"' | '\'' | '”' | '’' | ')' | '}' | ']')
    })
}

pub fn extract_sentence_context(content: &str, start_index: i64, end_index: i64) -> String {
    let chars: Vec<char> = content.chars().collect();
    if chars.is_empty() {
        return String::new();
    }
    let start = utf16_offset_to_char_index(&chars, start_index.max(0));
    let end = utf16_offset_to_char_index(&chars, end_index.max(start_index));
    let mut sentence_start = 0;
    for index in (0..start).rev() {
        if chars[index] == '\n' && index > 0 && chars[index - 1] == '\n' {
            sentence_start = index + 1;
            break;
        }
        if is_sentence_boundary(&chars, index) {
            sentence_start = index + 1;
            break;
        }
    }
    while sentence_start < chars.len()
        && (chars[sentence_start].is_whitespace()
            || matches!(
                chars[sentence_start],
                '"' | '\'' | '“' | '‘' | '(' | '[' | '{'
            ))
    {
        sentence_start += 1;
    }
    let mut sentence_end = chars.len();
    for index in end..chars.len() {
        if chars[index] == '\n' && index + 1 < chars.len() && chars[index + 1] == '\n' {
            sentence_end = index;
            break;
        }
        if is_sentence_boundary(&chars, index) {
            sentence_end = index + 1;
            while sentence_end < chars.len()
                && matches!(
                    chars[sentence_end],
                    '"' | '\'' | '”' | '’' | ')' | '}' | ']'
                )
            {
                sentence_end += 1;
            }
            break;
        }
    }
    chars[sentence_start..sentence_end]
        .iter()
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
