import type {
  DisplayLanguage
} from "../types";
import {
  interpolate
} from "../interpolate";

type ChapterUiKey = "title" | "hint" | "loadFailed" | "sourceRequired" | "savedSourceChanged" | "savedTranslation" | "saveFailed" | "paragraph" | "source" | "translation" | "translationPlaceholder" | "saving" | "saveChanges";
const chapterMessages: Record<DisplayLanguage, Partial<Record<ChapterUiKey, string>>> = {
  "zh-CN": {
    title:"编辑本章 · {title}",
    hint:"可逐段修正导入后的正文原文和中文译文。修改正文原文后，该章旧高亮会自动清除，避免标记位置错乱。",
    loadFailed:"无法加载章节内容：{error}",
    sourceRequired:"正文原文不能为空",
    savedSourceChanged:"已保存。正文原文变更后，旧高亮已自动清除。",
    savedTranslation:"译文已保存",
    saveFailed:"保存失败：{error}",
    paragraph:"段落",
    source:"正文原文",
    translation:"中文译文",
    translationPlaceholder:"可留空，之后使用 AI 补译",
    saving:"正在保存…",
    saveChanges:"保存本章修改"
  },
  "zh-TW": {
    title:"編輯本章 · {title}",
    hint:"可逐段修正匯入後的正文原文和中文譯文。修改正文原文後，該章舊標示會自動清除，避免標記位置錯亂。",
    loadFailed:"無法載入章節內容：{error}",
    sourceRequired:"正文原文不可為空",
    savedSourceChanged:"已儲存。正文原文變更後，舊標示已自動清除。",
    savedTranslation:"譯文已儲存",
    saveFailed:"儲存失敗：{error}",
    paragraph:"段落",
    source:"正文原文",
    translation:"中文譯文",
    translationPlaceholder:"可留空，之後使用 AI 補譯",
    saving:"正在儲存…",
    saveChanges:"儲存本章修改"
  },
  en: {
    title:"Edit chapter · {title}",
    hint:"Correct the imported source text and Chinese translation paragraph by paragraph. Changing the source text clears old highlights in this chapter to prevent misplaced marks.",
    loadFailed:"Unable to load chapter content: {error}",
    sourceRequired:"Source text cannot be empty",
    savedSourceChanged:"Saved. Old highlights were cleared because the source text changed.",
    savedTranslation:"Translation saved",
    saveFailed:"Save failed: {error}",
    paragraph:"Paragraph",
    source:"Source text",
    translation:"Chinese translation",
    translationPlaceholder:"Leave blank to complete later with AI",
    saving:"Saving…",
    saveChanges:"Save chapter changes"
  },
  ja: {},
  ko: {},
  fr: {},
  de: {},
  es: {},
};
chapterMessages.ja = {
  ...chapterMessages.en,
  title:"章を編集 · {title}",
  hint:"取り込んだ本文と中国語訳を段落ごとに修正できます。本文を変更すると位置ずれを防ぐため、この章の古いハイライトは自動的に削除されます",
  loadFailed:"章の内容を読み込めません: {error}",
  sourceRequired:"本文は空にできません",
  savedSourceChanged:"保存しました。本文変更により古いハイライトを削除しました",
  savedTranslation:"訳を保存しました",
  saveFailed:"保存できません: {error}",
  paragraph:"段落",
  source:"本文",
  translation:"中国語訳",
  translationPlaceholder:"空欄のままにして後でAI補訳できます",
  saving:"保存中…",
  saveChanges:"章の変更を保存"
};
chapterMessages.ko = {
  ...chapterMessages.en,
  title:"장 편집 · {title}",
  hint:"가져온 본문과 중국어 번역을 문단별로 수정할 수 있습니다. 본문을 바꾸면 위치 오류를 막기 위해 이 장의 기존 강조 표시가 자동으로 삭제됩니다",
  loadFailed:"장 내용을 불러오지 못했습니다: {error}",
  sourceRequired:"본문은 비워 둘 수 없습니다",
  savedSourceChanged:"저장되었습니다. 본문 변경으로 기존 강조 표시를 삭제했습니다",
  savedTranslation:"번역을 저장했습니다",
  saveFailed:"저장 실패: {error}",
  paragraph:"문단",
  source:"본문",
  translation:"중국어 번역",
  translationPlaceholder:"비워 두고 나중에 AI로 보완할 수 있습니다",
  saving:"저장 중…",
  saveChanges:"장 변경 저장"
};
chapterMessages.fr = {
  ...chapterMessages.en,
  title:"Modifier le chapitre · {title}",
  hint:"Corrigez le texte source et la traduction chinoise paragraphe par paragraphe. Modifier le texte source supprime les anciens surlignages de ce chapitre pour éviter les erreurs de position",
  loadFailed:"Impossible de charger le chapitre : {error}",
  sourceRequired:"Le texte source ne peut pas être vide",
  savedSourceChanged:"Enregistré. Les anciens surlignages ont été supprimés car le texte source a changé",
  savedTranslation:"Traduction enregistrée",
  saveFailed:"Échec de l’enregistrement : {error}",
  paragraph:"Paragraphe",
  source:"Texte source",
  translation:"Traduction chinoise",
  translationPlaceholder:"Laissez vide pour compléter plus tard avec l’IA",
  saving:"Enregistrement…",
  saveChanges:"Enregistrer les modifications"
};
chapterMessages.de = {
  ...chapterMessages.en,
  title:"Kapitel bearbeiten · {title}",
  hint:"Korrigieren Sie Quelltext und chinesische Übersetzung absatzweise. Änderungen am Quelltext löschen alte Hervorhebungen dieses Kapitels, um Positionsfehler zu verhindern",
  loadFailed:"Kapitelinhalt konnte nicht geladen werden: {error}",
  sourceRequired:"Der Quelltext darf nicht leer sein",
  savedSourceChanged:"Gespeichert. Alte Hervorhebungen wurden wegen der Quelltextänderung gelöscht",
  savedTranslation:"Übersetzung gespeichert",
  saveFailed:"Speichern fehlgeschlagen: {error}",
  paragraph:"Absatz",
  source:"Quelltext",
  translation:"Chinesische Übersetzung",
  translationPlaceholder:"Leer lassen und später mit KI ergänzen",
  saving:"Wird gespeichert…",
  saveChanges:"Kapiteländerungen speichern"
};
chapterMessages.es = {
  ...chapterMessages.en,
  title:"Editar capítulo · {title}",
  hint:"Corrige el texto original y la traducción al chino párrafo por párrafo. Al cambiar el texto original se eliminan los resaltados antiguos del capítulo para evitar posiciones incorrectas",
  loadFailed:"No se puede cargar el capítulo: {error}",
  sourceRequired:"El texto original no puede estar vacío",
  savedSourceChanged:"Guardado. Se eliminaron los resaltados antiguos porque cambió el texto original",
  savedTranslation:"Traducción guardada",
  saveFailed:"Error al guardar: {error}",
  paragraph:"Párrafo",
  source:"Texto original",
  translation:"Traducción al chino",
  translationPlaceholder:"Déjalo vacío para completarlo luego con IA",
  saving:"Guardando…",
  saveChanges:"Guardar cambios del capítulo"
};
export function chapterT(language: DisplayLanguage, key: ChapterUiKey, replacements: Record<string, string | number> = {}) {
  return interpolate(chapterMessages[language]?.[key] ?? chapterMessages["zh-CN"][key] ?? key,
  replacements);
}
