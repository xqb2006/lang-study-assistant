import { FormEvent, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, readTextFile } from "@tauri-apps/plugin-fs";
import { parseQuestionText } from "../import/recognition";
import { appInvoke, isTauri } from "../../services/appInvoke";
import type { ContentLanguage } from "../languages";

export type Book = {
  id: number;
  title: string;
  author: string;
  description: string;
  articleCount: number;
  language: ContentLanguage;
};

export type BookDraft = {
  title: string;
  author: string;
  description: string;
  language: ContentLanguage;
  chapterTitle: string;
  sourceText: string;
  translationText: string;
  autoTranslate: boolean;
};

export function createInitialBookDraft(language: ContentLanguage = "en"): BookDraft {
  return {
    title: "",
    author: "",
    description: "",
    language,
    chapterTitle: "第 1 章",
    sourceText: "",
    translationText: "",
    autoTranslate: false,
  };
}

export const initialBookDraft = createInitialBookDraft();

export type ChapterDraft = {
  title: string;
  sourceText: string;
  translationText: string;
  autoTranslate: boolean;
};

export const initialChapterDraft: ChapterDraft = {
  title: "",
  sourceText: "",
  translationText: "",
  autoTranslate: false,
};

type UseBookImportOptions = {
  aiConfigured: boolean;
  defaultLearningLanguage: ContentLanguage;
  loadArticle: (articleId: number) => Promise<void>;
  reloadCurrentArticle: (articleId: number) => Promise<void>;
  refreshArticles: () => Promise<void>;
  refreshBookshelf: () => void;
  setNotice: (message: string) => void;
};

type ContentTarget = "source" | "translation";
type ContentDestination = "book" | "chapter";

async function readImportText(path: string) {
  if (!path.toLowerCase().endsWith(".docx")) return readTextFile(path);
  const { extractDocxText } = await import("../../documentTools");
  return (await extractDocxText(await readFile(path)))
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function useBookImport({
  aiConfigured,
  defaultLearningLanguage,
  loadArticle,
  reloadCurrentArticle,
  refreshArticles,
  refreshBookshelf,
  setNotice,
}: UseBookImportOptions) {
  const [articleOpen, setArticleOpen] = useState(false);
  const [chapterBook, setChapterBook] = useState<Book | null>(null);
  const [draft, setDraft] = useState(() => createInitialBookDraft(defaultLearningLanguage));
  useEffect(() => {
    setDraft((current) =>
      current.title || current.author || current.description
        ? current
        : createInitialBookDraft(defaultLearningLanguage),
    );
  }, [defaultLearningLanguage]);
  const [chapterDraft, setChapterDraft] = useState(initialChapterDraft);
  const [chapterQuestionsText, setChapterQuestionsText] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const saveDraftQuestions = async (articleId: number, rawText: string) => {
    const questions = parseQuestionText(rawText);
    if (!questions.length) return 0;
    return appInvoke<number>("save_questions", {
      input: {
        articleId,
        questions: questions.map((question, index) => ({
          articleId,
          position: index + 1,
          questionType: "single_choice",
          prompt: question.prompt,
          answer: question.answer,
          explanation: question.explanation,
          sourceLine: question.sourceLine ?? null,
          options: question.options,
        })),
      },
    });
  };

  const createArticle = async (event: FormEvent) => {
    event.preventDefault();
    setIsImporting(true);
    try {
      await appInvoke<number>("save_book", {
        input: {
          title: draft.title,
          author: draft.author,
          description: draft.description,
          language: draft.language,
        },
      });
      setArticleOpen(false);
      setDraft(createInitialBookDraft(defaultLearningLanguage));
      refreshBookshelf();
      await refreshArticles();
      setNotice("书籍已创建，可在书架中按需新建章节");
    } catch (error) {
      setNotice(`无法创建书籍：${String(error)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const importContentFile = async (
    target: ContentTarget,
    destination: ContentDestination,
  ) => {
    if (!isTauri) {
      setNotice("文件导入仅在桌面应用中可用");
      return;
    }
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "阅读内容", extensions: ["txt", "md", "docx"] }],
      });
      if (!path || Array.isArray(path)) return;
      const text = await readImportText(path);
      if (!text.trim()) {
        setNotice("没有从文件中识别到可导入的文本");
        return;
      }
      const patch = target === "source" ? { sourceText: text } : { translationText: text };
      if (destination === "book") setDraft((current) => ({ ...current, ...patch }));
      else setChapterDraft((current) => ({ ...current, ...patch }));
      setNotice(
        `已导入${target === "source" ? "正文原文" : "中文译文"}${path.toLowerCase().endsWith(".docx") ? "（Word 文档）" : ""}`,
      );
    } catch (error) {
      setNotice(`文件导入失败：${String(error)}`);
    }
  };

  const importQuestionFile = async () => {
    if (!isTauri) {
      setNotice("题目文件导入仅在桌面应用中可用");
      return;
    }
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "题目文件", extensions: ["txt", "md", "docx"] }],
      });
      if (!path || Array.isArray(path)) return;
      setChapterQuestionsText(await readImportText(path));
      setNotice("题目文件已导入，将在创建时自动解析");
    } catch (error) {
      setNotice(`题目文件导入失败：${String(error)}`);
    }
  };

  const createChapter = async (event: FormEvent) => {
    event.preventDefault();
    if (!chapterBook) return;
    if (!chapterDraft.sourceText.trim()) {
      setNotice("请先填写或导入正文原文，章节无法创建");
      return;
    }
    const draftQuestions = parseQuestionText(chapterQuestionsText);
    if (
      draftQuestions.some((question) => !question.answer.trim()) &&
      !window.confirm("部分题目没有答案，保存后将无法自动判题。仍要创建吗？")
    ) {
      return;
    }
    if (
      !chapterDraft.translationText.trim() &&
      !chapterDraft.autoTranslate &&
      !window.confirm("未提供译文且未启用 AI 补译，仍要创建吗？")
    ) {
      return;
    }
    setIsImporting(true);
    try {
      const articleId = await appInvoke<number>("create_chapter", {
        input: { bookId: chapterBook.id, ...chapterDraft },
      });
      const importedQuestionCount = await saveDraftQuestions(articleId, chapterQuestionsText);
      const shouldAutoTranslate = chapterDraft.autoTranslate && aiConfigured;
      setChapterBook(null);
      setChapterDraft(initialChapterDraft);
      setChapterQuestionsText("");
      await refreshArticles();
      await loadArticle(articleId);
      if (shouldAutoTranslate) {
        setNotice("章节已创建，正在补齐缺失译文…");
        void appInvoke<number>("translate_pending_paragraphs", { articleId })
          .then(async (count) => {
            await reloadCurrentArticle(articleId);
            setNotice(count ? `AI 已补齐 ${count} 段译文` : "章节已创建，译文已完整");
          })
          .catch((error) => setNotice(`章节已创建，但 AI 补译失败：${String(error)}`));
      } else {
        setNotice(`章节已创建${importedQuestionCount ? `，并导入 ${importedQuestionCount} 道练习题` : ""}`);
      }
    } catch (error) {
      setNotice(`无法创建章节：${String(error)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const openBookCreation = () => {
    setDraft(createInitialBookDraft(defaultLearningLanguage));
    setArticleOpen(true);
  };
  const closeBookCreation = () => {
    setArticleOpen(false);
    setDraft(createInitialBookDraft(defaultLearningLanguage));
  };

  return {
    articleOpen,
    chapterBook,
    chapterDraft,
    chapterQuestionsText,
    createArticle,
    createChapter,
    draft,
    importContentFile,
    importQuestionFile,
    isImporting,
    openBookCreation,
    closeBookCreation,
    setArticleOpen,
    setChapterBook,
    setChapterDraft,
    setChapterQuestionsText,
    setDraft,
  };
}
