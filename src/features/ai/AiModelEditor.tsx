import { X } from "lucide-react";
import { settingsT, type DisplayLanguage } from "../../i18n/ui";
import type { AiConnectionTestResult, AiProviderProfile } from "./types";

export function AiModelEditor({
  profile,
  savedModels,
  discoveredModels,
  modelDraft,
  request,
  testResult,
  onDraftChange,
  onDiscover,
  onTest,
  onAdd,
  onRemove,
  onDefaultChange,
  onChatChange,
  displayLanguage = "zh-CN",
}: {
  profile: AiProviderProfile;
  savedModels: string[];
  discoveredModels: string[];
  modelDraft: string;
  request: "discover" | "test" | null;
  testResult: AiConnectionTestResult | null;
  onDraftChange: (value: string) => void;
  onDiscover: () => void;
  onTest: () => void;
  onAdd: () => void;
  onRemove: (model: string) => void;
  onDefaultChange: (model: string) => void;
  onChatChange: (model: string) => void;
  displayLanguage?: DisplayLanguage;
}) {
  return (
    <>
      <div className="model-row">
        <button className="secondary-button" type="button" onClick={onDiscover} disabled={request !== null}>
          {request === "discover" ? settingsT(displayLanguage, "fetchingModels") : settingsT(displayLanguage, "refreshModels")}
        </button>
        <button className="secondary-button" type="button" onClick={onTest} disabled={request !== null}>
          {request === "test" ? settingsT(displayLanguage, "testingConnection") : settingsT(displayLanguage, "testCurrent")}
        </button>
      </div>
      {request && <p className="ai-request-status">{settingsT(displayLanguage, "requestInBackground")}</p>}
      {testResult && (
        <p className="settings-feedback">
          {settingsT(displayLanguage, "connectionSuccess", {
            model: testResult.model,
            latency: testResult.latencyMs,
            message: testResult.message || settingsT(displayLanguage, "serviceResponded"),
          })}
        </p>
      )}
      <label>
        {settingsT(displayLanguage, "addModel")}
        <input
          list="provider-models"
          value={modelDraft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={settingsT(displayLanguage, "modelPlaceholder")}
        />
      </label>
      <button className="secondary-button add-model" type="button" onClick={onAdd}>{settingsT(displayLanguage, "addAvailable")}</button>
      <datalist id="provider-models">
        {discoveredModels.map((model) => <option value={model} key={model} />)}
      </datalist>
      <div className="model-list">
        {savedModels.map((model) => (
          <span key={model}>
            {model}
            <button type="button" aria-label={settingsT(displayLanguage, "removeModel", { model })} onClick={() => onRemove(model)}><X size={13} /></button>
          </span>
        ))}
      </div>
      <label>
        {settingsT(displayLanguage, "defaultModel")}
        <select value={profile.translationModel} onChange={(event) => onDefaultChange(event.target.value)}>
          {savedModels.length
            ? savedModels.map((model) => <option value={model} key={model}>{model}</option>)
            : <option value="">{settingsT(displayLanguage, "addModelFirst")}</option>}
        </select>
      </label>
      <label>
        {settingsT(displayLanguage, "chatModelOptional")}
        <select value={profile.chatModel} onChange={(event) => onChatChange(event.target.value)}>
          <option value="">{settingsT(displayLanguage, "useDefaultModel")}</option>
          {savedModels.map((model) => <option value={model} key={model}>{model}</option>)}
        </select>
      </label>
    </>
  );
}
