import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { Selection } from "./types";

const mocks = vi.hoisted(() => ({
  getSelectionDetails: vi.fn(),
  lookupSelection: vi.fn(),
  lookupWithAi: vi.fn(),
  markSelection: vi.fn(),
  saveLearningCard: vi.fn(),
}));

vi.mock("./selection", () => ({
  getSelectionDetails: mocks.getSelectionDetails,
}));

vi.mock("./useCardActions", () => ({
  useCardActions: () => ({
    cancelLookup: vi.fn(),
    createCard: vi.fn(),
    deleteCard: vi.fn(),
    getLookupForSelection: vi.fn().mockReturnValue(null),
    isSelectionLookingUp: vi.fn().mockReturnValue(false),
    jumpToReference: vi.fn(),
    lookupSelection: mocks.lookupSelection,
    lookupWithAi: mocks.lookupWithAi,
    markSelection: mocks.markSelection,
    openQuestionLookup: vi.fn(),
    saveAiAnalysisToContext: vi.fn(),
    saveLearningCard: mocks.saveLearningCard,
    saveCard: vi.fn(),
    saveContext: vi.fn(),
  }),
}));

import { useReaderSelectionWorkspace } from "./useReaderSelectionWorkspace";

const selection: Selection = {
  word: "announced",
  startIndex: 2,
  endIndex: 11,
  lineNumber: 1,
  contextSentence: "The company announced the result.",
};

function renderWorkspace(setNotice = vi.fn()) {
  return renderHook(() => useReaderSelectionWorkspace({
    activeModel: "test-model",
    article: { id: 1, content: "The company announced the result." },
    cards: [],
    editingCard: null,
    editingContext: null,
    loadArticle: vi.fn().mockResolvedValue(undefined),
    marks: [],
    pendingCardDelete: null,
    setEditingCard: vi.fn(),
    setEditingContext: vi.fn(),
    setNotice,
    setPendingCardDelete: vi.fn(),
  }));
}

describe("useReaderSelectionWorkspace", () => {
  test("正文选词后由快捷键复用当前选词并打开词典查询", () => {
    mocks.getSelectionDetails.mockReturnValueOnce(selection).mockReturnValueOnce(null);
    const showCardPanel = vi.fn();
    const { result } = renderWorkspace();

    act(() => {
      result.current.captureReaderSelection({ current: document.createElement("section") });
    });
    act(() => {
      result.current.handleReaderShortcut("dictionary", { current: document.createElement("section") }, showCardPanel);
    });

    expect(result.current.selected).toEqual(selection);
    expect(showCardPanel).toHaveBeenCalledOnce();
    expect(mocks.lookupSelection).toHaveBeenCalledWith(selection);
  });

  test("没有任何选词时快捷键给出明确提示", () => {
    mocks.getSelectionDetails.mockReturnValue(null);
    const setNotice = vi.fn();
    const { result } = renderWorkspace(setNotice);

    act(() => {
      result.current.handleReaderShortcut("ai", { current: document.createElement("section") }, vi.fn());
    });

    expect(setNotice).toHaveBeenCalledWith("请先在正文中选中内容，再使用“语境精析”");
    expect(mocks.lookupWithAi).not.toHaveBeenCalled();
  });

  test("清空选词同时清理当前选择状态", () => {
    mocks.getSelectionDetails.mockReturnValue(selection);
    const { result } = renderWorkspace();

    act(() => result.current.captureReaderSelection({ current: document.createElement("section") }));
    expect(result.current.selected).toEqual(selection);
    act(() => result.current.clearSelection());
    expect(result.current.selected).toBeNull();
  });
});
