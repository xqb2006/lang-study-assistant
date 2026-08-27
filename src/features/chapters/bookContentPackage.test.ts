import { describe, expect, it } from "vitest";
import {
  createBookContentPackage,
  createEpubBytes,
  isLocalBookImportCancelled,
  LocalBookImportCancelledError,
  parseBookContentPackage,
  resolveImportLanguage,
  splitBookText,
} from "./bookContentPackage";

describe("book content package", () => {
  it("only keeps portable book metadata and chapter content", () => {
    const packageData = createBookContentPackage({
      title: "A local book",
      author: "Reader",
      description: "Portable content only",
      language: "en",
      chapters: [{ title: "Chapter 1", sourceText: "Source paragraph", translationText: "译文段落" }],
    });

    expect(packageData).toMatchObject({
      format: "reading-agent-book",
      version: 1,
      book: { title: "A local book", language: "en" },
      chapters: [{ title: "Chapter 1", sourceText: "Source paragraph", translationText: "译文段落" }],
    });
    expect(JSON.stringify(packageData)).not.toContain("markings");
    expect(JSON.stringify(packageData)).not.toContain("wordCards");
    expect(JSON.stringify(packageData)).not.toContain("learningProgress");
  });

  it("accepts valid content packages and ignores unsupported personal fields", () => {
    const parsed = parseBookContentPackage(JSON.stringify({
      format: "reading-agent-book",
      version: 1,
      exportedAt: "2026-08-08T00:00:00.000Z",
      book: { title: "Imported", author: "", description: "", language: "en" },
      chapters: [{ title: "Chapter 1", sourceText: "Text", translationText: "Translation" }],
      markings: [{ word: "private" }],
      cards: [{ word: "private" }],
    }));

    expect(parsed.chapters).toHaveLength(1);
    expect(parsed).not.toHaveProperty("markings");
    expect(parsed).not.toHaveProperty("cards");
  });

  it("rejects packages without a usable book or chapter", () => {
    expect(() => parseBookContentPackage(JSON.stringify({
      format: "reading-agent-book",
      version: 1,
      book: { title: "", language: "en" },
      chapters: [],
    }))).toThrow("缺少书名或可导入章节");
  });

  it("splits common Markdown, English, and Chinese chapter headings without AI", () => {
    expect(splitBookText("# First chapter\nFirst text\n\nChapter 2 Next\nSecond text")).toMatchObject([
      { title: "First chapter", sourceText: "First text" },
      { title: "Chapter 2 Next", sourceText: "Second text" },
    ]);
    expect(splitBookText("第一章 开始\n第一段\n\n第 2 章 继续\n第二段")).toMatchObject([
      { title: "第一章 开始", sourceText: "第一段" },
      { title: "第 2 章 继续", sourceText: "第二段" },
    ]);
  });

  it("keeps unstructured local text as a single chapter", () => {
    expect(splitBookText("Only a continuous reading passage.", "Reading")).toEqual([
      { title: "Reading", sourceText: "Only a continuous reading passage.", translationText: "" },
    ]);
  });

  it("creates a portable EPUB with navigation, chapters, and optional translations", async () => {
    const packageData = createBookContentPackage({
      title: "Portable EPUB",
      author: "Reader",
      description: "A local export",
      language: "en",
      chapters: [{ title: "Chapter 1", sourceText: "Original text", translationText: "译文内容" }],
    });
    const JSZip = (await import("jszip")).default;
    const archive = await JSZip.loadAsync(await createEpubBytes(packageData, true));

    expect(await archive.file("mimetype")?.async("text")).toBe("application/epub+zip");
    expect(await archive.file("OEBPS/content.opf")?.async("text")).toContain("Portable EPUB");
    expect(await archive.file("OEBPS/nav.xhtml")?.async("text")).toContain("Chapter 1");
    expect(await archive.file("OEBPS/chapter-001.xhtml")?.async("text")).toContain("译文内容");
  });

  it("identifies cancellation without treating it as a file failure", () => {
    expect(isLocalBookImportCancelled(new LocalBookImportCancelledError())).toBe(true);
    expect(isLocalBookImportCancelled(new Error("PDF_TEXT_EXTRACTION_CANCELLED"))).toBe(true);
    expect(isLocalBookImportCancelled(new Error("invalid epub"))).toBe(false);
  });

  it("uses EPUB language tags first and detects local text as a fallback", () => {
    expect(resolveImportLanguage("en-US", "无关正文")).toBe("en");
    expect(resolveImportLanguage("fr_CA", "English text")).toBe("fr");
    expect(resolveImportLanguage("", "The reader and the writer are from the school, and this book was written for the class.")).toBe("en");
  });
});
