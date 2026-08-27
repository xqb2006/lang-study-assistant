import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
  FilePlus2,
  Files,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Modal } from "../../components/Modal";
import { BookEditModal } from "./BookEditModal";
import { appInvoke } from "../../services/appInvoke";
import { languageLabel, type ContentLanguage } from "../languages";
import { shelfT, t, type DisplayLanguage } from "../../i18n/ui";

type Book = {
  id: number;
  title: string;
  author: string;
  description: string;
  articleCount: number;
  language: ContentLanguage;
};

type Chapter = {
  id: number;
  bookId: number;
  title: string;
  position: number;
  articleId?: number;
};

function EmptyState({
  icon,
  text,
  detail,
}: {
  icon?: React.ReactNode;
  text: string;
  detail?: string;
}) {
  return (
    <div className="empty-state">
      {icon}
      <p>{text}</p>
      {detail && <span>{detail}</span>}
    </div>
  );
}
export function Bookshelf({
  activeArticleId,
  displayLanguage = "zh-CN",
  refreshKey,
  onOpenArticle,
  onNewBook,
  onAddChapter,
  onImportReadingPackage,
  onExportBook,
  onArticleTitleChange,
  onLibraryChanged,
}: {
  activeArticleId?: number;
  displayLanguage?: DisplayLanguage;
  refreshKey: string;
  onOpenArticle: (id: number) => void;
  onNewBook: () => void;
  onAddChapter: (book: Book) => void;
  onImportReadingPackage: (book?: Book) => void;
  onExportBook: (book: Book) => void;
  onArticleTitleChange: (articleId: number | undefined, title: string) => void;
  onLibraryChanged: () => void;
}) {
  const [books, setBooks] = useState<Book[]>([]);
  const [expandedBookId, setExpandedBookId] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [libraryError, setLibraryError] = useState("");
  const [version, setVersion] = useState(0);
  const [pendingRemoval, setPendingRemoval] = useState<{ kind: "book"; book: Book } | { kind: "chapter"; chapter: Chapter } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removalError, setRemovalError] = useState("");
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const refreshChapters = () => setVersion((value) => value + 1);
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    void appInvoke<Book[]>("get_books")
      .then((items) => {
        if (!active) return;
        setBooks(items);
        setExpandedBookId((current) =>
          current && items.some((book) => book.id === current) ? current : items[0]?.id ?? null,
        );
      })
      .catch((error) => { if (active) setLibraryError(`读取书架失败：${String(error)}`); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [refreshKey, version]);
  useEffect(() => {
    let active = true;
    if (!expandedBookId) {
      setChapters([]);
      return () => { active = false; };
    }
    void appInvoke<Chapter[]>("get_chapters", { bookId: expandedBookId })
      .then((items) => { if (active) setChapters(items); })
      .catch((error) => { if (active) setLibraryError(`读取章节失败：${String(error)}`); });
    return () => { active = false; };
  }, [expandedBookId, refreshKey, version]);
  const rename = async (chapter: Chapter) => {
    const title = window.prompt(shelfT(displayLanguage, "renamePrompt"), chapter.title)?.trim();
    if (!title || title === chapter.title) return;
    setLibraryError("");
    try {
      await appInvoke("rename_chapter", { input: { id: chapter.id, title } });
      setChapters((current) => current.map((item) => item.id === chapter.id ? { ...item, title } : item));
      onArticleTitleChange(chapter.articleId, title);
      onLibraryChanged();
      refreshChapters();
    } catch (error) {
      setLibraryError(`修改章节标题失败：${String(error)}`);
    }
  };
  const confirmRemoval = async () => {
    if (!pendingRemoval || isRemoving) return;
    setIsRemoving(true);
    setRemovalError("");
    try {
      if (pendingRemoval.kind === "chapter") {
        const { chapter } = pendingRemoval;
        await appInvoke("delete_chapter", { id: chapter.id });
        if (chapter.articleId === activeArticleId) onOpenArticle(0);
      } else {
        const { book } = pendingRemoval;
        await appInvoke("delete_book", { id: book.id });
        if (expandedBookId === book.id) setExpandedBookId(null);
        onOpenArticle(0);
      }
      setPendingRemoval(null);
      onLibraryChanged();
      refreshChapters();
    } catch (error) {
      setRemovalError(shelfT(displayLanguage, "deleteFailed", { error: String(error) }));
    } finally {
      setIsRemoving(false);
    }
  };
  const move = async (chapter: Chapter, direction: "up" | "down") => {
    setLibraryError("");
    try {
      await appInvoke("move_chapter", {
        input: { id: chapter.id, bookId: chapter.bookId, direction },
      });
      onLibraryChanged();
      refreshChapters();
    } catch (error) {
      setLibraryError(`调整章节顺序失败：${String(error)}`);
    }
  };
  const renameBook = async (book: Book) => {
    setEditingBook(book);
  };

  const saveBookEdits = async (book: Book) => {
    setLibraryError("");
    try {
      await appInvoke("update_book", {
        input: {
          id: book.id,
          title: book.title.trim(),
          author: book.author.trim(),
          description: book.description.trim(),
          language: book.language,
        },
      });
      setEditingBook(null);
      onLibraryChanged();
      refreshChapters();
    } catch (error) {
      setLibraryError(`保存书籍信息失败：${String(error)}`);
      throw error;
    }
  };

  return (
    <>
      <section className="article-list bookshelf">
      <div className="section-heading">
        <div>
          <p>{shelfT(displayLanguage, "shelf")}</p>
          <h1>{shelfT(displayLanguage, "myBooks")}</h1>
        </div>
        <div className="bookshelf-header-actions">
          <button
            className="icon-button"
            aria-label={shelfT(displayLanguage, "newBook")}
            title={shelfT(displayLanguage, "newBook")}
            onClick={onNewBook}
          >
            <FilePlus2 size={17} />
          </button>
          <button
            className="bookshelf-batch-import"
            type="button"
            aria-label={displayLanguage === "zh-CN" ? "导入阅读包" : shelfT(displayLanguage, "importChapters")}
            onClick={() => onImportReadingPackage()}
          >
            <Files size={15} />
            {displayLanguage === "zh-CN" ? "导入阅读包" : shelfT(displayLanguage, "importChapters")}
          </button>
        </div>
      </div>
      {libraryError && <p className="settings-feedback">{libraryError}</p>}
      {isLoading && <EmptyState text={shelfT(displayLanguage, "loading")} />}
      {!isLoading && !books.length && (
        <EmptyState
          icon={<BookOpen />}
          text={shelfT(displayLanguage, "empty")}
          detail={shelfT(displayLanguage, "emptyHint")}
        />
      )}
      {books.map((book) => (
        <div className="book-entry" key={book.id}>
          <div className="book-row">
            <button
              className={`book-toggle ${expandedBookId === book.id ? "expanded" : ""}`}
              onClick={() =>
                setExpandedBookId(expandedBookId === book.id ? null : book.id)
              }
            >
              <FolderOpen size={16} />
              <span>
                <b>{book.title}</b>
                <small>
                  {languageLabel(book.language)} · {book.author ? shelfT(displayLanguage, "author", { author: book.author }) : shelfT(displayLanguage, "authorMissing")} · {shelfT(displayLanguage, "chapters", { count: book.articleCount })}
                </small>
                {book.description && <em title={book.description}>{book.description}</em>}
              </span>
              <ChevronDown size={15} />
            </button>
            <div className="book-actions">
              <button
                aria-label={shelfT(displayLanguage, "editBook")}
                onClick={() => void renameBook(book)}
              >
                <Pencil size={13} />
              </button>
              <button
                aria-label={shelfT(displayLanguage, "exportBook")}
                title={shelfT(displayLanguage, "exportBook")}
                onClick={() => onExportBook(book)}
              >
                <Download size={13} />
              </button>
              <button
                aria-label={shelfT(displayLanguage, "deleteBook")}
                className="danger"
                onClick={() => { setRemovalError(""); setPendingRemoval({ kind: "book", book }); }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          {expandedBookId === book.id && (
            <div className="chapter-list">
              <button
                className="add-chapter"
                onClick={() => onAddChapter(book)}
              >
                <Plus size={14} />
                {shelfT(displayLanguage, "newChapter")}
              </button>
              <button className="add-chapter" onClick={() => onImportReadingPackage(book)}>
                <FilePlus2 size={14} />
                {displayLanguage === "zh-CN" ? "导入阅读包" : shelfT(displayLanguage, "importChapters")}
              </button>
              {chapters.map((chapter) => (
                <div
                  className={`chapter-row ${chapter.articleId === activeArticleId ? "selected" : ""}`}
                  key={chapter.id}
                >
                  <button
                    className="chapter-item"
                    disabled={!chapter.articleId}
                    onClick={() =>
                      chapter.articleId && onOpenArticle(chapter.articleId)
                    }
                  >
                    <i>{String(chapter.position).padStart(2, "0")}</i>
                    <span>{chapter.title}</span>
                  </button>
                  <div className="chapter-actions">
                    <button
                      aria-label={shelfT(displayLanguage, "moveUp")}
                      onClick={() => void move(chapter, "up")}
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      aria-label={shelfT(displayLanguage, "moveDown")}
                      onClick={() => void move(chapter, "down")}
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      aria-label={shelfT(displayLanguage, "renameChapter")}
                      onClick={() => void rename(chapter)}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      aria-label={shelfT(displayLanguage, "deleteChapter")}
                      className="danger"
                      onClick={() => { setRemovalError(""); setPendingRemoval({ kind: "chapter", chapter }); }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {!chapters.length && (
                <small className="empty-chapter">{shelfT(displayLanguage, "noChapters")}</small>
              )}
            </div>
          )}
        </div>
      ))}
      </section>
      {editingBook && (
        <BookEditModal
          book={editingBook}
          onClose={() => setEditingBook(null)}
          onSave={saveBookEdits}
          displayLanguage={displayLanguage}
        />
      )}
      {pendingRemoval && (
        <Modal title={shelfT(displayLanguage, "deleteTitle")} onClose={() => setPendingRemoval(null)}>
          <p className="modal-copy">
            {pendingRemoval.kind === "book"
              ? shelfT(displayLanguage, "deleteBookHint", { title: pendingRemoval.book.title })
              : shelfT(displayLanguage, "deleteChapterHint", { title: pendingRemoval.chapter.title })}
          </p>
          <p className="modal-copy danger-copy">{shelfT(displayLanguage, "cannotUndo")}</p>
          {removalError && <p className="settings-feedback">{removalError}</p>}
          <div className="form-actions">
            <button className="cancel-button" type="button" disabled={isRemoving} onClick={() => setPendingRemoval(null)}>{t(displayLanguage, "cancel")}</button>
            <button className="primary-button danger-button" type="button" disabled={isRemoving} onClick={() => void confirmRemoval()}>{isRemoving ? shelfT(displayLanguage, "deleting") : shelfT(displayLanguage, "confirmDelete")}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
