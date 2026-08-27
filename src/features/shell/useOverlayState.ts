import { useCallback, useState } from "react";
import type { Card, CardReference } from "../cards/types";
import type { ExportOptions } from "../export/types";

const defaultExportOptions: ExportOptions = {
  includeHighlights: true,
  includeTranslation: true,
  includeQuestions: true,
  includeQuestionAnswers: false,
  includeMarkedWords: true,
  includeVocabularyList: false,
};

export function useOverlayState() {
  const [chapterPhotoOpen, setChapterPhotoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localDictionaryOpen, setLocalDictionaryOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editingContext, setEditingContext] = useState<CardReference | null>(
    null,
  );
  const [pendingCardDelete, setPendingCardDelete] = useState<Card | null>(null);
  const [exportFormat, setExportFormat] = useState<"pdf" | "word" | null>(
    null,
  );
  const [exportOptions, setExportOptions] =
    useState<ExportOptions>(defaultExportOptions);
  const [learningOpen, setLearningOpen] = useState(false);

  const closeReaderOverlays = useCallback(() => {
    setLearningOpen(false);
    setExportFormat(null);
  }, []);

  return {
    chapterPhotoOpen,
    closeReaderOverlays,
    editingCard,
    editingContext,
    exportFormat,
    exportOptions,
    learningOpen,
    localDictionaryOpen,
    pendingCardDelete,
    setChapterPhotoOpen,
    setEditingCard,
    setEditingContext,
    setExportFormat,
    setExportOptions,
    setLearningOpen,
    setLocalDictionaryOpen,
    setPendingCardDelete,
    setSettingsOpen,
    settingsOpen,
  };
}
