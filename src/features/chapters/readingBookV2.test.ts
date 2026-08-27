import { describe, expect, test } from "vitest";
import { createReadingBookPackage, parseBookContentPackage } from "./bookContentPackage";

describe("readingbook v2", () => {
  test("stores article boundaries and source blocks while keeping v1 fields", () => {
    const packageData = createReadingBookPackage({
      book: { title: "Portable", author: "Reader", description: "", language: "en" },
      chapters: [{ title: "Article 1", sourceText: "A paragraph", translationText: "译文" }],
      articles: [{ index: 0, title: "Article 1", chapterIndex: 0, confidence: "medium" }],
      sourceBlocks: [{ id: "article-1-block-1", articleIndex: 0, blockType: "paragraph", text: "A paragraph", confidence: 1 }],
    });
    const parsed = parseBookContentPackage(JSON.stringify(packageData));
    expect(parsed.version).toBe(2);
    expect(parsed.articles?.[0].title).toBe("Article 1");
    expect(parsed.sourceBlocks?.[0].id).toBe("article-1-block-1");
    expect(parsed.chapters[0].translationText).toBe("译文");
  });
});