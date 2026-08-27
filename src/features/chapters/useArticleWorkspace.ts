import { useCallback, useEffect, useRef, useState } from "react";
import { appInvoke } from "../../services/appInvoke";
import type { Card, Mark } from "../cards/types";

type ArticleMeta = { id: number; title: string; createdAt: string; wordCount: number; language: string };
type Article = { id: number; title: string; content: string; createdAt: string; language: string };

export function useArticleWorkspace(onError: (message: string) => void) {
  const [articles, setArticles] = useState<ArticleMeta[]>([]);
  const [article, setArticle] = useState<Article | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const articleRef = useRef<Article | null>(null);
  const loadRequestId = useRef(0);
  const refreshRequestId = useRef(0);

  useEffect(() => {
    articleRef.current = article;
  }, [article]);

  const load = useCallback(async (id: number) => {
    const requestId = ++loadRequestId.current;
    try {
      const item = await appInvoke<Article>("get_article", { id });
      const [itemMarks, itemCards] = await Promise.all([
        appInvoke<Mark[]>("get_markings_by_article", { articleId: id }),
        appInvoke<Card[]>("get_cards_by_article", { articleId: id }),
      ]);
      if (requestId !== loadRequestId.current) return;
      setArticle(item);
      setMarks(itemMarks);
      setCards(itemCards);
    } catch (error) {
      if (requestId === loadRequestId.current) onError(`无法加载文章：${String(error)}`);
    }
  }, [onError]);

  const clearCurrentArticle = useCallback(() => {
    loadRequestId.current += 1;
    articleRef.current = null;
    setArticle(null);
    setMarks([]);
    setCards([]);
  }, []);

  const reloadIfCurrent = useCallback(async (id: number) => {
    if (articleRef.current?.id !== id) return;
    await load(id);
  }, [load]);

  const refresh = useCallback(async (selectFirst = false) => {
    const requestId = ++refreshRequestId.current;
    try {
      const items = await appInvoke<ArticleMeta[]>("get_articles");
      if (requestId !== refreshRequestId.current) return;
      setArticles(items);
      if (articleRef.current && !items.some((item) => item.id === articleRef.current?.id)) {
        loadRequestId.current += 1;
        articleRef.current = null;
        setArticle(null);
        setMarks([]);
        setCards([]);
        return;
      }
      if ((selectFirst || !articleRef.current) && items[0]) await load(items[0].id);
    } catch (error) {
      if (requestId === refreshRequestId.current) onError(`数据库不可用：${String(error)}`);
    }
  }, [load, onError]);

  return {
    articles,
    setArticles,
    article,
    setArticle,
    marks,
    setMarks,
    cards,
    setCards,
    load,
    reloadIfCurrent,
    clearCurrentArticle,
    refresh,
  };
}
