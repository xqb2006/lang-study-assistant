import type {
  DisplayLanguage
} from "../types";
import {
  interpolate
} from "../interpolate";

type AppNoticeUiKey = "deleteProfileTitle" | "deleteProfileMessage" | "unnamedProfile" | "deleteCardTitle" | "deleteCardMessage" | "chapterUpdated" | "currentBook" | "recognitionFilled" | "noQuestions" | "noQuestionsHint";
const appNoticeMessages: Record<DisplayLanguage, Partial<Record<AppNoticeUiKey, string>>> = {
  "zh-CN": {
    deleteProfileTitle:"确认删除模型配置",
    deleteProfileMessage:"将删除模型配置“{name}”及其保存的 URL、Key 和模型列表。",
    unnamedProfile:"未命名配置",
    deleteCardTitle:"确认删除单词卡片",
    deleteCardMessage:"将删除“{word}”的 {count} 条语境及对应原文高亮。删除后可以在同一位置重新创建卡片。",
    chapterUpdated:"章节内容已更新",
    currentBook:"当前书籍",
    recognitionFilled:"识别结果已填入章节校对区",
    noQuestions:"本篇文章还没有阅读题",
    noQuestionsHint:"可在上方粘贴或导入题目文件，也可以上传题目照片进行识别。"
  },
  "zh-TW": {
    deleteProfileTitle:"確認刪除模型設定",
    deleteProfileMessage:"將刪除模型設定「{name}」及其儲存的 URL、Key 和模型列表。",
    unnamedProfile:"未命名設定",
    deleteCardTitle:"確認刪除單字卡片",
    deleteCardMessage:"將刪除「{word}」的 {count} 條語境及對應原文標示。刪除後可在同一位置重新建立卡片。",
    chapterUpdated:"章節內容已更新",
    currentBook:"目前書籍",
    recognitionFilled:"辨識結果已填入章節校對區",
    noQuestions:"本篇文章還沒有閱讀題",
    noQuestionsHint:"可在上方貼上或匯入題目檔案，也可上傳題目照片辨識。"
  },
  en: {
    deleteProfileTitle:"Delete model profile",
    deleteProfileMessage:"This deletes the model profile “{name}” and its saved URL, key, and model list.",
    unnamedProfile:"Unnamed profile",
    deleteCardTitle:"Delete vocabulary card",
    deleteCardMessage:"This deletes “{word}”, its {count} contexts, and matching source highlights. You can create a card again at the same location.",
    chapterUpdated:"Chapter content updated",
    currentBook:"Current book",
    recognitionFilled:"Recognition results were added to the chapter review area",
    noQuestions:"This article has no reading questions",
    noQuestionsHint:"Paste or import a question file above, or upload a question photo for recognition."
  },
  ja: {},
  ko: {},
  fr: {},
  de: {},
  es: {},
};
appNoticeMessages.ja = {
  ...appNoticeMessages.en,
  deleteProfileTitle:"モデル設定を削除",
  deleteProfileMessage:"モデル設定「{name}」と保存済みのURL、キー、モデル一覧を削除します",
  unnamedProfile:"名前のない設定",
  deleteCardTitle:"単語カードを削除",
  deleteCardMessage:"「{word}」の {count} 件の文脈と対応する本文ハイライトを削除します。同じ場所で再度カードを作成できます",
  chapterUpdated:"章の内容を更新しました",
  currentBook:"現在の書籍",
  recognitionFilled:"認識結果を章の確認エリアに入力しました",
  noQuestions:"この記事には読解問題がありません",
  noQuestionsHint:"上で問題ファイルを貼り付けまたは取り込むか、問題写真をアップロードして認識できます"
}; appNoticeMessages.ko = {
  ...appNoticeMessages.en,
  deleteProfileTitle:"모델 구성 삭제",
  deleteProfileMessage:"모델 구성 “{name}”과 저장된 URL, 키, 모델 목록을 삭제합니다",
  unnamedProfile:"이름 없는 구성",
  deleteCardTitle:"단어 카드 삭제",
  deleteCardMessage:"“{word}”의 문맥 {count}개와 해당 원문 강조 표시를 삭제합니다. 같은 위치에서 카드를 다시 만들 수 있습니다",
  chapterUpdated:"장 내용이 업데이트되었습니다",
  currentBook:"현재 책",
  recognitionFilled:"인식 결과를 장 검토 영역에 채웠습니다",
  noQuestions:"이 글에는 독해 문제가 없습니다",
  noQuestionsHint:"위에서 문제 파일을 붙여넣거나 가져오고, 문제 사진을 업로드하여 인식할 수도 있습니다"
}; appNoticeMessages.fr = {
  ...appNoticeMessages.en,
  deleteProfileTitle:"Supprimer la configuration du modèle",
  deleteProfileMessage:"Cette action supprime la configuration « {name} », ainsi que son URL, sa clé et sa liste de modèles enregistrées",
  unnamedProfile:"Configuration sans nom",
  deleteCardTitle:"Supprimer la carte de vocabulaire",
  deleteCardMessage:"Cette action supprime « {word} », ses {count} contextes et les surlignages correspondants. Vous pourrez recréer une carte au même endroit",
  chapterUpdated:"Contenu du chapitre mis à jour",
  currentBook:"Livre actuel",
  recognitionFilled:"Les résultats de reconnaissance ont été ajoutés à la zone de vérification du chapitre",
  noQuestions:"Cet article ne comporte aucune question de lecture",
  noQuestionsHint:"Collez ou importez un fichier de questions ci-dessus, ou téléversez une photo de questions pour la reconnaissance"
}; appNoticeMessages.de = {
  ...appNoticeMessages.en,
  deleteProfileTitle:"Modellprofil löschen",
  deleteProfileMessage:"Dadurch werden das Modellprofil „{name}“ sowie die gespeicherte URL, der Schlüssel und die Modellliste gelöscht",
  unnamedProfile:"Unbenanntes Profil",
  deleteCardTitle:"Vokabelkarte löschen",
  deleteCardMessage:"Dadurch werden „{word}“, die {count} Kontexte und zugehörige Quellhervorhebungen gelöscht. An derselben Stelle kann erneut eine Karte erstellt werden",
  chapterUpdated:"Kapitelinhalt aktualisiert",
  currentBook:"Aktuelles Buch",
  recognitionFilled:"Erkennungsergebnisse wurden in den Prüfbereich des Kapitels eingetragen",
  noQuestions:"Dieser Artikel enthält keine Lesefragen",
  noQuestionsHint:"Fügen Sie oben eine Fragendatei ein oder importieren Sie sie, oder laden Sie ein Fragefoto zur Erkennung hoch"
}; appNoticeMessages.es = {
  ...appNoticeMessages.en,
  deleteProfileTitle:"Eliminar perfil del modelo",
  deleteProfileMessage:"Esto eliminará el perfil “{name}”, su URL, clave y lista de modelos guardadas",
  unnamedProfile:"Perfil sin nombre",
  deleteCardTitle:"Eliminar tarjeta de vocabulario",
  deleteCardMessage:"Esto eliminará “{word}”, sus {count} contextos y los resaltados correspondientes. Puedes volver a crear una tarjeta en el mismo lugar",
  chapterUpdated:"Contenido del capítulo actualizado",
  currentBook:"Libro actual",
  recognitionFilled:"Los resultados del reconocimiento se añadieron al área de revisión del capítulo",
  noQuestions:"Este artículo no tiene preguntas de lectura",
  noQuestionsHint:"Pega o importa arriba un archivo de preguntas, o sube una foto de preguntas para reconocerla"
};
export function appNoticeT(language: DisplayLanguage, key: AppNoticeUiKey, replacements: Record<string, string | number> = {}) {
  return interpolate(appNoticeMessages[language]?.[key] ?? appNoticeMessages["zh-CN"][key] ?? key,
  replacements);
}
