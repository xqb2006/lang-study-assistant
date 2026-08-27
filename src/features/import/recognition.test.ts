import { describe, expect, it } from "vitest";
import { collectHandwritingReviewPages, createChapterPhotoDraft, createLocalOcrPageResult, createRecognitionBatches, mergeVisualTocEntries } from "./recognition";

describe("visual import review metadata", () => {
  it("collects unique positive handwriting-review page numbers", () => {
    expect(collectHandwritingReviewPages([
      { documentType: "reading", title: "", paragraphs: [], questions: [], handwritingPages: [3, 1, 3, 0] },
      { documentType: "mixed", title: "", paragraphs: [], questions: [], handwritingPages: [2, -1, 1] },
    ])).toEqual([1, 2, 3]);
  });

  it("keeps one directory context entry per title", () => {
    expect(mergeVisualTocEntries([
      { title: "Chapter 1", printedPageNumber: 1 },
      { title: " chapter 1 ", printedPageNumber: 1 },
      { title: "Chapter 2", printedPageNumber: 12 },
    ])).toEqual([{ title: "Chapter 1", printedPageNumber: 1 }, { title: "Chapter 2", printedPageNumber: 12 }]);
  });

  it("splits visual material by verified chapter starts", () => {
    const draft = createChapterPhotoDraft([{ documentType: "reading", title: "Book", questions: [], paragraphs: [
      { sourceText: "One", translation: "", needsReview: false, pageStart: 2 },
      { sourceText: "Two", translation: "", needsReview: false, pageStart: 4 },
    ], chapterStarts: [
      { title: "Chapter 1", pageNumber: 2, confidence: 0.9 },
      { title: "Chapter 2", pageNumber: 4, confidence: 0.9 },
    ] }], "Fallback");

    expect(draft.chapterDrafts).toEqual([
      { title: "Chapter 1", sourceText: "One", translationText: "" },
      { title: "Chapter 2", sourceText: "Two", translationText: "" },
    ]);
  });

  it("keeps original PDF page numbers across rendered segments", () => {
    const batches = createRecognitionBatches([{ id: "p31", name: "page", imageData: "data:image/jpeg;base64,a", rotation: 0, sourcePageNumber: 31, status: "waiting" }]);
    expect(batches[0][0].pageNumber).toBe(31);
  });

  it("rebuilds final chapters from archived and current PDF segments", () => {
    const archived = { documentType: "reading" as const, title: "Book", questions: [], paragraphs: [
      { sourceText: "First segment", translation: "", needsReview: false, pageStart: 1 },
    ], chapterStarts: [{ title: "Chapter 1", pageNumber: 1, confidence: 0.9 }] };
    const current = { documentType: "reading" as const, title: "", questions: [], paragraphs: [
      { sourceText: "Second segment", translation: "", needsReview: false, pageStart: 31 },
    ], chapterStarts: [{ title: "Chapter 2", pageNumber: 31, confidence: 0.9 }] };

    expect(createChapterPhotoDraft([archived, current], "Fallback").chapterDrafts).toEqual([
      { title: "Chapter 1", sourceText: "First segment", translationText: "" },
      { title: "Chapter 2", sourceText: "Second segment", translationText: "" },
    ]);
  });

  it("keeps a local OCR page together and detects its article title", () => {
    expect(createLocalOcrPageResult(7, [
      { text: "The Secret Life of Trees" },
      { text: "Trees communicate through underground fungal networks." },
    ])).toMatchObject({
      paragraphs: [{ sourceText: "The Secret Life of Trees\nTrees communicate through underground fungal networks.", pageStart: 7 }],
      chapterStarts: [{ title: "The Secret Life of Trees", pageNumber: 7 }],
    });
  });

  it("does not create duplicate articles for repeated local OCR page headers", () => {
    const first = createLocalOcrPageResult(1, [{ text: "UNIT 3 WILDLIFE" }, { text: "The first page starts here." }]);
    const second = createLocalOcrPageResult(2, [{ text: "UNIT 3 WILDLIFE" }, { text: "The article continues here." }]);

    expect(createChapterPhotoDraft([first, second], "Fallback").chapterDrafts).toEqual([
      {
        title: "UNIT 3 WILDLIFE",
        sourceText: "UNIT 3 WILDLIFE\nThe first page starts here.\n\nUNIT 3 WILDLIFE\nThe article continues here.",
        translationText: "",
      },
    ]);
  });

  it("extracts local OCR directory entries without treating them as article starts", () => {
    expect(createLocalOcrPageResult(3, [
      { text: "CONTENTS" },
      { text: "The Secret Life of Trees .... 12" },
      { text: "Living with Wolves  25" },
    ])).toMatchObject({
      tocEntries: [
        { title: "The Secret Life of Trees", printedPageNumber: 12 },
        { title: "Living with Wolves", printedPageNumber: 25 },
      ],
      chapterStarts: [],
    });
  });
});
