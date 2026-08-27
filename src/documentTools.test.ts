import { beforeAll, describe, expect, it } from "vitest";
import { extractDocxText } from "./documentTools";

beforeAll(async () => {
  const moduleName = "jsdom";
  const { JSDOM } = await import(moduleName) as {
    JSDOM: new () => { window: { DOMParser: typeof DOMParser } };
  };
  Object.assign(globalThis, { DOMParser: new JSDOM().window.DOMParser });
});

describe("document tools", () => {
  it("extracts paragraphs and inline Word content without mammoth", async () => {
    const JSZip = (await import("jszip")).default;
    const archive = new JSZip();
    archive.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>First &amp; line</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>part</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>next</w:t></w:r></w:p>
          <w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>
        </w:body>
      </w:document>`);

    const bytes = await archive.generateAsync({ type: "uint8array" });
    await expect(extractDocxText(bytes)).resolves.toBe("First & line\tpart\nnext\n\nSecond paragraph");
  });

  it("reports Word files without a document body", async () => {
    const JSZip = (await import("jszip")).default;
    const bytes = await new JSZip().generateAsync({ type: "uint8array" });
    await expect(extractDocxText(bytes)).rejects.toThrow("缺少正文内容");
  });
});