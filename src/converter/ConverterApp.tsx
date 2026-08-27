import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useMemo, useState } from "react";
import { appInvoke, isTauri } from "../services/appInvoke";
import { SettingsModal } from "../features/settings/SettingsModal";
import { ConfirmDeleteModal } from "../components/ConfirmDeleteModal";
import { useSettingsWorkspace } from "../features/settings/useSettingsWorkspace";
import { supportedLanguages, type ContentLanguage } from "../features/languages";
import { PhotoImportModal } from "../features/import/PhotoImportModal";
import type { QuestionDraft } from "../features/import/types";
import {
  createBookContentPackage,
  createReadingBookPackage,
  isLocalBookImportCancelled,
  readBookContentFile,
  readEpubBook,
  readLocalBookFile,
  resolveImportLanguage,
  type BookContentPackage,
  type ReadingBookArticle,
} from "../features/chapters/bookContentPackage";
import {
prepareLocalBookImport,
} from "../features/chapters/localImportAssessment";
import {
  assembleClassifiedBlocks,
  classifyBookContent,
  toReadingBookSourceBlocks,
  type ClassifiedContentBlock,
  type ContentBlockType,
} from "../features/chapters/contentClassification";
import {
  chaptersFromPdfRanges,
  findPdfChapterRanges,
  normalizePdfChapterRanges,
  type PdfChapterRange,
  type PdfTextPage,
} from "../features/chapters/pdfChapterIndex";
import { extractPdfTextPages } from "../documentTools";

type ChapterDraft = { title: string; sourceText: string; translationText: string };
type AiBlockClassification = {
  id: string;
  blockType: ContentBlockType;
  confidence: number;
};

type AiBlockClassificationResponse = {
  blocks: AiBlockClassification[];
};

const emptyClassificationCounts = (): Record<ContentBlockType, number> => ({
  title: 0, paragraph: 0, translation: 0, question: 0, option: 0,
  answer: 0, explanation: 0, header: 0, footer: 0, unknown: 0,
});

function mergeQuestions(primary: QuestionDraft[], secondary: QuestionDraft[]) {
  return [...primary, ...secondary].filter((question, index, items) => {
    const normalized = question.prompt.replace(/\s+/g, " ").trim().toLowerCase();
    return normalized && items.findIndex((item) => item.prompt.replace(/\s+/g, " ").trim().toLowerCase() === normalized) === index;
  });
}

const extensions = ["readingbook", "epub", "txt", "md", "markdown", "html", "htm", "docx", "pdf", "jpg", "jpeg", "png", "webp"];
const imageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);

function extensionOf(path: string) {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

function fileTitleOf(path: string) {
  return path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "").trim() || "未命名书籍";
}

function chapterFromDraft(draft: { title: string; sourceText: string; translationText?: string }) {
  return {
    title: draft.title.trim() || "未命名文章",
    sourceText: draft.sourceText.trim(),
    translationText: draft.translationText?.trim() ?? "",
  };
}

function articlesFromChapters(chapters: ChapterDraft[]): ReadingBookArticle[] {
  return chapters.map((chapter, index) => ({
    index,
    title: chapter.title,
    chapterIndex: index,
    confidence: "medium",
  }));
}

export function ConverterApp() {
  const [book, setBook] = useState<BookContentPackage | null>(null);
  const [chapters, setChapters] = useState<ChapterDraft[]>([]);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<ContentLanguage>("en");
  const [status, setStatus] = useState("请选择需要转换的阅读文件。");
  const [isBusy, setIsBusy] = useState(false);
  const [recognitionPath, setRecognitionPath] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingProfileDelete, setPendingProfileDelete] = useState(false);
  const [classifiedBlocks, setClassifiedBlocks] = useState<ClassifiedContentBlock[]>([]);
  const [classificationIssues, setClassificationIssues] = useState<string[]>([]);
  const [classificationCounts, setClassificationCounts] = useState<Record<ContentBlockType, number>>(emptyClassificationCounts);
  const [pdfPages, setPdfPages] = useState<PdfTextPage[]>([]);
  const [pdfChapterRanges, setPdfChapterRanges] = useState<PdfChapterRange[]>([]);
  const [pdfSourceTitle, setPdfSourceTitle] = useState("");
  const settings = useSettingsWorkspace({ setNotice: setStatus });

  const assessment = useMemo(() => {
    if (!book) return null;
    return prepareLocalBookImport({ ...book, chapters });
  }, [book, chapters]);

  const applyPackage = (nextBook: BookContentPackage, recognizedQuestions: QuestionDraft[] = []) => {
    const classified = classifyBookContent(nextBook);
    const nextChapters = classified.chapters.map(chapterFromDraft).filter((chapter) => chapter.sourceText);
    const normalizedBook: BookContentPackage = {
      ...nextBook,
      chapters: nextChapters,
      sourceBlocks: toReadingBookSourceBlocks(classified.blocks),
    };
    setBook(normalizedBook);
    setChapters(nextChapters);
    setQuestions(mergeQuestions(classified.questions, recognizedQuestions));
    setClassifiedBlocks(classified.blocks);
    setClassificationIssues(classified.issues);
    setClassificationCounts(classified.counts);
    setTitle(nextBook.book.title);
    setAuthor(nextBook.book.author);
    setDescription(nextBook.book.description);
    setLanguage(nextBook.book.language);
    setStatus(`本地分类完成：原文 ${classified.counts.paragraph} 段，译文 ${classified.counts.translation} 段，题目 ${classified.counts.question} 道；${classified.issues.length ? `发现 ${classified.issues.length} 项需要校对。` : "未发现异常内容。"}`);
  };

  const rebuildPdfChapters = (ranges: PdfChapterRange[], notice: string) => {
    const normalizedRanges = normalizePdfChapterRanges(ranges, pdfPages.length);
    const nextChapters = chaptersFromPdfRanges(pdfPages, normalizedRanges);
    if (!nextChapters.length) {
      setStatus("页段内没有可提取的正文，请检查每章的起始 PDF 页。 ");
      return;
    }
    setPdfChapterRanges(normalizedRanges);
    applyPackage(createBookContentPackage({
      title: pdfSourceTitle || "未命名书籍",
      author,
      description,
      language: resolveImportLanguage("", nextChapters.map((chapter) => chapter.sourceText).join("\n\n")),
      chapters: nextChapters,
    }));
    setStatus(notice);
  };

  const updatePdfChapterRange = (id: string, patch: Partial<Pick<PdfChapterRange, "title" | "pdfPageStart">>) => {
    setPdfChapterRanges((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const selectFile = async () => {
    if (!isTauri) {
      setStatus("文件转换仅可在桌面程序中使用。");
      return;
    }
    let path = "";
    try {
      const selected = await open({ multiple: false, filters: [{ name: "可转换阅读文件", extensions }] });
      if (!selected || Array.isArray(selected)) return;
      path = selected;
      setIsBusy(true);
      const extension = extensionOf(path);
      if (imageExtensions.has(extension)) {
        setRecognitionPath(path);
        return;
      }
      if (extension === "pdf") {
        const pages = await extractPdfTextPages(await readFile(path));
        const ranges = findPdfChapterRanges(pages);
        if (ranges.length) {
          const sourceTitle = fileTitleOf(path);
          const normalizedRanges = normalizePdfChapterRanges(ranges, pages.length);
          const nextChapters = chaptersFromPdfRanges(pages, normalizedRanges);
          setPdfPages(pages);
          setPdfChapterRanges(normalizedRanges);
          setPdfSourceTitle(sourceTitle);
          applyPackage(createBookContentPackage({
            title: sourceTitle,
            author: "",
            description: "",
            language: resolveImportLanguage("", nextChapters.map((chapter) => chapter.sourceText).join("\n\n")),
            chapters: nextChapters,
          }));
          setStatus(`已从目录识别 ${normalizedRanges.length} 个章节页段。请在“PDF 章节定位”中确认起始页；低置信度页段不会静默采用。`);
          return;
        }
        setPdfPages([]);
        setPdfChapterRanges([]);
        setPdfSourceTitle("");
      } else {
        setPdfPages([]);
        setPdfChapterRanges([]);
        setPdfSourceTitle("");
      }
      const nextBook = extension === "readingbook"
        ? await readBookContentFile(path)
        : extension === "epub"
          ? await readEpubBook(path)
          : await readLocalBookFile(path);
      applyPackage(nextBook);
    } catch (error) {
      if (isLocalBookImportCancelled(error)) return;
      if (extensionOf(path) === "pdf") {
        setRecognitionPath(path);
        setStatus("PDF 无法直接提取文字，将转入视觉识别。识别结果仍需在本窗口校对。");
      } else {
        setStatus(`读取失败：${String(error)}`);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const applyRecognizedDraft = (draft: { title: string; sourceText: string; translationText: string; questions: QuestionDraft[]; paragraphs?: { sourceText: string; translation: string }[]; chapterDrafts?: ChapterDraft[] }) => {
    const sourceText = draft.paragraphs?.map((paragraph) => paragraph.sourceText).filter(Boolean).join("\n\n") || draft.sourceText;
    const translationText = draft.paragraphs?.map((paragraph) => paragraph.translation).filter(Boolean).join("\n\n") || draft.translationText;
    setRecognitionPath(null);
    const recognizedChapters = draft.chapterDrafts?.filter((chapter) => chapter.sourceText.trim()).map(chapterFromDraft) ?? [];
    applyPackage(createBookContentPackage({
      title: draft.title || title || "待校对内容",
      author,
      description,
      language,
      chapters: recognizedChapters.length ? recognizedChapters : [{ title: draft.title || "待校对内容", sourceText, translationText }],
    }), draft.questions);
  };

  const updateChapter = (index: number, patch: Partial<ChapterDraft>) => {
    setChapters((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const removeChapter = (index: number) => setChapters((items) => items.filter((_, itemIndex) => itemIndex !== index));

  const mergePrevious = (index: number) => {
    if (index <= 0) return;
    setChapters((items) => items.flatMap((chapter, chapterIndex) => {
      if (chapterIndex === index - 1) {
        const next = items[index];
        return [{ ...chapter, sourceText: `${chapter.sourceText}\n\n${next.sourceText}`, translationText: [chapter.translationText, next.translationText].filter(Boolean).join("\n\n") }];
      }
      if (chapterIndex === index) return [];
      return [chapter];
    }));
  };

  const splitChapter = (index: number) => {
    const chapter = chapters[index];
    const paragraphs = chapter.sourceText.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
    if (paragraphs.length < 2) {
      setStatus("当前内容没有足够的段落可拆分，请在正文中添加空行后重试。");
      return;
    }
    const midpoint = Math.ceil(paragraphs.length / 2);
    const first = paragraphs.slice(0, midpoint).join("\n\n");
    const second = paragraphs.slice(midpoint).join("\n\n");
    setChapters((items) => items.flatMap((item, itemIndex) => itemIndex === index
      ? [{ ...item, title: `${item.title}（上）`, sourceText: first }, { ...item, title: `${item.title}（下）`, sourceText: second, translationText: "" }]
      : [item]));
    setStatus("已按段落拆分当前内容，请检查文章标题和译文归属。");
  };

  const runAiBoundaryReview = async () => {
    if (!book || !classifiedBlocks.length) return;
    if (!isTauri) {
      setStatus("AI 校对仅可在桌面程序中使用。");
      return;
    }
    const candidates = classifiedBlocks.filter((block) => block.type === "unknown" || block.type === "title" && !block.locked && (block.confidence ?? 0) < 0.9);
    if (!candidates.length) {
      setStatus("本地规则已覆盖全部内容，不需要调用 AI。原文、已有译文、选项、答案和解析均不会发送。 ");
      return;
    }
    setIsBusy(true);
    try {
      const result = await appInvoke<AiBlockClassificationResponse>("classify_import_blocks", {
        input: {
          language,
          blocks: candidates.map((block) => ({
            id: block.id,
            text: block.text,
            allowedTypes: ["title", "paragraph", "translation", "question"],
          })),
        },
      });
      const aiById = new Map(result.blocks.filter((item) => item.confidence >= 0.6).map((item) => [item.id, item]));
      const updatedBlocks = classifiedBlocks.map((block) => {
        const ai = aiById.get(block.id);
        return ai ? {
          ...block,
          type: ai.blockType,
          blockType: ai.blockType,
          confidence: ai.confidence,
          evidence: [...block.evidence, "AI unresolved-block review"],
        } : block;
      });
      const assembled = assembleClassifiedBlocks(book, updatedBlocks);
      const nextChapters = assembled.chapters.map(chapterFromDraft).filter((chapter) => chapter.sourceText);
      setBook({ ...book, chapters: nextChapters, sourceBlocks: toReadingBookSourceBlocks(updatedBlocks) });
      setChapters(nextChapters);
      setQuestions(mergeQuestions(assembled.questions, questions));
      setClassifiedBlocks(updatedBlocks);
      setClassificationIssues(assembled.issues);
      setClassificationCounts(assembled.counts);
      setStatus(`AI 仅校对了 ${candidates.length} 个低置信度片段，未发送或改写原文、已有译文、选项、答案和解析。`);
    } catch (error) {
      setStatus(`AI 校对失败：${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const exportPackage = async () => {
    if (!chapters.length) {
      setStatus("请先读取文件。");
      return;
    }
    if (!isTauri) {
      setStatus("导出仅可在桌面程序中使用。");
      return;
    }
    const packageData = createReadingBookPackage({
      book: { title: title.trim() || "未命名书籍", author, description, language },
      chapters,
      articles: articlesFromChapters(chapters),
      sourceBlocks: toReadingBookSourceBlocks(classifyBookContent(createBookContentPackage({ title, author, description, language, chapters })).blocks),
    });
    const target = await save({ defaultPath: `${packageData.book.title || "reading-book"}.readingbook`, filters: [{ name: "英语阅读助手阅读包", extensions: ["readingbook"] }] });
    if (!target) return;
    await writeTextFile(target, JSON.stringify(packageData, null, 2));
    setStatus(`已导出阅读包 v${packageData.version}：${target}`);
  };

  return (
    <div className="converter-shell">
      <header className="converter-topbar">
        <div><h1>阅读内容转换器</h1><p>将复杂文件整理为英语阅读助手可直接导入的阅读包</p></div>
        <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setSettingsOpen(true)}>AI 模型配置</button><button className="secondary-button" type="button" onClick={() => void selectFile()} disabled={isBusy}>选择文件</button></div>
      </header>
      <main className="converter-main">
        <aside className="converter-panel converter-sidebar">
          <h2>转换设置</h2>
          <div className="converter-meta">
            <label>书名<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>作者（可选）<input value={author} onChange={(event) => setAuthor(event.target.value)} /></label>
            <label>学习语言<select value={language} onChange={(event) => setLanguage(event.target.value as ContentLanguage)}>{supportedLanguages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
            <label>书籍简介（可选）<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          </div>
          <p className="converter-status">{status}</p>
        </aside>
        <section className="converter-panel converter-editor">
          <div className="converter-toolbar">
            <button className="primary-button" type="button" onClick={() => void selectFile()} disabled={isBusy}>读取文件</button>
            <button className="secondary-button" type="button" onClick={() => void runAiBoundaryReview()} disabled={isBusy || !classifiedBlocks.length || !settings.aiConfigured}>AI 校对异常内容</button>
            <button className="primary-button" type="button" onClick={() => void exportPackage()} disabled={isBusy || !chapters.length}>导出阅读包</button>
          </div>
          {assessment && <div className="converter-stats"><div className="converter-stat"><strong>{chapters.length}</strong><span>阅读文章</span></div><div className="converter-stat"><strong>{classificationCounts.paragraph}</strong><span>原文段落</span></div><div className="converter-stat"><strong>{classificationCounts.translation}</strong><span>已有译文</span></div><div className="converter-stat"><strong>{questions.length}</strong><span>识别题目</span></div><div className="converter-stat"><strong>{classificationCounts.option}</strong><span>题目选项</span></div><div className="converter-stat"><strong>{classificationCounts.unknown}</strong><span>待校对片段</span></div></div>}
          {pdfChapterRanges.length > 0 && <section className="converter-pdf-index" aria-label="PDF 章节定位"><div className="converter-pdf-index-head"><div><h3>PDF 章节定位</h3><p>目录页码用于定位，最终以 PDF 起始页为准。修改后重新组装，不会调用 AI 或覆盖已有译文。</p></div><button className="secondary-button" type="button" onClick={() => rebuildPdfChapters(pdfChapterRanges, "已按修正后的 PDF 章节页段重新组装内容，请继续校对文章边界。")} disabled={isBusy}>应用页段修正</button></div><div className="converter-pdf-index-list">{pdfChapterRanges.map((range) => <div className="converter-pdf-index-row" key={range.id}><label>章节标题<input value={range.title} onChange={(event) => updatePdfChapterRange(range.id, { title: event.target.value })} /></label><label>目录页码<span>{range.printedPageNumber}</span></label><label>PDF 起始页<input type="number" min="1" max={pdfPages.length} value={range.pdfPageStart} onChange={(event) => updatePdfChapterRange(range.id, { pdfPageStart: Number(event.target.value) })} /></label><label>当前页段<span>{range.pdfPageStart}–{range.pdfPageEnd}</span></label><p className={`converter-pdf-confidence is-${range.confidence}`}>{range.confidence === "high" ? "已验证" : "待确认"}：{range.evidence}</p></div>)}</div></section>}
          {classificationIssues.length > 0 && <div className="converter-alert"><strong>需要校对：</strong>{classificationIssues.slice(0, 3).join("；")}{classificationIssues.length > 3 ? "……" : ""}</div>}
          {!chapters.length && <div className="converter-empty">选择 TXT、Word、EPUB、HTML、PDF 或图片后，在这里校对文章边界。</div>}
          {chapters.map((chapter, index) => <article className="converter-chapter" key={`${index}-${chapter.title}`}><div className="converter-chapter-head"><strong>内容单元 {index + 1}</strong><div className="form-actions"><button className="secondary-button" type="button" onClick={() => mergePrevious(index)} disabled={index === 0}>合并上一篇</button><button className="secondary-button" type="button" onClick={() => splitChapter(index)}>拆分当前</button><button className="danger-button" type="button" onClick={() => removeChapter(index)}>删除</button></div></div><label>文章标题<input value={chapter.title} onChange={(event) => updateChapter(index, { title: event.target.value })} /></label><label>原文<textarea rows={9} value={chapter.sourceText} onChange={(event) => updateChapter(index, { sourceText: event.target.value })} /></label><label>已有译文<textarea rows={5} value={chapter.translationText} onChange={(event) => updateChapter(index, { translationText: event.target.value })} placeholder="没有现成译文时保持为空，不会自动覆盖。" /></label></article>)}
        </section>
      </main>
      {settingsOpen && <SettingsModal
        activeProfileId={settings.activeProfileId}
        aiProfiles={settings.aiProfiles}
        aiProvider={settings.aiProvider}
        aiRequest={settings.aiRequest}
        aiTestResult={settings.aiTestResult}
        discoveredModels={settings.models}
        modelDraft={settings.modelDraft}
        onActivateProfile={() => void settings.activateAiProfile()}
        onAddModel={settings.addModel}
        onChatModelChange={(chatModel) => settings.setAiProvider({ ...settings.aiProvider, chatModel })}
        onClose={() => setSettingsOpen(false)}
        onCreateProfile={settings.createAiProfile}
        onDefaultModelChange={(translationModel) => settings.setAiProvider({ ...settings.aiProvider, translationModel })}
        onDeleteProfile={() => setPendingProfileDelete(true)}
        onDiscoverModels={() => void settings.discoverModels()}
        onDiscardAiChanges={() => {
          const savedProfile = settings.aiProfiles.find((profile) => profile.id === settings.aiProvider.id);
          if (savedProfile) {
            settings.setAiProvider(savedProfile);
            settings.setSavedModels(savedProfile.models);
          }
          setSettingsOpen(false);
        }}
        onModelDraftChange={settings.setModelDraft}
        onProfileChange={settings.setAiProvider}
        onSavedModelsChange={settings.setSavedModels}
        onSaveAi={settings.saveAiProvider}
        onSelectProfile={settings.selectAiProfile}
        onTestAi={() => void settings.testAiProvider()}
        savedModels={settings.savedModels}
        settingsError={settings.settingsError}
      />}
      {pendingProfileDelete && <ConfirmDeleteModal
        title="删除 AI 模型配置"
        message={<>确定删除当前 AI 模型配置吗？删除后需要重新填写 URL、Key 和模型。</>}
        onClose={() => setPendingProfileDelete(false)}
        onConfirm={() => { setPendingProfileDelete(false); void settings.removeAiProfile(); }}
      />}      {recognitionPath && <PhotoImportModal aiConfigured={settings.aiConfigured} mode="batch" initialPaths={[recognitionPath]} currentBookTitle={title || "新书"} currentBookLanguage={language} onClose={() => setRecognitionPath(null)} onDraft={applyRecognizedDraft} />}
    </div>
  );
}
