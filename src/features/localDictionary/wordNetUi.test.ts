import { describe, expect, it } from "vitest";
import { resourceImportError } from "./resourceImportErrors";
import { resourceImportErrorMessage, resourceLanguageLabel, wordNetProgressText, wordNetT } from "./wordNetUi";

describe("wordNetUi", () => {
  it("localizes WordNet actions and interpolates errors", () => {
    expect(wordNetT("en", "importDirectory")).toBe("Import WordNet folder");
    expect(wordNetT("zh-CN", "importFailed", { error: "missing data.noun" })).toBe("WordNet 导入失败：missing data.noun");
  });

  it("uses the active display locale for resource language names", () => {
    expect(resourceLanguageLabel("en", "zh-CN", "其他语言")).toBe("英语");
    expect(resourceLanguageLabel("fr", "en", "Other language")).toBe("French");
  });

  it("uses the supplied fallback for unsupported resource languages", () => {
    expect(resourceLanguageLabel("other", "en", "Other language")).toBe("Other language");
  });

  it("localizes expected resource import errors while preserving unknown failures", () => {
    expect(resourceImportErrorMessage(resourceImportError("wordnet-missing-file", { file: "data.noun" }), "en")).toBe("The WordNet folder is incomplete: data.noun is missing. Select the complete dict folder.");
    expect(resourceImportErrorMessage(resourceImportError("gzip-archive"), "zh-CN")).toContain(".tar.gz");
    expect(resourceImportErrorMessage(new Error("disk unavailable"), "en")).toBe("Error: disk unavailable");
  });

  it("localizes semantic WordNet progress without parser-owned text", () => {
    expect(wordNetProgressText({ completed: 0, total: 4, stage: "checking" }, "en")).toBe("Checking WordNet folder…");
    expect(wordNetProgressText({ completed: 1.5, total: 4, stage: "parsing", file: "data.verb", percent: 50 }, "zh-CN")).toBe("正在解析 data.verb（50%）…");
  });
});
