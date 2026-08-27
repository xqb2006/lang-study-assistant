import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { Download, FileUp } from "lucide-react";
import { useState } from "react";
import { FloatingWindow } from "../../components/FloatingWindow";
import { appInvoke, isTauri } from "../../services/appInvoke";
import { supportedLanguages, type ContentLanguage } from "../languages";
import {
  createBookContentPackage,
  createEpubBytes,
  readBookContentFile,
  type BookContentPackage,
} from "./bookContentPackage";

export type BookContentTarget = {
  id: number;
  title: string;
  language: ContentLanguage;
};

type ExportedBookContent = {
  title: string;
  author: string;
  description: string;
  language: string;
  chapters: { title: string; sourceText: string; translationText: string }[];
};

function safeFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ") || "reading-book";
}

export function BookContentPackageModal({
  mode,
  targetBook,
  onClose,
  onImported,
}: {
  mode: "import" | "export";
  targetBook?: BookContentTarget;
  onClose: () => void;
  onImported: (articleIds: number[]) => void;
}) {
  const [packageDraft, setPackageDraft] = useState<BookContentPackage | null>(null);
  const [selectedChapterIndexes, setSelectedChapterIndexes] = useState<Set<number>>(new Set());
  const [duplicateChapterIndexes, setDuplicateChapterIndexes] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [includeTranslations, setIncludeTranslations] = useState(true);

  const chooseFile = async () => {
    if (!isTauri) {
      setMessage("阅读包导入仅在桌面程序中可用。");
      return;
    }
    try {
      const path = await open({ multiple: false, filters: [{ name: "阅读学习助手阅读包", extensions: ["readingbook"] }] });
      if (!path || Array.isArray(path)) return;
      const next = await readBookContentFile(path);
      let duplicateIndexes = new Set<number>();
      if (targetBook) {
        try {
          const result = await appInvoke<{ duplicateIndexes: number[] }>("preview_book_chapter_duplicates", {
            input: { bookId: targetBook.id, chapters: next.chapters },
          });
          duplicateIndexes = new Set(result.duplicateIndexes);
        } catch {
          setMessage("阅读包已读取，但未能完成重复预检；你仍可确认导入。");
        }
      }
      setPackageDraft(next);
      setDuplicateChapterIndexes(duplicateIndexes);
      setSelectedChapterIndexes(new Set(next.chapters.map((_, index) => index).filter((index) => !duplicateIndexes.has(index))));
      setMessage(`已读取《${next.book.title}》，共 ${next.chapters.length} 个章节。${duplicateIndexes.size ? `检测到 ${duplicateIndexes.size} 个重复章节，已默认跳过。` : ""}`);
    } catch (error) {
      setMessage(`读取阅读包失败：${String(error)}`);
    }
  };

  const submitImport = async () => {
    if (!packageDraft || isWorking) return;
    if (!targetBook && !packageDraft.book.title.trim()) {
      setMessage("请先填写书名。");
      return;
    }
    const chapters = packageDraft.chapters.filter((_, index) => selectedChapterIndexes.has(index));
    if (!chapters.length) {
      setMessage("请至少选择一个要导入的章节。");
      return;
    }
    setIsWorking(true);
    setMessage("");
    try {
      const result = await appInvoke<{ articleIds: number[] }>("import_book_chapters", {
        input: {
          bookId: targetBook?.id,
          title: targetBook?.title ?? packageDraft.book.title,
          author: packageDraft.book.author,
          description: packageDraft.book.description,
          language: targetBook?.language ?? packageDraft.book.language,
          autoTranslate: false,
          chapters,
        },
      });
      onImported(result.articleIds);
    } catch (error) {
      setMessage(`导入失败：${String(error)}`);
    } finally {
      setIsWorking(false);
    }
  };

  const toggleChapter = (index: number) => {
    setSelectedChapterIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const renameChapter = (index: number, title: string) => {
    setPackageDraft((current) => current ? {
      ...current,
      chapters: current.chapters.map((chapter, chapterIndex) => chapterIndex === index ? { ...chapter, title } : chapter),
    } : current);
  };

  const updateBook = (update: Partial<BookContentPackage["book"]>) => {
    setPackageDraft((current) => current ? { ...current, book: { ...current.book, ...update } } : current);
  };

  const exportBook = async (format: "readingbook" | "epub") => {
    if (!targetBook || isWorking) return;
    if (!isTauri) {
      setMessage("本地书籍导出仅在桌面程序中可用。");
      return;
    }
    setIsWorking(true);
    setMessage("");
    try {
      const content = await appInvoke<ExportedBookContent>("export_book_content", { id: targetBook.id });
      const packageData = createBookContentPackage(content);
      if (!packageData.chapters.length) throw new Error("该书没有可导出的章节。");
      const path = await save(format === "readingbook" ? {
        defaultPath: `${safeFileName(packageData.book.title)}.readingbook`,
        filters: [{ name: "阅读助手书籍包", extensions: ["readingbook"] }],
      } : {
        defaultPath: `${safeFileName(packageData.book.title)}.epub`,
        filters: [{ name: "EPUB 电子书", extensions: ["epub"] }],
      });
      if (!path) return;
      if (format === "readingbook") {
        await writeTextFile(path, JSON.stringify(packageData, null, 2));
        setMessage("书籍内容包导出完成；其中不包含高亮、词卡、笔记和学习记录。");
      } else {
        await writeFile(path, await createEpubBytes(packageData, includeTranslations));
        setMessage(`EPUB 导出完成${includeTranslations ? "，已附带保存的译文。" : "，仅包含原文。"}`);
      }
    } catch (error) {
      setMessage(`导出失败：${String(error)}`);
    } finally {
      setIsWorking(false);
    }
  };

  const title = mode === "export"
    ? `导出《${targetBook?.title ?? "书籍"}》`
    : targetBook ? `导入阅读包到《${targetBook.title}》` : "导入阅读包";
  return (
    <FloatingWindow title={title} onClose={onClose} size="wide">
      <section className="book-import-form">
        {mode === "export" ? (
          <>
            <p className="modal-copy">导出的 .readingbook 和 EPUB 仅包含书籍信息、章节、正文和可选已保存译文，不包含高亮、单词卡片、笔记、学习进度或答题记录。</p>
            <label className="book-export-option"><input type="checkbox" checked={includeTranslations} onChange={(event) => setIncludeTranslations(event.target.checked)} />导出 EPUB 时附带已保存译文</label>
            <div className="form-actions">
              <button className="cancel-button" type="button" onClick={onClose}>取消</button>
              <button className="secondary-button" type="button" disabled={isWorking} onClick={() => void exportBook("epub")}><Download size={16} />{isWorking ? "正在导出…" : "导出 EPUB"}</button>
              <button className="primary-button" type="button" disabled={isWorking} onClick={() => void exportBook("readingbook")}><Download size={16} />{isWorking ? "正在导出…" : "导出 .readingbook"}</button>
            </div>
          </>
        ) : (
          <>
            <p className="modal-copy">主程序只接收 `.readingbook` 阅读包，保证导入结果中的原文、已有译文和题目结构已经校对。TXT、EPUB、Word、PDF、图片等原始文件请先在“阅读内容转换器”中整理并导出阅读包。</p>
            <div className="panel-actions">
              <button className="secondary-button" type="button" disabled={isWorking} onClick={() => void chooseFile()}><FileUp size={16} />选择 .readingbook</button>
            </div>            {packageDraft && (
              <div className="import-preview">
                <b>{packageDraft.book.title}</b>
                <span>{packageDraft.book.author || "未填写作者"}</span>
                <span>{packageDraft.chapters.length} 个章节</span>
                <small>{targetBook ? `将追加到《${targetBook.title}》，不会修改该书信息。` : "将创建一本新书；导入过程不自动翻译。"}</small>
              </div>
            )}
            {packageDraft && !targetBook && (
              <div className="form-grid book-content-metadata">
                <label>书名<input value={packageDraft.book.title} onChange={(event) => updateBook({ title: event.target.value })} /></label>
                <label>学习语言<select value={packageDraft.book.language} onChange={(event) => updateBook({ language: event.target.value as ContentLanguage })}>{supportedLanguages.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}</select></label>
                <label>作者（可选）<input value={packageDraft.book.author} onChange={(event) => updateBook({ author: event.target.value })} /></label>
                <label>书籍简介（可选）<textarea rows={2} value={packageDraft.book.description} onChange={(event) => updateBook({ description: event.target.value })} /></label>
              </div>
            )}
            {packageDraft && (
              <div className="book-content-chapter-list">
                {packageDraft.chapters.map((chapter, index) => (
                  <label className={`book-content-chapter-row ${duplicateChapterIndexes.has(index) ? "duplicate" : ""}`} key={`${index}-${chapter.title}`}>
                    <input type="checkbox" checked={selectedChapterIndexes.has(index)} onChange={() => toggleChapter(index)} />
                    <span>{index + 1}</span>
                    <input value={chapter.title} onChange={(event) => renameChapter(index, event.target.value)} aria-label={`章节 ${index + 1} 标题`} />
                    <small>{duplicateChapterIndexes.has(index) ? "疑似重复（默认跳过）" : `${chapter.sourceText.length} 字符`}</small>
                  </label>
                ))}
              </div>
            )}
            <div className="form-actions">
              <button className="cancel-button" type="button" onClick={onClose}>取消</button>
              <button className="primary-button" type="button" disabled={!packageDraft || !selectedChapterIndexes.size || isWorking} onClick={() => void submitImport()}>{isWorking ? "正在导入…" : targetBook ? `确认追加 ${selectedChapterIndexes.size} 个章节` : `确认导入 ${selectedChapterIndexes.size} 个章节`}</button>
            </div>
          </>
        )}
        {message && <p className="settings-feedback">{message}</p>}
      </section>
    </FloatingWindow>
  );
}
