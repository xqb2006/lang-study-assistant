import { describe, expect, test } from "vitest";
import {
  createAiReviewGroups,
  createSmartImportCacheKey,
  prepareLocalBookImport,
} from "./localImportAssessment";
import type { BookContentPackage } from "./bookContentPackage";

function createBook(chapters: BookContentPackage["chapters"]): BookContentPackage {
  return {
    format: "reading-agent-book",
    version: 1,
    exportedAt: "2026-08-09T00:00:00.000Z",
    book: { title: "Test book", author: "", description: "", language: "en" },
    chapters,
  };
}

describe("local import assessment", () => {
  test("removes standalone page numbers and duplicate lines", () => {
    const prepared = prepareLocalBookImport(createBook([
      {
        title: "Chapter 1",
        sourceText: "A stable paragraph with enough content to assess locally.\n1\nA stable paragraph with enough content to assess locally.",
        translationText: "",
      },
    ]));
    expect(prepared.book.chapters[0].sourceText).not.toContain("\n1\n");
    expect(prepared.assessment.removedNoiseLines).toBe(2);
  });

  test("marks malformed content for AI review", () => {
    const prepared = prepareLocalBookImport(createBook([
      { title: "第 1 章", sourceText: "�\n1. Question\nA. One\n答案：A", translationText: "" },
    ]));
    expect(prepared.assessment.reviewIndexes).toEqual([0]);
    expect(prepared.assessment.chapters[0].confidence).toBe("low");
  });

  test("groups adjacent review chapters and creates stable cache keys", () => {
    const book = createBook([
      { title: "One", sourceText: "one", translationText: "" },
      { title: "Two", sourceText: "two", translationText: "" },
      { title: "Three", sourceText: "three", translationText: "" },
    ]);
    const groups = createAiReviewGroups(book, [2, 0, 1]);
    expect(groups).toHaveLength(1);
    expect(groups[0].startIndex).toBe(0);
    expect(groups[0].endIndex).toBe(2);
    expect(createSmartImportCacheKey(book, groups[0], "en")).toMatch(/^reading-agent\.smart-import\.v1\.en\.0-2\./);
  });
});