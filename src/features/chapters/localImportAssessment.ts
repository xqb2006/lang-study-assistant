import type { ContentLanguage } from "../languages";
import type { BookContentChapter, BookContentPackage } from "./bookContentPackage";

export type ImportConfidence = "high" | "medium" | "low";

export type LocalChapterAssessment = {
  index: number;
  confidence: ImportConfidence;
  score: number;
  reasons: string[];
};

export type LocalImportAssessment = {
  chapters: LocalChapterAssessment[];
  reviewIndexes: number[];
  confidence: ImportConfidence;
  removedNoiseLines: number;
};

export type LocalImportPreparation = {
  book: BookContentPackage;
  assessment: LocalImportAssessment;
};

function normalizeLine(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function isStandalonePageNumber(value: string) {
  return /^(?:page\s*)?\d{1,4}$/i.test(value) || /^第\s*\d{1,4}\s*页$/.test(value);
}

function isLikelyHeading(value: string) {
  return /^(?:#{1,6}\s+|(?:chapter|unit|lesson)\s+\d+\b|第\s*[一二三四五六七八九十百0-9]+\s*(?:章|节|单元|课))/.test(value.trim());
}

function isLikelyQuestion(value: string) {
  return /(?:^|\n)\s*\d+\s*[.、)]\s+.+(?:\n\s*[A-D][.、)]\s+)/i.test(value)
    || /(?:^|\n)\s*(?:answer|答案|解析)\s*[:：]/i.test(value);
}

function normalizeChapter(chapter: BookContentChapter) {
  const lines = chapter.sourceText.replace(/\r\n/g, "\n").split("\n");
  const cleaned: string[] = [];
  let removedNoiseLines = 0;
  for (const rawLine of lines) {
    const line = normalizeLine(rawLine);
    if (line && isStandalonePageNumber(line)) {
      removedNoiseLines += 1;
      continue;
    }
    if (line && cleaned[cleaned.length - 1] === line) {
      removedNoiseLines += 1;
      continue;
    }
    cleaned.push(line);
  }
  return {
    chapter: {
      ...chapter,
      title: normalizeLine(chapter.title),
      sourceText: cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
      translationText: chapter.translationText.replace(/\r\n/g, "\n").trim(),
    },
    removedNoiseLines,
  };
}

function assessChapter(chapter: BookContentChapter, index: number): LocalChapterAssessment {
  const reasons: string[] = [];
  let score = 100;
  const source = chapter.sourceText.trim();
  const lines = source.split("\n").map(normalizeLine).filter(Boolean);
  const shortLineCount = lines.filter((line) => line.length < 18 && !isLikelyHeading(line)).length;
  const genericTitle = /^第\s*\d+\s*章$/.test(chapter.title) || /^chapter\s*\d+$/i.test(chapter.title);

  if (source.length < 120) {
    score -= 28;
    reasons.push("正文过短，无法稳定判断结构");
  }
  if (/�/.test(source)) {
    score -= 45;
    reasons.push("包含无法识别的字符");
  }
  if (lines.length >= 5 && shortLineCount / lines.length > 0.45) {
    score -= 22;
    reasons.push("短行比例过高，可能存在分页或排版残留");
  }
  if (genericTitle) {
    score -= 12;
    reasons.push("章节标题由本地规则生成");
  }
  if (lines.slice(1).some(isLikelyHeading)) {
    score -= 30;
    reasons.push("正文中仍包含疑似章节标题");
  }
  if (isLikelyQuestion(source)) {
    score -= 20;
    reasons.push("检测到疑似练习题，需要分离正文与题目");
  }
  if (chapter.translationText && chapter.translationText.length < Math.max(20, source.length * 0.05)) {
    score -= 12;
    reasons.push("已有译文过短，可能未完整匹配");
  }

  const confidence: ImportConfidence = score >= 82 ? "high" : score >= 60 ? "medium" : "low";
  return { index, confidence, score: Math.max(0, score), reasons };
}

export function prepareLocalBookImport(book: BookContentPackage): LocalImportPreparation {
  let removedNoiseLines = 0;
  const chapters = book.chapters.map((chapter) => {
    const normalized = normalizeChapter(chapter);
    removedNoiseLines += normalized.removedNoiseLines;
    return normalized.chapter;
  }).filter((chapter) => chapter.sourceText);
  const chapterAssessments = chapters.map(assessChapter);
  const reviewIndexes = chapterAssessments
    .filter((chapter) => chapter.confidence === "low")
    .map((chapter) => chapter.index);
  const confidence: ImportConfidence = reviewIndexes.length
    ? "low"
    : chapterAssessments.some((chapter) => chapter.confidence === "medium")
      ? "medium"
      : "high";
  return {
    book: { ...book, chapters },
    assessment: { chapters: chapterAssessments, reviewIndexes, confidence, removedNoiseLines },
  };
}

export type ReviewGroup = { startIndex: number; endIndex: number; chapters: BookContentChapter[] };

export function createAiReviewGroups(book: BookContentPackage, reviewIndexes: number[]): ReviewGroup[] {
  const indexes = [...new Set(reviewIndexes)].filter((index) => index >= 0 && index < book.chapters.length).sort((left, right) => left - right);
  const groups: ReviewGroup[] = [];
  for (const index of indexes) {
    const previous = groups[groups.length - 1];
    if (previous && index <= previous.endIndex + 1) {
      previous.endIndex = index;
      previous.chapters = book.chapters.slice(previous.startIndex, index + 1);
    } else {
      groups.push({ startIndex: index, endIndex: index, chapters: [book.chapters[index]] });
    }
  }
  return groups;
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export function createSmartImportCacheKey(book: BookContentPackage, group: ReviewGroup, language: ContentLanguage) {
  const content = group.chapters.map((chapter) => `${chapter.title}\u0000${chapter.sourceText}\u0000${chapter.translationText}`).join("\u0001");
  return `reading-agent.smart-import.v1.${language}.${group.startIndex}-${group.endIndex}.${fnv1a(`${book.book.title}\u0002${content}`)}`;
}

export function readSmartImportCache<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const record = JSON.parse(raw) as { savedAt?: number; value?: T };
    if (!record.savedAt || Date.now() - record.savedAt > 30 * 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(key);
      return null;
    }
    return record.value ?? null;
  } catch {
    return null;
  }
}

export function writeSmartImportCache<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Import remains available when browser storage is unavailable.
  }
}