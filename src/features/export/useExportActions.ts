import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { VocabularyExportEntry } from "../../documentTools";
import { appInvoke, isTauri } from "../../services/appInvoke";
import type { Card, Mark } from "../cards/types";
import type { ExportOptions } from "./types";

type Article = {
  id: number;
  title: string;
  content: string;
};

type Paragraph = {
  position: number;
  sourceText: string;
  translation: string;
};

type QuizQuestion = {
  prompt: string;
  answer: string;
  explanation: string;
  options: Array<{ content: string }>;
};

type UseExportActionsOptions = {
  article: Article | null;
  cards: Card[];
  defaultOptions: ExportOptions;
  marks: Mark[];
  setNotice: (message: string) => void;
};

function fileSafeName(value: string, fallback: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || fallback;
}

function downloadBlob(file: Blob, name: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function loadDocumentTools() {
  return import("../../documentTools");
}

function yieldToUi() {
  return new Promise<void>((resolve) => {
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    window.setTimeout(resolve, 0);
  });
}

export function useExportActions({
  article,
  cards,
  defaultOptions,
  marks,
  setNotice,
}: UseExportActionsOptions) {
  const getHighlightRanges = (
    sourceText: string,
    offset: number,
    includeHighlights: boolean,
  ) => {
    if (!includeHighlights) return [];
    return marks
      .filter(
        (mark) =>
          mark.startIndex < offset + sourceText.length && mark.endIndex > offset,
      )
      .map((mark) => ({
        start: Math.max(0, mark.startIndex - offset),
        end: Math.min(sourceText.length, mark.endIndex - offset),
      }))
      .sort((left, right) => left.start - right.start);
  };

  const buildVocabularyEntries = (sourceCards: Card[] = cards): VocabularyExportEntry[] => {
    const entries = new Map<number, VocabularyExportEntry>();
    for (const card of sourceCards) {
      if (!entries.has(card.id)) {
        entries.set(card.id, {
          word: card.word.trim(),
          phonetic: card.phonetic.trim(),
          definition: (card.translation || card.definition || "暂无释义").trim(),
        });
      }
    }
    return [...entries.values()];
  };

  const loadExportData = async (options: ExportOptions) => {
    if (!article) throw new Error("请先打开一篇文章");
    const [saved, questions] = await Promise.all([
      appInvoke<Paragraph[]>("get_paragraphs", { articleId: article.id }).catch(
        () => [],
      ),
      appInvoke<QuizQuestion[]>("get_questions", { articleId: article.id }).catch(
        () => [],
      ),
    ]);
    let searchOffset = 0;
    const pdfParagraphs = article.content
      .split("\n")
      .filter(Boolean)
      .map((sourceText, index) => {
        const offset = article.content.indexOf(sourceText, searchOffset);
        searchOffset = offset >= 0 ? offset + sourceText.length : searchOffset;
        const savedParagraph =
          saved.find((item) => item.position === index + 1) ||
          saved.find((item) => item.position === index);
        return {
          sourceText,
          highlights: getHighlightRanges(
            sourceText,
            Math.max(0, offset),
            options.includeHighlights,
          ),
          translation: options.includeTranslation
            ? savedParagraph?.translation || ""
            : "",
        };
      });
    const exportQuestions = options.includeQuestions
      ? questions.map((question) => ({
          prompt: question.prompt,
          answer: options.includeQuestionAnswers ? question.answer : "",
          explanation: options.includeQuestionAnswers ? question.explanation : "",
          options: question.options.map((option) => option.content),
        }))
      : [];
    const markedWords = options.includeMarkedWords
      ? cards.map((card) => ({
          word: card.word,
          phonetic: card.phonetic,
          definition: card.translation || card.definition,
          references: card.references.map((reference) => ({
            contextSentence: reference.contextSentence,
            sentenceTranslation: reference.sentenceTranslation,
            contextualMeaning: reference.contextualMeaning,
            usageNote: reference.usageNote,
            learningNote: reference.learningNote,
          })),
        }))
      : [];
    return {
      saved,
      questions,
      pdfParagraphs,
      exportQuestions,
      markedWords,
      vocabularyEntries: options.includeVocabularyList
        ? buildVocabularyEntries()
        : [],
    };
  };

  const exportBrowserPrintHtml = async () => {
    if (!article) return;
    const exportData = await loadExportData({
      ...defaultOptions,
      includeHighlights: false,
      includeQuestions: false,
      includeMarkedWords: false,
      includeVocabularyList: false,
    });
    const escape = (value: string) =>
      value.replace(
        /[&<>]/g,
        (character) =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] ??
          character,
      );
    const body = exportData.pdfParagraphs
      .map(
        (paragraph, index) =>
          `<section><p><sup>${index + 1}</sup>${escape(paragraph.sourceText)}</p>${paragraph.translation ? `<div class="translation">${escape(paragraph.translation)}</div>` : ""}</section>`,
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(article.title)}</title><style>@page{size:A4;margin:18mm}body{font-family:Georgia,'Times New Roman',serif;color:#1f2937;max-width:174mm;margin:auto}h1{font:700 20pt 'Segoe UI';margin:0 0 5mm}p{font-size:12pt;line-height:1.8;margin:0 0 2mm}section{margin:0 0 5mm}.translation{padding-left:10mm;color:#475569;font:10.5pt/1.7 'Microsoft YaHei','Segoe UI',sans-serif}sup{color:#9ca3af;font:8pt Arial;margin-right:5mm}</style></head><body><h1>${escape(article.title)}</h1>${body}</body></html>`;
    downloadBlob(
      new Blob([html], { type: "text/html;charset=utf-8" }),
      `${fileSafeName(article.title, "reading")}-双语阅读稿.html`,
    );
    setNotice("双语阅读稿已开始下载，可打开后打印或另存为 PDF");
  };

  const exportPdf = async (options: ExportOptions = defaultOptions) => {
    if (!article) return;
    if (!isTauri) {
      await exportBrowserPrintHtml();
      return;
    }
    try {
      setNotice("正在准备 PDF 导出…");
      await yieldToUi();
      const path = await save({
        defaultPath: `${fileSafeName(article.title, "reading")}-export.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!path) return;
      const data = await loadExportData(options);
      await appInvoke("export_pdf_in_background", {
        input: {
          path,
          title: article.title,
          paragraphs: data.pdfParagraphs,
          questions: data.exportQuestions,
          markedWords: data.markedWords,
          vocabularyList: data.vocabularyEntries,
          vocabularyOnly: false,
        },
      });
      setNotice("PDF 导出完成");
    } catch (error) {
      setNotice(`PDF 导出失败：${String(error)}`);
    }
  };

  const exportWord = async (options: ExportOptions = defaultOptions) => {
    if (!article) return;
    try {
      setNotice("正在生成 Word 文档…");
      await yieldToUi();
      const data = await loadExportData(options);
      const { createWordDocumentBlob } = await loadDocumentTools();
      const file = await createWordDocumentBlob({
        title: article.title,
        content: article.content,
        paragraphs: data.saved,
        questions: data.questions,
        marks,
        cards,
        includeHighlights: options.includeHighlights,
        includeTranslation: options.includeTranslation,
        includeQuestions: options.includeQuestions,
        includeQuestionAnswers: options.includeQuestionAnswers,
        includeMarkedWords: options.includeMarkedWords,
        vocabularyEntries: data.vocabularyEntries,
        includeVocabularyList: options.includeVocabularyList,
      });
      const name = `${fileSafeName(article.title, "reading")}-export.docx`;
      if (isTauri) {
        const path = await save({
          defaultPath: name,
          filters: [{ name: "Word", extensions: ["docx"] }],
        });
        if (!path) return;
        await writeFile(path, new Uint8Array(await file.arrayBuffer()));
      } else {
        downloadBlob(file, name);
      }
      setNotice("Word 导出完成");
    } catch (error) {
      setNotice(`Word 导出失败：${String(error)}`);
    }
  };

  const exportVocabularyPdf = async (
    sourceCards: Card[] = cards,
    title = article?.title || "我的单词",
  ) => {
    const entries = buildVocabularyEntries(sourceCards);
    if (!entries.length) {
      setNotice("当前没有可导出的单词卡片");
      return;
    }
    if (!isTauri) {
      setNotice("浏览器预览暂不支持 PDF 单词表导出，请在桌面程序中使用");
      return;
    }
    try {
      setNotice("正在准备单词表 PDF…");
      await yieldToUi();
      const path = await save({
        defaultPath: `${fileSafeName(title, "vocabulary")}-vocabulary.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!path) return;
      await appInvoke("export_pdf_in_background", {
        input: {
          path,
          title: `${title} · 单词表`,
          paragraphs: [],
          questions: [],
          markedWords: [],
          vocabularyList: entries,
          vocabularyOnly: true,
        },
      });
      setNotice(`单词表 PDF 导出完成，共 ${entries.length} 个词条`);
    } catch (error) {
      setNotice(`单词表 PDF 导出失败：${String(error)}`);
    }
  };

  const exportVocabularyWord = async (
    sourceCards: Card[] = cards,
    title = article?.title || "我的单词",
  ) => {
    const entries = buildVocabularyEntries(sourceCards);
    if (!entries.length) {
      setNotice("当前没有可导出的单词卡片");
      return;
    }
    try {
      setNotice("正在生成单词表 Word 文档…");
      await yieldToUi();
      const { createVocabularyDocumentBlob } = await loadDocumentTools();
      const file = await createVocabularyDocumentBlob({
        title: `${title} · 单词表`,
        entries,
      });
      const name = `${fileSafeName(title, "vocabulary")}-vocabulary.docx`;
      if (isTauri) {
        const path = await save({
          defaultPath: name,
          filters: [{ name: "Word", extensions: ["docx"] }],
        });
        if (!path) return;
        await writeFile(path, new Uint8Array(await file.arrayBuffer()));
      } else {
        downloadBlob(file, name);
      }
      setNotice(`单词表 Word 导出完成，共 ${entries.length} 个词条`);
    } catch (error) {
      setNotice(`单词表 Word 导出失败：${String(error)}`);
    }
  };

  return {
    exportPdf,
    exportVocabularyPdf,
    exportVocabularyWord,
    exportWord,
  };
}
