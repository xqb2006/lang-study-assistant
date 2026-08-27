import { useState } from "react";
import { FloatingWindow } from "../../components/FloatingWindow";
import { supportedLanguages, type ContentLanguage } from "../languages";
import { bookT, t, type DisplayLanguage } from "../../i18n/ui";

type EditableBook = {
  id: number;
  title: string;
  author: string;
  description: string;
  articleCount: number;
  language: ContentLanguage;
};

export function BookEditModal({
  book,
  onClose,
  onSave,
  displayLanguage = "zh-CN",
}: {
  book: EditableBook;
  onClose: () => void;
  onSave: (book: EditableBook) => Promise<void>;
  displayLanguage?: DisplayLanguage;
}) {
  const [draft, setDraft] = useState(book);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!draft.title.trim()) {
      setError(bookT(displayLanguage, "titleRequired"));
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await onSave({ ...draft, title: draft.title.trim() });
    } catch (value) {
      setError(`${bookT(displayLanguage, "saveFailed")}: ${String(value)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FloatingWindow title={`${bookT(displayLanguage, "editBook")} · ${book.title}`} onClose={onClose}>
      <div className="book-import-form">
        <p className="modal-copy">{bookT(displayLanguage, "editHint")}</p>
        <label>
          {bookT(displayLanguage, "bookTitle")}
          <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </label>
        <label>
          {bookT(displayLanguage, "readingLanguage")}
          <select value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value as ContentLanguage })}>
            {supportedLanguages.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
          </select>
        </label>
        <label>
          {bookT(displayLanguage, "authorOptional")}
          <input value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} />
        </label>
        <label>
          {bookT(displayLanguage, "descriptionOptional")}
          <textarea rows={5} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        </label>
        {error && <p className="settings-feedback">{error}</p>}
        <div className="form-actions">
          <button className="cancel-button" type="button" disabled={isSaving} onClick={onClose}>{t(displayLanguage, "cancel")}</button>
          <button className="primary-button" type="button" disabled={isSaving} onClick={() => void save()}>{isSaving ? bookT(displayLanguage, "saving") : bookT(displayLanguage, "saveChanges")}</button>
        </div>
      </div>
    </FloatingWindow>
  );
}
