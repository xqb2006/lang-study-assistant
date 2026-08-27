import {
  BookOpen,
  GraduationCap,
  Library,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Languages,
} from "lucide-react";

import { t, type DisplayLanguage } from "../../i18n/ui";

export type ShellView = "library" | "vocabulary" | "shortcuts" | "diagnostics";

type AppSidebarProps = {
  activeView: ShellView;
  articleCount: number;
  configured: boolean;
  displayLanguage?: DisplayLanguage;
  markCount: number;
  navCollapsed: boolean;
  onNewBook: () => void;
  onOpenDictionary: () => void;
  onOpenSettings: () => void;
  onOpenDisplayLanguage?: () => void;
  onToggleNavigation: () => void;
  onViewChange: (view: ShellView) => void;
  reviewCardCount: number;
};

export function AppSidebar({
  activeView,
  articleCount,
  configured,
  displayLanguage = "zh-CN",
  markCount,
  navCollapsed,
  onNewBook,
  onOpenDictionary,
  onOpenSettings,
  onOpenDisplayLanguage = () => undefined,
  onToggleNavigation,
  onViewChange,
  reviewCardCount,
}: AppSidebarProps) {
  return (
    <aside className="sidebar">
      <button
        className="sidebar-toggle"
        aria-label="折叠主导航"
        onClick={onToggleNavigation}
      >
        {navCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
      </button>
      <div className="brand">
        <BookOpen size={20} />
        <span>
          {t(displayLanguage, "appName")}
        </span>
      </div>
      <button className="primary-button" onClick={onNewBook}>
        <Plus size={16} />
        <span>{t(displayLanguage, "newBook")}</span>
      </button>
      <p className="sidebar-label">{t(displayLanguage, "bookshelf")}</p>
      <button className={`nav-button ${activeView === "library" ? "active" : ""}`} onClick={() => onViewChange("library")}>
        <Library size={16} />
        <span>{t(displayLanguage, "allChapters")}</span>
        <em>{articleCount}</em>
      </button>
      <button className={`nav-button ${activeView === "vocabulary" ? "active" : ""}`} onClick={() => onViewChange("vocabulary")}>
        <GraduationCap size={16} />
        <span>{t(displayLanguage, "vocabulary")}</span>
        <em>{reviewCardCount}</em>
      </button>
      <p className="sidebar-label">{t(displayLanguage, "tools")}</p>
      <button className="nav-button" onClick={onOpenDictionary}>
        <BookOpen size={16} />
        <span>{t(displayLanguage, "languageResources")}</span>
      </button>
      <button className="nav-button" onClick={onOpenSettings}>
        <Settings size={16} />
        <span>{t(displayLanguage, "aiSettings")}</span>
        <em>{configured ? t(displayLanguage, "configured") : t(displayLanguage, "notConfigured")}</em>
      </button>
      <p className="sidebar-label">{t(displayLanguage, "preferences")}</p>
      <button className="nav-button" onClick={onOpenDisplayLanguage}>
        <Languages size={16} />
        <span>{t(displayLanguage, "displayLanguage")}</span>
      </button>
      <button className={`nav-button ${activeView === "diagnostics" ? "active" : ""}`} onClick={() => onViewChange("diagnostics")}>
        <Settings size={16} />
        <span>{t(displayLanguage, "diagnostics")}</span>
      </button>
      <button className={`nav-button ${activeView === "shortcuts" ? "active" : ""}`} onClick={() => onViewChange("shortcuts")}>
        <Settings size={16} />
        <span>{t(displayLanguage, "shortcuts")}</span>
      </button>
      <footer>{t(displayLanguage, "localFirst")} · {markCount} 个标记</footer>
    </aside>
  );
}