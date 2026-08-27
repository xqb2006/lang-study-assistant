import { FloatingWindow } from "../../components/FloatingWindow";
import { displayLanguages, t, type DisplayLanguage } from "../../i18n/ui";

export function DisplayLanguageModal({
  language,
  onClose,
  onSave,
}: {
  language: DisplayLanguage;
  onClose: () => void;
  onSave: (language: DisplayLanguage) => void;
}) {
  return (
    <FloatingWindow title={t(language, "selectDisplayLanguage")} onClose={onClose}>
      <div className="book-import-form">
        <p className="modal-copy">{t(language, "displayLanguageHint")}</p>
        <label>
          {t(language, "displayLanguage")}
          <select value={language} onChange={(event) => onSave(event.target.value as DisplayLanguage)}>
            {displayLanguages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </label>
        <div className="form-actions">
          <button className="cancel-button" type="button" onClick={onClose}>{t(language, "cancel")}</button>
        </div>
      </div>
    </FloatingWindow>
  );
}
