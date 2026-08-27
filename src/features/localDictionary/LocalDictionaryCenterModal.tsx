import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FloatingWindow } from "../../components/FloatingWindow";
import { Modal } from "../../components/Modal";
import { resourceT, type DisplayLanguage } from "../../i18n/ui";
import { appInvoke, isTauri } from "../../services/appInvoke";
import { localDictionaryApi } from "./api";
import { CustomDictionaryPanel, languageResourceLabel } from "./CustomDictionaryPanel";
import type { CustomDictionaryStatus, ResourceImportAnalysis, ResourceLanguage, ResourceType } from "./types";
import { useLocalDictionaryStatus } from "./useLocalDictionaryStatus";
import { normalizeResourceImportFile, normalizeWordNetDirectory, resourceImportExtensions } from "./resourceFileConversion";
import { resourceImportErrorMessage, wordNetProgressText, wordNetT } from "./wordNetUi";

const languageOptions: ResourceLanguage[] = ["zh", "en", "ja", "ko", "fr", "de", "es", "it", "pt", "ru", "ar", "other"];
const resourceTypeOptions: ResourceType[] = ["dictionary", "wordlist", "terminology", "examples"];
const resourceTypeKeys: Record<ResourceType, "typeDictionary" | "typeWordlist" | "typeTerminology" | "typeExamples"> = { dictionary: "typeDictionary", wordlist: "typeWordlist", terminology: "typeTerminology", examples: "typeExamples" };

type PendingImport = ResourceImportAnalysis & { path: string; name: string };

export function LocalDictionaryCenterModal({ onClose, displayLanguage = "zh-CN" }: { onClose: () => void; displayLanguage?: DisplayLanguage }) {
  const [installing, setInstalling] = useState<"custom" | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [pendingCustomDelete, setPendingCustomDelete] = useState<CustomDictionaryStatus | null>(null);
  const [customDeleteText, setCustomDeleteText] = useState("");
  const [isDeletingCustomDictionary, setIsDeletingCustomDictionary] = useState(false);
  const { customDictionaries, progress, message, setMessage, setProgress, refreshStatus } = useLocalDictionaryStatus(appInvoke, isTauri, displayLanguage);
  const typeLabel = (value: ResourceType) => resourceT(displayLanguage, resourceTypeKeys[value]);

  const startWordNetImport = async () => {
    if (!isTauri) return setMessage(resourceT(displayLanguage, "desktopImportOnly"));
    try {
      const path = await open({ directory: true, multiple: false });
      if (!path || Array.isArray(path)) return;
      setInstalling("custom"); setProgress({ phase: "custom", percent: 0, detail: wordNetT(displayLanguage, "analyzingDirectory") });
      const normalizedPath = await normalizeWordNetDirectory(path, (progress) => setProgress({ phase: "custom", percent: Math.round((progress.completed / progress.total) * 70), detail: wordNetProgressText(progress, displayLanguage) })); setProgress({ phase: "custom", percent: 75, detail: wordNetT(displayLanguage, "analyzingEntries") }); const analysis = await localDictionaryApi.analyzeCustom(appInvoke, normalizedPath);
      setPendingImport({ ...analysis, path: normalizedPath, name: "Princeton WordNet 3.1", lookupLanguage: "en", definitionLanguage: "en", resourceType: "dictionary" }); setProgress(null);
    } catch (error) { setMessage(wordNetT(displayLanguage, "importFailed", { error: resourceImportErrorMessage(error, displayLanguage) })); } finally { setInstalling(null); }
  };
  const startCustomDictionaryImport = async () => {
    if (!isTauri) return setMessage(resourceT(displayLanguage, "desktopImportOnly"));
    try {
      const path = await open({ multiple: false, filters: [{ name: wordNetT(displayLanguage, "resourceFileFilter"), extensions: resourceImportExtensions }] });
      if (!path || Array.isArray(path)) return;
      setInstalling("custom");
      setProgress({ phase: "custom", percent: 0, detail: resourceT(displayLanguage, "analyzingImport") });
      const normalizedPath = await normalizeResourceImportFile(path);
      const analysis = await localDictionaryApi.analyzeCustom(appInvoke, normalizedPath);
      setPendingImport({ ...analysis, path: normalizedPath, name: analysis.suggestedName });
      setProgress(null);
    } catch (error) {
      setMessage(resourceT(displayLanguage, "analysisFailed", { error: resourceImportErrorMessage(error, displayLanguage) }));
    } finally {
      setInstalling(null);
    }
  };

  const confirmCustomDictionaryImport = async () => {
    if (!pendingImport || !pendingImport.name.trim()) return;
    try {
      setInstalling("custom");
      setProgress({ phase: "custom", percent: 0, detail: resourceT(displayLanguage, "preparingImport") });
      const next = await localDictionaryApi.importCustom(appInvoke, pendingImport.path, pendingImport.name.trim(), pendingImport.lookupLanguage, pendingImport.definitionLanguage, pendingImport.resourceType);
      setPendingImport(null);
      setMessage(resourceT(displayLanguage, "customImportSucceeded", { count: next.entryCount.toLocaleString() }));
      await refreshStatus();
    } catch (error) {
      setMessage(resourceT(displayLanguage, "customImportFailed", { error: String(error) }));
    } finally {
      setInstalling(null);
    }
  };

  const renameCustomDictionary = async (dictionary: CustomDictionaryStatus) => {
    const name = window.prompt(resourceT(displayLanguage, "renamePrompt"), dictionary.name)?.trim();
    if (!name || name === dictionary.name) return;
    try {
      await localDictionaryApi.renameCustom(appInvoke, dictionary.id, name);
      setMessage(resourceT(displayLanguage, "renamedCustom", { name }));
      await refreshStatus();
    } catch (error) {
      setMessage(resourceT(displayLanguage, "renameFailed", { error: String(error) }));
    }
  };

  const toggleCustomDictionary = async (dictionary: CustomDictionaryStatus) => {
    try {
      const nextState = resourceT(displayLanguage, dictionary.enabled ? "disabled" : "enabled");
      await localDictionaryApi.setCustomEnabled(appInvoke, dictionary.id, !dictionary.enabled);
      setMessage(resourceT(displayLanguage, "resourceToggled", { name: dictionary.name, state: nextState }));
      await refreshStatus();
    } catch (error) {
      setMessage(resourceT(displayLanguage, "resourceStatusFailed", { error: String(error) }));
    }
  };

  const confirmCustomDictionaryRemoval = async () => {
    if (!pendingCustomDelete || customDeleteText.trim() !== pendingCustomDelete.name || isDeletingCustomDictionary) return;
    setIsDeletingCustomDictionary(true);
    try {
      const dictionary = pendingCustomDelete;
      await localDictionaryApi.deleteCustom(appInvoke, dictionary.id);
      setPendingCustomDelete(null);
      setCustomDeleteText("");
      setMessage(resourceT(displayLanguage, "customDeleted", { name: dictionary.name }));
      await refreshStatus();
    } catch (error) {
      setMessage(resourceT(displayLanguage, "customDeleteFailed", { error: String(error) }));
    } finally {
      setIsDeletingCustomDictionary(false);
    }
  };

  return (
    <FloatingWindow title={resourceT(displayLanguage, "title")} onClose={onClose} closeLabel={resourceT(displayLanguage, "close")}>
      <section className="dictionary-center">
        <p className="modal-copy">{resourceT(displayLanguage, "intro")}</p>
        <CustomDictionaryPanel dictionaries={customDictionaries} installing={installing === "custom"} onImport={() => void startCustomDictionaryImport()} onImportWordNet={() => void startWordNetImport()} onRename={(dictionary) => void renameCustomDictionary(dictionary)} onToggle={(dictionary) => void toggleCustomDictionary(dictionary)} onDelete={(dictionary) => { setPendingCustomDelete(dictionary); setCustomDeleteText(""); }} displayLanguage={displayLanguage} />
        {progress && <div className="dictionary-progress" aria-live="polite"><div><span>{progress.detail}</span><b>{progress.percent}%</b></div><i><em style={{ width: `${progress.percent}%` }} /></i></div>}
        {message && <p className="settings-feedback">{message}</p>}
        <div className="form-actions"><button className="cancel-button" type="button" onClick={onClose}>{resourceT(displayLanguage, "close")}</button></div>
      </section>
      {pendingImport && <Modal title={resourceT(displayLanguage, "importPreview")} layer="confirmation" closeLabel={resourceT(displayLanguage, "close")} onClose={() => setPendingImport(null)}>
        <section className="resource-import-preview">
          <p className="modal-copy">{resourceT(displayLanguage, "autoDetected")}：{pendingImport.note}</p>
          <p className="resource-analysis-summary">{resourceT(displayLanguage, "detectedEntries", { count: pendingImport.sampleCount })} · {resourceT(displayLanguage, `analysisConfidence${pendingImport.confidence[0].toUpperCase()}${pendingImport.confidence.slice(1)}` as "analysisConfidenceHigh" | "analysisConfidenceMedium" | "analysisConfidenceLow")}</p>
          <div className="resource-import-controls">
            <label className="settings-field"><span>{resourceT(displayLanguage, "customNamePrompt")}</span><input value={pendingImport.name} onChange={(event) => setPendingImport({ ...pendingImport, name: event.target.value })} autoFocus /></label>
            <label className="settings-field"><span>{resourceT(displayLanguage, "queryLanguage")}</span><select value={pendingImport.lookupLanguage} onChange={(event) => setPendingImport({ ...pendingImport, lookupLanguage: event.target.value })}>{languageOptions.map((language) => <option key={language} value={language}>{languageResourceLabel(language, displayLanguage)}</option>)}</select></label>
            <label className="settings-field"><span>{resourceT(displayLanguage, "definitionLanguage")}</span><select value={pendingImport.definitionLanguage} onChange={(event) => setPendingImport({ ...pendingImport, definitionLanguage: event.target.value })}><option value="">{resourceT(displayLanguage, "definitionUnspecified")}</option>{languageOptions.map((language) => <option key={language} value={language}>{languageResourceLabel(language, displayLanguage)}</option>)}</select></label>
            <label className="settings-field"><span>{resourceT(displayLanguage, "resourceType")}</span><select value={pendingImport.resourceType} onChange={(event) => setPendingImport({ ...pendingImport, resourceType: event.target.value as ResourceType })}>{resourceTypeOptions.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}</select></label>
          </div>
          <div className="form-actions"><button className="cancel-button" type="button" disabled={installing === "custom"} onClick={() => setPendingImport(null)}>{resourceT(displayLanguage, "close")}</button><button className="primary-button" type="button" disabled={installing === "custom" || !pendingImport.name.trim()} onClick={() => void confirmCustomDictionaryImport()}>{installing === "custom" ? resourceT(displayLanguage, "importing") : resourceT(displayLanguage, "confirmImport")}</button></div>
        </section>
      </Modal>}
      {pendingCustomDelete && <Modal title={resourceT(displayLanguage, "confirmDeleteTitle")} layer="confirmation" closeLabel={resourceT(displayLanguage, "close")} onClose={() => { setPendingCustomDelete(null); setCustomDeleteText(""); }}>
        <p className="modal-copy">{resourceT(displayLanguage, "confirmDeleteHint", { name: pendingCustomDelete.name })}</p>
        <label className="settings-field"><span>{resourceT(displayLanguage, "confirmName")}</span><input value={customDeleteText} onChange={(event) => setCustomDeleteText(event.target.value)} placeholder={pendingCustomDelete.name} autoFocus /></label>
        <div className="form-actions"><button className="cancel-button" type="button" disabled={isDeletingCustomDictionary} onClick={() => { setPendingCustomDelete(null); setCustomDeleteText(""); }}>{resourceT(displayLanguage, "close")}</button><button className="primary-button danger-button" type="button" disabled={isDeletingCustomDictionary || customDeleteText.trim() !== pendingCustomDelete.name} onClick={() => void confirmCustomDictionaryRemoval()}>{isDeletingCustomDictionary ? resourceT(displayLanguage, "deleting") : resourceT(displayLanguage, "confirmDelete")}</button></div>
      </Modal>}
    </FloatingWindow>
  );
}
