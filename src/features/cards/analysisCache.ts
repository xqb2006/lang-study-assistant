import type { DictionaryResult } from "./useCardActions";

const CACHE_KEY = "reading-agent.ai-analysis-cache.v1";
export const ANALYSIS_CACHE_LIMIT_KEY = "reading-agent.ai-analysis-cache-limit.v1";
export const DEFAULT_ANALYSIS_CACHE_LIMIT = 300;

type CachedAnalysis = {
  key: string;
  result: DictionaryResult;
  updatedAt: number;
};

function readCache(): CachedAnalysis[] {
  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "[]") as CachedAnalysis[];
    return Array.isArray(cached) ? cached : [];
  } catch {
    return [];
  }
}

function writeCache(entries: CachedAnalysis[]) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch {
    // Cache failures must not interrupt dictionary lookups.
  }
}

export function analysisCacheKey(articleId: number, startIndex: number, endIndex: number) {
  return `${articleId}:${startIndex}:${endIndex}`;
}

export function getCachedAnalysis(key: string, enabled = true) {
  if (!enabled) return null;
  return readCache().find((entry) => entry.key === key)?.result ?? null;
}

export function saveCachedAnalysis(key: string, result: DictionaryResult, limit = DEFAULT_ANALYSIS_CACHE_LIMIT) {
  if (limit <= 0) {
    writeCache([]);
    return;
  }
  const entries = readCache()
    .filter((entry) => entry.key !== key)
    .concat({ key, result, updatedAt: Date.now() })
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, Math.min(limit, 2000));
  writeCache(entries);
}


