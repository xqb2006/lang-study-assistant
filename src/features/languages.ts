export const supportedLanguages = [
  { code: "en", label: "英语" },
  { code: "ja", label: "日语" },
  { code: "ko", label: "韩语" },
  { code: "fr", label: "法语" },
  { code: "de", label: "德语" },
  { code: "es", label: "西班牙语" },
  { code: "other", label: "其他语言" },
] as const;

export type ContentLanguage = (typeof supportedLanguages)[number]["code"];

export function languageLabel(language: string | undefined) {
  return supportedLanguages.find((item) => item.code === language)?.label ?? "其他语言";
}

export type LanguageDetection = {
  language: ContentLanguage;
  confidence: "high" | "medium" | "low";
  reason: string;
};

export function detectContentLanguage(text: string): LanguageDetection {
  const sample = text.replace(/\s+/g, " ").trim().slice(0, 4000);
  if (!sample) return { language: "en", confidence: "low", reason: "尚无可识别的正文" };
  const count = (pattern: RegExp) => (sample.match(pattern) ?? []).length;
  const kana = count(/[぀-ヿ]/g);
  const hangul = count(/[가-힯]/g);
  if (kana >= 3) return { language: "ja", confidence: "high", reason: "检测到日文假名" };
  if (hangul >= 3) return { language: "ko", confidence: "high", reason: "检测到韩文字符" };
  const latin = count(/[A-Za-zÀ-ÖØ-öø-ÿ]/g);
  const letters = count(/[\p{L}]/gu);
  const englishSignals = count(/(?:the|and|that|with|from|this|have|will|for|are|was|were|not)/gi);
  if (latin >= 24 && latin / Math.max(letters, 1) > 0.8 && englishSignals >= 2) {
    return { language: "en", confidence: "high", reason: "检测到连续英文词汇与句法特征" };
  }
  if (latin >= 12 && latin / Math.max(letters, 1) > 0.7) {
    return { language: "other", confidence: "low", reason: "检测到拉丁字母文本，法语、德语、西班牙语等请手动确认" };
  }
  return { language: "other", confidence: "low", reason: "未能可靠识别语言，请在书籍设置中手动选择" };
}
