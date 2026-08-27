import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useEffect, useState } from "react";
import { preferenceT, type DisplayLanguage } from "../../i18n/ui";
import { appInvoke, isTauri } from "../../services/appInvoke";
import { createRedactedDiagnosticReport, type AppDiagnostics } from "./diagnosticReport";

type BackupPreview = { formatVersion: number; createdAt: string; appVersion: string; books: number; chapters: number; articles: number; cards: number; questions: number; dictionaryIncluded: boolean; customDictionaries: number; customDictionaryEntries: number; dictionarySize: number; };

function formatByteSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function downloadText(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DiagnosticsPage({ displayLanguage = "zh-CN" }: { displayLanguage?: DisplayLanguage }) {
  const [diagnostics, setDiagnostics] = useState<AppDiagnostics | null>(null);
  const [backup, setBackup] = useState<{ path: string; preview: BackupPreview } | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [includeDictionary, setIncludeDictionary] = useState(true);
  const load = async () => {
    try {
      setError("");
      setFeedback("");
      setDiagnostics(await appInvoke<AppDiagnostics>("get_app_diagnostics"));
    } catch (loadError) {
      setError(String(loadError));
    }
  };
  const exportReport = async () => {
    if (!diagnostics || isExporting) return;
    setError(""); setFeedback(""); setIsExporting(true);
    try {
      const filename = `reading-agent-diagnostics-${new Date().toISOString().slice(0, 10)}.txt`;
      const content = createRedactedDiagnosticReport(diagnostics);
      if (isTauri) {
        const path = await save({ defaultPath: filename, filters: [{ name: "Text", extensions: ["txt"] }] });
        if (!path) return;
        await writeTextFile(path, content);
      } else downloadText(content, filename);
      setFeedback(preferenceT(displayLanguage, "diagnosticsExported"));
    } catch (exportError) {
      setError(preferenceT(displayLanguage, "diagnosticsExportFailed", { error: String(exportError) }));
    } finally { setIsExporting(false); }
  };
  const exportBackup = async () => {
    if (!isTauri || isMigrating) return;
    setError(""); setFeedback(""); setIsMigrating(true);
    try {
      const path = await save({ defaultPath: `reading-agent-backup-${new Date().toISOString().slice(0, 10)}.readingbackup`, filters: [{ name: "Reading backup", extensions: ["readingbackup"] }] });
      if (!path) return;
      const preview = await appInvoke<BackupPreview>("export_learning_backup", { input: { path, includeDictionary } });
      const messageKey = preview.dictionaryIncluded ? "backupExportedWithDictionary" : "backupExported";
      setFeedback(preferenceT(displayLanguage, messageKey, { books: preview.books, chapters: preview.chapters, resources: preview.customDictionaries, entries: preview.customDictionaryEntries }));
    } catch (backupError) { setError(preferenceT(displayLanguage, "backupFailed", { error: String(backupError) })); }
    finally { setIsMigrating(false); }
  };
  const chooseBackup = async () => {
    if (!isTauri || isMigrating) return;
    setError(""); setFeedback(""); setBackup(null); setRestoreConfirmed(false); setIsMigrating(true);
    try {
      const path = await open({ multiple: false, filters: [{ name: "Reading backup", extensions: ["readingbackup"] }] });
      if (!path || Array.isArray(path)) return;
      const preview = await appInvoke<BackupPreview>("inspect_learning_backup", { input: { path } });
      setBackup({ path, preview });
    } catch (backupError) { setError(preferenceT(displayLanguage, "backupFailed", { error: String(backupError) })); }
    finally { setIsMigrating(false); }
  };
  const restoreBackup = async () => {
    if (!backup || !restoreConfirmed || isMigrating) return;
    setError(""); setFeedback(""); setIsMigrating(true);
    try {
      const result = await appInvoke<{ rollbackBackupPath: string }>("restore_learning_backup", { input: { path: backup.path } });
      setFeedback(preferenceT(displayLanguage, "backupRestored", { path: result.rollbackBackupPath }));
      window.setTimeout(() => window.location.reload(), 900);
    } catch (backupError) { setError(preferenceT(displayLanguage, "backupFailed", { error: String(backupError) })); }
    finally { setIsMigrating(false); }
  };

  useEffect(() => { void load(); }, []);
  return <section className="preferences-page diagnostics-page"><header className="preferences-head"><div><p>{preferenceT(displayLanguage, "diagnostics")}</p><h1>{preferenceT(displayLanguage, "dataHealth")}</h1></div><div className="panel-actions"><button className="secondary-button" type="button" disabled={!diagnostics || isExporting} onClick={() => void exportReport()}>{isExporting ? preferenceT(displayLanguage, "exportingDiagnostics") : preferenceT(displayLanguage, "exportDiagnostics")}</button><button className="secondary-button" type="button" onClick={() => void load()}>{preferenceT(displayLanguage, "refresh")}</button></div></header>{error && <p className="settings-feedback">{error}</p>}{feedback && <p className="settings-feedback">{feedback}</p>}{diagnostics && <div className="diagnostics-grid"><article><span>{preferenceT(displayLanguage, "appVersion")}</span><strong>v{diagnostics.appVersion}</strong></article><article><span>{preferenceT(displayLanguage, "booksChapters")}</span><strong>{diagnostics.books} / {diagnostics.chapters}</strong></article><article><span>{preferenceT(displayLanguage, "cards")}</span><strong>{diagnostics.cards}</strong></article><article><span>{preferenceT(displayLanguage, "questions")}</span><strong>{diagnostics.questions}</strong></article><article><span>{preferenceT(displayLanguage, "legacyQuestions")}</span><strong>{diagnostics.questionsWithoutOptions}</strong><small>{preferenceT(displayLanguage, "legacyQuestionsHint")}</small></article></div>}<section className="preferences-section"><div><h2>{preferenceT(displayLanguage, "backupTitle")}</h2><p className="modal-copy">{preferenceT(displayLanguage, "backupHint")}</p></div><label className="checkbox-row"><input type="checkbox" checked={includeDictionary} onChange={(event) => setIncludeDictionary(event.target.checked)} disabled={isMigrating} />{preferenceT(displayLanguage, "includeDictionary")}<small>{preferenceT(displayLanguage, "includeDictionaryHint")}</small></label><div className="panel-actions"><button className="secondary-button" type="button" disabled={!isTauri || isMigrating} onClick={() => void exportBackup()}>{preferenceT(displayLanguage, "exportBackup")}</button><button className="secondary-button" type="button" disabled={!isTauri || isMigrating} onClick={() => void chooseBackup()}>{preferenceT(displayLanguage, "selectBackup")}</button></div>{!isTauri && <p className="modal-copy">{preferenceT(displayLanguage, "desktopOnly")}</p>}{backup && <div className="diagnostics-grid"><article><span>{preferenceT(displayLanguage, "backupPreview")}</span><strong>{backup.preview.books} / {backup.preview.chapters}</strong><small>{backup.preview.cards} {preferenceT(displayLanguage, "cards")} · {backup.preview.questions} {preferenceT(displayLanguage, "questions")}</small></article><article><span>{preferenceT(displayLanguage, "backupDictionary")}</span><strong>{backup.preview.dictionaryIncluded ? preferenceT(displayLanguage, "backupDictionaryIncluded") : preferenceT(displayLanguage, "backupDictionaryNotIncluded")}</strong>{backup.preview.dictionaryIncluded && <small>{preferenceT(displayLanguage, "backupCustomResources", { resources: backup.preview.customDictionaries, entries: backup.preview.customDictionaryEntries })} · {preferenceT(displayLanguage, "backupDictionarySize", { size: formatByteSize(backup.preview.dictionarySize) })}</small>}</article><article><span>{preferenceT(displayLanguage, "backupCreated")}</span><strong>{backup.preview.createdAt}</strong><small>{backup.path}</small></article></div>} {backup && <label className="checkbox-row"><input type="checkbox" checked={restoreConfirmed} onChange={(event) => setRestoreConfirmed(event.target.checked)} />{preferenceT(displayLanguage, "restoreConfirm")}</label>} {backup && <button className="danger-button" type="button" disabled={!restoreConfirmed || isMigrating} onClick={() => void restoreBackup()}>{preferenceT(displayLanguage, "restoreBackup")}</button>}</section></section>;
}