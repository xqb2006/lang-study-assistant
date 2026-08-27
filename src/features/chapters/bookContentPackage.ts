import { readFile, readTextFile } from "@tauri-apps/plugin-fs";
import { detectContentLanguage, type ContentLanguage } from "../languages";

export type BookContentChapter = {
  title: string;
  sourceText: string;
  translationText: string;
};

export type ReadingBookArticle = {
  index: number;
  title: string;
  chapterIndex: number;
  startBlockId?: string;
  endBlockId?: string;
  confidence?: "high" | "medium" | "low";
};

export type ReadingBookSourceBlock = {
  id: string;
  pageNumber?: number;
  articleIndex?: number;
  blockType: "title" | "paragraph" | "translation" | "question" | "option" | "answer" | "explanation" | "header" | "footer" | "unknown";
  text: string;
  confidence?: number;
};
export type BookContentPackage = {
  format: "reading-agent-book";
  version: 1 | 2;
  exportedAt: string;
  book: {
    title: string;
    author: string;
    description: string;
    language: ContentLanguage;
  };
  chapters: BookContentChapter[];
  articles?: ReadingBookArticle[];
  sourceBlocks?: ReadingBookSourceBlock[];
};

export type LocalBookImportOptions = {
  onProgress?: (current: number, total: number, label: string) => void;
  isCancelled?: () => boolean;
};

export class LocalBookImportCancelledError extends Error {
  constructor() {
    super("LOCAL_BOOK_IMPORT_CANCELLED");
  }
}

export function isLocalBookImportCancelled(error: unknown) {
  return error instanceof LocalBookImportCancelledError || error instanceof Error && error.message === "PDF_TEXT_EXTRACTION_CANCELLED";
}

function ensureNotCancelled(options?: LocalBookImportOptions) {
  if (options?.isCancelled?.()) throw new LocalBookImportCancelledError();
}

type RawBookContent = Omit<BookContentPackage, "format" | "version" | "exportedAt" | "book" | "chapters"> & {
  title: string;
  author: string;
  description: string;
  language: string;
  chapters: BookContentChapter[];
  articles?: ReadingBookArticle[];
  sourceBlocks?: ReadingBookSourceBlock[];
};

const languageCodes: ContentLanguage[] = ["en", "ja", "ko", "fr", "de", "es", "other"];

function normalizeLanguage(value: unknown): ContentLanguage {
  return languageCodes.includes(value as ContentLanguage) ? value as ContentLanguage : "other";
}

export function resolveImportLanguage(metadataLanguage: unknown, sourceText: string): ContentLanguage {
  const raw = typeof metadataLanguage === "string" ? metadataLanguage.trim().toLowerCase().replace(/_/g, "-") : "";
  const base = raw.split("-")[0];
  if (languageCodes.includes(base as ContentLanguage)) return base as ContentLanguage;
  if (["english", "eng"].includes(raw)) return "en";
  if (["japanese", "jpn"].includes(raw)) return "ja";
  if (["korean", "kor"].includes(raw)) return "ko";
  if (["french", "fra", "fre"].includes(raw)) return "fr";
  if (["german", "deu", "ger"].includes(raw)) return "de";
  if (["spanish", "spa"].includes(raw)) return "es";
  const letters = sourceText.match(/\p{L}/gu)?.length ?? 0;
  const latinLetters = sourceText.match(/[A-Za-z]/g)?.length ?? 0;
  const englishSignals = sourceText.toLowerCase().match(/\b(?:the|and|that|with|from|this|have|will|for|are|was|were|not)\b/g)?.length ?? 0;
  if (latinLetters >= 24 && latinLetters / Math.max(letters, 1) > 0.75 && englishSignals >= 2) return "en";
  return detectContentLanguage(sourceText).language;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
}

function normalizeChapters(value: unknown): BookContentChapter[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((chapter, index) => {
      const record = chapter && typeof chapter === "object" ? chapter as Record<string, unknown> : {};
      return {
        title: cleanText(record.title) || `第 ${index + 1} 章`,
        sourceText: cleanText(record.sourceText),
        translationText: cleanText(record.translationText),
      };
    })
    .filter((chapter) => chapter.sourceText.length > 0);
}

export function createBookContentPackage(book: RawBookContent): BookContentPackage {
  return {
    format: "reading-agent-book",
    version: 1,
    exportedAt: new Date().toISOString(),
    book: {
      title: cleanText(book.title),
      author: cleanText(book.author),
      description: cleanText(book.description),
      language: normalizeLanguage(book.language),
    },
    chapters: normalizeChapters(book.chapters),
  };
}

export function createReadingBookPackage(input: {
  book: BookContentPackage["book"];
  chapters: BookContentChapter[];
  articles?: ReadingBookArticle[];
  sourceBlocks?: ReadingBookSourceBlock[];
}): BookContentPackage {
  const base = createBookContentPackage({
    title: input.book.title,
    author: input.book.author,
    description: input.book.description,
    language: input.book.language,
    chapters: input.chapters,
  });
  return { ...base, version: 2, articles: input.articles, sourceBlocks: input.sourceBlocks };
}

export function parseBookContentPackage(raw: string): BookContentPackage {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("无法读取书籍包：文件不是有效的 JSON 内容。");
  }
  const record = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (!record || record.format !== "reading-agent-book" || ![1, 2].includes(record.version as number)) {
    throw new Error("无法读取书籍包：不是受支持的 .readingbook 文件。");
  }
  const book = record.book && typeof record.book === "object" ? record.book as Record<string, unknown> : {};
  const normalized = createBookContentPackage({
    title: cleanText(book.title),
    author: cleanText(book.author),
    description: cleanText(book.description),
    language: String(book.language ?? "other"),
    chapters: normalizeChapters(record.chapters),
  });
  if (!normalized.book.title || !normalized.chapters.length) {
    throw new Error("无法读取书籍包：缺少书名或可导入章节。");
  }
  return { ...normalized,
    version: record.version as 1 | 2,
    articles: Array.isArray(record.articles) ? record.articles as ReadingBookArticle[] : undefined,
    sourceBlocks: Array.isArray(record.sourceBlocks) ? record.sourceBlocks as ReadingBookSourceBlock[] : undefined,
  };
}

function nodeText(element: Element) {
  return (element.textContent ?? "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function parseEpubChapter(raw: string) {
  const document = new DOMParser().parseFromString(raw, "text/html");
  const body = document.body;
  if (!body) return "";
  const blocks = Array.from(body.querySelectorAll("p, blockquote, li, h1, h2, h3, h4, h5, h6"))
    .map(nodeText)
    .filter(Boolean);
  return (blocks.length ? blocks : [nodeText(body)]).join("\n\n").trim();
}

function resolveArchivePath(base: string, relative: string) {
  const parts = `${base}/${relative}`.split("/");
  const result: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") result.pop();
    else result.push(part);
  }
  return result.join("/");
}

export async function readEpubBook(path: string, options?: LocalBookImportOptions): Promise<BookContentPackage> {
  ensureNotCancelled(options);
  const JSZip = (await import("jszip")).default;
  const archive = await JSZip.loadAsync(await readFile(path));
  const containerFile = archive.file("META-INF/container.xml");
  const container = containerFile ? new DOMParser().parseFromString(await containerFile.async("text"), "application/xml") : null;
  const opfPath = container?.querySelector("rootfile")?.getAttribute("full-path")
    ?? Object.keys(archive.files).find((name) => name.toLowerCase().endsWith(".opf"));
  if (!opfPath) throw new Error("无法读取 EPUB：缺少书籍目录文件。");
  const opfFile = archive.file(opfPath);
  if (!opfFile) throw new Error("无法读取 EPUB：书籍目录文件不存在。");
  const opf = new DOMParser().parseFromString(await opfFile.async("text"), "application/xml");
  const metadata = opf.querySelector("metadata");
  const metadataValue = (name: string) => nodeText(metadata?.querySelector(name) ?? metadata?.querySelector(`dc\\:${name}`) ?? document.createElement("span"));
  const manifest = new Map(Array.from(opf.querySelectorAll("manifest > item")).map((item) => [item.getAttribute("id") ?? "", item]));
  const base = opfPath.slice(0, opfPath.lastIndexOf("/"));
  const spine = Array.from(opf.querySelectorAll("spine > itemref"));
  const chapters = [] as BookContentChapter[];
  for (const [index, itemRef] of spine.entries()) {
    ensureNotCancelled(options);
    options?.onProgress?.(index, spine.length, "正在读取 EPUB 章节");
    const manifestItem = manifest.get(itemRef.getAttribute("idref") ?? "");
    const href = manifestItem?.getAttribute("href");
    if (!href) continue;
    const chapterFile = archive.file(resolveArchivePath(base, href));
    if (!chapterFile) continue;
    const raw = await chapterFile.async("text");
    const sourceText = parseEpubChapter(raw);
    if (!sourceText) continue;
    const document = new DOMParser().parseFromString(raw, "text/html");
    const heading = document.querySelector("h1, h2, h3, title");
    const title = (heading ? nodeText(heading) : "") || `第 ${index + 1} 章`;
    chapters.push({ title, sourceText, translationText: "" });
    options?.onProgress?.(index + 1, spine.length, "正在读取 EPUB 章节");
  }
  ensureNotCancelled(options);
  return createBookContentPackage({
    title: metadataValue("title") || path.split(/[\\/]/).pop()?.replace(/\.epub$/i, "") || "未命名书籍",
    author: metadataValue("creator"),
    description: metadataValue("description"),
    language: resolveImportLanguage(metadataValue("language"), chapters.map((chapter) => chapter.sourceText).join("\n\n")),
    chapters,
  });
}

export async function readBookContentFile(path: string) {
  return parseBookContentPackage(await readTextFile(path));
}

function fileTitle(path: string) {
  return path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "").trim() || "未命名书籍";
}

function isChapterHeading(value: string) {
  return /^(?:#{1,6}\s+|chapter\s+\d+\b|part\s+[\divxlcdm]+\b|unit\s+\d+\b|lesson\s+\d+\b|第\s*[一二三四五六七八九十百千万\d]+\s*(?:章|节|课)|\d+(?:\.\d+)*[.、\s]+).+/i.test(value.trim());
}

function headingTitle(value: string) {
  return value
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\d+(?:\.\d+)*[.、\s]+/, "")
    .trim();
}

export function splitBookText(raw: string, fallbackTitle = "第 1 章"): BookContentChapter[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const chapters: BookContentChapter[] = [];
  let title = "";
  let content: string[] = [];
  const flush = () => {
    const sourceText = content.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!sourceText) return;
    chapters.push({
      title: title || `${fallbackTitle}${chapters.length ? ` ${chapters.length + 1}` : ""}`,
      sourceText,
      translationText: "",
    });
  };
  for (const line of lines) {
    if (isChapterHeading(line)) {
      flush();
      title = headingTitle(line) || `第 ${chapters.length + 1} 章`;
      content = [];
    } else {
      content.push(line);
    }
  }
  flush();
  return chapters;
}

function extractHtmlBookText(raw: string) {
  const document = new DOMParser().parseFromString(raw, "text/html");
  const body = document.body;
  if (!body) return "";
  return Array.from(body.querySelectorAll("h1, h2, h3, h4, h5, h6, p, blockquote, li"))
    .map((element) => {
      const text = nodeText(element);
      if (!text) return "";
      return /^H[1-6]$/.test(element.tagName) ? `# ${text}` : text;
    })
    .filter(Boolean)
    .join("\n\n");
}

export async function readLocalBookFile(path: string, options?: LocalBookImportOptions): Promise<BookContentPackage> {
  ensureNotCancelled(options);
  const extension = path.split(".").pop()?.toLowerCase();
  let raw = "";
  if (extension === "docx") {
    options?.onProgress?.(0, 1, "正在读取 Word 文档");
    const { extractDocxText } = await import("../../documentTools");
    raw = await extractDocxText(await readFile(path));
  } else if (extension === "pdf") {
    options?.onProgress?.(0, 0, "正在提取 PDF 文字");
    const { extractPdfText } = await import("../../documentTools");
    raw = await extractPdfText(await readFile(path), {
      onProgress: (current, total) => options?.onProgress?.(current, total, "正在提取 PDF 文字"),
      isCancelled: options?.isCancelled,
    });
  } else {
    options?.onProgress?.(0, 1, "正在读取本地文本");
    raw = await readTextFile(path);
  }
  ensureNotCancelled(options);
  options?.onProgress?.(1, 1, "正在拆分章节");
  const sourceText = ["html", "htm"].includes(extension ?? "") ? extractHtmlBookText(raw) : raw;
  const chapters = splitBookText(sourceText, fileTitle(path));
  if (!chapters.length) throw new Error("无法读取本地书籍：文件中没有可导入的正文。");
  ensureNotCancelled(options);
  return createBookContentPackage({
    title: fileTitle(path),
    author: "",
    description: "",
    language: resolveImportLanguage("", sourceText),
    chapters,
  });
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function chapterXhtml(chapter: BookContentChapter, includeTranslations: boolean) {
  const paragraphs = chapter.sourceText.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const translations = chapter.translationText.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const translationSection = includeTranslations && translations.length
    ? `<section class="translation"><h2>Translation</h2>${translations.map((paragraph) => `<p>${escapeXml(paragraph)}</p>`).join("")}</section>`
    : "";
  return `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(chapter.title)}</title><link rel="stylesheet" type="text/css" href="style.css" /></head><body><article><h1>${escapeXml(chapter.title)}</h1>${paragraphs.map((paragraph) => `<p>${escapeXml(paragraph)}</p>`).join("")}${translationSection}</article></body></html>`;
}

export async function createEpubBytes(book: BookContentPackage, includeTranslations = false): Promise<Uint8Array> {
  if (!book.chapters.length) throw new Error("没有可导出的章节。");
  const JSZip = (await import("jszip")).default;
  const archive = new JSZip();
  const identifier = `urn:uuid:${crypto.randomUUID()}`;
  const language = book.book.language === "other" ? "und" : book.book.language;
  const chapterItems = book.chapters.map((chapter, index) => ({
    id: `chapter-${index + 1}`,
    href: `chapter-${String(index + 1).padStart(3, "0")}.xhtml`,
    title: chapter.title,
    chapter,
  }));
  archive.file("mimetype", "application/epub+zip", { compression: "STORE" });
  archive.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  archive.file("OEBPS/style.css", "body{font-family:Georgia,'Times New Roman',serif;line-height:1.7;margin:5%;color:#1f2937}h1{font-size:1.55em;margin:0 0 1.4em}h2{font-size:1.1em;margin:1.8em 0 .8em}.translation{border-top:1px solid #cbd5e1;margin-top:2em;color:#475569}p{margin:0 0 1em}");
  archive.file("OEBPS/nav.xhtml", `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${chapterItems.map((item) => `<li><a href="${item.href}">${escapeXml(item.title)}</a></li>`).join("")}</ol></nav></body></html>`);
  archive.file("OEBPS/content.opf", `<?xml version="1.0" encoding="utf-8"?><package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${identifier}</dc:identifier><dc:title>${escapeXml(book.book.title)}</dc:title><dc:language>${language}</dc:language>${book.book.author ? `<dc:creator>${escapeXml(book.book.author)}</dc:creator>` : ""}${book.book.description ? `<dc:description>${escapeXml(book.book.description)}</dc:description>` : ""}<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="style" href="style.css" media-type="text/css"/>${chapterItems.map((item) => `<item id="${item.id}" href="${item.href}" media-type="application/xhtml+xml"/>`).join("")}</manifest><spine>${chapterItems.map((item) => `<itemref idref="${item.id}"/>`).join("")}</spine></package>`);
  chapterItems.forEach((item) => archive.file(`OEBPS/${item.href}`, chapterXhtml(item.chapter, includeTranslations)));
  return archive.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
