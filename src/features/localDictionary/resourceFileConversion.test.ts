import { describe, expect, it } from "vitest";
import {
  parseWordNetEntries,
  parseWordNetEntriesInBatches,
  parseWordNetExceptionEntries,
  resourceFormatForPath,
  resourceImportExtensions,
  wordNetDirectoryCandidates,
} from "./resourceFileConversion";

describe("parseWordNetEntries", () => {
  it("parses hexadecimal synset word counts and glosses", () => {
    const text = "00001740 03 n 02 animal 0 animate_being 0 | a living organism characterized by voluntary movement";
    expect(parseWordNetEntries(text, "noun")).toEqual([
      ["animal", "a living organism characterized by voluntary movement", "noun"],
      ["animate being", "a living organism characterized by voluntary movement", "noun"],
    ]);
  });

  it("ignores comments, malformed rows, and entries without glosses", () => {
    const text = [
      "  WordNet comment",
      "invalid row",
      "00001740 03 n 01 animal 0 |",
      "00001741 03 n 01 creature 0 | an animal",
    ].join("\n");
    expect(parseWordNetEntries(text, "noun")).toEqual([["creature", "an animal", "noun"]]);
  });


  it("reports incremental progress while parsing batches", async () => {
    const updates: string[] = [];
    await parseWordNetEntriesInBatches("00001740 03 n 01 animal 0 | a living organism\n00001741 03 n 01 creature 0 | an animal", "noun", 1, (completed, total) => updates.push(`${completed}/${total}`));
    expect(updates).toEqual(["1/2", "2/2", "2/2"]);
  });
  it("keeps batched parsing output identical to synchronous parsing", async () => {
    const text = [
      "00001740 03 n 01 animal 0 | a living organism",
      "00001741 03 n 01 creature 0 | an animal",
    ].join("\n");
    await expect(parseWordNetEntriesInBatches(text, "noun", 1)).resolves.toEqual(parseWordNetEntries(text, "noun"));
  });
  it("keeps the source part of speech", () => {
    const text = "00001000 02 v 01 announce 0 | make known; announce information";
    expect(parseWordNetEntries(text, "verb")).toEqual([["announce", "make known; announce information", "verb"]]);
  });
});
describe("wordNetDirectoryCandidates", () => {
  it("uses the selected WordNet root directory directly", () => {
    expect(wordNetDirectoryCandidates("F:\\英语阅读助手\\词典资料\\dict")).toEqual(["F:\\英语阅读助手\\词典资料\\dict"]);
  });

  it("falls back from dbfiles to the parent dict directory", () => {
    expect(wordNetDirectoryCandidates("F:\\英语阅读助手\\词典资料\\dict\\dbfiles")).toEqual([
      "F:\\英语阅读助手\\词典资料\\dict\\dbfiles",
      "F:\\英语阅读助手\\词典资料\\dict",
    ]);
  });

  it("normalizes a trailing directory separator", () => {
    expect(wordNetDirectoryCandidates("F:\\英语阅读助手\\词典资料\\dict\\")).toEqual(["F:\\英语阅读助手\\词典资料\\dict"]);
  });
});
describe("parseWordNetExceptionEntries", () => {
  it("maps inflected forms to one or more lemmas", () => {
    expect(parseWordNetExceptionEntries("announced announce\nchildren child kid")).toEqual([
      ["announced", "announce"],
      ["children", "child"],
      ["children", "kid"],
    ]);
  });

  it("ignores empty and comment lines", () => {
    expect(parseWordNetExceptionEntries("; comment\n\nwent go")).toEqual([["went", "go"]]);
  });
});

describe("resourceFormatForPath", () => {
  it("keeps regular resource extensions", () => {
    expect(resourceFormatForPath("F:\\dictionary\\words.json")).toBe("json");
  });

  it("uses the inner extension for single-file gzip resources", () => {
    expect(resourceFormatForPath("F:\\dictionary\\ecdict.csv.gz")).toBe("csv");
    expect(resourceFormatForPath("F:\\dictionary\\terms.tsv.gz")).toBe("tsv");
  });

  it("preserves archive types so callers can require extraction", () => {
    expect(resourceFormatForPath("F:\\dictionary\\wordnet.tar.gz")).toBe("tar");
  });

  it("advertises gzip files in the file picker", () => {
    expect(resourceImportExtensions).toContain("gz");
  });
});
