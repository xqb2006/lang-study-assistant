export type PdfTextPage = {
  pageNumber: number;
  text: string;
};

export type PdfChapterRange = {
  id: string;
  title: string;
  printedPageNumber: number;
  pdfPageStart: number;
  pdfPageEnd: number;
  confidence: "high" | "medium" | "low";
  evidence: string;
};

const chapterPrefix = "(?:chapter|unit|lesson|part)\\s+(?:\\d+|[ivxlcdm]+)\\b|第\\s*[一二三四五六七八九十百千万\\d]+\\s*(?:章|节|课)";
const numberedPrefix = "\\d+(?:\\.\\d+)*[.、]\\s+";
const tocLinePattern = new RegExp(`^((?:(?:${chapterPrefix})|(?:${numberedPrefix})).*?)(?:\\s*\\.{2,}\\s*|\\s{3,})(\\d{1,4})$`, "i");

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[\W_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(value: string) {
  return value.replace(/\.{2,}\s*$/, "").replace(/\s+/g, " ").trim();
}

function bodyTitleMatch(pageText: string, title: string) {
  const normalizedTitle = normalize(title);
  if (normalizedTitle.length < 5) return false;
  const firstLines = pageText.split("\n").slice(0, 18).join(" ");
  return normalize(firstLines).includes(normalizedTitle);
}

function nearestBodyPage(pages: PdfTextPage[], title: string, afterPage: number) {
  const exact = pages.find((page) => page.pageNumber > afterPage && bodyTitleMatch(page.text, title));
  return exact?.pageNumber;
}

function inferredPdfPage(printedPageNumber: number, tocLastPage: number, totalPages: number) {
  const minimumBodyStart = Math.min(totalPages, tocLastPage + 1);
  return Math.max(minimumBodyStart, Math.min(totalPages, printedPageNumber + minimumBodyStart - 1));
}

export function findPdfChapterRanges(pages: PdfTextPage[]): PdfChapterRange[] {
  const tocPages = pages.slice(0, Math.min(15, pages.length));
  const rawCandidates: Array<{ title: string; printedPageNumber: number; tocPage: number }> = [];

  for (const page of tocPages) {
    for (const line of page.text.split("\n")) {
      const match = line.trim().match(tocLinePattern);
      if (!match) continue;
      const title = cleanTitle(match[1]);
      const printedPageNumber = Number(match[2]);
      if (!title || !Number.isInteger(printedPageNumber) || printedPageNumber < 1) continue;
      if (rawCandidates.some((candidate) => normalize(candidate.title) === normalize(title))) continue;
      rawCandidates.push({ title, printedPageNumber, tocPage: page.pageNumber });
    }
  }

  const sorted = rawCandidates
    .sort((left, right) => left.printedPageNumber - right.printedPageNumber)
    .slice(0, 120);
  if (!sorted.length) return [];

  const tocLastPage = Math.max(...tocPages.map((page) => page.pageNumber));
  const starts = sorted.map((candidate) => {
    const matchedPage = nearestBodyPage(pages, candidate.title, candidate.tocPage);
    const pdfPageStart = matchedPage ?? inferredPdfPage(candidate.printedPageNumber, tocLastPage, pages.length);
    return {
      ...candidate,
      pdfPageStart,
      confidence: matchedPage ? "high" as const : "low" as const,
      evidence: matchedPage
        ? `目录第 ${candidate.tocPage} 页与 PDF 第 ${matchedPage} 页标题匹配`
        : `按目录页码推测；请核对 PDF 第 ${pdfPageStart} 页`,
    };
  });

  return starts.map((candidate, index) => {
    const nextStart = starts[index + 1]?.pdfPageStart;
    const pdfPageEnd = Math.max(candidate.pdfPageStart, (nextStart ?? pages.length + 1) - 1);
    return {
      id: `pdf-chapter-${index + 1}`,
      title: candidate.title,
      printedPageNumber: candidate.printedPageNumber,
      pdfPageStart: candidate.pdfPageStart,
      pdfPageEnd,
      confidence: candidate.confidence,
      evidence: candidate.evidence,
    };
  });
}

export function normalizePdfChapterRanges(ranges: PdfChapterRange[], totalPages: number): PdfChapterRange[] {
  return ranges
    .map((range) => ({
      ...range,
      title: range.title.trim() || "未命名章节",
      pdfPageStart: Math.max(1, Math.min(totalPages, Math.round(range.pdfPageStart) || 1)),
    }))
    .sort((left, right) => left.pdfPageStart - right.pdfPageStart)
    .map((range, index, items) => ({
      ...range,
      pdfPageEnd: Math.max(range.pdfPageStart, (items[index + 1]?.pdfPageStart ?? totalPages + 1) - 1),
    }));
}

export function chaptersFromPdfRanges(pages: PdfTextPage[], ranges: PdfChapterRange[]) {
  return ranges.map((range) => ({
    title: range.title,
    sourceText: pages
      .filter((page) => page.pageNumber >= range.pdfPageStart && page.pageNumber <= range.pdfPageEnd)
      .map((page) => page.text)
      .filter(Boolean)
      .join("\n\n"),
    translationText: "",
  })).filter((chapter) => chapter.sourceText.trim());
}
