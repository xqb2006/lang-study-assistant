export type ShortcutAction = "mark" | "dictionary" | "ai" | "createCard";

export type Shortcuts = Record<ShortcutAction, string>;

export const defaultShortcuts: Shortcuts = {
  mark: "Ctrl+Shift+M",
  dictionary: "Ctrl+Shift+D",
  ai: "Ctrl+Shift+A",
  createCard: "Ctrl+Shift+S",
};

export const shortcutLabels: Record<ShortcutAction, string> = {
  mark: "高亮标记 / 取消高亮",
  dictionary: "词典查询",
  ai: "语境精析",
  createCard: "保存学习卡片",
};
