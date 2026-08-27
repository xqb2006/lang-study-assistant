import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
vi.mock("./companionAppearance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./companionAppearance")>();
  return { ...actual, createCompanionSpriteUrl: vi.fn().mockResolvedValue("blob:custom-companion") };
});
import { ReaderAssistantCompanion } from "./ReaderAssistantCompanion";

function pointerEvent(type: string, clientX: number, clientY: number, button = 0) {
  const event = new MouseEvent(type, { bubbles: true, button, clientX, clientY });
  Object.defineProperty(event, "pointerId", { value: 1 });
  return event;
}

beforeEach(() => {
  window.localStorage.clear();
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

describe("ReaderAssistantCompanion", () => {
  test("uses the saved identity and opens the assistant", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    window.localStorage.setItem("reading-assistant-helper-settings", JSON.stringify({ avatar: "🦉", name: "语法猫头鹰" }));

    render(<ReaderAssistantCompanion onOpen={onOpen} />);

    expect(screen.getByText("🦉")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "打开语法猫头鹰" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  test("自定义精灵图只显示桌宠本体，不渲染名称、外框内容或聊天图标", async () => {
    const onOpen = vi.fn();
    window.localStorage.setItem("reading-assistant-helper-settings", JSON.stringify({
      name: "自定义伙伴",
      sprite: {
        filePath: "C:\\companions\\cat.png",
        fileName: "cat.png",
        columns: 3,
        rows: 2,
        frames: { idle: 0, happy: 1, thinking: 2, sleepy: 3, talking: 4, drag: 5 },
      },
    }));

    render(<ReaderAssistantCompanion onOpen={onOpen} />);
    const companion = screen.getByRole("button", { name: "打开自定义伙伴" });

    await waitFor(() => expect(companion.className).toContain("custom-sprite"));
    expect(screen.queryByText("自定义伙伴")).toBeNull();
    expect(companion.querySelector(".reader-assistant-sprite")).toBeTruthy();
    expect(companion.querySelector("svg")).toBeNull();
  });
  test("persists a dragged position without opening the assistant", async () => {
    const onOpen = vi.fn();
    render(<ReaderAssistantCompanion onOpen={onOpen} />);
    const companion = screen.getByRole("button", { name: "打开阅读小助手" });

    fireEvent(companion, pointerEvent("pointerdown", 804, 688));
    fireEvent(companion, pointerEvent("pointermove", 320, 240));
    fireEvent(companion, pointerEvent("pointerup", 320, 240));
    fireEvent.click(companion);

    await waitFor(() => expect(window.localStorage.getItem("reading-assistant-companion-position")).toContain('"x":320'));
    expect(onOpen).not.toHaveBeenCalled();
  });
});
