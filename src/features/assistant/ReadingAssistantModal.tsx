import { open } from "@tauri-apps/plugin-dialog";
import { ArrowLeft, ImagePlus, Send, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FloatingWindow } from "../../components/FloatingWindow";
import { appInvoke, isTauri } from "../../services/appInvoke";
import type { Selection } from "../cards/types";
import type { ReaderParagraphContext } from "../../components/BilingualArticle";
import { resolveAssistantContextPlan } from "./assistantContext";
import { MarkdownMessage } from "./MarkdownMessage";
import {
  companionStates,
  createCompanionSpriteUrl,
  emitCompanionExpression,
  frameStyle,
  importCompanionSprite,
  createAssistantProfile,
  defaultAssistantProfile,
  loadAssistantStore,
  removeCompanionSprite,
  saveAssistantStore,
  type AssistantProfile,
  type AssistantStore,
  type CompanionState,
  type CompanionSprite,
} from "./companionAppearance";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type ReadingAssistantModalProps = {
  activeModel: string;
  aiConfigured: boolean;
  articleId: number;
  articleLanguage?: string;
  articleContent?: string;
  currentParagraph?: ReaderParagraphContext | null;
  onClose: () => void;
  selected: Selection | null;
};

const ASSISTANT_HISTORY_PREFIX = "reading-assistant-history:";

function historyKey(articleId: number, assistantId: string) {
  return `${ASSISTANT_HISTORY_PREFIX}${articleId}:${assistantId}`;
}

function loadHistory(articleId: number, assistantId: string): ChatMessage[] {
  try {
    const currentKey = historyKey(articleId, assistantId);
    const current = window.localStorage.getItem(currentKey);
    const legacy = assistantId === "default" ? window.localStorage.getItem(`${ASSISTANT_HISTORY_PREFIX}${articleId}`) : null;
    const saved = JSON.parse(current ?? legacy ?? "[]") as ChatMessage[];
    return saved
      .filter((message) => (message.role === "assistant" || message.role === "user") && typeof message.content === "string" && message.content.trim())
      .slice(-40)
      .map((message) => ({ role: message.role, content: message.content.trim().slice(0, 4000) }));
  } catch {
    return [];
  }
}
function defaultFrames(): Record<CompanionState, number> {
  return companionStates.reduce((frames, state, index) => {
    frames[state.value] = index;
    return frames;
  }, {} as Record<CompanionState, number>);
}

function updateSpriteGrid(sprite: CompanionSprite, columns: number, rows: number): CompanionSprite {
  const frameCount = columns * rows;
  const frames = companionStates.reduce((current, state) => {
    current[state.value] = Math.min(sprite.frames[state.value] ?? 0, frameCount - 1);
    return current;
  }, {} as Record<CompanionState, number>);
  return { ...sprite, columns, rows, frames };
}

export function ReadingAssistantModal({
  activeModel,
  aiConfigured,
  articleId,
  articleLanguage,
  articleContent,
  currentParagraph,
  onClose,
  selected,
}: ReadingAssistantModalProps) {
  const [assistantStore, setAssistantStore] = useState<AssistantStore>(loadAssistantStore);
  const settings = assistantStore.profiles.find((profile) => profile.id === assistantStore.activeProfileId) || assistantStore.profiles[0] || defaultAssistantProfile;
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory(articleId, settings.id));
  const [question, setQuestion] = useState("");
  const [isSelectionReferenceDismissed, setIsSelectionReferenceDismissed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [selectedState, setSelectedState] = useState<CompanionState>("idle");
  const [spriteUrl, setSpriteUrl] = useState("");
  const spritePath = settings?.sprite?.filePath || "";

  useEffect(() => {
    saveAssistantStore(assistantStore);
  }, [assistantStore]);

  useEffect(() => {
    const serializedHistory = JSON.stringify(messages.slice(-40));
    window.localStorage.setItem(historyKey(articleId, settings.id), serializedHistory);
    if (settings.id === "default") window.localStorage.setItem(`${ASSISTANT_HISTORY_PREFIX}${articleId}`, serializedHistory);
  }, [articleId, messages, settings.id]);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setSpriteUrl("");
    if (!settings.sprite) return undefined;
    void createCompanionSpriteUrl(settings.sprite)
      .then((url) => {
        objectUrl = url;
        if (active) setSpriteUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch(() => {
        if (active) setError("无法读取当前形象图，请重新导入。");
      });
    return () => {
      active = false;
      if (objectUrl && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(objectUrl);
    };
  }, [spritePath]);

  const selectionKey = `${selected?.startIndex ?? ""}:${selected?.endIndex ?? ""}:${selected?.contextSentence ?? ""}`;
  const hasSelectionReference = Boolean(selected?.contextSentence.trim()) && !isSelectionReferenceDismissed;
  const contextPlan = useMemo(() => resolveAssistantContextPlan({ question, selection: selected, selectionReferenceEnabled: hasSelectionReference, currentParagraph, articleContent }), [articleContent, currentParagraph, hasSelectionReference, question, selected]);

  useEffect(() => {
    setIsSelectionReferenceDismissed(false);
  }, [selectionKey]);

  useEffect(() => {
    if (!showSettings) emitCompanionExpression("idle");
  }, [showSettings]);

  const updateSettings = (updater: (current: AssistantProfile) => AssistantProfile) => {
    setAssistantStore((current) => ({ ...current, profiles: current.profiles.map((profile) => profile.id === settings.id ? updater(profile) : profile) }));
  };

  const switchAssistant = (profileId: string) => {
    if (profileId === settings.id) return;
    setAssistantStore((current) => ({ ...current, activeProfileId: profileId }));
    setMessages(loadHistory(articleId, profileId));
  };

  const createAssistant = () => {
    const profile = createAssistantProfile();
    setAssistantStore((current) => ({ profiles: [...current.profiles, profile], activeProfileId: profile.id }));
    setShowSettings(true);
  };

  const deleteAssistant = () => {
    if (!settings || assistantStore.profiles.length <= 1) {
      setError("至少需要保留一个助手。");
      return;
    }
    if (!window.confirm(`确定删除助手“${settings.name}”吗？该助手的人设和形象设置将被删除。`)) return;
    const remaining = assistantStore.profiles.filter((profile) => profile.id !== settings.id);
    setAssistantStore({ profiles: remaining, activeProfileId: remaining[0].id });
  };

  const importSprite = async () => {
    if (!isTauri) {
      setError("自定义形象仅支持桌面客户端，请使用阅读学习助手.exe。");
      return;
    }
    try {
      const path = await open({ multiple: false, filters: [{ name: "桌宠精灵图", extensions: ["png", "webp", "gif", "jpg", "jpeg"] }] });
      if (!path || Array.isArray(path)) return;
      const imported = await importCompanionSprite(path);
      updateSettings((current) => ({ ...current, sprite: { ...imported, columns: 3, rows: 2, frames: defaultFrames() } }));
      setSelectedState("idle");
      setError("");
    } catch (importError) {
      setError(`导入形象图失败：${String(importError)}`);
    }
  };

  const clearSprite = async () => {
    if (!settings.sprite || !window.confirm("确定移除当前桌宠形象吗？原始图片副本也会从应用数据中删除。")) return;
    const currentSprite = settings.sprite;
    updateSettings((current) => ({ ...current, sprite: null }));
    await removeCompanionSprite(currentSprite);
  };

  const ask = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isSending) return;
    if (!aiConfigured || !activeModel) {
      setError("请先在设置中添加并选择 AI 模型。");
      return;
    }
    const userMessage: ChatMessage = { role: "user", content: trimmedQuestion };
    const history = [...messages, userMessage];
    setMessages(history);
    setQuestion("");
    setError("");
    setIsSending(true);
    emitCompanionExpression("thinking");
    try {
      const result = await appInvoke<{ answer: string }>("ask_reading_assistant", { input: { question: trimmedQuestion, model: activeModel, language: articleLanguage || "en", context: contextPlan.context, contextScope: contextPlan.mode, contextIntent: contextPlan.intent, history: messages.slice(-6), assistantPersona: settings?.personaPrompt || "" } });
      setMessages((current) => [...current, { role: "assistant", content: result.answer }]);
      emitCompanionExpression("happy");
    } catch (requestError) {
      setMessages(messages);
      setError(String(requestError));
      emitCompanionExpression("idle");
    } finally {
      setIsSending(false);
    }
  };

  const activeSprite = settings.sprite;
  const frameCount = activeSprite ? activeSprite.columns * activeSprite.rows : 0;

  return (
    <FloatingWindow title={showSettings ? "桌宠设置" : settings.name} onClose={onClose}>
      <section className="reading-assistant" aria-label={showSettings ? "桌宠设置" : "AI 阅读小助手"}>
        {showSettings ? <section className="reading-assistant-settings-page" aria-label="桌宠设置页面"><div className="reading-assistant-settings-header"><div><strong>桌宠设置</strong><p>角色档案、形象、状态映射和称呼会自动保存。</p></div><button className="icon-button" type="button" aria-label="返回聊天" onClick={() => setShowSettings(false)}><ArrowLeft size={16} /></button></div><div className="assistant-profile-controls" aria-label="助手配置"><label>当前助手<select aria-label="当前助手" value={settings.id} onChange={(event) => switchAssistant(event.target.value)}>{assistantStore.profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select></label><div className="assistant-profile-actions"><button className="secondary-button" type="button" onClick={createAssistant}>新建助手</button><button className="danger-button" type="button" onClick={deleteAssistant} disabled={assistantStore.profiles.length <= 1}>删除当前</button></div></div><div className="reading-assistant-settings"><section className="assistant-persona-settings" aria-label="助手角色设定">
  <div className="companion-section-heading"><div><strong>角色设定</strong><p>直接输入这个桌宠的完整人设，身份、经历、性格、语气、称呼、习惯和禁忌都可以写在同一段里。</p></div></div>
  <label>完整角色设定<textarea rows={14} maxLength={12000} value={settings.personaPrompt} placeholder="例如：你是一只陪我学习英语的猫头鹰……" onChange={(event) => updateSettings((current) => ({ ...current, personaPrompt: event.target.value }))} /></label>
  <small>角色设定会影响桌宠的身份、语气、称呼、情绪和互动方式；不会覆盖英语学习职责、事实边界、安全规则和中文回答要求。</small>
</section><section className="companion-appearance-settings" aria-label="桌宠形象"><div className="companion-section-heading"><div><strong>桌宠形象</strong><p>导入一张精灵图，再指定每格对应的状态。透明背景 PNG 或 WebP 效果最佳。</p></div><button className="secondary-button" type="button" onClick={() => void importSprite()}><ImagePlus size={15} />导入精灵图</button></div><div className="companion-size-panel"><div><strong>桌宠大小</strong><span>{settings.size}px</span></div><input aria-label="桌宠大小" type="range" min={56} max={220} step={2} value={settings.size} onChange={(event) => updateSettings((current) => ({ ...current, size: Number(event.target.value) }))} /><small>只调整桌宠本体显示大小，不会改变精灵图裁切。</small></div><div className="companion-preview"><div className="companion-preview-stage" style={{ width: settings.size, height: settings.size }}>{spriteUrl && activeSprite ? <span className="companion-preview-sprite" style={frameStyle(activeSprite, spriteUrl, selectedState)} /> : <span className="companion-preview-fallback">{settings.avatar}</span>}</div><div><strong>实时预览</strong><p>拖动大小滑块后立即查看桌宠效果。</p></div></div>{activeSprite ? <><div className="companion-grid-fields"><label>横向格数<input type="number" min={1} max={8} value={activeSprite.columns} onChange={(event) => { const columns = Math.max(1, Math.min(8, Number(event.target.value) || 1)); updateSettings((current) => current.sprite ? { ...current, sprite: updateSpriteGrid(current.sprite, columns, current.sprite.rows) } : current); }} /></label><label>纵向格数<input type="number" min={1} max={8} value={activeSprite.rows} onChange={(event) => { const rows = Math.max(1, Math.min(8, Number(event.target.value) || 1)); updateSettings((current) => current.sprite ? { ...current, sprite: updateSpriteGrid(current.sprite, current.sprite.columns, rows) } : current); }} /></label><span>{activeSprite.fileName}</span></div><p className="companion-mapping-hint">先选择一个状态，再点击下方对应图片格。当前设置：<b>{companionStates.find((state) => state.value === selectedState)?.label}</b></p><div className="companion-state-tabs" role="group" aria-label="选择要设置的桌宠状态">{companionStates.map((state) => <button className={state.value === selectedState ? "active" : ""} type="button" key={state.value} onClick={() => setSelectedState(state.value)}>{state.label} · 第 {activeSprite.frames[state.value] + 1} 格</button>)}</div>{spriteUrl && <div className="companion-sprite-grid" style={{ gridTemplateColumns: `repeat(${activeSprite.columns}, minmax(0, 1fr))` }}>{Array.from({ length: frameCount }, (_, index) => <button className={activeSprite.frames[selectedState] === index ? "selected" : ""} type="button" aria-label={`将第 ${index + 1} 格设为${companionStates.find((state) => state.value === selectedState)?.label}`} key={index} onClick={() => updateSettings((current) => current.sprite ? { ...current, sprite: { ...current.sprite, frames: { ...current.sprite.frames, [selectedState]: index } } } : current)}><span className="companion-sprite-cell" style={frameStyle({ ...activeSprite, frames: { ...activeSprite.frames, idle: index } }, spriteUrl, "idle")} /><small>第 {index + 1} 格</small></button>)}</div>}<div className="companion-appearance-actions"><button className="danger-button" type="button" onClick={() => void clearSprite()}>移除当前形象</button></div></> : <p className="companion-empty-state">尚未导入形象图，当前使用基础图标作为桌宠外观。</p>}</section><label>桌宠称呼<input maxLength={20} value={settings.name} onChange={(event) => updateSettings((current) => ({ ...current, name: event.target.value }))} /></label></div>{error && <p className="settings-feedback">{error}</p>}</section> : <><div className="reading-assistant-toolbar"><select aria-label="切换助手" value={settings.id} onChange={(event) => switchAssistant(event.target.value)}>{assistantStore.profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select><div className="reading-assistant-toolbar-actions"><button className="icon-button" type="button" aria-label="清空对话" disabled={!messages.length || isSending} onClick={() => setMessages([])}><Trash2 size={15} /></button><button className="icon-button" type="button" aria-label="助手设置" onClick={() => setShowSettings(true)}><Settings2 size={15} /></button></div></div><div className="reading-assistant-messages" aria-live="polite">{messages.map((message, index) => <div className={`reading-assistant-message ${message.role}`} key={`${message.role}-${index}`}><MarkdownMessage content={message.content} /></div>)}{isSending && <div className="reading-assistant-message assistant"><MarkdownMessage content="正在思考…" /></div>}</div>{hasSelectionReference && <div className="reading-assistant-context-plan"><span>已引用当前句</span><button type="button" aria-label="移除当前句引用" onClick={() => setIsSelectionReferenceDismissed(true)}><X size={14} /></button></div>}<textarea className="reading-assistant-question" rows={3} maxLength={600} value={question} placeholder="输入文章学习问题…" onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void ask(); } }} />{error && <p className="settings-feedback">{error}</p>}<div className="form-actions"><button className="primary-button" type="button" aria-label="发送" disabled={isSending || !question.trim()} onClick={() => void ask()}><Send size={15} /></button></div></>}
      </section>
    </FloatingWindow>
  );
}






