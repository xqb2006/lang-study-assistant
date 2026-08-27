import { describe, expect, it } from "vitest";
import { chaptersFromPdfRanges, findPdfChapterRanges, normalizePdfChapterRanges } from "./pdfChapterIndex";

const pages = [
  { pageNumber: 1, text: "Contents\nChapter 1 Getting Started ........ 1\nChapter 2 Reading Carefully ....... 5" },
  { pageNumber: 2, text: "Copyright" },
  { pageNumber: 3, text: "Chapter 1 Getting Started\nFirst chapter text." },
  { pageNumber: 4, text: "More first chapter text." },
  { pageNumber: 5, text: "Chapter 2 Reading Carefully\nSecond chapter text." },
];

describe("PDF chapter index", () => {
  it("uses directory entries and matching body headings to build page ranges", () => {
    const ranges = findPdfChapterRanges(pages);

    expect(ranges).toEqual([
      expect.objectContaining({ title: "Chapter 1 Getting Started", pdfPageStart: 3, pdfPageEnd: 4, confidence: "high" }),
      expect.objectContaining({ title: "Chapter 2 Reading Carefully", pdfPageStart: 5, pdfPageEnd: 5, confidence: "high" }),
    ]);
  });

  it("recalculates ranges after a manual start-page correction", () => {
    const ranges = normalizePdfChapterRanges([
      { id: "first", title: "First", printedPageNumber: 1, pdfPageStart: 2, pdfPageEnd: 2, confidence: "low", evidence: "manual" },
      { id: "second", title: "Second", printedPageNumber: 5, pdfPageStart: 5, pdfPageEnd: 5, confidence: "low", evidence: "manual" },
    ], 6);

    expect(ranges.map((range) => [range.pdfPageStart, range.pdfPageEnd])).toEqual([[2, 4], [5, 6]]);
    expect(chaptersFromPdfRanges(pages, ranges)[0].sourceText).toContain("Copyright");
  });
});
