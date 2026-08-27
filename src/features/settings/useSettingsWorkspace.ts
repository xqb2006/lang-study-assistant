import { FormEvent, useEffect, useState } from "react";
import { aiProviderApi } from "../ai/api";
import type { AiConnectionTestResult, AiProviderProfile, AiProviderStatus } from "../ai/types";
import { appInvoke } from "../../services/appInvoke";

const emptyProvider: AiProviderProfile = {
  id: "",
  name: "默认配置",
  baseUrl: "",
  apiKey: "",
  chatModel: "",
  translationModel: "",
  models: [],
};

type UseSettingsWorkspaceOptions = {
  setNotice: (message: string) => void;
};

export function useSettingsWorkspace({ setNotice }: UseSettingsWorkspaceOptions) {
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProviderProfile>(emptyProvider);
  const [aiProfiles, setAiProfiles] = useState<AiProviderProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [savedModels, setSavedModels] = useState<string[]>([]);
  const [modelDraft, setModelDraft] = useState("");
  const [aiRequest, setAiRequest] = useState<"discover" | "test" | null>(null);
  const [aiTestResult, setAiTestResult] = useState<AiConnectionTestResult | null>(null);
  const [activeModel, setActiveModel] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [pendingAiProfileDelete, setPendingAiProfileDelete] =
    useState<AiProviderProfile | null>(null);

  const applyAiProviderStatus = (
    status: AiProviderStatus,
    selectedProfileId = status.activeProfileId,
  ) => {
    setAiConfigured(status.configured);
    setAiProfiles(status.profiles);
    setActiveProfileId(status.activeProfileId);
    setSavedModels(status.models);
    setActiveModel(status.translationModel || status.models[0] || "");
    const selectedProfile =
      status.profiles.find((profile) => profile.id === selectedProfileId) ||
      status.profiles[0];
    if (selectedProfile) {
      setAiProvider(selectedProfile);
      setSavedModels(selectedProfile.models);
    } else {
      setAiProvider(emptyProvider);
      setSavedModels([]);
    }
  };

  useEffect(() => {
    void aiProviderApi
      .getStatus(appInvoke)
      .then(applyAiProviderStatus)
      .catch(() => setAiConfigured(false));
  }, []);


  const selectAiProfile = (profileId: string) => {
    const profile = aiProfiles.find((item) => item.id === profileId);
    if (!profile || profile.id === aiProvider.id) return;
    const savedProfile = aiProfiles.find((item) => item.id === aiProvider.id);
    const draftProfile = { ...aiProvider, models: savedModels };
    if (
      savedProfile &&
      JSON.stringify(savedProfile) !== JSON.stringify(draftProfile) &&
      !window.confirm("当前配置尚未保存，确定放弃修改并切换吗？")
    ) {
      return;
    }
    setAiProvider(profile);
    setSavedModels(profile.models);
    setModelDraft("");
    setModels([]);
    setSettingsError("");
  };

  const createAiProfile = () => {
    const profile: AiProviderProfile = {
      ...emptyProvider,
      id: `profile-${Date.now()}`,
      name: "新模型配置",
    };
    setAiProfiles((current) => [...current, profile]);
    setAiProvider(profile);
    setSavedModels([]);
    setModels([]);
    setModelDraft("");
    setSettingsError("请填写新配置的 URL、Key，并获取或添加模型后保存");
  };

  const removeAiProfile = async () => {
    try {
      const status = await aiProviderApi.deleteProfile(appInvoke, aiProvider.id);
      applyAiProviderStatus(status);
      setModels([]);
      setModelDraft("");
      setPendingAiProfileDelete(null);
      setNotice("模型配置已删除");
    } catch (error) {
      const message = String(error);
      if (message.includes("未找到")) {
        const remaining = aiProfiles.filter(
          (profile) => profile.id !== aiProvider.id,
        );
        const nextProfile = remaining[0] || emptyProvider;
        setAiProfiles(remaining);
        setAiProvider(nextProfile);
        setSavedModels(nextProfile.models);
        setModels([]);
        setModelDraft("");
        setPendingAiProfileDelete(null);
        return;
      }
      setSettingsError(`删除失败：${message}`);
    }
  };

  const saveAiProvider = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const updatedProfile = { ...aiProvider, models: savedModels };
      const status = await aiProviderApi.saveProfile(
        appInvoke,
        updatedProfile,
        false,
      );
      applyAiProviderStatus(status, updatedProfile.id);
      setSettingsError("当前模型配置已保存");
      setNotice("当前模型配置已保存");
    } catch (error) {
      setSettingsError(`保存失败：${String(error)}`);
    }
  };

  const activateAiProfile = async () => {
    try {
      const status = await aiProviderApi.activateProfile(appInvoke, aiProvider.id);
      applyAiProviderStatus(status);
      setSettingsError("已设为当前 AI 配置");
      setNotice(`已启用：${aiProvider.name}`);
    } catch (error) {
      setSettingsError(`启用失败：${String(error)}`);
    }
  };

  const discoverModels = async () => {
    if (aiRequest) return;
    setAiRequest("discover");
    try {
      const items = await aiProviderApi.discoverModels(appInvoke, {
        ...aiProvider,
        models: savedModels,
      });
      setModels(items);
      setNotice(items.length ? `已发现 ${items.length} 个模型` : "未发现可用模型");
    } catch (error) {
      setSettingsError(`获取模型失败：${String(error)}`);
    } finally {
      setAiRequest(null);
    }
  };

  const addModel = () => {
    const model = modelDraft.trim();
    if (!model) return;
    setSavedModels((current) =>
      current.includes(model) ? current : [...current, model],
    );
    setModelDraft("");
  };

  const testAiProvider = async () => {
    if (aiRequest) return;
    setAiRequest("test");
    try {
      const result = await aiProviderApi.testProvider(appInvoke, {
        ...aiProvider,
        models: savedModels,
      });
      setAiTestResult(result);
      setSettingsError("");
      setNotice(`AI 连接成功：${result.model}，耗时 ${result.latencyMs} ms`);
    } catch (error) {
      setAiTestResult(null);
      setSettingsError(`连接测试失败：${String(error)}`);
    } finally {
      setAiRequest(null);
    }
  };

  return {
    activeModel,
    activeProfileId,
    addModel,
    aiConfigured,
    aiProfiles,
    aiProvider,
    aiRequest,
    aiTestResult,
    createAiProfile,
    discoverModels,
    models,
    modelDraft,
    pendingAiProfileDelete,
    removeAiProfile,
    saveAiProvider,
    savedModels,
    selectAiProfile,
    setAiProvider,
    setActiveModel,
    setModelDraft,
    setPendingAiProfileDelete,
    setSavedModels,
    setSettingsError,
    settingsError,
    testAiProvider,
    activateAiProfile,
  };
}
