import { FormEvent, useRef } from "react";
import { isAiSentenceContext } from "../../sentenceContext";
import { appInvoke } from "../../services/appInvoke";
import type { LocalDictionaryResult } from "../localDictionary/types";
import { cardApi } from "./api";
import { analysisCacheKey, DEFAULT_ANALYSIS_CACHE_LIMIT, getCachedAnalysis, saveCachedAnalysis } from "./analysisCache";
import type { Card, CardReference, Mark, Selection } from "./types";

export type DictionaryResult = {
  word: string;
  translation: string;
  phonetic: string;
  definition: string;
  commonMeanings?: string[];
  contextualMeaning?: string;
  sentenceTranslation?: string;
  usageNote?: string;
};

function normalizeDictionaryLineBreaks(value: string | undefined) {
  return value?.replace(/\\r?\\n/g, "\n") ?? "";
}

function normalizeDictionaryResult<T extends DictionaryResult>(result: T): T {
  return {
    ...result,
    translation: normalizeDictionaryLineBreaks(result.translation),
    definition: normalizeDictionaryLineBreaks(result.definition),
    contextualMeaning: normalizeDictionaryLineBreaks(result.contextualMeaning),
    sentenceTranslation: normalizeDictionaryLineBreaks(result.sentenceTranslation),
    usageNote: normalizeDictionaryLineBreaks(result.usageNote),
    commonMeanings: result.commonMeanings?.map(normalizeDictionaryLineBreaks),
  };
}

function selectionKey(selection: Selection) {
  return `${selection.origin || "article"}:${selection.startIndex}:${selection.endIndex}:${selection.word.toLocaleLowerCase()}:${selection.contextSentence}`;
}

function yieldToUi() {
  return new Promise<void>((resolve) => {
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    window.setTimeout(resolve, 0);
  });
}

type Paragraph = {
  position: number;
  sourceText: string;
  translation: string;
  translationSource: string;
};

type UseCardActionsOptions = {
  activeModel: string;
  analysisCacheLimit?: number;
  article: { id: number; language?: string } | null;
  cards: Card[];
  editingCard: Card | null;
  editingContext: CardReference | null;
  isLookingUp: boolean;
  loadArticle: (articleId: number) => Promise<void>;
  lookup: DictionaryResult | null;
  marks: Mark[];
  pendingCardDelete: Card | null;
  selected: Selection | null;
  setEditingCard: (card: Card | null) => void;
  setEditingContext: (context: CardReference | null) => void;
  setIsLookingUp: (loading: boolean) => void;
  setLookup: (lookup: DictionaryResult | null) => void;
  setNotice: (message: string) => void;
  setPendingCardDelete: (card: Card | null) => void;
  setSelected: (selection: Selection | null) => void;
};

export function useCardActions({
  activeModel,
  analysisCacheLimit,
  article,
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
}: UseCardActionsOptions) {
  const localLookupRequestId = useRef(0);
  const aiLookupRequestId = useRef(0);
  const activeAiRequests = useRef(new Set<number>());
  const localRequests = useRef(0);
  const aiRequests = useRef(0);
  const aiResults = useRef(new Map<string, DictionaryResult>());
  const pendingSelectionRequests = useRef(new Map<string, number>());
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const updateLoadingState = () => {
    setIsLookingUp(localRequests.current > 0 || aiRequests.current > 0);
  };

  const getLookupForSelection = (selection: Selection) =>
    aiResults.current.get(selectionKey(selection)) || null;

  const isSelectionLookingUp = (selection: Selection) =>
    (pendingSelectionRequests.current.get(selectionKey(selection)) || 0) > 0;

  const updateSelectionRequestCount = (selection: Selection, change: number) => {
    const key = selectionKey(selection);
    const nextCount = Math.max(0, (pendingSelectionRequests.current.get(key) || 0) + change);
    if (nextCount) pendingSelectionRequests.current.set(key, nextCount);
    else pendingSelectionRequests.current.delete(key);
  };

  const markSelection = async (selection = selected) => {
    if (!article || !selection) {
      setNotice("请先选中单词或短语");
      return;
    }
    const existing = marks.find(
      (mark) =>
        mark.startIndex === selection.startIndex &&
        mark.endIndex === selection.endIndex,
    );
    try {
      if (existing) {
        await appInvoke("delete_marking", {
          articleId: article.id,
          startIndex: selection.startIndex,
          endIndex: selection.endIndex,
        });
        setNotice(`已取消“${selection.word}”的高亮`);
      } else {
        await cardApi.createMarking(appInvoke, article.id, selection);
        setNotice(`已高亮“${selection.word}”`);
      }
      await loadArticle(article.id);
    } catch (error) {
      setNotice(String(error));
    }
  };

  const lookupSelection = async (selection = selected) => {
    if (!selection) {
      setNotice("请先选中单词");
      return;
    }
    const requestId = ++localLookupRequestId.current;
    localRequests.current += 1;
    updateSelectionRequestCount(selection, 1);
    updateLoadingState();
    try {
      const result = await appInvoke<LocalDictionaryResult>(
        "lookup_local_dictionary",
        { word: selection.word, language: article?.language ?? "en" },
      );
      if (requestId !== localLookupRequestId.current) return;
      if (!result.found) {
        setLookup(null);
        setNotice(`本地词典未收录“${selection.word}”，可使用 AI 深度解析`);
        return;
      }
      if (selectionKey(selectedRef.current || selection) === selectionKey(selection)) {
        setLookup(normalizeDictionaryResult(result));
        setNotice(`本地词典已找到“${result.word}”`);
      }
    } catch (error) {
      if (requestId === localLookupRequestId.current) setNotice(String(error));
    } finally {
      localRequests.current = Math.max(0, localRequests.current - 1);
      updateSelectionRequestCount(selection, -1);
      updateLoadingState();
    }
  };

  const lookupWithAi = async (selection = selected, regenerate = false) => {
    if (!selection) {
      setNotice("请先选中单词或短语");
      return;
    }
    if (!activeModel) {
      setNotice("请先在设置中添加并选择 AI 模型");
      return;
    }
    if (!isAiSentenceContext(selection.contextSentence, selection.word)) {
      setNotice("未能可靠定位该词所在句子，请重新选择后再进行语境精析");
      return;
    }
    const cacheKey = article && selection.origin !== "question"
      ? analysisCacheKey(article.id, selection.startIndex, selection.endIndex)
      : null;
    if (cacheKey && !regenerate) {
      const cached = getCachedAnalysis(cacheKey, (analysisCacheLimit ?? DEFAULT_ANALYSIS_CACHE_LIMIT) > 0);
      if (cached) {
        const normalizedCached = normalizeDictionaryResult(cached);
        aiResults.current.set(selectionKey(selection), normalizedCached);
        setLookup(normalizedCached);
        setNotice(`已复用“${selection.word}”的语境解析缓存；可点击“重新生成”获取新结果`);
        return;
      }
    }
    const requestId = ++aiLookupRequestId.current;
    const resultKey = selectionKey(selection);
    activeAiRequests.current.add(requestId);
    aiRequests.current += 1;
    updateSelectionRequestCount(selection, 1);
    updateLoadingState();
    await yieldToUi();
    try {
      const articleLanguage = article?.language ?? "en";
      const localLookup = articleLanguage !== "en" || !/\s/.test(selection.word.trim())
        ? appInvoke<LocalDictionaryResult>("lookup_local_dictionary", { word: selection.word, language: articleLanguage })
        : Promise.resolve(null);
      const translationReferenceLookup = (async () => {
        if (!article || selection.origin === "question") return { referenceTranslation: "", referenceTranslationSource: "" };
        const normalizedSentence = selection.contextSentence.replace(/\s+/g, " ").trim().toLowerCase();
        const paragraphs = await appInvoke<Paragraph[]>("get_paragraphs", { articleId: article.id }).catch(() => []);
        const paragraph = paragraphs
          .filter((item) => item.translation.trim() && item.sourceText.replace(/\s+/g, " ").trim().toLowerCase().includes(normalizedSentence))
          .sort((left, right) => left.sourceText.length - right.sourceText.length)[0];
        return paragraph ? { referenceTranslation: paragraph.translation, referenceTranslationSource: paragraph.translationSource || "文章译文" } : { referenceTranslation: "", referenceTranslationSource: "" };
      })();
      const [localResult, translationReference] = await Promise.all([localLookup, translationReferenceLookup]);
      if (!activeAiRequests.current.has(requestId)) return;
      const result = await appInvoke<DictionaryResult>("lookup_with_ai", {
        input: { word: selection.word, context: selection.contextSentence, model: activeModel, language: article?.language ?? "en", ...translationReference },
      });
      if (!activeAiRequests.current.has(requestId)) return;
      const mergedResult = normalizeDictionaryResult({
        ...localResult,
        ...result,
        phonetic: result.phonetic || localResult?.phonetic || "",
        translation: result.translation || localResult?.translation || "",
        definition: result.definition || localResult?.definition || "",
        commonMeanings: result.commonMeanings?.length ? result.commonMeanings : localResult?.commonMeanings,
      });
      aiResults.current.set(resultKey, mergedResult);
      if (selectionKey(selectedRef.current || selection) === resultKey) setLookup(mergedResult);
      if (cacheKey) saveCachedAnalysis(cacheKey, mergedResult, analysisCacheLimit);
      if (selectionKey(selectedRef.current || selection) === resultKey) {
        setNotice(`已完成“${selection.word}”的词典查询与语境精析`);
      }
    } catch (error) {
      if (activeAiRequests.current.has(requestId) && selectionKey(selectedRef.current || selection) === resultKey) setNotice(String(error));
    } finally {
      activeAiRequests.current.delete(requestId);
      aiRequests.current = Math.max(0, aiRequests.current - 1);
      updateSelectionRequestCount(selection, -1);
      updateLoadingState();
    }
  };

  const openQuestionLookup = (
    questionSelection: { word: string; contextSentence: string },
    mode: "dictionary" | "ai",
  ) => {
    if (selected && lookup) {
      setNotice("当前查询结果尚未保存。请保存学习卡片，或关闭当前查询后再选择其他内容。");
      return;
    }
    const nextSelection: Selection = {
      word: questionSelection.word,
      startIndex: -1,
      endIndex: -1,
      lineNumber: 0,
      contextSentence: questionSelection.contextSentence,
      origin: "question",
    };
    setSelected(nextSelection);
    setLookup(null);
    if (mode === "dictionary") void lookupSelection(nextSelection);
    else void lookupWithAi(nextSelection);
  };

  const cancelLookup = () => {
    if (!isLookingUp) return;
    localLookupRequestId.current += 1;
    activeAiRequests.current.clear();
    localRequests.current = 0;
    aiRequests.current = 0;
    pendingSelectionRequests.current.clear();
    updateLoadingState();
    setNotice("已取消当前查询，返回结果将被忽略");
  };

  const createCard = async (selection = selected, keepSelection = false) => {
    if (!article || !selection) return;
    if (selection.origin === "question") {
      setNotice("题目选词仅用于查询，不会自动创建正文高亮或单词卡片");
      return;
    }
    try {
      try {
        await appInvoke("create_marking", {
          input: { articleId: article.id, ...selection },
        });
      } catch (error) {
        const message = String(error);
        if (!message.includes("不存在") && !message.includes("This text is already marked")) {
          throw error;
        }
      }
      const result = await cardApi.createCard(appInvoke, {
        articleId: article.id,
        ...selection,
        translation: lookup?.translation || "",
        contextualMeaning: lookup?.contextualMeaning || "",
        sentenceTranslation: lookup?.sentenceTranslation || "",
        usageNote: lookup?.usageNote || "",
        analysisSource: lookup?.contextualMeaning ? "ai" : "",
      });
      await loadArticle(article.id);
      if (!keepSelection) {
        setSelected(null);
        setLookup(null);
        window.getSelection()?.removeAllRanges();
      }
      setNotice(
        result.created
          ? `已创建词典卡「${result.word}」`
          : `已合并到「${result.word}」，现有 ${result.contextCount} 条语境`,
      );
      return true;
    } catch (error) {
      const message = String(error);
      if (keepSelection && message.includes("该出处已收录到单词卡片")) return true;
      setNotice(message);
      return false;
    }
  };

  const saveLearningCard = async (selectionToSave = selected) => {
    const analysisToSave = lookup;
    if (!selectionToSave) {
      setNotice("请先在正文中选中单词或短语");
      return;
    }
    const keepSelection = Boolean(analysisToSave?.contextualMeaning);
    const cardSaved = await createCard(selectionToSave, keepSelection);
    if (!cardSaved) return;
    if (keepSelection) {
      const analysisSaved = await saveAiAnalysisToContext(false, selectionToSave, analysisToSave);
      if (!analysisSaved) return;
    }
    setSelected(null);
    setLookup(null);
    window.getSelection()?.removeAllRanges();
  };
  const saveAiAnalysisToContext = async (overwriteUserEdits = false, selectionToSave = selected, analysisToSave = lookup) => {
    if (!article || !selectionToSave || !analysisToSave?.contextualMeaning) {
      setNotice("请先选中已建卡的单词或短语，再执行 AI 解析");
      return;
    }
    try {
      await appInvoke("save_ai_analysis_to_context", {
        input: {
          articleId: article.id,
          startIndex: selectionToSave.startIndex,
          endIndex: selectionToSave.endIndex,
          contextualMeaning: analysisToSave.contextualMeaning,
          sentenceTranslation: analysisToSave.sentenceTranslation || "",
          usageNote: analysisToSave.usageNote || "",
          overwriteUserEdits,
        },
      });
      await loadArticle(article.id);
      setNotice("AI 解析已保存到当前语境");
      return true;
    } catch (error) {
      if (
        String(error).includes("CONTEXT_HAS_USER_EDITS") &&
        !overwriteUserEdits &&
        window.confirm("当前语境已有人工修改，是否使用 AI 结果覆盖？")
      ) {
        return saveAiAnalysisToContext(true, selectionToSave, analysisToSave);
      }
      setNotice(
        String(error).includes("CARD_CONTEXT_NOT_FOUND")
          ? "词卡尚未保存成功，请检查当前选词后重试"
          : String(error),
      );
      return false;
    }
  };

  const saveContext = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingContext || !article) return;
    try {
      await cardApi.updateContext(appInvoke, editingContext);
      await loadArticle(article.id);
      setEditingContext(null);
      setNotice("语境笔记已保存");
    } catch (error) {
      setNotice(String(error));
    }
  };

  const saveCard = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingCard || !article) return;
    try {
      await cardApi.updateCard(appInvoke, editingCard);
      await loadArticle(article.id);
      setEditingCard(null);
      setNotice("卡片已更新");
    } catch (error) {
      setNotice(String(error));
    }
  };

  const deleteCard = async () => {
    if (!article || !pendingCardDelete) return;
    try {
      await cardApi.deleteCard(appInvoke, pendingCardDelete.id);
      await loadArticle(article.id);
      setPendingCardDelete(null);
      setNotice("单词卡片、语境与对应高亮已删除");
    } catch (error) {
      setNotice(String(error));
    }
  };

  const jumpToReference = async (reference: CardReference) => {
    await loadArticle(reference.articleId);
    window.setTimeout(
      () =>
        document
          .getElementById(`line-${reference.lineNumber}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      80,
    );
  };

  return {
    cancelLookup,
    createCard,
    deleteCard,
    getLookupForSelection,
    isSelectionLookingUp,
    jumpToReference,
    lookupSelection,
    lookupWithAi,
    markSelection,
    openQuestionLookup,
    saveAiAnalysisToContext,
    saveLearningCard,
    saveCard,
    saveContext,
  };
}


