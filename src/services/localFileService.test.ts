import { describe, expect, it } from "vitest";
import { appResourceCachePath, appResourceCacheSessionPath } from "./localFileService";

describe("appResourceCachePath", () => {
  it("adds a separator when the app data directory has none", () => {
    expect(appResourceCachePath("C:\\Users\\Lenovo\\AppData\\Local\\com.readingagent.app")).toBe("C:\\Users\\Lenovo\\AppData\\Local\\com.readingagent.app\\resource-import-cache");
  });

  it("does not duplicate a trailing Windows separator", () => {
    expect(appResourceCachePath("C:\\Users\\Lenovo\\AppData\\Local\\com.readingagent.app\\")).toBe("C:\\Users\\Lenovo\\AppData\\Local\\com.readingagent.app\\resource-import-cache");
  });

  it("supports a trailing POSIX separator for portability", () => {
    expect(appResourceCachePath("/tmp/com.readingagent.app/")).toBe("/tmp/com.readingagent.app\\resource-import-cache");
  });

  it("creates an isolated session beneath the shared resource cache", () => {
    expect(appResourceCacheSessionPath("C:\\cache\\resource-import-cache", "pdf-ocr-123")).toBe("C:\\cache\\resource-import-cache\\pdf-ocr-123");
  });
});
