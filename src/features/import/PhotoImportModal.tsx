import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { FloatingWindow } from "../../components/FloatingWindow";
import { importRuntimeT, importT, type DisplayLanguage } from "../../i18n/ui";
import { appInvoke, isTauri } from "../../services/appInvoke";
import {
  createAppResourceCacheSession,
  removeAppResourceCacheSession,
  writeAppResourceCacheBinaryFile,
} from "../../services/localFileService";
import { detectContentLanguage, languageLabel, type ContentLanguage } from "../languages";
import {
  collectRecognitionResults,
  collectHandwritingReviewPages,
  mergeVisualTocEntries,
  createChapterPhotoDraft,
  createLocalOcrPageResult,
  createRecognitionBatches,
} from "./recognition";
import { processImportImage, readImportImage } from "./imageProcessing";
import { recognizeWithLocalOcr } from "./localOcr";
import { PhotoImportQueue } from "./PhotoImportQueue";
import { PhotoImportReviewFields } from "./PhotoImportReviewFields";
import { PhotoRecognitionControls } from "./PhotoRecognitionControls";
import type {
  ChapterPhotoDraft,
  QuestionDraft,
  ReadingPhoto,
  UnifiedImportResult,
  VisualTocEntry,
} from "./types";

function yieldToUi() {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    window.setTimeout(resolve, 0);
  });
}

export function PhotoImportModal({
  aiConfigured,
  onClose,
  onDraft,
  currentBookTitle,
  currentBookLanguage,
  displayLanguage = "zh-CN",
  mode = "chapter",
  initialPaths = [],
}: {
  aiConfigured: boolean;
  onClose: () => void;
  onDraft: (draft: ChapterPhotoDraft) => void;
  currentBookTitle: string;
  currentBookLanguage: ContentLanguage;
  displayLanguage?: DisplayLanguage;
  mode?: "chapter" | "batch";
  initialPaths?: string[];
}) {
  const isBatchImport = mode === "batch";
  const [photos, setPhotos] = useState<ReadingPhoto[]>([]);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const loadedInitialPathsRef = useRef("");
  const [chapterTitle, setChapterTitle] = useState("第 1 章");
  const [translate, setTranslate] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [translationText, setTranslationText] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionProgress, setRecognitionProgress] = useState({ current: 0, total: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [questionDrafts, setQuestionDrafts] = useState<QuestionDraft[]>([]);
  const [handwritingReviewPages, setHandwritingReviewPages] = useState<number[]>([]);
  const [archivedResults, setArchivedResults] = useState<UnifiedImportResult[]>([]);
  const [archivedPageCount, setArchivedPageCount] = useState(0);
  const [assembledChapterDrafts, setAssembledChapterDrafts] = useState<ChapterPhotoDraft["chapterDrafts"]>([]);
  const [pendingPdfSegment, setPendingPdfSegment] = useState<{ path: string; totalPages: number; nextPage: number } | null>(null);
  const [pdfTocReview, setPdfTocReview] = useState<{ path: string; totalPages: number; entries: VisualTocEntry[] } | null>(null);
  const [confirmedPdfTocEntries, setConfirmedPdfTocEntries] = useState<VisualTocEntry[]>([]);
  const [useLocalOcr, setUseLocalOcr] = useState(false);
  const cancelRecognitionRef = useRef(false);
  const pdfCacheDirectoryRef = useRef<string | null>(null);
  const pdfCacheFileIndexRef = useRef(0);
  const clearPdfPageCache = async () => {
    const cacheDirectory = pdfCacheDirectoryRef.current;
    pdfCacheDirectoryRef.current = null;
    pdfCacheFileIndexRef.current = 0;
    if (!cacheDirectory) return;
    try {
      await removeAppResourceCacheSession(cacheDirectory);
    } catch (error) {
      console.warn("Failed to remove PDF OCR cache", error);
    }
  };
  const cachePdfPages = async <Page extends { imageData: string; ocrImageData?: string }>(pages: Page[]) => {
    if (!pages.length) return pages.map(({ ocrImageData: _ocrImageData, ...page }) => ({ ...page, localPath: undefined }));
    const cacheDirectory = pdfCacheDirectoryRef.current ?? await createAppResourceCacheSession("pdf-ocr");
    pdfCacheDirectoryRef.current = cacheDirectory;
    return Promise.all(pages.map(async ({ ocrImageData, ...page }) => {
      const fileIndex = pdfCacheFileIndexRef.current++;
      const ocrSource = ocrImageData ?? page.imageData;
      const bytes = new Uint8Array(await (await fetch(ocrSource)).arrayBuffer());
      const extension = ocrSource.startsWith("data:image/png") ? "png" : "jpg";
      const localPath = await writeAppResourceCacheBinaryFile(cacheDirectory, `page-${fileIndex}.${extension}`, bytes);
      return { ...page, localPath };
    }));
  };
  useEffect(() => () => {
    void clearPdfPageCache();
  }, []);
  const closeImport = () => {
    void clearPdfPageCache();
    onClose();
  };
  const addPhotos = (added: ReadingPhoto[]) => {
    setPhotos((current) => [...current, ...added]);
    setOrderConfirmed(false);
  };
  const appendImportFiles = async (paths: string[]) => {
    if (!paths.length) return;
    try {
      const added: ReadingPhoto[] = [];
      for (const [index, path] of paths.entries()) {
        if (path.toLowerCase().endsWith(".pdf")) {
          setMessage(importRuntimeT(displayLanguage, "readingPdf", { current: index + 1, total: paths.length }));
          const { getPdfPageCount, renderPdfPages } = await import("../../documentTools");
          const bytes = await readFile(path);
          const totalPages = await getPdfPageCount(bytes);
          const endPage = Math.min(totalPages, 15);
          const renderedPages = await renderPdfPages(path, bytes, { startPage: 1, endPage, ocrScale: 2.2 });
          const cachedPages = await cachePdfPages(renderedPages);
          added.push(...cachedPages.map((page) => ({ ...page, sourcePageNumber: page.pageNumber, rotation: 0, status: "waiting" as const })));
          setPdfTocReview({ path, totalPages, entries: [] });
          setConfirmedPdfTocEntries([]);
          setPendingPdfSegment(null);
        } else {
          added.push({
            id: `${Date.now()}-${index}`,
            name: path.split(/[\\/]/).pop() ?? "imported-file",
            imageData: await processImportImage(await readImportImage(path)),
            localPath: path,
            rotation: 0,
            status: "waiting",
          });
        }
      }
      addPhotos(added);
      setMessage(importRuntimeT(displayLanguage, "pagesAdded", { count: added.length }));
    } catch (error) {
      setMessage(importRuntimeT(displayLanguage, "readFailed", { error: String(error) }));
    }
  };
  const loadNextPdfSegment = async () => {
    if (!pendingPdfSegment || isRecognizing) return;
    if (photos.some((photo) => photo.status !== "done")) {
      setMessage("请先完成当前 PDF 页面的识别，再读取下一批页面，避免遗漏或重复。 ");
      return;
    }
    try {
      const currentResults = collectRecognitionResults(createRecognitionBatches(photos));
      const allResults = [...archivedResults, ...currentResults];
      setArchivedResults(allResults);
      setArchivedPageCount((count) => count + photos.length);
      applyRecognitionDraft(allResults);
      await clearPdfPageCache();
      const { renderPdfPages } = await import("../../documentTools");
      const endPage = Math.min(pendingPdfSegment.totalPages, pendingPdfSegment.nextPage + 29);
      const renderedPages = await renderPdfPages(pendingPdfSegment.path, await readFile(pendingPdfSegment.path), { startPage: pendingPdfSegment.nextPage, endPage, ocrScale: 2.2 });
      const cachedPages = await cachePdfPages(renderedPages);
      setPhotos(cachedPages.map((page) => ({ ...page, sourcePageNumber: page.pageNumber, rotation: 0, status: "waiting" as const })));
      setOrderConfirmed(false);
      setPendingPdfSegment(endPage < pendingPdfSegment.totalPages ? { ...pendingPdfSegment, nextPage: endPage + 1 } : null);
      setMessage(`已读取 PDF 第 ${pendingPdfSegment.nextPage}–${endPage} 页；已识别的前页会保留在当前校对结果中。`);
    } catch (error) {
      setMessage(`读取下一批 PDF 页面失败：${String(error)}`);
    }
  };
  const extractPdfToc = async () => {
    if (!pdfTocReview || isRecognizing) return;
    if (!useLocalOcr && !aiConfigured) {
      setMessage(importRuntimeT(displayLanguage, "configureAi"));
      return;
    }
    setIsRecognizing(true);
    setRecognitionProgress({ current: 0, total: createRecognitionBatches(photos).length });
    setMessage("正在提取 PDF 目录，请稍候…");
    try {
      const tocEntries: VisualTocEntry[] = [];
      const batches = createRecognitionBatches(photos);
      for (const [index, batch] of batches.entries()) {
        setRecognitionProgress({ current: index + 1, total: batches.length });
        const result = await recognizeBatch(batch, mergeVisualTocEntries(tocEntries));
        tocEntries.push(...(result.tocEntries ?? []));
      }
      const entries = mergeVisualTocEntries(tocEntries);
      setPdfTocReview((current) => current ? { ...current, entries } : current);
      setMessage(entries.length ? `已提取 ${entries.length} 个目录条目，请确认后再读取正文。` : "未识别到目录条目；可手动补充，或确认后继续读取正文。");
    } catch (error) {
      setMessage(`提取 PDF 目录失败：${String(error)}`);
    } finally {
      setIsRecognizing(false);
    }
  };
  const updatePdfTocEntry = (index: number, update: Partial<VisualTocEntry>) => {
    setPdfTocReview((current) => current ? {
      ...current,
      entries: current.entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...update } : entry),
    } : current);
  };
  const confirmPdfToc = async () => {
    if (!pdfTocReview || isRecognizing) return;
    const entries = mergeVisualTocEntries(pdfTocReview.entries);
    setIsRecognizing(true);
    setMessage("目录已确认，正在读取正文页…");
    try {
      await clearPdfPageCache();
      const { renderPdfPages } = await import("../../documentTools");
      const endPage = Math.min(pdfTocReview.totalPages, 30);
      const renderedPages = await renderPdfPages(pdfTocReview.path, await readFile(pdfTocReview.path), { startPage: 1, endPage, ocrScale: 2.2 });
      const cachedPages = await cachePdfPages(renderedPages);
      setPhotos(cachedPages.map((page) => ({ ...page, sourcePageNumber: page.pageNumber, rotation: 0, status: "waiting" as const })));
      setOrderConfirmed(false);
      setArchivedResults([]);
      setArchivedPageCount(0);
      setConfirmedPdfTocEntries(entries);
      setPendingPdfSegment(endPage < pdfTocReview.totalPages ? { path: pdfTocReview.path, totalPages: pdfTocReview.totalPages, nextPage: endPage + 1 } : null);
      setPdfTocReview(null);
      setRecognitionProgress({ current: 0, total: 0 });
      setMessage(`目录已确认${entries.length ? `（${entries.length} 项）` : ""}，现在可以开始识别正文。`);
    } catch (error) {
      setMessage(`读取 PDF 正文页失败：${String(error)}`);
    } finally {
      setIsRecognizing(false);
    }
  };
  const selectImportFiles = async () => {
    if (!isTauri) {
      setMessage(importRuntimeT(displayLanguage, "desktopOnly"));
      return;
    }
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: "可识别文件", extensions: ["jpg", "jpeg", "png", "webp", "pdf"] }],
      });
      const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
      await appendImportFiles(paths);
    } catch (error) {
      setMessage(importRuntimeT(displayLanguage, "readFailed", { error: String(error) }));
    }
  };
  useEffect(() => {
    const key = initialPaths.join("\u0000");
    if (!key || loadedInitialPathsRef.current === key) return;
    loadedInitialPathsRef.current = key;
    void appendImportFiles(initialPaths);
  }, [initialPaths]);
  const updatePhoto = (id: string, update: Partial<ReadingPhoto>) =>
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === id ? { ...photo, ...update } : photo,
      ),
    );
  const movePhoto = (id: string, direction: -1 | 1) =>
    setPhotos((current) => {
      const index = current.findIndex((photo) => photo.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const rotatePhoto = async (photo: ReadingPhoto) => {
    try {
      const imageData = await processImportImage(photo.imageData, { rotation: 90 });
      updatePhoto(photo.id, {
        imageData,
        rotation: (photo.rotation + 90) % 360,
        status: "waiting",
        result: undefined,
        error: undefined,
      });
      setOrderConfirmed(false);
    } catch (error) {
      setMessage(importRuntimeT(displayLanguage, "rotateFailed", { error: String(error) }));
    }
  };
  const trimPhoto = async (photo: ReadingPhoto) => {
    try {
      const imageData = await processImportImage(photo.imageData, { trimWhitespace: true });
      updatePhoto(photo.id, {
        imageData,
        status: "waiting",
        result: undefined,
        error: undefined,
      });
      setOrderConfirmed(false);
      setMessage(importRuntimeT(displayLanguage, "trimmed", { name: photo.name }));
    } catch (error) {
      setMessage(importRuntimeT(displayLanguage, "trimFailed", { error: String(error) }));
    }
  };
  const recognizeBatch = async (batch: { photo: ReadingPhoto; pageNumber: number }[], tocContext: VisualTocEntry[] = []) => {
    batch.forEach(({ photo }) => updatePhoto(photo.id, { status: "recognizing", error: undefined }));
    await yieldToUi();
    try {
      const result = useLocalOcr
        ? await recognizeLocalOcrBatch(batch)
        : await appInvoke<UnifiedImportResult>(
          "recognize_import_document",
          { input: { pages: batch.map(({ photo, pageNumber }) => ({ pageNumber, imageData: photo.imageData })), translate, tocContext } },
        );
      batch.forEach(({ photo }) => updatePhoto(photo.id, { status: "done", result }));
      return result;
    } catch (error) {
      batch.forEach(({ photo }) => updatePhoto(photo.id, { status: "failed", error: String(error) }));
      throw error;
    }
  };
  const recognizeLocalOcrBatch = async (batch: { photo: ReadingPhoto; pageNumber: number }[]): Promise<UnifiedImportResult> => {
    if (batch.some(({ photo }) => !photo.localPath)) {
      throw new Error("本地 OCR 找不到页面缓存，请重新导入该页面。");
    }
    const pages: UnifiedImportResult[] = [];
    for (const { photo, pageNumber } of batch) {
      const localPath = photo.localPath;
      if (!localPath) throw new Error("本地 OCR 找不到页面缓存，请重新导入该页面。");
      const result = await recognizeWithLocalOcr({
        path: localPath,
        language: currentBookLanguage === "other" ? "en-US" : currentBookLanguage,
      });
      pages.push(createLocalOcrPageResult(pageNumber, result.lines));
      await yieldToUi();
    }
    return {
      documentType: "reading",
      title: "",
      paragraphs: pages.flatMap((page) => page.paragraphs),
      questions: [],
      chapterStarts: pages.flatMap((page) => page.chapterStarts ?? []),
    };
  };
  const applyRecognitionDraft = (results: UnifiedImportResult[]) => {
    const draft = createChapterPhotoDraft(results, "第 1 章");
    setQuestionDrafts(draft.questions);
    setSourceText(draft.sourceText);
    setTranslationText(draft.translationText);
    setHandwritingReviewPages(collectHandwritingReviewPages(results));
    setAssembledChapterDrafts(draft.chapterDrafts ?? []);
    if (!chapterTitle.trim() || chapterTitle === "第 1 章") setChapterTitle(draft.title);
    return draft;
  };
  const completedResults = useMemo(
    () => photos.flatMap((photo) => photo.result ? [photo.result] : []),
    [photos],
  );
  const allRecognitionResults = useMemo(() => [...archivedResults, ...completedResults], [archivedResults, completedResults]);
  const currentPdfPageRange = useMemo(() => {
    const pageNumbers = photos.map((photo) => photo.sourcePageNumber).filter((pageNumber): pageNumber is number => typeof pageNumber === "number");
    return pageNumbers.length ? `${Math.min(...pageNumbers)}–${Math.max(...pageNumbers)}` : "";
  }, [photos]);
  const detectedHandwritingPages = handwritingReviewPages.length
    ? handwritingReviewPages
    : collectHandwritingReviewPages(allRecognitionResults);
  const retryPhotoRecognition = async (photo: ReadingPhoto, pageNumber: number) => {
    if (isRecognizing) return;
    setIsRecognizing(true);
    setRecognitionProgress({ current: 0, total: 1 });
    setMessage(`正在重新识别第 ${pageNumber} 页：${photo.name}`);
    try {
      const result = await recognizeBatch([{ photo, pageNumber }], mergeVisualTocEntries([...confirmedPdfTocEntries, ...allRecognitionResults.flatMap((item) => item.tocEntries ?? [])]));
      const draft = applyRecognitionDraft([...archivedResults, ...collectRecognitionResults(createRecognitionBatches(photos), [result])]);
      setRecognitionProgress({ current: 1, total: 1 });
      setMessage(`已重新识别 ${photo.name}；当前校对内容已同步为 ${draft.sourceText ? draft.sourceText.split("\n\n").length : 0} 段内容，${draft.questions.length} 道题。`);
    } catch (error) {
      setMessage(`重新识别 ${photo.name} 失败：${String(error)}`);
    } finally {
      setIsRecognizing(false);
    }
  };
  const recognize = async () => {
    if (pdfTocReview) {
      setMessage("请先提取并确认 PDF 目录，再开始识别正文。");
      return;
    }
    if (!useLocalOcr && !aiConfigured) {
      setMessage(importRuntimeT(displayLanguage, "configureAi"));
      return;
    }
    if (!photos.length) {
      setMessage(importRuntimeT(displayLanguage, "addFiles"));
      return;
    }
    if (!orderConfirmed) {
      setMessage("请先确认队列中的图片顺序。识别会严格按当前顺序合并连续页面，顺序错误可能影响跨页内容和章节判断。");
      return;
    }
    setIsRecognizing(true);
    cancelRecognitionRef.current = false;
    const batches = createRecognitionBatches(photos);
    const pendingBatches = batches
      .map((batch) => batch.filter(({ photo }) => photo.status !== "done"))
      .filter((batch) => batch.length > 0);
    setRecognitionProgress({ current: 0, total: pendingBatches.length });
    setMessage(importRuntimeT(displayLanguage, "preparingRecognition", { count: pendingBatches.length }));
    const recognizedResults: UnifiedImportResult[] = [];
    let tocContext: VisualTocEntry[] = mergeVisualTocEntries([...confirmedPdfTocEntries, ...allRecognitionResults.flatMap((item) => item.tocEntries ?? [])]);
    let processedBatches = 0;
    let failedBatches = 0;
    for (const [index, batch] of pendingBatches.entries()) {
      if (cancelRecognitionRef.current) break;
      setRecognitionProgress({ current: index + 1, total: pendingBatches.length });
      setMessage(importRuntimeT(displayLanguage, "recognizingBatch", { current: index + 1, total: pendingBatches.length }));
      try {
        const result = await recognizeBatch(batch, tocContext);
        recognizedResults.push(result);
        tocContext = mergeVisualTocEntries([...tocContext, ...(result.tocEntries ?? [])]);
      } catch {
        failedBatches += 1;
      }
      processedBatches += 1;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
    const results = [...archivedResults, ...collectRecognitionResults(batches, recognizedResults)];
    const draft = applyRecognitionDraft(results);
    setRecognitionProgress({ current: processedBatches, total: pendingBatches.length });
    const languageNotice = draft.detectedLanguage && draft.detectedLanguage !== currentBookLanguage
      ? ` 检测到正文更接近${languageLabel(draft.detectedLanguage)}，与当前书籍的${languageLabel(currentBookLanguage)}不一致；请校对后到书架修改书籍语言。`
      : ` 正文语言：${languageLabel(draft.detectedLanguage)}（${draft.languageDetectionReason ?? "待确认"}）。`;
    const failureNotice = failedBatches ? ` ${failedBatches} 个识别页组失败，可点击失败页面的“重试”后继续校对。` : "";
    setMessage(cancelRecognitionRef.current ? `已停止识别；已完成内容已保留，可继续识别剩余页面。${failureNotice}${languageNotice}` : `识别完成：${draft.sourceText ? draft.sourceText.split("\n\n").length : 0} 段内容，${draft.questions.length} 道题。${failureNotice}请在下方校对后导入当前章节。${languageNotice}`);
    setIsRecognizing(false);
  };
  const saveBook = async (event: FormEvent) => {
    event.preventDefault();
    if (!sourceText.trim()) {
      setMessage(importRuntimeT(displayLanguage, "sourceRequired"));
      return;
    }
    setIsSaving(true);
    try {
      onDraft({
        title: chapterTitle.trim() || "第 1 章",
        sourceText,
        translationText,
        questions: questionDrafts,
        detectedLanguage: detectContentLanguage(sourceText).language,
        languageDetectionReason: detectContentLanguage(sourceText).reason,
        chapterDrafts: assembledChapterDrafts,
      });
    } catch (error) {
      setMessage(importRuntimeT(displayLanguage, "fillFailed", { error: String(error) }));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <FloatingWindow title={isBatchImport ? "识别整本书或多个章节" : importT(displayLanguage, "title")} onClose={onClose} size="wide">
      <form className="photo-import-form" onSubmit={saveBook}>
        <p className="modal-copy">
          {isBatchImport ? "已自动载入所选文件。识别完成后会合并连续页面并整理为多个章节。" : importT(displayLanguage, "intro")}
        </p>
        <div className="photo-import-actions">
          <div>
            <button
              className="secondary-button"
              type="button"
              disabled={isRecognizing}
              onClick={() => void selectImportFiles()}
            >
              {importT(displayLanguage, "selectFiles")}
            </button>
          </div>
          <span>{pendingPdfSegment || archivedPageCount > 0 ? `已归档 ${archivedPageCount} 页；当前页段 ${currentPdfPageRange || "—"}${pendingPdfSegment ? `；共 ${pendingPdfSegment.totalPages} 页` : ""}` : importT(displayLanguage, "pagesAdded", { count: photos.length })}</span>
        </div>
        <label className="checkbox-row"><input type="checkbox" checked={useLocalOcr} onChange={(event) => setUseLocalOcr(event.target.checked)} disabled={isRecognizing} />使用 Windows 本地 OCR（支持图片和扫描 PDF，不调用 AI）</label>
        {pdfTocReview && <section className="photo-import-review">
          <h3>PDF 目录确认</h3>
          <p className="modal-copy">先从前 15 页提取目录。请检查标题和印刷页码，确认后才会读取并识别正文。</p>
          <div className="form-actions">
            <button className="secondary-button" type="button" disabled={isRecognizing} onClick={() => void extractPdfToc()}>提取目录</button>
            <button className="secondary-button" type="button" disabled={isRecognizing} onClick={() => setPdfTocReview((current) => current ? { ...current, entries: [...current.entries, { title: "", printedPageNumber: 1 }] } : current)}>添加条目</button>
          </div>
          {pdfTocReview.entries.map((entry, index) => <div className="photo-import-actions" key={`${index}-${entry.title}`}>
            <input value={entry.title} placeholder="文章或章节标题" disabled={isRecognizing} onChange={(event) => updatePdfTocEntry(index, { title: event.target.value })} />
            <input type="number" min="1" value={entry.printedPageNumber} disabled={isRecognizing} onChange={(event) => updatePdfTocEntry(index, { printedPageNumber: Number(event.target.value) || 1 })} />
            <button className="danger-button" type="button" disabled={isRecognizing} onClick={() => setPdfTocReview((current) => current ? { ...current, entries: current.entries.filter((_, entryIndex) => entryIndex !== index) } : current)}>删除</button>
          </div>)}
          <button className="primary-button" type="button" disabled={isRecognizing} onClick={() => void confirmPdfToc()}>确认目录并读取正文</button>
        </section>}
        <PhotoImportQueue
          photos={photos}
          isRecognizing={isRecognizing}
          onMove={movePhoto}
          onRotate={(photo) => void rotatePhoto(photo)}
          onTrim={(photo) => void trimPhoto(photo)}
          onRetry={(photo, pageNumber) => void retryPhotoRecognition(photo, pageNumber)}
          onRemove={(photoId) => {
            setPhotos((current) => current.filter((photo) => photo.id !== photoId));
            setOrderConfirmed(false);
          }}
          displayLanguage={displayLanguage}
        />
        {photos.length > 0 && !pdfTocReview && (
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={orderConfirmed}
              disabled={isRecognizing}
              onChange={(event) => setOrderConfirmed(event.target.checked)}
            />
            我已核对图片队列顺序；识别将按当前顺序合并连续页面。
          </label>
        )}
        <PhotoImportReviewFields
          mode={mode}
          currentBookTitle={currentBookTitle}
          questionCount={questionDrafts.length}
          handwritingReviewPages={detectedHandwritingPages}
          chapterTitle={chapterTitle}
          translate={translate}
          sourceText={sourceText}
          translationText={translationText}
          onChapterTitleChange={setChapterTitle}
          onTranslateChange={setTranslate}
          onSourceTextChange={setSourceText}
          onTranslationTextChange={setTranslationText}
          displayLanguage={displayLanguage}
        />
        {!pdfTocReview && <PhotoRecognitionControls
          photoCount={photos.length}
          isRecognizing={isRecognizing}
          progress={recognitionProgress}
          message={message}
          onRecognize={() => void recognize()}
          onCancel={() => {
            cancelRecognitionRef.current = true;
            setMessage("将在当前页组完成后停止，其余页面可稍后继续识别。");
          }}
          displayLanguage={displayLanguage}
        />}
        {pendingPdfSegment && <button className="secondary-button" type="button" disabled={isRecognizing} onClick={() => void loadNextPdfSegment()}>读取下一批 PDF 页面（第 {pendingPdfSegment.nextPage}–{Math.min(pendingPdfSegment.totalPages, pendingPdfSegment.nextPage + 29)} 页）</button>}
        <div className="form-actions">
          <button className="cancel-button" type="button" onClick={closeImport}>
            {importT(displayLanguage, "cancel")}
          </button>
          <button
            className="primary-button"
            disabled={isSaving || !sourceText.trim()}
          >
            {isSaving ? "正在整理…" : isBatchImport ? "返回多章节校对" : importT(displayLanguage, "confirmImport")}
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
}
