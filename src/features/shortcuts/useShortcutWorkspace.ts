import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultShortcuts,
  type ShortcutAction,
  type Shortcuts,
} from "./types";

function isSafeShortcut(shortcut: string) {
  return /^(?:(?:Alt|Ctrl|Shift)\+){1,3}[A-Z0-9]$|^Mouse(?:Middle|Back|Forward)$/.test(shortcut);
}

function readShortcuts(): Shortcuts {
  try {
    const saved = JSON.parse(localStorage.getItem("reading-agent-shortcuts") ?? "{}") as Partial<Shortcuts>;
    const shortcuts = { ...defaultShortcuts };
    (Object.keys(shortcuts) as ShortcutAction[]).forEach((action) => {
      if (typeof saved[action] === "string" && isSafeShortcut(saved[action])) shortcuts[action] = saved[action];
    });
    return shortcuts;
  } catch {
    return defaultShortcuts;
  }
}

function shortcutFromEvent(event: KeyboardEvent) {
  const code = event.code;
  const key = code.startsWith("Key")
    ? code.slice(3)
    : code.startsWith("Digit")
      ? code.slice(5)
      : event.key.length === 1
        ? event.key.toUpperCase()
        : event.key;
  return `${event.altKey ? "Alt+" : ""}${event.ctrlKey ? "Ctrl+" : ""}${event.shiftKey ? "Shift+" : ""}${key}`;
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable='true']");
}

type UseShortcutWorkspaceOptions = {
  enabled: boolean;
  onShortcut: (action: ShortcutAction) => void;
  setNotice: (message: string) => void;
};

export function useShortcutWorkspace({ enabled, onShortcut, setNotice }: UseShortcutWorkspaceOptions) {
  const [shortcuts, setShortcuts] = useState<Shortcuts>(readShortcuts);
  const [recordingAction, setRecordingAction] = useState<ShortcutAction | null>(null);
  const [recordingMessage, setRecordingMessage] = useState("");
  const shortcutsRef = useRef(shortcuts);
  const recordingActionRef = useRef(recordingAction);

  useEffect(() => { shortcutsRef.current = shortcuts; }, [shortcuts]);
  useEffect(() => { recordingActionRef.current = recordingAction; }, [recordingAction]);

  const saveShortcutValue = (action: ShortcutAction, shortcut: string) => {
    if (!isSafeShortcut(shortcut)) {
      setNotice("请按带有 Ctrl、Alt 或 Shift 的字母、数字组合键，或按鼠标中键、后退键、前进键");
      return;
    }
    if ((Object.entries(shortcutsRef.current) as [ShortcutAction, string][]).some(([otherAction, value]) => otherAction !== action && value === shortcut)) {
      setNotice("该快捷键已被其他操作使用");
      return;
    }
    setShortcuts((current) => ({ ...current, [action]: shortcut }));
    recordingActionRef.current = null;
    setRecordingAction(null);
    setRecordingMessage(`已录入：${shortcut}`);
    setNotice(`已录入快捷键：${shortcut}`);
  };

  const toggleRecording = (action: ShortcutAction) => {
    if (recordingActionRef.current === action) {
      const message = "正在录制：请按下组合键，Esc 或“取消录制”可退出";
      setRecordingMessage(message);
      setNotice(message);
      return;
    }
    recordingActionRef.current = action;
    setRecordingAction(action);
    const message = "正在录制：请按下组合键，Esc 或“取消录制”可退出";
    setRecordingMessage(message);
    setNotice(message);
  };

  const restoreDefaults = () => {
    setShortcuts(defaultShortcuts);
    recordingActionRef.current = null;
    setRecordingAction(null);
    setRecordingMessage("已恢复默认快捷键");
    setNotice("已恢复默认快捷键");
  };

  const cancelRecording = useCallback(() => {
    if (!recordingActionRef.current) return;
    recordingActionRef.current = null;
    setRecordingAction(null);
    setRecordingMessage("已取消快捷键录制");
    setNotice("已取消快捷键录制");
  }, [setNotice]);

  useEffect(() => {
    if (!recordingAction) return;
    const keyboard = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.isComposing) return;
      if (event.key === "Escape") return cancelRecording();
      if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return;
      saveShortcutValue(recordingAction, shortcutFromEvent(event));
    };
    const mouse = (event: MouseEvent) => {
      const shortcutsByButton: Record<number, string> = { 1: "MouseMiddle", 3: "MouseBack", 4: "MouseForward" };
      const shortcut = shortcutsByButton[event.button];
      if (!shortcut) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      saveShortcutValue(recordingAction, shortcut);
    };
    window.addEventListener("keydown", keyboard, true);
    window.addEventListener("mousedown", mouse, true);
    return () => {
      window.removeEventListener("keydown", keyboard, true);
      window.removeEventListener("mousedown", mouse, true);
    };
  }, [recordingAction]);

  useEffect(() => {
    localStorage.setItem("reading-agent-shortcuts", JSON.stringify(shortcuts));
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;
    const handleShortcut = (event: KeyboardEvent) => {
      if (recordingActionRef.current || event.repeat || event.isComposing || isEditableTarget(event.target)) return;
      const action = (Object.entries(shortcutsRef.current) as [ShortcutAction, string][]).find(([, shortcut]) => shortcut === shortcutFromEvent(event))?.[0];
      if (!action) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onShortcut(action);
    };
    window.addEventListener("keydown", handleShortcut, true);
    return () => window.removeEventListener("keydown", handleShortcut, true);
  }, [enabled, onShortcut]);

  return { cancelRecording, recordingAction, recordingMessage, restoreDefaults, shortcuts, toggleRecording };
}