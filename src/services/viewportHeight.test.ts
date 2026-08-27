import { afterEach, describe, expect, test, vi } from "vitest";
import { installViewportHeightSync } from "./viewportHeight";

afterEach(() => {
  document.documentElement.style.removeProperty("--app-viewport-height");
});

describe("installViewportHeightSync", () => {
  test("按当前窗口高度设置应用视口变量并支持窗口变化", () => {
    vi.stubGlobal("innerHeight", 720);
    const cleanup = installViewportHeightSync();
    expect(document.documentElement.style.getPropertyValue("--app-viewport-width")).toBe(`${window.innerWidth}px`);
    expect(document.documentElement.style.getPropertyValue("--app-viewport-height")).toBe("720px");

    vi.stubGlobal("innerHeight", 640);
    window.dispatchEvent(new Event("resize"));
    expect(document.documentElement.style.getPropertyValue("--app-viewport-height")).toBe("640px");
    cleanup();
  });
});

