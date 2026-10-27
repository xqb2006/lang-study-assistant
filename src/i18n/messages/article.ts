import type {
  DisplayLanguage
} from "../types";
import {
  interpolate
} from "../interpolate";

type ArticleUiKey = "marked" | "translationPending" | "translationMissing";
const articleMessages: Record<DisplayLanguage, Partial<Record<ArticleUiKey, string>>> = {
  "zh-CN": {
    marked:"已标记：{word}",
    translationPending:"译文待 AI 补齐",
    translationMissing:"暂未导入译文"
  },
  "zh-TW": {
    marked:"已標示：{word}",
    translationPending:"譯文待 AI 補齊",
    translationMissing:"暫未匯入譯文"
  },
  en: {
    marked:"Marked: {word}",
    translationPending:"Translation pending AI completion",
    translationMissing:"No translation imported"
  },
  ja: {},
  ko: {},
  fr: {},
  de: {},
  es: {},
};
articleMessages.ja = {
  ...articleMessages.en,
  marked:"マーク済み: {word}",
  translationPending:"AIによる訳の補完待ち",
  translationMissing:"訳は未取り込み"
}; articleMessages.ko = {
  ...articleMessages.en,
  marked:"표시됨: {word}",
  translationPending:"AI 번역 보완 대기 중",
  translationMissing:"번역을 가져오지 않았습니다"
}; articleMessages.fr = {
  ...articleMessages.en,
  marked:"Marqué : {word}",
  translationPending:"Traduction en attente de l’IA",
  translationMissing:"Aucune traduction importée"
}; articleMessages.de = {
  ...articleMessages.en,
  marked:"Markiert: {word}",
  translationPending:"Übersetzung wartet auf KI-Ergänzung",
  translationMissing:"Keine Übersetzung importiert"
}; articleMessages.es = {
  ...articleMessages.en,
  marked:"Marcado: {word}",
  translationPending:"Traducción pendiente de completar con IA",
  translationMissing:"No se importó ninguna traducción"
};
export function articleT(language: DisplayLanguage, key: ArticleUiKey, replacements: Record<string, string | number> = {}) {
  return interpolate(articleMessages[language]?.[key] ?? articleMessages["zh-CN"][key] ?? key,
  replacements);
}
