import type { FormEvent } from "react";
import { FloatingWindow } from "../../components/FloatingWindow";
import type { BookDraft } from "./useBookImport";
import { supportedLanguages } from "../languages";
import { bookT, t, type DisplayLanguage } from "../../i18n/ui";

type BookCreationModalProps = {
  draft: BookDraft;
  isSubmitting: boolean;
  onCancel: () => void;
  onClose: () => void;
  onDraftChange: (draft: BookDraft) => void;
  projectDefaultLanguage?: BookDraft["language"];
  displayLanguage?: DisplayLanguage;
  onSaveProjectDefault?: (language: BookDraft["language"]) => void;
  onSubmit: (event: FormEvent) => void;
  onOpenPackageImport: () => void;
};

export function BookCreationModal({
  draft,
  isSubmitting,
  onCancel,
  onClose,
  onDraftChange,
  projectDefaultLanguage = "en",
  displayLanguage = "zh-CN",
  onSaveProjectDefault = () => undefined,
  onSubmit,
  onOpenPackageImport,
}: BookCreationModalProps) {
  return (
    <FloatingWindow title={bookT(displayLanguage, "createBook")} onClose={onClose}>
      <form onSubmit={onSubmit} className="book-import-form">
        <p className="modal-copy">
          {bookT(displayLanguage, "creationHint")}
        </p>
        <button className="secondary-button" type="button" onClick={onOpenPackageImport}>{bookT(displayLanguage, "importReadingPackage")}</button>
        <label>
          {bookT(displayLanguage, "bookTitle")}
          <input
            value={draft.title}
            onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
            required
          />
        </label>
        <label>
          {bookT(displayLanguage, "readingLanguage")}
          <select
            value={draft.language}
            onChange={(event) => onDraftChange({ ...draft, language: event.target.value as BookDraft["language"] })}
          >
            {supportedLanguages.map((language) => (
              <option key={language.code} value={language.code}>{language.label}</option>
            ))}
          </select>
          <span className="modal-copy">{bookT(displayLanguage, "projectDefault")}: {supportedLanguages.find((item) => item.code === projectDefaultLanguage)?.label ?? projectDefaultLanguage}<button className="text-import-button" type="button" onClick={() => onSaveProjectDefault(draft.language)}>{bookT(displayLanguage, "setProjectDefault")}</button></span>
        </label>
        <label>
          {bookT(displayLanguage, "authorOptional")}
          <input
            value={draft.author}
            onChange={(event) => onDraftChange({ ...draft, author: event.target.value })}
          />
        </label>
        <label>
          {bookT(displayLanguage, "descriptionOptional")}
          <textarea
            rows={4}
            value={draft.description}
            onChange={(event) => onDraftChange({ ...draft, description: event.target.value })}
          />
        </label>
        <div className="form-actions">
          <button className="cancel-button" type="button" onClick={onCancel}>
            {t(displayLanguage, "cancel")}
          </button>
          <button className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? bookT(displayLanguage, "creating") : bookT(displayLanguage, "createBook")}
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
}
