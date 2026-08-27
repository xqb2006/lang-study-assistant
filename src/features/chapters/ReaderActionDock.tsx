import { useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { ChapterEditorModal } from "./ChapterEditorModal";
import { readerT, type DisplayLanguage } from "../../i18n/ui";

type ReaderArticle = {
  id: number;
  title: string;
  content: string;
};

type ReaderActionDockProps = {
  article: ReaderArticle;
  displayLanguage?: DisplayLanguage;
  onOpenLearning: () => void;
  onExportPdf: () => void;
  onExportWord: () => void;
  onChapterSaved: () => Promise<void>;
};

export function ReaderActionDock({
  article,
  displayLanguage = "zh-CN",
  onOpenLearning,
  onExportPdf,
  onExportWord,
  onChapterSaved,
}: ReaderActionDockProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <>
      {editorOpen && (
        <ChapterEditorModal
          article={article}
          displayLanguage={displayLanguage}
          onClose={() => setEditorOpen(false)}
          onSaved={onChapterSaved}
        />
      )}
      <div className="reader-action-dock">
        <button
          className="secondary-button edit-chapter-button"
          type="button"
          onClick={() => setEditorOpen(true)}
        >
          <Pencil size={15} />
          {readerT(displayLanguage, "editChapter")}
        </button>
        <button className="secondary-button" type="button" onClick={onOpenLearning}>
          {readerT(displayLanguage, "learningMode")}
        </button>
        <div className="export-menu">
          <button
            className="primary-button"
            type="button"
            onClick={() => setExportOpen((current) => !current)}
          >
            {readerT(displayLanguage, "export")}
            <ChevronDown size={15} />
          </button>
          {exportOpen && (
            <div className="export-menu-list">
              <button
                type="button"
                onClick={() => {
                  setExportOpen(false);
                  onExportPdf();
                }}
              >
                {readerT(displayLanguage, "exportPdf")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportOpen(false);
                  onExportWord();
                }}
              >
                {readerT(displayLanguage, "exportWord")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
