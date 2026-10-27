import type {
  DisplayLanguage
} from "../types";
import {
  interpolate
} from "../interpolate";

type VocabularyUiKey = "section" | "title" | "summary" | "exportWord" | "exportPdf" | "searchPlaceholder" | "loading" | "empty" | "emptyDetail" | "word" | "phonetic" | "definition" | "contexts" | "noDefinition" | "contextCount" | "contextLine";
const vocabularyMessages: Record<DisplayLanguage, Partial<Record<VocabularyUiKey, string>>> = {
  "zh-CN": {
    section:"单词复习",
    title:"我的单词",
    summary:"共 {total} 个词条 · 当前显示 {visible} 个",
    exportWord:"导出 Word",
    exportPdf:"导出 PDF",
    searchPlaceholder:"搜索单词、音标或释义",
    loading:"正在加载单词卡片…",
    empty:"暂无可复习单词",
    emptyDetail:"在阅读页面创建单词卡片后会自动汇总到这里。",
    word:"单词",
    phonetic:"音标",
    definition:"基础释义",
    contexts:"语境",
    noDefinition:"暂无释义",
    contextCount:"{count} 条语境",
    contextLine:"{index} · {title} · 第 {line} 行"
  },
  "zh-TW": {
    section:"單字複習",
    title:"我的單字",
    summary:"共 {total} 個詞條 · 目前顯示 {visible} 個",
    exportWord:"匯出 Word",
    exportPdf:"匯出 PDF",
    searchPlaceholder:"搜尋單字、音標或釋義",
    loading:"正在載入單字卡片…",
    empty:"暫無可複習單字",
    emptyDetail:"在閱讀頁面建立單字卡片後，會自動彙整到這裡。",
    word:"單字",
    phonetic:"音標",
    definition:"基礎釋義",
    contexts:"語境",
    noDefinition:"暫無釋義",
    contextCount:"{count} 條語境",
    contextLine:"{index} · {title} · 第 {line} 行"
  },
  en: {
    section:"Vocabulary review",
    title:"My vocabulary",
    summary:"{total} entries · showing {visible}",
    exportWord:"Export Word",
    exportPdf:"Export PDF",
    searchPlaceholder:"Search words, pronunciation, or definitions",
    loading:"Loading vocabulary cards…",
    empty:"No vocabulary to review",
    emptyDetail:"Cards created while reading are collected here automatically.",
    word:"Word",
    phonetic:"Pronunciation",
    definition:"Core definition",
    contexts:"Contexts",
    noDefinition:"No definition",
    contextCount:"{count} contexts",
    contextLine:"{index} · {title} · line {line}"
  },
  ja: {
    ...{}
  },
  ko: {
    ...{}
  },
  fr: {
    ...{}
  },
  de: {
    ...{}
  },
  es: {
    ...{}
  },
};
vocabularyMessages.ja = {
  ...vocabularyMessages.en,
  section:"単語復習",
  title:"マイ単語",
  summary:"{total} 項目 · {visible} 項目を表示",
  exportWord:"Wordに書き出す",
  exportPdf:"PDFに書き出す",
  searchPlaceholder:"単語、発音、語義を検索",
  loading:"単語カードを読み込み中…",
  empty:"復習する単語はありません",
  emptyDetail:"読書中に作成したカードはここに自動でまとめられます",
  word:"単語",
  phonetic:"発音",
  definition:"基本の語義",
  contexts:"文脈",
  noDefinition:"語義なし",
  contextCount:"{count} 件の文脈",
  contextLine:"{index} · {title} · {line}行目"
};
vocabularyMessages.ko = {
  ...vocabularyMessages.en,
  section:"단어 복습",
  title:"내 단어",
  summary:"항목 {total}개 · {visible}개 표시",
  exportWord:"Word 내보내기",
  exportPdf:"PDF 내보내기",
  searchPlaceholder:"단어, 발음 또는 뜻 검색",
  loading:"단어 카드를 불러오는 중…",
  empty:"복습할 단어가 없습니다",
  emptyDetail:"읽는 중 만든 카드는 여기에 자동으로 모입니다",
  word:"단어",
  phonetic:"발음",
  definition:"기본 뜻",
  contexts:"문맥",
  noDefinition:"뜻 없음",
  contextCount:"문맥 {count}개",
  contextLine:"{index} · {title} · {line}번째 줄"
};
vocabularyMessages.fr = {
  ...vocabularyMessages.en,
  section:"Révision du vocabulaire",
  title:"Mon vocabulaire",
  summary:"{total} entrées · {visible} affichées",
  exportWord:"Exporter en Word",
  exportPdf:"Exporter en PDF",
  searchPlaceholder:"Rechercher un mot, une prononciation ou une définition",
  loading:"Chargement des cartes…",
  empty:"Aucun mot à réviser",
  emptyDetail:"Les cartes créées pendant la lecture sont regroupées ici automatiquement",
  word:"Mot",
  phonetic:"Prononciation",
  definition:"Définition principale",
  contexts:"Contextes",
  noDefinition:"Aucune définition",
  contextCount:"{count} contextes",
  contextLine:"{index} · {title} · ligne {line}"
};
vocabularyMessages.de = {
  ...vocabularyMessages.en,
  section:"Vokabeln wiederholen",
  title:"Meine Vokabeln",
  summary:"{total} Einträge · {visible} angezeigt",
  exportWord:"Als Word exportieren",
  exportPdf:"Als PDF exportieren",
  searchPlaceholder:"Wörter, Aussprache oder Bedeutungen suchen",
  loading:"Vokabelkarten werden geladen…",
  empty:"Keine Vokabeln zum Wiederholen",
  emptyDetail:"Beim Lesen erstellte Karten werden hier automatisch gesammelt",
  word:"Wort",
  phonetic:"Aussprache",
  definition:"Grundbedeutung",
  contexts:"Kontexte",
  noDefinition:"Keine Bedeutung",
  contextCount:"{count} Kontexte",
  contextLine:"{index} · {title} · Zeile {line}"
};
vocabularyMessages.es = {
  ...vocabularyMessages.en,
  section:"Repaso de vocabulario",
  title:"Mis palabras",
  summary:"{total} entradas · {visible} mostradas",
  exportWord:"Exportar a Word",
  exportPdf:"Exportar a PDF",
  searchPlaceholder:"Buscar palabras, pronunciación o definiciones",
  loading:"Cargando tarjetas…",
  empty:"No hay palabras para repasar",
  emptyDetail:"Las tarjetas creadas durante la lectura se recopilan aquí automáticamente",
  word:"Palabra",
  phonetic:"Pronunciación",
  definition:"Definición principal",
  contexts:"Contextos",
  noDefinition:"Sin definición",
  contextCount:"{count} contextos",
  contextLine:"{index} · {title} · línea {line}"
};
export function vocabularyT(language: DisplayLanguage, key: VocabularyUiKey, replacements: Record<string, string | number> = {}) {
  return interpolate(vocabularyMessages[language]?.[key] ?? vocabularyMessages["zh-CN"][key] ?? key,
  replacements);
}
