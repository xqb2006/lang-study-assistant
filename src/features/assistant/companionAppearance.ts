import { appLocalDataDir } from "@tauri-apps/api/path";
import { mkdir, readFile, remove, writeFile } from "@tauri-apps/plugin-fs";

export type CompanionState = "idle" | "happy" | "thinking" | "sleepy" | "talking" | "drag";

export type CompanionSprite = {
  filePath: string;
  fileName: string;
  columns: number;
  rows: number;
  frames: Record<CompanionState, number>;
};

export type AssistantSettings = {
  avatar: string;
  name: string;
  sprite: CompanionSprite | null;
  size: number;
};

export type AssistantProfile = AssistantSettings & {
  id: string;
  personaPrompt: string;
};

export type AssistantStore = {
  profiles: AssistantProfile[];
  activeProfileId: string;
};

export const ASSISTANT_SETTINGS_KEY = "reading-assistant-helper-settings";
export const ASSISTANT_SETTINGS_UPDATED_EVENT = "reading-assistant-settings-updated";
export const ASSISTANT_EXPRESSION_EVENT = "reading-assistant-expression-updated";
export const companionStates: Array<{ value: CompanionState; label: string }> = [
  { value: "idle", label: "待机" },
  { value: "happy", label: "开心" },
  { value: "thinking", label: "思考" },
  { value: "sleepy", label: "困倦" },
  { value: "talking", label: "说话" },
  { value: "drag", label: "拖动" },
];

export const defaultAssistantSettings: AssistantSettings = {
  avatar: "\ud83d\udcda",
  name: "\u9605\u8bfb\u5c0f\u52a9\u624b",
  sprite: null,
  size: 92,
};

export const defaultAssistantProfile: AssistantProfile = {
  ...defaultAssistantSettings,
  id: "default",
  personaPrompt: "",
};

const allowedAvatars = ["📚", "🦉", "🐱", "🤖", "🧠"];
const imageExtensions = ["png", "webp", "gif", "jpg", "jpeg"];
const imageMimeTypes: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

function clampGridValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 8 ? value : fallback;
}

function clampCompanionSize(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(220, Math.max(56, Math.round(value))) : 92;
}

function normalizeSprite(value: unknown): CompanionSprite | null {
  if (!value || typeof value !== "object") return null;
  const saved = value as Partial<CompanionSprite>;
  if (typeof saved.filePath !== "string" || !saved.filePath.trim() || typeof saved.fileName !== "string") return null;
  const columns = clampGridValue(saved.columns, 3);
  const rows = clampGridValue(saved.rows, 2);
  const frameCount = columns * rows;
  const savedFrames: Partial<Record<CompanionState, number>> = saved.frames || {};
  const frames = companionStates.reduce((current, state) => {
    const index = savedFrames[state.value];
    current[state.value] = typeof index === "number" && Number.isInteger(index) && index >= 0 && index < frameCount ? index : 0;
    return current;
  }, {} as Record<CompanionState, number>);
  return { filePath: saved.filePath.trim(), fileName: saved.fileName.trim() || "自定义形象", columns, rows, frames };
}

function normalizeProfile(value: unknown, fallbackId: string): AssistantProfile | null {
  if (!value || typeof value !== "object") return null;
  const saved = value as Partial<AssistantProfile>;
  const name = typeof saved.name === "string" && saved.name.trim() ? saved.name.trim().slice(0, 20) : defaultAssistantSettings.name;
  const id = typeof saved.id === "string" && saved.id.trim() ? saved.id.trim() : fallbackId;
  const personaPrompt = typeof saved.personaPrompt === "string" ? saved.personaPrompt.trim().slice(0, 12000) : "";
  const size = clampCompanionSize(saved.size);
  return {
    id,
    avatar: allowedAvatars.includes(saved.avatar || "") ? saved.avatar! : defaultAssistantSettings.avatar,
    name,
    personaPrompt,
    sprite: normalizeSprite(saved.sprite),
    size,
  };
}

function createProfileId() {
  return globalThis.crypto?.randomUUID?.() || `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadAssistantStore(): AssistantStore {
  try {
    const saved = JSON.parse(window.localStorage.getItem(ASSISTANT_SETTINGS_KEY) || "{}");
    const profiles = Array.isArray(saved.profiles)
      ? saved.profiles.map((profile: unknown, index: number) => normalizeProfile(profile, index === 0 ? "default" : createProfileId())).filter((profile: AssistantProfile | null): profile is AssistantProfile => Boolean(profile))
      : [];
    if (profiles.length) {
      const activeProfileId = profiles.some((profile: AssistantProfile) => profile.id === saved.activeProfileId) ? saved.activeProfileId : profiles[0].id;
      return { profiles, activeProfileId };
    }
    const legacy = normalizeProfile(saved, "default") || defaultAssistantProfile;
    return { profiles: [{ ...legacy, personaPrompt: "" }], activeProfileId: legacy.id };
  } catch {
    return { profiles: [defaultAssistantProfile], activeProfileId: defaultAssistantProfile.id };
  }
}

export function saveAssistantStore(store: AssistantStore) {
  window.localStorage.setItem(ASSISTANT_SETTINGS_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(ASSISTANT_SETTINGS_UPDATED_EVENT));
}

export function loadAssistantSettings(): AssistantSettings {
  const store = loadAssistantStore();
  const active = store.profiles.find((profile) => profile.id === store.activeProfileId) || store.profiles[0] || defaultAssistantProfile;
  return { avatar: active.avatar, name: active.name, sprite: active.sprite, size: active.size };
}

export function saveAssistantSettings(settings: AssistantSettings) {
  const store = loadAssistantStore();
  const activeProfileId = store.activeProfileId;
  saveAssistantStore({
    activeProfileId,
    profiles: store.profiles.map((profile) => profile.id === activeProfileId ? { ...profile, ...settings } : profile),
  });
}

export function createAssistantProfile(): AssistantProfile {
  return { ...defaultAssistantProfile, id: createProfileId(), name: "新助手" };
}

export function emitCompanionExpression(expression: CompanionState) {
  window.dispatchEvent(new CustomEvent<CompanionState>(ASSISTANT_EXPRESSION_EVENT, { detail: expression }));
}
function extensionOf(path: string) {
  return path.split(".").pop()?.toLowerCase() || "";
}

function companionDirectory(baseDirectory: string) {
  return `${baseDirectory.replace(/[\\/]$/, "")}\\companion-appearances`;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60) || "sprite";
}

export async function importCompanionSprite(sourcePath: string): Promise<{ filePath: string; fileName: string }> {
  const extension = extensionOf(sourcePath);
  if (!imageExtensions.includes(extension)) throw new Error("仅支持 PNG、WebP、GIF、JPG 和 JPEG 图片。");
  const bytes = await readFile(sourcePath);
  if (!bytes.byteLength) throw new Error("选择的图片为空，无法导入。");
  if (bytes.byteLength > 15 * 1024 * 1024) throw new Error("形象图不能超过 15 MB。");
  const baseDirectory = await appLocalDataDir();
  const directory = companionDirectory(baseDirectory);
  await mkdir(directory, { recursive: true });
  const sourceName = sourcePath.split(/[\\/]/).pop() || `sprite.${extension}`;
  const outputName = `${Date.now()}-${crypto.randomUUID()}-${safeFileName(sourceName)}`;
  const filePath = `${directory}\\${outputName}`;
  await writeFile(filePath, bytes);
  return { filePath, fileName: sourceName };
}

export async function removeCompanionSprite(sprite: CompanionSprite | null) {
  if (!sprite?.filePath) return;
  try {
    await remove(sprite.filePath);
  } catch {
  }
}

export async function createCompanionSpriteUrl(sprite: CompanionSprite | null) {
  if (!sprite?.filePath) return "";
  const bytes = await readFile(sprite.filePath);
  const mimeType = imageMimeTypes[extensionOf(sprite.filePath)] || "application/octet-stream";
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export function frameStyle(sprite: CompanionSprite, imageUrl: string, state: CompanionState) {
  const frame = sprite.frames[state] ?? 0;
  const column = frame % sprite.columns;
  const row = Math.floor(frame / sprite.columns);
  const horizontal = sprite.columns === 1 ? "0%" : `${(column / (sprite.columns - 1)) * 100}%`;
  const vertical = sprite.rows === 1 ? "0%" : `${(row / (sprite.rows - 1)) * 100}%`;
  return {
    backgroundImage: `url("${imageUrl}")`,
    backgroundPosition: `${horizontal} ${vertical}`,
    backgroundSize: `${sprite.columns * 100}% ${sprite.rows * 100}%`,
  };
}







