import type {
  DisplayLanguage
} from "../types";
import {
  interpolate
} from "../interpolate";

type LearningUiKey = "workspaceTitle" | "questionCount" | "selected" | "dictionaryLookup" | "contextAnalysis" | "closeSelection" | "optionLabel" | "chooseOption" | "optionsMissing" | "submitting" | "resubmit" | "submit" | "correct" | "incorrect" | "correctAnswer" | "noExplanation" | "sourceLine" | "selectionNotLocated";
const learningMessages: Record<DisplayLanguage, Partial<Record<LearningUiKey, string>>> = {
  "zh-CN": {
    workspaceTitle:"阅读练习",
    questionCount:"{count} 题",
    selected:"已选：{word}",
    dictionaryLookup:"词典查询",
    contextAnalysis:"语境精析",
    closeSelection:"关闭选词工具",
    optionLabel:"第 {index} 题选项",
    chooseOption:"选择选项 {option}",
    optionsMissing:"未识别出可选项，请在题目编辑中补充 A/B/C/D 选项。",
    submitting:"正在提交…",
    resubmit:"再次提交",
    submit:"提交答案",
    correct:"回答正确",
    incorrect:"回答错误",
    correctAnswer:"正确答案：{answer}",
    noExplanation:"暂无解析",
    sourceLine:"原文定位：第 {line} 段",
    selectionNotLocated:"未能定位选词所在句子，请只在单个题干、选项或解析中重新选择"
  },
  "zh-TW": {
    workspaceTitle:"閱讀練習",
    questionCount:"{count} 題",
    selected:"已選：{word}",
    dictionaryLookup:"詞典查詢",
    contextAnalysis:"語境精析",
    closeSelection:"關閉選詞工具",
    optionLabel:"第 {index} 題選項",
    chooseOption:"選擇選項 {option}",
    optionsMissing:"未辨識出可選項，請在題目編輯中補上 A/B/C/D 選項。",
    submitting:"正在提交…",
    resubmit:"再次提交",
    submit:"提交答案",
    correct:"回答正確",
    incorrect:"回答錯誤",
    correctAnswer:"正確答案：{answer}",
    noExplanation:"暫無解析",
    sourceLine:"原文定位：第 {line} 段",
    selectionNotLocated:"無法定位選詞所在句子，請只在單個題幹、選項或解析中重新選擇"
  },
  en: {
    workspaceTitle:"Reading practice",
    questionCount:"{count} questions",
    selected:"Selected: {word}",
    dictionaryLookup:"Dictionary lookup",
    contextAnalysis:"Context analysis",
    closeSelection:"Close selection tools",
    optionLabel:"Question {index} options",
    chooseOption:"Choose option {option}",
    optionsMissing:"No options were recognized. Add A/B/C/D options in question editing.",
    submitting:"Submitting…",
    resubmit:"Submit again",
    submit:"Submit answer",
    correct:"Correct",
    incorrect:"Incorrect",
    correctAnswer:"Correct answer: {answer}",
    noExplanation:"No explanation yet",
    sourceLine:"Source: paragraph {line}",
    selectionNotLocated:"The selected text could not be located in a sentence. Select text within one prompt, option, or explanation."
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
learningMessages.ja = {
  ...learningMessages.en,
  workspaceTitle:"読解練習",
  questionCount:"{count} 問",
  selected:"選択中: {word}",
  dictionaryLookup:"辞書検索",
  contextAnalysis:"文脈分析",
  closeSelection:"選択ツールを閉じる",
  optionLabel:"第{index}問の選択肢",
  chooseOption:"選択肢 {option} を選ぶ",
  optionsMissing:"選択肢を認識できませんでした。問題編集でA/B/C/Dを追加してください",
  submitting:"提出中…",
  resubmit:"もう一度提出",
  submit:"解答を提出",
  correct:"正解",
  incorrect:"不正解",
  correctAnswer:"正解: {answer}",
  noExplanation:"解説はありません",
  sourceLine:"本文: {line}段落",
  selectionNotLocated:"選択した文字を文中で見つけられません。1つの設問、選択肢、解説内で選択してください"
};
learningMessages.ko = {
  ...learningMessages.en,
  workspaceTitle:"독해 연습",
  questionCount:"문제 {count}개",
  selected:"선택됨: {word}",
  dictionaryLookup:"사전 검색",
  contextAnalysis:"문맥 분석",
  closeSelection:"선택 도구 닫기",
  optionLabel:"{index}번 문제 선택지",
  chooseOption:"선택지 {option} 선택",
  optionsMissing:"선택지를 인식하지 못했습니다. 문제 편집에서 A/B/C/D 선택지를 추가하세요",
  submitting:"제출 중…",
  resubmit:"다시 제출",
  submit:"답안 제출",
  correct:"정답",
  incorrect:"오답",
  correctAnswer:"정답: {answer}",
  noExplanation:"해설 없음",
  sourceLine:"본문: {line}문단",
  selectionNotLocated:"선택한 텍스트를 문장에서 찾지 못했습니다. 하나의 문제, 선택지 또는 해설 안에서 선택하세요"
};
learningMessages.fr = {
  ...learningMessages.en,
  workspaceTitle:"Exercices de lecture",
  questionCount:"{count} questions",
  selected:"Sélectionné : {word}",
  dictionaryLookup:"Recherche dans le dictionnaire",
  contextAnalysis:"Analyse du contexte",
  closeSelection:"Fermer les outils de sélection",
  optionLabel:"Options de la question {index}",
  chooseOption:"Choisir l’option {option}",
  optionsMissing:"Aucune option reconnue. Ajoutez les options A/B/C/D dans l’édition de la question",
  submitting:"Envoi…",
  resubmit:"Envoyer à nouveau",
  submit:"Envoyer la réponse",
  correct:"Correct",
  incorrect:"Incorrect",
  correctAnswer:"Bonne réponse : {answer}",
  noExplanation:"Aucune explication",
  sourceLine:"Source : paragraphe {line}",
  selectionNotLocated:"Le texte sélectionné est introuvable dans une phrase. Sélectionnez-le dans une seule question, option ou explication"
};
learningMessages.de = {
  ...learningMessages.en,
  workspaceTitle:"Leseübungen",
  questionCount:"{count} Fragen",
  selected:"Ausgewählt: {word}",
  dictionaryLookup:"Wörterbuchsuche",
  contextAnalysis:"Kontextanalyse",
  closeSelection:"Auswahlwerkzeuge schließen",
  optionLabel:"Optionen zu Frage {index}",
  chooseOption:"Option {option} auswählen",
  optionsMissing:"Keine Optionen erkannt. Ergänzen Sie A/B/C/D bei der Fragenbearbeitung",
  submitting:"Wird eingereicht…",
  resubmit:"Erneut einreichen",
  submit:"Antwort einreichen",
  correct:"Richtig",
  incorrect:"Falsch",
  correctAnswer:"Richtige Antwort: {answer}",
  noExplanation:"Noch keine Erklärung",
  sourceLine:"Quelle: Absatz {line}",
  selectionNotLocated:"Der ausgewählte Text konnte keinem Satz zugeordnet werden. Wählen Sie Text in genau einer Frage, Option oder Erklärung aus"
};
learningMessages.es = {
  ...learningMessages.en,
  workspaceTitle:"Práctica de lectura",
  questionCount:"{count} preguntas",
  selected:"Seleccionado: {word}",
  dictionaryLookup:"Buscar en el diccionario",
  contextAnalysis:"Análisis del contexto",
  closeSelection:"Cerrar herramientas de selección",
  optionLabel:"Opciones de la pregunta {index}",
  chooseOption:"Elegir la opción {option}",
  optionsMissing:"No se reconocieron opciones. Añade A/B/C/D al editar la pregunta",
  submitting:"Enviando…",
  resubmit:"Enviar de nuevo",
  submit:"Enviar respuesta",
  correct:"Correcto",
  incorrect:"Incorrecto",
  correctAnswer:"Respuesta correcta: {answer}",
  noExplanation:"Sin explicación",
  sourceLine:"Fuente: párrafo {line}",
  selectionNotLocated:"No se pudo localizar el texto seleccionado en una oración. Selecciona texto dentro de una sola pregunta, opción o explicación"
};
export function learningT(language: DisplayLanguage, key: LearningUiKey, replacements: Record<string, string | number> = {}) {
  return interpolate(learningMessages[language]?.[key] ?? learningMessages["zh-CN"][key] ?? key,
  replacements);
}
