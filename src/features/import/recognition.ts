import type {
  ChapterPhotoDraft,
  QuestionDraft,
  ReadingImageParagraph,
  ReadingPhoto,
  VisualChapterStart,
  VisualTocEntry,
  UnifiedImportResult,
} from "./types";
import { appInvoke } from "../../services/appInvoke";
import { detectContentLanguage } from "../languages";

export type RecognitionBatch = { photo: ReadingPhoto; pageNumber: number }[];
export type LocalOcrLine = {
  text: string;
  words?: { y: number; height: number }[];
};

function normalizeOcrLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function findLocalOcrArticleTitle(lines: LocalOcrLine[]) {
  const candidates = lines
    .map((line) => normalizeOcrLine(line.text))
    .filter(Boolean)
    .slice(0, 4);
  for (const text of candidates) {
    if (text.length > 100 || /[.。!?！？;；:]$/.test(text)) continue;
    if (/^(?:chapter|unit|lesson|part|article|passage|reading)\s*(?:\d+|[a-z])?\b/i.test(text)) return text;
    const words = text.split(/\s+/);
    const titleCaseWords = words.filter((word) => /^[A-Z][A-Za-z'-]*$/.test(word)).length;
    const letters = text.match(/[A-Za-z]/g)?.length ?? 0;
    const uppercaseLetters = text.match(/[A-Z]/g)?.length ?? 0;
    if (
      words.length >= 2
      && words.length <= 14
      && letters >= 4
      && (titleCaseWords >= Math.max(2, words.length - 1) || uppercaseLetters / letters >= 0.7)
    ) return text;
  }
  return "";
}

function findLocalOcrTocEntries(lines: LocalOcrLine[]) {
  const isTocPage = lines.some((line) => /^(?:contents|table of contents|目录)$/i.test(normalizeOcrLine(line.text)));
  return lines.flatMap((line) => {
    const rawText = line.text.replace(/\u00a0/g, " ").trim();
    const match = rawText.match(isTocPage
      ? /^(.+?)(?:\s*\.{2,}\s*|…\s*|\s+)(\d{1,4})$/
      : /^(.+?)(?:\s*\.{2,}\s*|…\s*|\s{2,})(\d{1,4})$/);
    if (!match) return [];
    const title = match[1].replace(/^\s*(?:\d+[.、]?\s*)?/, "").trim();
    const printedPageNumber = Number(match[2]);
    return title && printedPageNumber > 0 ? [{ title, printedPageNumber }] : [];
  });
}

export function createLocalOcrPageResult(pageNumber: number, lines: LocalOcrLine[]): UnifiedImportResult {
  const sourceText = lines.map((line) => line.text.trim()).filter(Boolean).join("\n");
  const title = findLocalOcrArticleTitle(lines);
  return {
    documentType: "reading",
    title: "",
    paragraphs: sourceText ? [{
      sourceText,
      translation: "",
      translationSource: "missing",
      needsReview: false,
      pageStart: pageNumber,
      pageEnd: pageNumber,
      continuesFromPrevious: false,
      continuesToNext: false,
    }] : [],
    questions: [],
    tocEntries: findLocalOcrTocEntries(lines),
    chapterStarts: title ? [{ title, pageNumber, confidence: 0.72 }] : [],
  };
}

export function createRecognitionBatches(photos: ReadingPhoto[]): RecognitionBatch[] {
  const numberedPages = photos.map((photo, index) => ({ photo, pageNumber: photo.sourcePageNumber ?? index + 1 }));
  const batches: RecognitionBatch[] = [];
  const batchSize = 8;
  const overlap = 1;
  for (let start = 0; start < numberedPages.length; start += batchSize - overlap) {
    const batch = numberedPages.slice(start, start + batchSize);
    if (!batch.length) break;
    batches.push(batch);
    if (start + batchSize >= numberedPages.length) break;
  }
  return batches;
}

export function collectRecognitionResults(
  batches: RecognitionBatch[],
  recognizedResults: UnifiedImportResult[] = [],
) {
  const completedResults = batches
    .map((batch) => batch.map(({ photo }) => photo.result).find(Boolean))
    .filter((result): result is UnifiedImportResult => Boolean(result));
  return Array.from(new Set([...completedResults, ...recognizedResults]));
}

export function collectHandwritingReviewPages(results: UnifiedImportResult[]) {
  return Array.from(new Set(
    results.flatMap((result) => result.handwritingPages ?? [])
      .filter((pageNumber) => Number.isInteger(pageNumber) && pageNumber > 0),
  )).sort((left, right) => left - right);
}

export function mergeVisualTocEntries(entries: VisualTocEntry[]) {
  return entries.filter((entry, index, items) => {
    const normalizedTitle = entry.title.replace(/\s+/g, " ").trim().toLowerCase();
    return normalizedTitle && entry.printedPageNumber > 0
      && items.findIndex((item) => item.title.replace(/\s+/g, " ").trim().toLowerCase() === normalizedTitle) === index;
  });
}

function mergeVisualChapterStarts(starts: VisualChapterStart[]) {
  return starts
    .filter((start) => start.title.trim() && start.pageNumber > 0 && start.confidence >= 0.6)
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .filter((start, index, items) => index === 0 || (
      items[index - 1].pageNumber !== start.pageNumber
      && items[index - 1].title.replace(/\s+/g, " ").trim().toLowerCase() !== start.title.replace(/\s+/g, " ").trim().toLowerCase()
    ));
}

export function mergeRecognitionResults(results: UnifiedImportResult[]) {
  const paragraphs: ReadingImageParagraph[] = [];
  for (const paragraph of results.flatMap((result) => result.paragraphs)) {
    const normalized = paragraph.sourceText.replace(/\s+/g, " ").trim().toLowerCase();
    const previous = paragraphs[paragraphs.length - 1];
    if (
      !normalized ||
      paragraphs.some(
        (item) => item.sourceText.replace(/\s+/g, " ").trim().toLowerCase() === normalized,
      )
    ) {
      continue;
    }
    if (previous && (previous.continuesToNext || paragraph.continuesFromPrevious)) {
      previous.sourceText = `${previous.sourceText} ${paragraph.sourceText}`
        .replace(/\s+/g, " ")
        .trim();
      if (paragraph.translation) {
        previous.translation = [previous.translation, paragraph.translation]
          .filter(Boolean)
          .join("\n");
      }
      previous.pageEnd = paragraph.pageEnd ?? paragraph.pageStart ?? previous.pageEnd;
      previous.continuesToNext = paragraph.continuesToNext;
    } else {
      paragraphs.push(paragraph);
    }
  }
  const questions = results
    .flatMap((result) => result.questions)
    .filter(
      (question, index, all) =>
        all.findIndex((item) => item.prompt.trim() === question.prompt.trim()) === index,
    );
  return { paragraphs, questions };
}

export function createChapterPhotoDraft(
  results: UnifiedImportResult[],
  fallbackTitle: string,
): ChapterPhotoDraft {
  const { paragraphs, questions } = mergeRecognitionResults(results);
  const chapterStarts = mergeVisualChapterStarts(results.flatMap((result) => result.chapterStarts ?? []));
  const sourceText = paragraphs.map((paragraph) => paragraph.sourceText).join("\n\n");
  const detection = detectContentLanguage(sourceText);
  const chapterDrafts = chapterStarts.map((start, index) => {
    const nextPageNumber = chapterStarts[index + 1]?.pageNumber ?? Number.POSITIVE_INFINITY;
    const chapterParagraphs = paragraphs.filter((paragraph) => {
      const pageStart = paragraph.pageStart ?? 1;
      return pageStart >= start.pageNumber && pageStart < nextPageNumber;
    });
    return {
      title: start.title.trim(),
      sourceText: chapterParagraphs.map((paragraph) => paragraph.sourceText).join("\n\n"),
      translationText: chapterParagraphs.map((paragraph) => paragraph.translation).filter(Boolean).join("\n\n"),
    };
  }).filter((chapter) => chapter.sourceText);
  return {
    title: results.find((result) => result.title.trim())?.title.trim() || fallbackTitle,
    sourceText,
    translationText: paragraphs.map((paragraph) => paragraph.translation).join("\n\n"),
    questions,
    detectedLanguage: detection.language,
    languageDetectionReason: detection.reason,
    chapterDrafts,
  };
}

export function parseQuestionText(rawText: string): QuestionDraft[] {
  const blocks = rawText
    .replace(/\r/g, "")
    .split(/(?=^\s*\d+\s*[.、．])/m)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const options = lines.filter((line) => /^[A-D][.、．]\s*/i.test(line));
      const answerLine = lines.find((line) => /^(?:答案|answer)\s*[:：]/i.test(line));
      const explanationLine = lines.find((line) => /^(?:解析|explanation)\s*[:：]/i.test(line));
      const answer = answerLine?.match(/[A-D]/i)?.[0]?.toUpperCase() ?? "";
      return {
        prompt: lines
          .filter(
            (line) =>
              !options.includes(line) &&
              line !== answerLine &&
              line !== explanationLine,
          )
          .join(" ")
          .replace(/^\d+\s*[.、．]\s*/, ""),
        answer,
        explanation:
          explanationLine?.replace(/^(?:解析|explanation)\s*[:：]\s*/i, "") ?? "",
        options: options.map((content) => ({
          content,
          isCorrect: content[0].toUpperCase() === answer,
        })),
      };
    })
    .filter((question) => question.prompt);
}

export function recognizeQuestionImage(imageData: string) {
  return appInvoke<QuestionDraft[]>("recognize_questions_image", {
    input: { imageData, translate: false },
  });
}
