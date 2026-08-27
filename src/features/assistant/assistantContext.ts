import type { ReaderParagraphContext } from "../../components/BilingualArticle";
import type { Selection } from "../cards/types";

export type AssistantContextMode = "none" | "selection" | "paragraph" | "chapter";
export type AssistantIntent = "vocabulary" | "sentence" | "paragraph" | "chapter" | "study" | "casual";

export type AssistantContextPlan = {
  mode: AssistantContextMode;
  intent: AssistantIntent;
  label: string;
  context: string;
};

function compactText(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const head = Math.ceil(limit * 0.7);
  const tail = Math.max(0, limit - head - 16);
  return `${normalized.slice(0, head)} …（中间内容已省略）… ${normalized.slice(-tail)}`;
}

export function decideAssistantIntent(question: string): AssistantIntent {
  const normalized = question.trim().toLowerCase();
  if (!normalized) return "casual";
  if (/学习方法|怎么学|如何学习|怎么记住|如何记住|复习|背单词|考试|四级|六级|计划|记忆/.test(normalized)) return "study";
  if (/全文|整篇|文章主旨|文章主题|本文讲|这篇文章|这一章|本章|人物|情节|结构|总结|概括/.test(normalized)) return "chapter";
  if (/这一段|这段|上下文|指代|前后句|这几句|段落|段意|逻辑|关系/.test(normalized)) return "paragraph";
  if (/这句话|这个句子|本句|句子|怎么翻译|怎么理解|语法|时态|主干|从句|修饰|为什么用/.test(normalized)) return "sentence";
  if (/这个词|该词|单词|词义|词性|短语|搭配|发音|拼写|是什么意思|怎么读/.test(normalized)) return "vocabulary";
  return "casual";
}

export function decideAssistantContext(question: string, hasSelection: boolean): AssistantContextMode {
  const intent = decideAssistantIntent(question);
  if (!question.trim()) return hasSelection ? "selection" : "none";
  if (intent === "study" || intent === "casual") return "none";
  if (intent === "chapter") return "chapter";
  if (intent === "paragraph") return "paragraph";
  if (intent === "vocabulary" || intent === "sentence") return hasSelection ? "selection" : "paragraph";
  return hasSelection ? "selection" : "paragraph";
}

export function resolveAssistantContextPlan({
  question,
  selection,
  selectionReferenceEnabled,
  currentParagraph,
  articleContent,
}: {
  question: string;
  selection: Selection | null;
  selectionReferenceEnabled: boolean;
  currentParagraph?: ReaderParagraphContext | null;
  articleContent?: string;
}): AssistantContextPlan {
  const selectedSentence = selectionReferenceEnabled ? selection?.contextSentence.trim() || "" : "";
  const intent = decideAssistantIntent(question);
  const mode = decideAssistantContext(question, Boolean(selectedSentence));
  if (mode === "selection" && selectedSentence) return { mode, intent, label: "当前选句", context: compactText(selectedSentence, 1800) };
  if (mode === "paragraph" && currentParagraph?.sourceText.trim()) {
    const translation = currentParagraph.translation.trim();
    return { mode, intent, label: "当前段落", context: `${compactText(currentParagraph.sourceText, 2600)}${translation ? `\n段落译文：${compactText(translation, 1800)}` : ""}` };
  }
  if (mode === "chapter" && articleContent?.trim()) return { mode, intent, label: "当前章节", context: compactText(articleContent, 6000) };
  return { mode: "none", intent, label: "不附带正文", context: "" };
}

