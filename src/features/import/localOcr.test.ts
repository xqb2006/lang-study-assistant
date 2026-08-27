import { describe, expect, it } from "vitest";
import { defaultLocalOcrProvider } from "./localOcr";

describe("local OCR provider seam", () => {
  it("keeps Windows OCR as the current default provider", () => {
    expect(defaultLocalOcrProvider).toBe("windows");
  });
});
