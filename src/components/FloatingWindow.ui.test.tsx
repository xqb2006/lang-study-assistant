import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FloatingWindow } from "./FloatingWindow";

afterEach(() => cleanup());

describe("FloatingWindow", () => {
  test("不使用遮罩，并可通过标题栏拖动", () => {
    render(<FloatingWindow title="词卡编辑" onClose={vi.fn()}><p>内容</p></FloatingWindow>);

    const dialog = screen.getByRole("dialog", { name: "词卡编辑" });
    expect(document.querySelector(".backdrop")).toBeNull();
    fireEvent(dialog.querySelector(".floating-window-head")!, new MouseEvent("pointerdown", { bubbles: true, clientX: 20, clientY: 20 }));
    fireEvent(window, new MouseEvent("pointermove", { bubbles: true, clientX: 220, clientY: 180 }));
    fireEvent.pointerUp(window);
    expect(dialog.style.left).toBe("200px");
    expect(dialog.style.top).toBe("160px");
  });

  test("按 Esc 可关闭", () => {
    const onClose = vi.fn();
    render(<FloatingWindow title="词卡编辑" onClose={onClose}><p>内容</p></FloatingWindow>);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
