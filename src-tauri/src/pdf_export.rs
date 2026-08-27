use owned_ttf_parser::{AsFaceRef, OwnedFace};
use printpdf::{
    path::PaintMode, Color, IndirectFontRef, Mm, PdfDocument, PdfLayerReference, Rect, Rgb,
};
use serde::Deserialize;
use std::fs;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportInput {
    pub path: String,
    pub title: String,
    pub paragraphs: Vec<PdfExportParagraph>,
    pub questions: Vec<PdfExportQuestion>,
    #[serde(default)]
    pub marked_words: Vec<PdfExportWord>,
    #[serde(default)]
    pub vocabulary_list: Vec<PdfVocabularyWord>,
    #[serde(default)]
    pub vocabulary_only: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportParagraph {
    pub source_text: String,
    pub translation: String,
    #[serde(default)]
    pub highlights: Vec<PdfExportHighlight>,
}
#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportHighlight {
    pub start: usize,
    pub end: usize,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportQuestion {
    pub prompt: String,
    pub answer: String,
    pub explanation: String,
    pub options: Vec<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportWord {
    pub word: String,
    pub phonetic: String,
    pub definition: String,
    #[serde(default)]
    pub references: Vec<PdfExportWordReference>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportWordReference {
    pub context_sentence: String,
    pub sentence_translation: String,
    pub contextual_meaning: String,
    pub usage_note: String,
    pub learning_note: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfVocabularyWord {
    pub word: String,
    pub phonetic: String,
    pub definition: String,
}
pub struct PdfFont {
    pub reference: IndirectFontRef,
    pub face: OwnedFace,
}
pub struct PdfFonts {
    pub english: PdfFont,
    pub chinese: PdfFont,
}
pub struct PdfTextSegment {
    pub text: String,
    pub highlighted: bool,
    pub whitespace: bool,
}

fn load_pdf_font(
    document: &printpdf::PdfDocumentReference,
    paths: &[&str],
    label: &str,
) -> Result<PdfFont, String> {
    for path in paths {
        let Ok(bytes) = fs::read(path) else {
            continue;
        };
        let Ok(face) = OwnedFace::from_vec(bytes, 0) else {
            continue;
        };
        let Ok(file) = fs::File::open(path) else {
            continue;
        };
        let reference = document
            .add_external_font(file)
            .map_err(|error| error.to_string())?;
        return Ok(PdfFont { reference, face });
    }
    Err(format!("未找到可用的{label}字体"))
}
fn load_pdf_fonts(document: &printpdf::PdfDocumentReference) -> Result<PdfFonts, String> {
    Ok(PdfFonts {
        english: load_pdf_font(
            document,
            &[
                "C:\\Windows\\Fonts\\georgia.ttf",
                "C:\\Windows\\Fonts\\times.ttf",
                "C:\\Windows\\Fonts\\cambria.ttc",
            ],
            "英文字体（Georgia、Times New Roman 或 Cambria）",
        )?,
        chinese: load_pdf_font(
            document,
            &[
                "C:\\Windows\\Fonts\\msyh.ttc",
                "C:\\Windows\\Fonts\\simsun.ttc",
                "C:\\Windows\\Fonts\\simhei.ttf",
            ],
            "中文字体（微软雅黑、宋体或黑体）",
        )?,
    })
}
fn pdf_text_width(font: &PdfFont, text: &str, font_size: f32) -> f32 {
    let face = font.face.as_face_ref();
    let units_per_em = f32::from(face.units_per_em());
    text.chars()
        .map(|character| {
            face.glyph_index(character)
                .and_then(|glyph| face.glyph_hor_advance(glyph))
                .map(f32::from)
                .unwrap_or(units_per_em * 0.5)
        })
        .sum::<f32>()
        * font_size
        * 0.3528
        / units_per_em
}
fn pdf_font_for_text<'a>(fonts: &'a PdfFonts, text: &str) -> &'a PdfFont {
    if text
        .chars()
        .filter(|character| !character.is_whitespace())
        .all(|character| character.is_ascii())
    {
        &fonts.english
    } else {
        &fonts.chinese
    }
}
fn normalize_pdf_line(line: &mut Vec<(char, bool)>) {
    while line
        .first()
        .is_some_and(|(character, _)| character.is_whitespace())
    {
        line.remove(0);
    }
    while line
        .last()
        .is_some_and(|(character, _)| character.is_whitespace())
    {
        line.pop();
    }
}
fn layout_pdf_text(
    text: &str,
    highlights: &[PdfExportHighlight],
    font: &PdfFont,
    font_size: f32,
    max_width: f32,
    keep_words: bool,
) -> Vec<Vec<PdfTextSegment>> {
    let characters: Vec<char> = text.chars().collect();
    let mut marked = vec![false; characters.len()];
    for range in highlights {
        for index in range.start.min(characters.len())..range.end.min(characters.len()) {
            marked[index] = true;
        }
    }
    let mut tokens: Vec<Vec<(char, bool)>> = Vec::new();
    if keep_words {
        let mut word = Vec::new();
        for (index, character) in characters.into_iter().enumerate() {
            if character.is_whitespace() {
                if !word.is_empty() {
                    tokens.push(std::mem::take(&mut word));
                }
                tokens.push(vec![(character, marked[index])]);
            } else {
                word.push((character, marked[index]));
            }
        }
        if !word.is_empty() {
            tokens.push(word);
        }
    } else {
        tokens = characters
            .into_iter()
            .enumerate()
            .map(|(index, character)| vec![(character, marked[index])])
            .collect();
    }
    let mut lines: Vec<Vec<(char, bool)>> = Vec::new();
    let mut line = Vec::new();
    let mut line_width = 0.0;
    for token in tokens {
        let token_text: String = token.iter().map(|(character, _)| *character).collect();
        let token_width = pdf_text_width(font, &token_text, font_size);
        if !line.is_empty() && line_width + token_width > max_width {
            normalize_pdf_line(&mut line);
            if !line.is_empty() {
                lines.push(std::mem::take(&mut line));
            }
            line_width = 0.0;
        }
        if line.is_empty() && token.iter().all(|(character, _)| character.is_whitespace()) {
            continue;
        }
        line_width += token_width;
        line.extend(token);
    }
    normalize_pdf_line(&mut line);
    if !line.is_empty() {
        lines.push(line);
    }
    if lines.is_empty() {
        lines.push(Vec::new());
    }
    lines
        .into_iter()
        .map(|line| {
            let mut segments: Vec<PdfTextSegment> = Vec::new();
            for (character, highlighted) in line {
                if character.is_whitespace() {
                    segments.push(PdfTextSegment {
                        text: character.to_string(),
                        highlighted: false,
                        whitespace: true,
                    });
                } else if let Some(previous) = segments
                    .last_mut()
                    .filter(|previous| !previous.whitespace && previous.highlighted == highlighted)
                {
                    previous.text.push(character);
                } else {
                    segments.push(PdfTextSegment {
                        text: character.to_string(),
                        highlighted,
                        whitespace: false,
                    });
                }
            }
            segments
        })
        .collect()
}
fn draw_pdf_line(
    layer: &PdfLayerReference,
    font: &PdfFont,
    y: f32,
    x: f32,
    max_width: f32,
    font_size: f32,
    segments: &[PdfTextSegment],
    justify: bool,
    color: (f32, f32, f32),
) {
    let line_width = segments
        .iter()
        .map(|segment| pdf_text_width(font, &segment.text, font_size))
        .sum::<f32>();
    let space_count = segments
        .iter()
        .filter(|segment| segment.whitespace)
        .map(|segment| segment.text.chars().count())
        .sum::<usize>();
    let extra_space = if justify && space_count > 0 {
        ((max_width - line_width).max(0.0)) / space_count as f32
    } else {
        0.0
    };
    let mut cursor_x = x;
    for segment in segments {
        let width = pdf_text_width(font, &segment.text, font_size);
        if segment.whitespace {
            cursor_x += width + extra_space * segment.text.chars().count() as f32;
            continue;
        }
        if segment.highlighted {
            layer.set_fill_color(Color::Rgb(Rgb::new(1.0, 0.93, 0.32, None)));
            layer.add_rect(
                Rect::new(
                    Mm(cursor_x - 0.35),
                    Mm(y - 1.15),
                    Mm(cursor_x + width + 0.35),
                    Mm(y + font_size * 0.27),
                )
                .with_mode(PaintMode::Fill),
            );
        }
        layer.set_fill_color(Color::Rgb(Rgb::new(color.0, color.1, color.2, None)));
        layer.use_text(
            &segment.text,
            font_size,
            Mm(cursor_x),
            Mm(y),
            &font.reference,
        );
        cursor_x += width;
    }
}
fn draw_pdf_header(layer: &PdfLayerReference, font: &PdfFont, title: &str, page_number: usize) {
    layer.set_fill_color(Color::Rgb(Rgb::new(0.39, 0.41, 0.48, None)));
    layer.use_text(
        title.chars().take(46).collect::<String>(),
        8.5,
        Mm(20.0),
        Mm(286.0),
        &font.reference,
    );
    layer.use_text(
        format!("第 {page_number} 页"),
        8.5,
        Mm(177.0),
        Mm(286.0),
        &font.reference,
    );
}
fn draw_pdf_footer(layer: &PdfLayerReference, font: &PdfFont, page_number: usize) {
    layer.set_fill_color(Color::Rgb(Rgb::new(0.55, 0.58, 0.64, None)));
    layer.use_text(
        format!("英语阅读助手 · {page_number}"),
        8.0,
        Mm(86.0),
        Mm(10.0),
        &font.reference,
    );
}
#[tauri::command]
pub fn export_pdf(input: PdfExportInput) -> Result<(), String> {
    if input.path.trim().is_empty() {
        return Err("请选择 PDF 保存位置".into());
    }
    let (document, first_page, first_layer) =
        PdfDocument::new(&input.title, Mm(210.0), Mm(297.0), "阅读稿");
    let fonts = load_pdf_fonts(&document)?;
    let mut layer = document.get_page(first_page).get_layer(first_layer);
    let mut y = 270.0_f32;
    let mut page_number = 1_usize;
    draw_pdf_footer(&layer, &fonts.chinese, page_number);
    let title_font = pdf_font_for_text(&fonts, &input.title);
    let title_width = pdf_text_width(title_font, &input.title, 21.0);
    layer.set_fill_color(Color::Rgb(Rgb::new(0.1, 0.13, 0.2, None)));
    layer.use_text(
        &input.title,
        21.0,
        Mm(((210.0 - title_width) / 2.0).max(20.0)),
        Mm(y),
        &title_font.reference,
    );
    y -= 15.0;
    macro_rules! ensure_space {
        ($height:expr) => {{
            if y < 22.0 + $height {
                let (page, layer_id) = document.add_page(Mm(210.0), Mm(297.0), "阅读稿");
                layer = document.get_page(page).get_layer(layer_id);
                page_number += 1;
                draw_pdf_header(&layer, &fonts.chinese, &input.title, page_number);
                draw_pdf_footer(&layer, &fonts.chinese, page_number);
                y = 272.0;
            }
        }};
    }
    macro_rules! paragraph {
        ($text:expr, $highlights:expr, $font:expr, $size:expr, $height:expr, $x:expr, $width:expr, $justify:expr, $words:expr, $color:expr) => {{
            let lines = layout_pdf_text($text, $highlights, $font, $size, $width, $words);
            for (line_index, line) in lines.iter().enumerate() {
                ensure_space!($height);
                draw_pdf_line(
                    &layer,
                    $font,
                    y,
                    $x,
                    $width,
                    $size,
                    line,
                    $justify && line_index + 1 < lines.len(),
                    $color,
                );
                y -= $height;
            }
        }};
    }
    macro_rules! section_heading {
        ($text:expr) => {{
            ensure_space!(13.0);
            y -= 2.0;
            layer.set_fill_color(Color::Rgb(Rgb::new(0.25, 0.28, 0.55, None)));
            layer.use_text($text, 15.5, Mm(20.0), Mm(y), &fonts.chinese.reference);
            y -= 10.0;
        }};
    }
    for (index, paragraph) in input.paragraphs.iter().enumerate() {
        let numbered_source = format!("{}. {}", index + 1, paragraph.source_text.trim());
        let mut source_highlights = paragraph.highlights.clone();
        for highlight in &mut source_highlights {
            highlight.start += format!("{}. ", index + 1).chars().count();
            highlight.end += format!("{}. ", index + 1).chars().count();
        }
        paragraph!(
            &numbered_source,
            &source_highlights,
            &fonts.english,
            11.6,
            7.0,
            20.0,
            170.0,
            true,
            true,
            (0.12, 0.15, 0.2)
        );
        if !paragraph.translation.trim().is_empty() {
            paragraph!(
                paragraph.translation.trim(),
                &[],
                &fonts.chinese,
                10.6,
                6.4,
                26.0,
                158.0,
                true,
                false,
                (0.32, 0.36, 0.43)
            );
        }
        y -= 4.0;
    }
    if !input.marked_words.is_empty() {
        section_heading!("本文章标记生词");
        for word in &input.marked_words {
            paragraph!(
                &format!(
                    "{}{}",
                    word.word,
                    if word.phonetic.trim().is_empty() {
                        String::new()
                    } else {
                        format!(" /{}/", word.phonetic.trim())
                    }
                ),
                &[],
                &fonts.english,
                12.0,
                6.8,
                20.0,
                170.0,
                false,
                true,
                (0.14, 0.16, 0.24)
            );
            paragraph!(
                &format!("释义：{}", word.definition.trim()),
                &[],
                &fonts.chinese,
                10.4,
                6.1,
                24.0,
                162.0,
                true,
                false,
                (0.25, 0.29, 0.38)
            );
            for reference in word.references.iter().take(3) {
                paragraph!(
                    &format!("原句：{}", reference.context_sentence.trim()),
                    &[],
                    &fonts.chinese,
                    9.8,
                    5.8,
                    28.0,
                    154.0,
                    true,
                    false,
                    (0.3, 0.34, 0.42)
                );
                if !reference.sentence_translation.trim().is_empty() {
                    paragraph!(
                        &format!("整句翻译：{}", reference.sentence_translation.trim()),
                        &[],
                        &fonts.chinese,
                        9.6,
                        5.7,
                        28.0,
                        154.0,
                        true,
                        false,
                        (0.3, 0.34, 0.42)
                    );
                }
                if !reference.contextual_meaning.trim().is_empty() {
                    paragraph!(
                        &format!("句中释义：{}", reference.contextual_meaning.trim()),
                        &[],
                        &fonts.chinese,
                        9.6,
                        5.7,
                        28.0,
                        154.0,
                        true,
                        false,
                        (0.3, 0.34, 0.42)
                    );
                }
                if !reference.usage_note.trim().is_empty() {
                    paragraph!(
                        &format!("用法提示：{}", reference.usage_note.trim()),
                        &[],
                        &fonts.chinese,
                        9.6,
                        5.7,
                        28.0,
                        154.0,
                        true,
                        false,
                        (0.3, 0.34, 0.42)
                    );
                }
                if !reference.learning_note.trim().is_empty() {
                    paragraph!(
                        &format!("学习笔记：{}", reference.learning_note.trim()),
                        &[],
                        &fonts.chinese,
                        9.6,
                        5.7,
                        28.0,
                        154.0,
                        true,
                        false,
                        (0.3, 0.34, 0.42)
                    );
                }
            }
            y -= 3.0;
        }
    }
    if !input.questions.is_empty() {
        section_heading!("阅读练习");
        for (index, question) in input.questions.iter().enumerate() {
            let question_text = format!("{}. {}", index + 1, question.prompt.trim());
            let question_font = pdf_font_for_text(&fonts, &question_text);
            paragraph!(
                &question_text,
                &[],
                question_font,
                11.0,
                6.6,
                20.0,
                170.0,
                true,
                true,
                (0.12, 0.15, 0.2)
            );
            for option in &question.options {
                let option_font = pdf_font_for_text(&fonts, option);
                paragraph!(
                    option.trim(),
                    &[],
                    option_font,
                    10.2,
                    6.0,
                    28.0,
                    162.0,
                    true,
                    true,
                    (0.2, 0.24, 0.32)
                );
            }
            if !question.answer.trim().is_empty() {
                paragraph!(
                    &format!("答案：{}", question.answer.trim()),
                    &[],
                    &fonts.chinese,
                    10.0,
                    6.0,
                    24.0,
                    166.0,
                    false,
                    false,
                    (0.2, 0.24, 0.32)
                );
            }
            if !question.explanation.trim().is_empty() {
                paragraph!(
                    &format!("解析：{}", question.explanation.trim()),
                    &[],
                    &fonts.chinese,
                    9.8,
                    5.8,
                    24.0,
                    166.0,
                    true,
                    false,
                    (0.3, 0.34, 0.42)
                );
            }
            y -= 4.0;
        }
    }
    if !input.vocabulary_list.is_empty() {
        if !input.vocabulary_only {
            let (page, layer_id) = document.add_page(Mm(210.0), Mm(297.0), "单词表");
            layer = document.get_page(page).get_layer(layer_id);
            page_number += 1;
            draw_pdf_header(&layer, &fonts.chinese, &input.title, page_number);
            draw_pdf_footer(&layer, &fonts.chinese, page_number);
            y = 270.0;
        }
        let vocabulary_heading = if input.vocabulary_only {
            "单词表"
        } else {
            "本文单词表"
        };
        let heading_width = pdf_text_width(&fonts.chinese, vocabulary_heading, 15.5);
        layer.set_fill_color(Color::Rgb(Rgb::new(0.25, 0.28, 0.55, None)));
        layer.use_text(
            vocabulary_heading,
            15.5,
            Mm((105.0 - heading_width / 2.0).max(20.0)),
            Mm(y),
            &fonts.chinese.reference,
        );
        y -= 8.0;
        layer.set_fill_color(Color::Rgb(Rgb::new(0.42, 0.45, 0.52, None)));
        layer.use_text(
            format!("共 {} 个词条", input.vocabulary_list.len()),
            8.8,
            Mm(20.0),
            Mm(y),
            &fonts.chinese.reference,
        );
        y -= 8.0;
        let columns = [
            (16.0_f32, 12.0_f32),
            (28.0_f32, 38.0_f32),
            (66.0_f32, 41.0_f32),
            (107.0_f32, 87.0_f32),
        ];
        let draw_table_header = |layer: &PdfLayerReference, y: f32| {
            layer.set_fill_color(Color::Rgb(Rgb::new(0.94, 0.95, 0.99, None)));
            layer.add_rect(
                Rect::new(Mm(16.0), Mm(y - 1.6), Mm(194.0), Mm(y + 5.4)).with_mode(PaintMode::Fill),
            );
            for (text, x) in [
                ("序号", 18.0_f32),
                ("单词", 30.0_f32),
                ("音标", 68.0_f32),
                ("基础释义", 109.0_f32),
            ] {
                layer.set_fill_color(Color::Rgb(Rgb::new(0.28, 0.31, 0.48, None)));
                layer.use_text(text, 8.8, Mm(x), Mm(y), &fonts.chinese.reference);
            }
        };
        draw_table_header(&layer, y);
        y -= 7.3;
        for (index, word) in input.vocabulary_list.iter().enumerate() {
            let word_lines = layout_pdf_text(
                word.word.trim(),
                &[],
                &fonts.english,
                9.5,
                columns[1].1 - 2.0,
                true,
            );
            let phonetic_text = if word.phonetic.trim().is_empty() {
                "—".to_string()
            } else {
                format!("/{}/", word.phonetic.trim())
            };
            let phonetic_lines = layout_pdf_text(
                &phonetic_text,
                &[],
                &fonts.english,
                8.7,
                columns[2].1 - 2.0,
                true,
            );
            let definition_lines = layout_pdf_text(
                if word.definition.trim().is_empty() {
                    "暂无释义"
                } else {
                    word.definition.trim()
                },
                &[],
                &fonts.chinese,
                8.9,
                columns[3].1 - 2.0,
                false,
            );
            let line_count = word_lines
                .len()
                .max(phonetic_lines.len())
                .max(definition_lines.len());
            let row_height = (line_count as f32 * 5.4).max(7.0);
            if y < 22.0 + row_height {
                let (page, layer_id) = document.add_page(Mm(210.0), Mm(297.0), "单词表");
                layer = document.get_page(page).get_layer(layer_id);
                page_number += 1;
                draw_pdf_header(&layer, &fonts.chinese, &input.title, page_number);
                draw_pdf_footer(&layer, &fonts.chinese, page_number);
                y = 270.0;
                draw_table_header(&layer, y);
                y -= 7.3;
            }
            layer.set_outline_color(Color::Rgb(Rgb::new(0.84, 0.86, 0.9, None)));
            layer.set_outline_thickness(0.16);
            for x in [16.0_f32, 28.0, 66.0, 107.0, 194.0] {
                layer.add_line(printpdf::Line {
                    points: vec![
                        (printpdf::Point::new(Mm(x), Mm(y + 1.7)), false),
                        (printpdf::Point::new(Mm(x), Mm(y - row_height + 1.7)), false),
                    ],
                    is_closed: false,
                });
            }
            layer.add_line(printpdf::Line {
                points: vec![
                    (
                        printpdf::Point::new(Mm(16.0), Mm(y - row_height + 1.7)),
                        false,
                    ),
                    (
                        printpdf::Point::new(Mm(194.0), Mm(y - row_height + 1.7)),
                        false,
                    ),
                ],
                is_closed: false,
            });
            layer.use_text(
                format!("{}", index + 1),
                8.5,
                Mm(18.0),
                Mm(y),
                &fonts.english.reference,
            );
            for (line_index, line) in word_lines.iter().enumerate() {
                draw_pdf_line(
                    &layer,
                    &fonts.english,
                    y - line_index as f32 * 5.4,
                    columns[1].0 + 1.0,
                    columns[1].1 - 2.0,
                    9.5,
                    line,
                    false,
                    (0.12, 0.15, 0.2),
                );
            }
            for (line_index, line) in phonetic_lines.iter().enumerate() {
                draw_pdf_line(
                    &layer,
                    &fonts.english,
                    y - line_index as f32 * 5.4,
                    columns[2].0 + 1.0,
                    columns[2].1 - 2.0,
                    8.7,
                    line,
                    false,
                    (0.34, 0.38, 0.46),
                );
            }
            for (line_index, line) in definition_lines.iter().enumerate() {
                draw_pdf_line(
                    &layer,
                    &fonts.chinese,
                    y - line_index as f32 * 5.4,
                    columns[3].0 + 1.0,
                    columns[3].1 - 2.0,
                    8.9,
                    line,
                    false,
                    (0.26, 0.3, 0.38),
                );
            }
            y -= row_height;
        }
    }
    let file = fs::File::create(&input.path).map_err(|error| format!("无法创建 PDF：{error}"))?;
    document
        .save(&mut std::io::BufWriter::new(file))
        .map_err(|error| format!("无法保存 PDF：{error}"))?;
    Ok(())
}

#[tauri::command]
pub async fn export_pdf_in_background(input: PdfExportInput) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || export_pdf(input))
        .await
        .map_err(|error| format!("PDF 导出任务异常：{error}"))?
}
