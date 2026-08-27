import { describe, expect, it } from "vitest";
import { createBookContentPackage } from "./bookContentPackage";
import { classifyBookContent } from "./contentClassification";

describe("classifyBookContent", () => {
  it("keeps reading text, translations, and questions in separate structures", () => {
    const result = classifyBookContent(createBookContentPackage({
      title: "Urban Foxes",
      author: "",
      description: "",
      language: "en",
      chapters: [{
        title: "Imported content",
        sourceText: [
          "The Hidden Life of Urban Foxes",
          "Urban foxes live near parks and look for food after dark.",
          "城市狐狸经常生活在公园附近，并在天黑后寻找食物。",
          "1. Why do foxes enter cities?",
          "A. To find food.",
          "B. To avoid people.",
          "答案：A",
          "解析：根据第一段，狐狸会在城市里寻找食物。",
        ].join("\n"),
        translationText: "",
      }],
    }));

    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].title).toBe("The Hidden Life of Urban Foxes");
    expect(result.chapters[0].sourceText).toContain("Urban foxes live near parks");
    expect(result.chapters[0].sourceText).not.toContain("A. To find food.");
    expect(result.chapters[0].translationText).toContain("城市狐狸经常生活在公园附近");
    expect(result.chapters[0].translationText).not.toContain("答案");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].options).toHaveLength(2);
    expect(result.questions[0].answer).toBe("A");
    expect(result.questions[0].explanation).toContain("第一段");
    expect(result.blocks.find((block) => block.text.startsWith("A."))?.type).toBe("option");
    expect(result.blocks.find((block) => block.text.startsWith("A."))?.locked).toBe(true);
  });

  it("does not promote a complete English sentence to a title", () => {
    const result = classifyBookContent(createBookContentPackage({
      title: "Test",
      author: "",
      description: "",
      language: "en",
      chapters: [{
        title: "Imported content",
        sourceText: "This Complete Sentence Has Capital Words.\nIt remains ordinary reading text.",
        translationText: "",
      }],
    }));

    expect(result.blocks[0].type).toBe("paragraph");
    expect(result.chapters[0].title).toBe("Imported content");
  });

  it("preserves an existing translation field as translation", () => {
    const result = classifyBookContent(createBookContentPackage({
      title: "Test",
      author: "",
      description: "",
      language: "en",
      chapters: [{
        title: "Article",
        sourceText: "Birds migrate when the weather changes.",
        translationText: "当天气变化时，鸟类会迁徙。",
      }],
    }));

    expect(result.chapters[0].sourceText).toContain("Birds migrate");
    expect(result.chapters[0].translationText).toBe("当天气变化时，鸟类会迁徙。");
    expect(result.blocks[result.blocks.length - 1]?.type).toBe("translation");
    expect(result.blocks[result.blocks.length - 1]?.locked).toBe(true);
  });
});