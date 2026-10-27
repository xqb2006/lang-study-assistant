import type {
  DisplayLanguage
} from "../types";

type CardEditorUiKey = "contextTitle" | "contextHint" | "contextMeaning" | "sentenceTranslation" | "usageNote" | "contextNote" | "saveContext" | "cardTitle" | "word" | "translation" | "phonetic" | "definition" | "note" | "saveChanges";
const cardEditorMessages: Record<DisplayLanguage, Partial<Record<CardEditorUiKey, string>>> = {
  "zh-CN": {
    contextTitle:"编辑语境",
    contextHint:"原文句子保持只读，仅修改学习解析与笔记。",
    contextMeaning:"本句中的意思",
    sentenceTranslation:"整句翻译",
    usageNote:"用法提示",
    contextNote:"语境学习笔记",
    saveContext:"保存语境",
    cardTitle:"编辑单词卡片",
    word:"单词",
    translation:"中文翻译",
    phonetic:"音标",
    definition:"释义",
    note:"笔记",
    saveChanges:"保存修改"
  },
  "zh-TW": {
    contextTitle:"編輯語境",
    contextHint:"原文句子維持唯讀，僅修改學習解析與筆記。",
    contextMeaning:"本句中的意思",
    sentenceTranslation:"整句翻譯",
    usageNote:"用法提示",
    contextNote:"語境學習筆記",
    saveContext:"儲存語境",
    cardTitle:"編輯單字卡片",
    word:"單字",
    translation:"中文翻譯",
    phonetic:"音標",
    definition:"釋義",
    note:"筆記",
    saveChanges:"儲存修改"
  },
  en: {
    contextTitle:"Edit context",
    contextHint:"The original sentence is read-only. Only the learning analysis and notes can be changed.",
    contextMeaning:"Meaning in this sentence",
    sentenceTranslation:"Sentence translation",
    usageNote:"Usage note",
    contextNote:"Context study note",
    saveContext:"Save context",
    cardTitle:"Edit vocabulary card",
    word:"Word",
    translation:"Chinese translation",
    phonetic:"Pronunciation",
    definition:"Definition",
    note:"Note",
    saveChanges:"Save changes"
  },
  ja: {},
  ko: {},
  fr: {},
  de: {},
  es: {},
};
cardEditorMessages.ja = {
  ...cardEditorMessages.en,
  contextTitle:"文脈を編集",
  contextHint:"原文の文は読み取り専用です。学習分析とメモのみ変更できます",
  contextMeaning:"この文での意味",
  sentenceTranslation:"文全体の訳",
  usageNote:"用法のヒント",
  contextNote:"文脈学習メモ",
  saveContext:"文脈を保存",
  cardTitle:"単語カードを編集",
  word:"単語",
  translation:"中国語訳",
  phonetic:"発音",
  definition:"語義",
  note:"メモ",
  saveChanges:"変更を保存"
};
cardEditorMessages.ko = {
  ...cardEditorMessages.en,
  contextTitle:"문맥 편집",
  contextHint:"원문 문장은 읽기 전용입니다. 학습 분석과 메모만 수정할 수 있습니다",
  contextMeaning:"이 문장에서의 뜻",
  sentenceTranslation:"문장 전체 번역",
  usageNote:"용법 안내",
  contextNote:"문맥 학습 메모",
  saveContext:"문맥 저장",
  cardTitle:"단어 카드 편집",
  word:"단어",
  translation:"중국어 번역",
  phonetic:"발음",
  definition:"뜻",
  note:"메모",
  saveChanges:"변경 저장"
};
cardEditorMessages.fr = {
  ...cardEditorMessages.en,
  contextTitle:"Modifier le contexte",
  contextHint:"La phrase source est en lecture seule. Seuls l’analyse et les notes peuvent être modifiés",
  contextMeaning:"Sens dans cette phrase",
  sentenceTranslation:"Traduction de la phrase",
  usageNote:"Conseil d’usage",
  contextNote:"Note d’étude du contexte",
  saveContext:"Enregistrer le contexte",
  cardTitle:"Modifier la carte de vocabulaire",
  word:"Mot",
  translation:"Traduction chinoise",
  phonetic:"Prononciation",
  definition:"Définition",
  note:"Note",
  saveChanges:"Enregistrer les modifications"
};
cardEditorMessages.de = {
  ...cardEditorMessages.en,
  contextTitle:"Kontext bearbeiten",
  contextHint:"Der Quellsatz ist schreibgeschützt. Nur Lernanalyse und Notizen können geändert werden",
  contextMeaning:"Bedeutung in diesem Satz",
  sentenceTranslation:"Satzübersetzung",
  usageNote:"Hinweis zur Verwendung",
  contextNote:"Lernnotiz zum Kontext",
  saveContext:"Kontext speichern",
  cardTitle:"Vokabelkarte bearbeiten",
  word:"Wort",
  translation:"Chinesische Übersetzung",
  phonetic:"Aussprache",
  definition:"Bedeutung",
  note:"Notiz",
  saveChanges:"Änderungen speichern"
};
cardEditorMessages.es = {
  ...cardEditorMessages.en,
  contextTitle:"Editar contexto",
  contextHint:"La oración original es de solo lectura. Solo se pueden modificar el análisis y las notas",
  contextMeaning:"Significado en esta oración",
  sentenceTranslation:"Traducción de la oración",
  usageNote:"Nota de uso",
  contextNote:"Nota de estudio del contexto",
  saveContext:"Guardar contexto",
  cardTitle:"Editar tarjeta de vocabulario",
  word:"Palabra",
  translation:"Traducción al chino",
  phonetic:"Pronunciación",
  definition:"Definición",
  note:"Nota",
  saveChanges:"Guardar cambios"
};
export function cardEditorT(language: DisplayLanguage, key: CardEditorUiKey) {
  return cardEditorMessages[language]?.[key] ?? cardEditorMessages["zh-CN"][key] ?? key;
}
