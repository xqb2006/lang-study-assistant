import { useEffect, useState } from "react";
import { appInvoke } from "../../services/appInvoke";
import type { Card } from "./types";

export function useVocabularyReview(enabled: boolean, onError: (message: string) => void) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      setCards(await appInvoke<Card[]>("get_review_cards"));
    } catch (error) {
      onError(`加载单词复习数据失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled]);

  return { cards, loading, query, setQuery, refresh };
}
