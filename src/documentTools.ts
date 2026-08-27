type ExportParagraph = { position: number; translation: string };
type ExportMark = { word: string; startIndex: number; endIndex: number };
type ExportCard = {
  word: string;
  phonetic: string;
  translation: string;
  definition: string;
  references: { contextSentence: string; sentenceTranslation: string; contextualMeaning: string; usageNote: string }[];
};
type ExportQuestion = {
  prompt: string;
  answer: string;
  explanation: string;
  options: { content: string }[];
};
export type VocabularyExportEntry = {
  word: string;
  phonetic: string;
  definition: string;
};
type DocxApi = typeof import("docx");

function buildVocabularySection(docx: DocxApi, title: string, entries: VocabularyExportEntry[], pageBreakBefore: boolean) {
  const { BorderStyle, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = docx;
  const border = { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" };
  const cell = (text: string, width: number, options: { bold?: boolean; color?: string; font?: string } = {}) => new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, size: 18, bold: options.bold, color: options.color ?? "374151", font: options.font ?? "Microsoft YaHei" })] })],
  });
  const rows = [new TableRow({ children: [cell("序号", 9, { bold: true }), cell("单词", 24, { bold: true }), cell("音标", 25, { bold: true }), cell("基础释义", 42, { bold: true })] })];
  entries.forEach((entry, index) => rows.push(new TableRow({ children: [cell(String(index + 1), 9), cell(entry.word, 24, { bold: true, font: "Georgia" }), cell(entry.phonetic ? `/${entry.phonetic}/` : "—", 25, { font: "Georgia" }), cell(entry.definition || "暂无释义", 42)] })));
  return [
    new Paragraph({ pageBreakBefore, children: [new TextRun({ text: title, bold: true, size: 28, color: "1F2937", font: "Microsoft YaHei" })] }),
    new Paragraph({ children: [new TextRun({ text: `共 ${entries.length} 个词条`, size: 18, color: "6B7280", font: "Microsoft YaHei" })] }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
  ];
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function docxLocalName(node: Node): string {
  return node.nodeType === 1 ? (node as Element).localName : "";
}

function readDocxParagraph(node: Node): string {
  const parts: string[] = [];
  const visit = (current: Node) => {
    const name = docxLocalName(current);
    if (name === "t") {
      parts.push(current.textContent ?? "");
      return;
    }
    if (name === "tab") {
      parts.push("\t");
      return;
    }
    if (name === "br" || name === "cr") {
      parts.push("\n");
      return;
    }
    current.childNodes.forEach(visit);
  };
  visit(node);
  return parts.join("").replace(/[ \t]+\n/g, "\n").trim();
}

export async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const archive = await JSZip.loadAsync(toArrayBuffer(bytes));
  const documentFile = archive.file("word/document.xml");
  if (!documentFile) throw new Error("该 Word 文件缺少正文内容。");
  const xml = await documentFile.async("text");
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("无法解析该 Word 文件的正文内容。");
  const paragraphs = Array.from(document.getElementsByTagName("*")).filter((element) => element.localName === "p");
  const text = paragraphs.map(readDocxParagraph).filter(Boolean).join("\n\n").trim();
  if (!text) throw new Error("该 Word 文件没有可提取的正文内容。");
  return text;
}

async function yieldToBrowser() {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

export type PdfRenderOptions = { startPage?: number; endPage?: number; ocrScale?: number };

export async function getPdfPageCount(bytes: Uint8Array) {
  const pdfjsLib = await import("pdfjs-dist");
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  return pdf.numPages;
}

export async function renderPdfPages(path: string, bytes: Uint8Array, options: PdfRenderOptions = {}) {
  const [pdfjsLib, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const startPage = Math.max(1, Math.min(pdf.numPages, Math.floor(options.startPage ?? 1)));
  const endPage = Math.max(startPage, Math.min(pdf.numPages, Math.floor(options.endPage ?? pdf.numPages)));
  if (endPage - startPage + 1 > 30) throw new Error("单次最多渲染 30 页 PDF，请使用分段读取。");

  const documentName = path.split(/[\\/]/).pop()?.replace(/\.pdf$/i, "") ?? "PDF";
  const pages: { id: string; name: string; imageData: string; ocrImageData?: string; pageNumber: number }[] = [];
  for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.35 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法渲染 PDF 页面");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    let ocrImageData: string | undefined;
    if (options.ocrScale && options.ocrScale > 1.35) {
      const ocrViewport = page.getViewport({ scale: options.ocrScale });
      const ocrCanvas = document.createElement("canvas");
      ocrCanvas.width = Math.ceil(ocrViewport.width);
      ocrCanvas.height = Math.ceil(ocrViewport.height);
      const ocrContext = ocrCanvas.getContext("2d");
      if (!ocrContext) throw new Error("无法渲染 PDF OCR 页面");
      await page.render({ canvas: ocrCanvas, canvasContext: ocrContext, viewport: ocrViewport }).promise;
      ocrImageData = ocrCanvas.toDataURL("image/png");
    }
    pages.push({
      id: `${Date.now()}-${pageNumber}`,
      name: `${documentName} · 第 ${pageNumber} 页`,
      imageData: canvas.toDataURL("image/jpeg", 0.82),
      ocrImageData,
      pageNumber,
    });
    await yieldToBrowser();
  }
  return pages;
}

export type PdfTextExtractionOptions = {
  onProgress?: (current: number, total: number) => void;
  isCancelled?: () => boolean;
};

export class PdfTextExtractionCancelledError extends Error {
  constructor() {
    super("PDF_TEXT_EXTRACTION_CANCELLED");
  }
}

export type PdfTextPage = {
  pageNumber: number;
  text: string;
};

export async function extractPdfTextPages(bytes: Uint8Array, options: PdfTextExtractionOptions = {}): Promise<PdfTextPage[]> {
  const [pdfjsLib, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  if (pdf.numPages > 800) throw new Error("文本型 PDF 最多支持 800 页，请拆分后再导入。");
  const pages: PdfTextPage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    if (options.isCancelled?.()) throw new PdfTextExtractionCancelledError();
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    let pageText = "";
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      if (!item.str) continue;
      pageText += item.str;
      pageText += item.hasEOL ? "\n" : " ";
    }
    pageText = pageText.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    pages.push({ pageNumber, text: pageText });
    options.onProgress?.(pageNumber, pdf.numPages);
    if (pageNumber % 8 === 0) await yieldToBrowser();
  }
  const text = pages.map((page) => page.text).filter(Boolean).join("\n\n").trim();
  if (text.replace(/\s/g, "").length < 24) {
    throw new Error("该 PDF 没有可提取的文字，可能是扫描件。请使用智能文件导入进行识别。");
  }
  return pages;
}

export async function extractPdfText(bytes: Uint8Array, options: PdfTextExtractionOptions = {}) {
  const pages = await extractPdfTextPages(bytes, options);
  const text = pages.map((page) => page.text).filter(Boolean).join("\n\n").trim();
  return text;
}

export async function createWordDocumentBlob(input: {
  title: string;
  content: string;
  paragraphs: ExportParagraph[];
  questions: ExportQuestion[];
  marks?: ExportMark[];
  cards?: ExportCard[];
  includeHighlights?: boolean;
  includeTranslation?: boolean;
  includeQuestions?: boolean;
  includeQuestionAnswers?: boolean;
  includeMarkedWords?: boolean;
  vocabularyEntries?: VocabularyExportEntry[];
  includeVocabularyList?: boolean;
}): Promise<Blob> {
  const docx = await import("docx");
  const { Document, Packer, Paragraph, TextRun } = docx;
  const translationsByPosition = new Map(input.paragraphs.map((paragraph) => [paragraph.position, paragraph.translation]));
  const sourceLines = input.content.split("\n").filter(Boolean);
  const marks = input.marks ?? [];
  let searchOffset = 0;
  const sourceRuns = (line: string, lineNumber: number) => {
    const start = input.content.indexOf(line, searchOffset);
    searchOffset = start >= 0 ? start + line.length : searchOffset;
    const ranges = input.includeHighlights === false ? [] : marks
      .filter((mark) => mark.startIndex < start + line.length && mark.endIndex > start)
      .map((mark) => ({ start: Math.max(0, mark.startIndex - start), end: Math.min(line.length, mark.endIndex - start) }))
      .sort((left, right) => left.start - right.start);
    const runs = [new TextRun({ text: `${lineNumber + 1}. `, size: 22 })];
    let cursor = 0;
    for (const range of ranges) {
      if (range.start > cursor) runs.push(new TextRun({ text: line.slice(cursor, range.start), size: 22 }));
      runs.push(new TextRun({ text: line.slice(range.start, range.end), size: 22, highlight: "yellow" }));
      cursor = Math.max(cursor, range.end);
    }
    if (cursor < line.length) runs.push(new TextRun({ text: line.slice(cursor), size: 22 }));
    return runs;
  };

  const children = [
    new Paragraph({ children: [new TextRun({ text: input.title, bold: true, size: 32 })] }),
    ...sourceLines.flatMap((line, index) => {
      const translation = translationsByPosition.get(index + 1) || translationsByPosition.get(index) || "";
      return [
        new Paragraph({ children: sourceRuns(line, index) }),
        ...(input.includeTranslation && translation ? [new Paragraph({ children: [new TextRun({ text: translation, color: "475569", size: 20 })] })] : []),
      ];
    }),
    ...(input.includeMarkedWords && input.cards?.length ? [
      new Paragraph({ children: [new TextRun({ text: "本文章标记生词", bold: true, size: 28 })] }),
      ...input.cards.flatMap((card) => [
        new Paragraph({ children: [new TextRun({ text: `${card.word}${card.phonetic ? ` /${card.phonetic}/` : ""}`, bold: true, size: 22 })] }),
        new Paragraph({ children: [new TextRun({ text: card.translation || card.definition, size: 20 })] }),
        ...card.references.map((reference) => new Paragraph({ children: [new TextRun({ text: [reference.contextSentence, reference.sentenceTranslation, reference.contextualMeaning, reference.usageNote].filter(Boolean).join("\n"), color: "475569", size: 18 })] })),
      ]),
    ] : []),
    ...(input.includeQuestions && input.questions.length ? [
      new Paragraph({ children: [new TextRun({ text: "阅读练习", bold: true, size: 28 })] }),
      ...input.questions.flatMap((question, index) => [
        new Paragraph({ children: [new TextRun({ text: `${index + 1}. ${question.prompt}`, size: 22 })] }),
        ...question.options.map((option) => new Paragraph({ children: [new TextRun({ text: option.content, size: 20 })] })),
        ...(input.includeQuestionAnswers && question.answer ? [new Paragraph({ children: [new TextRun({ text: `答案：${question.answer}`, size: 20 })] })] : []),
        ...(input.includeQuestionAnswers && question.explanation ? [new Paragraph({ children: [new TextRun({ text: `解析：${question.explanation}`, color: "475569", size: 20 })] })] : []),
      ]),
    ] : []),
    ...(input.includeVocabularyList && input.vocabularyEntries?.length
      ? buildVocabularySection(docx, "本文单词表", input.vocabularyEntries, true)
      : []),
  ];

  return Packer.toBlob(new Document({ sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1020, right: 1020, bottom: 1020, left: 1020 } } }, children }] }));
}

export async function createVocabularyDocumentBlob(input: { title: string; entries: VocabularyExportEntry[] }): Promise<Blob> {
  const docx = await import("docx");
  const { Document, Packer } = docx;
  return Packer.toBlob(new Document({
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 760, right: 760, bottom: 760, left: 760 } } },
      children: buildVocabularySection(docx, input.title, input.entries, false),
    }],
  }));
}
