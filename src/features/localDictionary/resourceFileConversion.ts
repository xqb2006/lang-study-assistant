import { readFile, readTextFile } from "@tauri-apps/plugin-fs";
import { writeAppResourceCacheFile } from "../../services/localFileService";
import { resourceImportError } from "./resourceImportErrors";

export const resourceImportExtensions = ["csv", "tsv", "txt", "xlsx", "xls", "json", "md", "markdown", "srt", "vtt", "docx", "tmx", "tbx", "epub", "ifo", "gz"];
const extensionOf = (path: string) => path.split(".").pop()?.toLowerCase() ?? "";
export function resourceFormatForPath(path: string) {
  const extension = extensionOf(path);
  return extension === "gz" ? extensionOf(path.replace(/\.gz$/i, "")) : extension;
}
const isGzipPath = (path: string) => extensionOf(path) === "gz";
async function gzipText(path: string) {
  const pako = await import("pako");
  const bytes = await readFile(path);
  try { return new TextDecoder().decode(pako.ungzip(bytes)); }
  catch { throw resourceImportError("gzip-invalid"); }
}
const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const toCsv = (rows: unknown[][]) => rows.map((row) => row.map(csvCell).join(",")).join("\n");
const textRows = (text: string) => [["word", "translation"], ...text.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [word, ...rest] = line.replace(/^#\s*/, "").split(/\t|\s*[|:]\s*/); return [word, rest.join(" ")]; })];
const xmlDocument = (xml: string) => { const document = new DOMParser().parseFromString(xml, "application/xml"); if (document.querySelector("parsererror")) throw resourceImportError("xml-invalid"); return document; };
const nodeText = (node: Element | null) => node?.textContent?.replace(/\s+/g, " ").trim() ?? "";
function translationMemoryRows(xml: string, termbase: boolean) {
  const document = xmlDocument(xml); const pairs = termbase ? [...document.querySelectorAll("termEntry")].map((entry) => [...entry.querySelectorAll("langSet")].map((set) => nodeText(set.querySelector("term"))).filter(Boolean)) : [...document.querySelectorAll("tu")].map((unit) => [...unit.querySelectorAll("tuv")].map((value) => nodeText(value.querySelector("seg"))).filter(Boolean));
  return [["word", "translation"], ...pairs.filter((pair) => pair.length >= 2).map((pair) => [pair[0], pair[1]])];
}
async function starDictRows(path: string) {
  const basePath = path.replace(/\.ifo$/i, "");
  const info = await readTextFile(path);
  if (/idxoffsetbits=64/i.test(info)) throw resourceImportError("stardict-64-bit");
  const index = await readFile(`${basePath}.idx`);
  let dictionary: Uint8Array;
  try { dictionary = await readFile(`${basePath}.dict`); }
  catch { const pako = await import("pako"); dictionary = pako.inflate(await readFile(`${basePath}.dict.dz`)); }
  const decoder = new TextDecoder(); const view = new DataView(index.buffer, index.byteOffset, index.byteLength); const rows: unknown[][] = [["word", "definition"]]; let cursor = 0;
  while (cursor < index.length) {
    const wordStart = cursor; while (cursor < index.length && index[cursor] !== 0) cursor += 1; if (cursor + 9 > index.length) break;
    const word = decoder.decode(index.slice(wordStart, cursor)); cursor += 1;
    const offset = view.getUint32(cursor, false); const size = view.getUint32(cursor + 4, false); cursor += 8;
    if (!word || offset + size > dictionary.length) continue;
    const definition = decoder.decode(dictionary.slice(offset, offset + size)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (definition) rows.push([word, definition]);
  }
  if (rows.length < 2) throw resourceImportError("stardict-no-entries");
  return rows;
}
async function epubRows(path: string) {
  const JSZip = (await import("jszip")).default; const archive = await JSZip.loadAsync(await readFile(path)); const opf = Object.keys(archive.files).find((name) => name.toLowerCase().endsWith(".opf")); if (!opf) throw resourceImportError("epub-metadata-missing"); const base = opf.slice(0, opf.lastIndexOf("/") + 1); const manifest = xmlDocument(await archive.file(opf)!.async("text")); const item = [...manifest.querySelectorAll("item")].find((element) => /html|xhtml/.test(element.getAttribute("media-type") ?? "")); if (!item) throw resourceImportError("epub-chapter-missing"); const chapter = archive.file(`${base}${item.getAttribute("href")}`); if (!chapter) throw resourceImportError("epub-chapter-missing"); return textRows(nodeText(new DOMParser().parseFromString(await chapter.async("text"), "text/html").body));
}
const wordNetFiles = [["data.noun", "noun"], ["data.verb", "verb"], ["data.adj", "adjective"], ["data.adv", "adverb"]] as const;

export function wordNetDirectoryCandidates(path: string) {
  const selectedPath = path.replace(/[\\/]$/, "");
  const parentPath = selectedPath.replace(/[\\/]dbfiles$/i, "");
  return parentPath === selectedPath ? [selectedPath] : [selectedPath, parentPath];
}
type WordNetPartOfSpeech = "noun" | "verb" | "adjective" | "adverb";
export type WordNetImportProgress = { completed: number; total: number; stage: "checking" | "parsing"; file?: string; percent?: number };

function parseWordNetLine(line: string, partOfSpeech: WordNetPartOfSpeech) {
  if (!line || line.startsWith("  ")) return [] as string[][];
  const [raw, gloss = ""] = line.split("|", 2);
  const fields = raw.trim().split(/\s+/);
  if (fields.length < 5) return [] as string[][];
  const wordCount = Number.parseInt(fields[3], 16);
  const definition = gloss.trim();
  if (!Number.isFinite(wordCount) || wordCount < 1 || !definition) return [] as string[][];
  const rows: string[][] = [];
  for (let index = 0, cursor = 4; index < wordCount && cursor + 1 < fields.length; index += 1, cursor += 2) {
    rows.push([fields[cursor].replace(/_/g, " "), definition, partOfSpeech]);
  }
  return rows;
}

export function parseWordNetEntries(text: string, partOfSpeech: WordNetPartOfSpeech) {
  return text.split(/\r?\n/).flatMap((line) => parseWordNetLine(line, partOfSpeech));
}

export async function parseWordNetEntriesInBatches(text: string, partOfSpeech: WordNetPartOfSpeech, batchSize = 1500, onProgress?: (completed: number, total: number) => void) {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    rows.push(...parseWordNetLine(lines[index], partOfSpeech));
    if ((index + 1) % batchSize === 0) {
      onProgress?.(index + 1, lines.length);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  onProgress?.(lines.length, lines.length);
  return rows;
}
export function parseWordNetExceptionEntries(text: string) {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 2 || fields[0].startsWith(";")) continue;
    for (const lemma of fields.slice(1)) rows.push([fields[0].replace(/_/g, " "), lemma.replace(/_/g, " ")]);
  }
  return rows;
}
export async function normalizeWordNetDirectory(path: string, onProgress?: (progress: WordNetImportProgress) => void) {
  onProgress?.({ completed: 0, total: wordNetFiles.length, stage: "checking" });
  let root: string | null = null;
  for (const candidate of wordNetDirectoryCandidates(path)) {
    try { await readTextFile(`${candidate}\\data.noun`); root = candidate; break; }
    catch { /* Continue to the parent candidate when dbfiles was selected. */ }
  }
  if (!root) {
    throw new Error("未找到 WordNet 主数据文件 data.noun。请选择同时包含 data.noun、data.verb、data.adj、data.adv 的 dict 文件夹。");
  }
  const join = (name: string) => `${root}\\${name}`;
  const rows: string[][] = [["word", "definition", "part_of_speech"]];
  const seen = new Set<string>();
  const definitionsByLemma = new Map<string, Array<[string, string]>>();
  for (const [index, [file, partOfSpeech]] of wordNetFiles.entries()) {
    let sourceText: string;
    try { sourceText = await readTextFile(join(file)); }
    catch { throw resourceImportError("wordnet-missing-file", { file }); }
    onProgress?.({ completed: index, total: wordNetFiles.length, stage: "parsing", file, percent: 0 });
    for (const [word, definition, detectedPartOfSpeech] of await parseWordNetEntriesInBatches(sourceText, partOfSpeech, 1500, (completed, total) => {
      const percentage = Math.round((completed / total) * 100);
      onProgress?.({ completed: index + (completed / total), total: wordNetFiles.length, stage: "parsing", file, percent: percentage });
    })) {
      const key = `${word.toLowerCase()}|${detectedPartOfSpeech}|${definition}`;
      if (!seen.has(key)) { seen.add(key); rows.push([word, definition, detectedPartOfSpeech]); }
      const lemmaKey = `${word.toLowerCase()}|${detectedPartOfSpeech}`;
      const definitions = definitionsByLemma.get(lemmaKey) ?? [];
      if (!definitions.some(([knownDefinition]) => knownDefinition === definition)) definitions.push([definition, detectedPartOfSpeech]);
      definitionsByLemma.set(lemmaKey, definitions);
    }
    onProgress?.({ completed: index + 1, total: wordNetFiles.length, stage: "parsing", file, percent: 100 });
  }
  for (const [file, partOfSpeech] of [["noun.exc", "noun"], ["verb.exc", "verb"], ["adj.exc", "adjective"], ["adv.exc", "adverb"]] as const) {
    let exceptionText: string;
    try { exceptionText = await readTextFile(join(file)); }
    catch { continue; }
    for (const [form, lemma] of parseWordNetExceptionEntries(exceptionText)) {
      const definitions = definitionsByLemma.get(`${lemma.toLowerCase()}|${partOfSpeech}`) ?? [];
      for (const [definition, detectedPartOfSpeech] of definitions) {
        const key = `${form.toLowerCase()}|${detectedPartOfSpeech}|${definition}`;
        if (!seen.has(key)) { seen.add(key); rows.push([form, definition, detectedPartOfSpeech]); }
      }
    }
  }
  if (rows.length < 2) throw resourceImportError("wordnet-no-entries");
  return writeAppResourceCacheFile(`wordnet-${Date.now()}.csv`, toCsv(rows));
}
export async function normalizeResourceImportFile(path: string) {
  const compressed = isGzipPath(path);
  const extension = resourceFormatForPath(path);
  if (compressed && extension === "tar") throw resourceImportError("gzip-archive");
  if (!compressed && ["csv", "tsv", "txt"].includes(extension)) return path;
  if (compressed && ["csv", "tsv"].includes(extension)) {
    const content = await gzipText(path);
    if (!content.trim()) throw resourceImportError("gzip-empty");
    return writeAppResourceCacheFile(`resource-${Date.now()}.${extension}`, content);
  }
  const readText = () => compressed ? gzipText(path) : readTextFile(path);
  let rows: unknown[][];
  if (compressed && ["xlsx", "xls", "docx", "epub", "ifo"].includes(extension)) throw resourceImportError("gzip-unsupported-format", { extension });
  if (["xlsx", "xls"].includes(extension)) { const XLSX = await import("xlsx"); const workbook = XLSX.read(await readFile(path), { type: "array" }); rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" }) as unknown[][]; }
  else if (extension === "json") { let parsed: unknown; try { parsed = JSON.parse(await readText()); } catch { throw resourceImportError("json-invalid"); } const items = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { entries?: unknown }).entries) ? (parsed as { entries: unknown[] }).entries : []; rows = [["word", "phonetic", "definition", "translation", "part_of_speech"], ...items.map((item: Record<string, unknown>) => [item.word ?? item.headword ?? item.term ?? "", item.phonetic ?? "", item.definition ?? item.meaning ?? "", item.translation ?? item.gloss ?? "", item.part_of_speech ?? item.pos ?? ""])]; }
  else if (extension === "docx") { const { extractDocxText } = await import("../../documentTools"); rows = textRows(await extractDocxText(await readFile(path))); }
  else if (extension === "tmx") rows = translationMemoryRows(await readText(), false);
  else if (extension === "tbx") rows = translationMemoryRows(await readText(), true);
  else if (extension === "epub") rows = await epubRows(path);
  else if (extension === "ifo") rows = await starDictRows(path);
  else { const raw = await readText(); rows = textRows(["srt", "vtt"].includes(extension) ? raw.replace(/^\d+\s*$|^\d{2}:\d{2}:\d{2}[,.]\d+\s+-->.*$/gm, "") : raw); }
  if (rows.length < 2) throw resourceImportError("resource-no-entries"); return writeAppResourceCacheFile(`resource-${Date.now()}.csv`, toCsv(rows));
}
