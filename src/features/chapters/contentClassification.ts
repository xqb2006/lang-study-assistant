import type { QuestionDraft } from "../import/types";
import type {
  BookContentChapter,
  BookContentPackage,
  ReadingBookSourceBlock,
} from "./bookContentPackage";

export type ContentBlockType = ReadingBookSourceBlock["blockType"];

export type ClassifiedContentBlock = ReadingBookSourceBlock & {
  type: ContentBlockType;
  evidence: string[];
  locked: boolean;
  chapterIndex: number;
  lineIndex: number;
};

export type ContentClassificationResult = {
  chapters: BookContentChapter[];
  questions: QuestionDraft[];
  blocks: ClassifiedContentBlock[];
  counts: Record<ContentBlockType, number>;
  issues: string[];
};

type LineClassification = Pick<ClassifiedContentBlock, "type" | "confidence" | "evidence" | "locked">;

const blockTypes: ContentBlockType[] = [
  "title", "paragraph", "translation", "question", "option", "answer", "explanation", "header", "footer", "unknown",
];
const optionPattern = /^\s*(?:\(?[A-H]\)?[.\u3001\uFF0E):\uFF1A]|[A-H]\s*[-\u2014])\s+(.+)/i;
const answerPattern = /^\s*(?:answer|correct\s+answer|\u7b54\u6848|\u53c2\u8003\u7b54\u6848|\u6b63\u786e\u7b54\u6848)\s*[:\uFF1A]\s*(.*)$/i;
const explanationPattern = /^\s*(?:explanation|analysis|why|\u89e3\u6790|\u8be6\u89e3|\u7b54\u6848\u89e3\u6790)\s*[:\uFF1A]?\s*(.*)$/i;
const questionPattern = /^(?:\s*\d+\s*[.\u3001\uFF0E)\uFF09]\s*.+|\s*(?:question|\u6839\u636e(?:\u77ed\u6587|\u6587\u7ae0)|\u4e0b\u5217|\u8bf7\u9009\u62e9|\u9605\u8bfb(?:\u4e0b\u6587|\u77ed\u6587)|what|which|why|how|where|who)\b.*[?\uFF1F]?$)/i;
const pagePattern = /^\s*(?:page\s*)?\d{1,4}\s*$/i;
const terminalPunctuation = /[.\u3002!?\uFF01\uFF1F;\uFF1B:]$/;

function normalizeLine(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function hasCjk(value: string) {
  const cjk = value.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const letters = value.match(/[A-Za-z\u3400-\u9fff]/g)?.length ?? 0;
  return cjk >= 2 && cjk / Math.max(letters, 1) > 0.35;
}

function hasSourceLanguageText(value: string) {
  const latin = value.match(/[A-Za-z]/g)?.length ?? 0;
  const allLetters = value.match(/[A-Za-z\u3400-\u9fff]/g)?.length ?? 0;
  return latin >= 3 && latin / Math.max(allLetters, 1) > 0.65;
}

function isTitleCandidate(value: string, previous: string, next: string) {
  const compact = value.trim();
  if (!compact || compact.length > 110 || optionPattern.test(compact) || answerPattern.test(compact) || explanationPattern.test(compact) || questionPattern.test(compact)) return false;
  if (hasCjk(compact) || terminalPunctuation.test(compact)) return false;
  const explicit = /^(?:#{1,6}\s+|(?:chapter|unit|lesson|part|article|passage|reading)\s*(?:\d+|[a-z])?\b)/i.test(compact);
  const isolated = !previous && Boolean(next) && hasSourceLanguageText(next);
  const words = compact.split(/\s+/);
  const titleCase = words.length >= 2 && words.filter((word) => /^[A-Z][A-Za-z'-]*$/.test(word)).length >= Math.min(2, words.length);
  return explicit || (isolated && titleCase);
}

function classifyLine(value: string, previous: string, next: string, forceTranslation = false): LineClassification {
  const text = normalizeLine(value);
  if (!text) return { type: "unknown", confidence: 0, evidence: ["empty"], locked: false };
  if (pagePattern.test(text)) return { type: "footer", confidence: 0.98, evidence: ["page number"], locked: true };
  if (optionPattern.test(text)) return { type: "option", confidence: 0.99, evidence: ["option prefix"], locked: true };
  if (answerPattern.test(text)) return { type: "answer", confidence: 0.99, evidence: ["answer prefix"], locked: true };
  if (explanationPattern.test(text)) return { type: "explanation", confidence: 0.99, evidence: ["explanation prefix"], locked: true };
  if (questionPattern.test(text)) return { type: "question", confidence: 0.95, evidence: ["question pattern"], locked: true };
  if (forceTranslation || hasCjk(text)) return { type: "translation", confidence: forceTranslation ? 1 : 0.92, evidence: [forceTranslation ? "existing translation field" : "CJK text"], locked: forceTranslation };
  if (isTitleCandidate(text, previous, next)) return { type: "title", confidence: 0.82, evidence: ["title structure"], locked: false };
  if (hasSourceLanguageText(text)) return { type: "paragraph", confidence: 0.86, evidence: ["source language text"], locked: true };
  return { type: "unknown", confidence: 0.3, evidence: ["no strong structure"], locked: false };
}

function splitLines(value: string) {
  return value.replace(/\r/g, "").split("\n").map(normalizeLine).filter(Boolean);
}

function createBlocks(chapter: BookContentChapter, chapterIndex: number): ClassifiedContentBlock[] {
  const sourceLines = splitLines(chapter.sourceText);
  const translationLines = splitLines(chapter.translationText);
  const blocks: ClassifiedContentBlock[] = [];
  for (const [lineIndex, text] of sourceLines.entries()) {
    const previous = sourceLines[lineIndex - 1] ?? "";
    const next = sourceLines[lineIndex + 1] ?? "";
    const classified = classifyLine(text, previous, next);
    blocks.push({
      id: `chapter-${chapterIndex + 1}-source-${lineIndex + 1}`,
      chapterIndex,
      lineIndex,
      blockType: classified.type,
      type: classified.type,
      text,
      confidence: classified.confidence,
      evidence: classified.evidence,
      locked: classified.locked,
    });
  }
  for (const [lineIndex, text] of translationLines.entries()) {
    const classified = classifyLine(text, "", "", true);
    blocks.push({
      id: `chapter-${chapterIndex + 1}-translation-${lineIndex + 1}`,
      chapterIndex,
      lineIndex: sourceLines.length + lineIndex,
      blockType: classified.type,
      type: classified.type,
      text,
      confidence: classified.confidence,
      evidence: classified.evidence,
      locked: classified.locked,
    });
  }
  return blocks;
}

function appendText(current: string, text: string) {
  return current ? `${current}\n\n${text}` : text;
}

function createQuestion(block: ClassifiedContentBlock): QuestionDraft {
  return {
    prompt: block.text.replace(/^\s*\d+\s*[.\u3001\uFF0E)\uFF09]\s*/, ""),
    answer: "",
    explanation: "",
    sourceLine: block.lineIndex + 1,
    options: [],
  };
}

export function toReadingBookSourceBlocks(blocks: ClassifiedContentBlock[]): ReadingBookSourceBlock[] {
  return blocks.map(({ id, articleIndex, blockType, text, confidence }) => ({ id, articleIndex, blockType, text, confidence }));
}

export function assembleClassifiedBlocks(book: BookContentPackage, blocks: ClassifiedContentBlock[]): Omit<ContentClassificationResult, "blocks"> {
  const chapters: BookContentChapter[] = [];
  const questions: QuestionDraft[] = [];
  const issues: string[] = [];
  const counts = Object.fromEntries(blockTypes.map((type) => [type, 0])) as Record<ContentBlockType, number>;
  let current: BookContentChapter | null = null;
  let activeQuestion: QuestionDraft | null = null;

  const beginArticle = (articleTitle: string) => {
    if (current?.sourceText.trim()) chapters.push(current);
    const article: BookContentChapter = { title: articleTitle.trim() || `文章 ${chapters.length + 1}`, sourceText: "", translationText: "" };
    current = article;
    activeQuestion = null;
    return article;
  };

  for (const block of blocks) {
    counts[block.type] += 1;
    if (block.type === "footer" || block.type === "header") continue;
    if (block.type === "unknown") {
      issues.push(`未分类内容：${block.text.slice(0, 60)}`);
      continue;
    }
    if (block.type === "title") {
      beginArticle(block.text.replace(/^#{1,6}\s*/, ""));
      continue;
    }
    if (block.type === "question") {
      activeQuestion = createQuestion(block);
      questions.push(activeQuestion);
      continue;
    }
    if (block.type === "option") {
      if (!activeQuestion) issues.push(`孤立选项：${block.text.slice(0, 60)}`);
      else activeQuestion.options.push({ content: block.text, isCorrect: false });
      continue;
    }
    if (block.type === "answer") {
      if (!activeQuestion) {
        issues.push(`孤立答案：${block.text.slice(0, 60)}`);
      } else {
        const answer = answerPattern.exec(block.text)?.[1]?.match(/[A-H]/i)?.[0]?.toUpperCase() ?? "";
        activeQuestion.answer = answer;
        activeQuestion.options = activeQuestion.options.map((option) => ({ ...option, isCorrect: Boolean(answer) && option.content.trim().startsWith(answer) }));
      }
      continue;
    }
    if (block.type === "explanation") {
      if (!activeQuestion) issues.push(`孤立解析：${block.text.slice(0, 60)}`);
      else activeQuestion.explanation = explanationPattern.exec(block.text)?.[1]?.trim() || block.text;
      continue;
    }
    const currentArticle = current ?? beginArticle(book.chapters[block.chapterIndex]?.title || `文章 ${chapters.length + 1}`);
    if (block.type === "paragraph") {
      currentArticle.sourceText = appendText(currentArticle.sourceText, block.text);
      activeQuestion = null;
    } else if (block.type === "translation") {
      currentArticle.translationText = appendText(currentArticle.translationText, block.text);
    }
  }
  const finalArticle = current as BookContentChapter | null;
  if (finalArticle?.sourceText.trim()) chapters.push(finalArticle);
  if (!chapters.length) issues.push("未识别到可阅读的原文段落");
  return { chapters, questions, counts, issues };
}

export function classifyBookContent(book: BookContentPackage): ContentClassificationResult {
  const blocks = book.chapters.flatMap(createBlocks);
  return { blocks, ...assembleClassifiedBlocks(book, blocks) };
}