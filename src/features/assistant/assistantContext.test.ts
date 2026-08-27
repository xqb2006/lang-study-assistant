import { describe, expect, test } from "vitest";
import { decideAssistantContext, decideAssistantIntent, resolveAssistantContextPlan } from "./assistantContext";

describe("assistant context decision", () => {
  test("词汇问题优先使用当前选句", () => {
    expect(decideAssistantContext("这个词是什么意思？", true)).toBe("selection");
  });

  test("句子理解问题识别为句子任务", () => {
    expect(decideAssistantIntent("这句话是什么意思？")).toBe("sentence");
  });

  test("段落理解问题使用当前段落", () => {
    expect(decideAssistantContext("这一段的主旨是什么？", false)).toBe("paragraph");
  });

  test("章节总结问题使用当前章节", () => {
    expect(decideAssistantContext("总结这一章的主要内容", false)).toBe("chapter");
  });

  test("学习方法问题不附带正文", () => {
    expect(decideAssistantContext("怎么记住这个单词？", true)).toBe("none");
  });

  test("计划内容保留范围标签并限制上下文长度", () => {
    const plan = resolveAssistantContextPlan({
      question: "这一段讲了什么？",
      selection: null,
      selectionReferenceEnabled: false,
      currentParagraph: { position: 2, sourceText: "A paragraph.", translation: "一段文字。" },
      articleContent: "A chapter.",
    });
    expect(plan.mode).toBe("paragraph");
    expect(plan.label).toBe("当前段落");
    expect(plan.context).toContain("A paragraph.");
  });
});

