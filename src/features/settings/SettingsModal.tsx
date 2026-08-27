import { lazy, Suspense, type FormEvent } from "react";
import { FloatingWindow } from "../../components/FloatingWindow";
import { settingsT, type DisplayLanguage } from "../../i18n/ui";
import type { AiConnectionTestResult, AiProviderProfile } from "../ai/types";

const AiModelEditor = lazy(async () => {
  const module = await import("../ai/AiModelEditor");
  return { default: module.AiModelEditor };
});
const AiProfileControls = lazy(async () => {
  const module = await import("../ai/AiProfileControls");
  return { default: module.AiProfileControls };
});

type SettingsModalProps = {
  activeProfileId: string;
  analysisCacheLimit?: number;
  aiProfiles: AiProviderProfile[];
  aiProvider: AiProviderProfile;
  aiRequest: "discover" | "test" | null;
  aiTestResult: AiConnectionTestResult | null;
  discoveredModels: string[];
  modelDraft: string;
  onActivateProfile: () => void;
  onAnalysisCacheLimitChange?: (value: number) => void;
  onAddModel: () => void;
  onClose: () => void;
  onCreateProfile: () => void;
  onDefaultModelChange: (model: string) => void;
  onDeleteProfile: () => void;
  onDiscoverModels: () => void;
  onDiscardAiChanges: () => void;
  onModelDraftChange: (value: string) => void;
  onProfileChange: (profile: AiProviderProfile) => void;
  onSavedModelsChange: (models: string[]) => void;
  onSaveAi: (event: FormEvent) => void;
  onSelectProfile: (profileId: string) => void;
  onTestAi: () => void;
  onChatModelChange: (model: string) => void;
  savedModels: string[];
  settingsError: string;
  displayLanguage?: DisplayLanguage;
};

function Loading({ language }: { language: DisplayLanguage }) {
  return <p className="settings-feedback">{settingsT(language, "loading")}</p>;
}

export function SettingsModal({
  activeProfileId,
  analysisCacheLimit = 300,
  aiProfiles,
  aiProvider,
  aiRequest,
  aiTestResult,
  discoveredModels,
  modelDraft,
  onActivateProfile,
  onAnalysisCacheLimitChange = () => undefined,
  onAddModel,
  onChatModelChange,
  onClose,
  onCreateProfile,
  onDefaultModelChange,
  onDeleteProfile,
  onDiscoverModels,
  onDiscardAiChanges,
  onModelDraftChange,
  onProfileChange,
  onSavedModelsChange,
  onSaveAi,
  onSelectProfile,
  onTestAi,
  savedModels,
  settingsError,
  displayLanguage = "zh-CN",
}: SettingsModalProps) {
  const removeModel = (model: string) => {
    const nextModels = savedModels.filter((item) => item !== model);
    onSavedModelsChange(nextModels);
    onProfileChange({
      ...aiProvider,
      translationModel: aiProvider.translationModel === model ? nextModels[0] || "" : aiProvider.translationModel,
      chatModel: aiProvider.chatModel === model ? "" : aiProvider.chatModel,
    });
  };

  return (
    <FloatingWindow title={settingsT(displayLanguage, "title")} onClose={onClose} size="wide">
      <div className="settings-stack">
        {settingsError && <p className="settings-feedback">{settingsError}</p>}
        <form onSubmit={onSaveAi}>
          <h3>{settingsT(displayLanguage, "heading")}</h3>
          <p className="modal-copy">{settingsT(displayLanguage, "hint")}</p>
          <Suspense fallback={<Loading language={displayLanguage} />}>
            <AiProfileControls
              profiles={aiProfiles}
              selectedProfileId={aiProvider.id}
              activeProfileId={activeProfileId}
              onSelect={onSelectProfile}
              onCreate={onCreateProfile}
              onActivate={onActivateProfile}
              onDelete={onDeleteProfile}
              displayLanguage={displayLanguage}
            />
          </Suspense>
          <label>
            {settingsT(displayLanguage, "profileName")}
            <input
              value={aiProvider.name}
              onChange={(event) => onProfileChange({ ...aiProvider, name: event.target.value })}
              placeholder={settingsT(displayLanguage, "profileNamePlaceholder")}
              required
            />
          </label>
          <label>
            {settingsT(displayLanguage, "baseUrl")}
            <input
              value={aiProvider.baseUrl}
              onChange={(event) => onProfileChange({ ...aiProvider, baseUrl: event.target.value })}
              placeholder="https://api.example.com/v1"
              required
            />
          </label>
          <label>
            {settingsT(displayLanguage, "apiKey")}
            <input
              type="text"
              value={aiProvider.apiKey}
              onChange={(event) => onProfileChange({ ...aiProvider, apiKey: event.target.value })}
              required
              autoComplete="new-password"
            />
          </label>
          <Suspense fallback={<Loading language={displayLanguage} />}>
            <AiModelEditor
              profile={aiProvider}
              savedModels={savedModels}
              discoveredModels={discoveredModels}
              modelDraft={modelDraft}
              request={aiRequest}
              testResult={aiTestResult}
              onDraftChange={onModelDraftChange}
              onDiscover={onDiscoverModels}
              onTest={onTestAi}
              onAdd={onAddModel}
              onRemove={removeModel}
              onDefaultChange={onDefaultModelChange}
              onChatChange={onChatModelChange}
              displayLanguage={displayLanguage}
            />
          </Suspense>
          <div className="form-actions">
            <button className="cancel-button" type="button" onClick={onDiscardAiChanges}>{settingsT(displayLanguage, "close")}</button>
            <button className="primary-button">{settingsT(displayLanguage, "saveCurrent")}</button>
          </div>
        </form>
        <section className="settings-panel">
          <h3>语境解析缓存</h3>
          <p className="modal-copy">已解析过的文章位置会优先复用本地缓存；超过容量时会自动淘汰最早的缓存。设置为 0 可关闭缓存。</p>
          <label>
            最大缓存条数
            <input type="number" min="0" max="2000" value={analysisCacheLimit} onChange={(event) => onAnalysisCacheLimitChange(Number(event.target.value) || 0)} />
          </label>
        </section>
      </div>
    </FloatingWindow>
  );
}

