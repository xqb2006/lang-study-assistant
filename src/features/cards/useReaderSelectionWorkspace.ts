import { useCallback, useState, type RefObject } from "react";
import { getSelectionDetails } from "./selection";
import { useCardActions, type DictionaryResult } from "./useCardActions";
import type { Card, CardReference, Mark, Selection } from "./types";
import { shortcutLabels, type ShortcutAction } from "../shortcuts/types";

type ReaderArticle = { id: number; content: string; language?: string } | null;

function selectionsMatch(left: Selection, right: Selection) {
  return left.startIndex === right.startIndex && left.endIndex === right.endIndex && left.origin === right.origin;
}

type UseReaderSelectionWorkspaceOptions = {
  activeModel: string;
  analysisCacheLimit?: number;
  article: ReaderArticle;
  cards: Card[];
  editingCard: Card | null;
  editingContext: CardReference | null;
  loadArticle: (articleId: number) => Promise<void>;
  marks: Mark[];
  onExistingCardSelect?: (cardId: number) => void;
  pendingCardDelete: Card | null;
  setEditingCard: (card: Card | null) => void;
  setEditingContext: (context: CardReference | null) => void;
  setNotice: (message: string) => void;
  setPendingCardDelete: (card: Card | null) => void;
};

export function useReaderSelectionWorkspace({
  activeModel,
  analysisCacheLimit,
  article,
  cards,
  editingCard,
  editingContext,
  loadArticle,
  marks,
  onExistingCardSelect,
  pendingCardDelete,
  setEditingCard,
  setEditingContext,
  setNotice,
  setPendingCardDelete,
}: UseReaderSelectionWorkspaceOptions) {
  const [selected, setSelected] = useState<Selection | null>(null);
  const [lookup, setLookup] = useState<DictionaryResult | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const cardActions = useCardActions({
    activeModel,
    analysisCacheLimit,
    article,
    cards,
    editingCard,
    editingContext,
    isLookingUp,
    loadArticle,
    lookup,
    marks,
    pendingCardDelete,
    selected,
    setEditingCard,
    setEditingContext,
    setIsLookingUp,
    setLookup,
    setNotice,
    setPendingCardDelete,
    setSelected,
  });

  const clearSelection = useCallback(() => {
    setSelected(null);
    setLookup(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const captureReaderSelection = useCallback((readerRef: RefObject<HTMLElement | null>) => {
    const nextSelection = getSelectionDetails(readerRef, article?.content ?? "");
    if (nextSelection && selected && !selectionsMatch(nextSelection, selected) && lookup) {
      setNotice("当前查询结果尚未保存。请保存学习卡片，或点击右上角关闭后再查询其他单词。");
      return selected;
    }
    setSelected(nextSelection);
    if (nextSelection) {
      setLookup(cardActions.getLookupForSelection(nextSelection));
      const existingCard = cards.find(
        (card) => card.word.trim().toLocaleLowerCase() === nextSelection.word.trim().toLocaleLowerCase(),
      );
      if (existingCard) onExistingCardSelect?.(existingCard.id);
    }
    return nextSelection;
  }, [article?.content, cards, cardActions, lookup, onExistingCardSelect, selected, setNotice]);

  const handleReaderShortcut = useCallback((
    action: ShortcutAction,
    readerRef: RefObject<HTMLElement | null>,
    showCardPanel: () => void,
  ) => {
    const selection = getSelectionDetails(readerRef, article?.content ?? "") ?? selected;
    if (!selection) {
      setNotice(`请先在正文中选中内容，再使用“${shortcutLabels[action]}”`);
      return;
    }
    if (selected && lookup && !selectionsMatch(selection, selected)) {
      setNotice("当前查询结果尚未保存。请保存学习卡片，或点击右上角关闭后再查询其他单词。");
      return;
    }
    setSelected(selection);
    setLookup(cardActions.getLookupForSelection(selection));
    if (action === "mark") void cardActions.markSelection(selection);
    if (action === "dictionary") {
      showCardPanel();
      void cardActions.lookupSelection(selection);
    }
    if (action === "ai") {
      showCardPanel();
      void cardActions.lookupWithAi(selection);
    }
    if (action === "createCard") void cardActions.saveLearningCard(selection);
  }, [article?.content, cardActions, selected, setNotice]);

  return {
    ...cardActions,
    captureReaderSelection,
    clearSelection,
    handleReaderShortcut,
    isCurrentSelectionLookingUp: selected ? cardActions.isSelectionLookingUp(selected) : false,
    isLookingUp,
    lookup,
    selected,
  };
}
