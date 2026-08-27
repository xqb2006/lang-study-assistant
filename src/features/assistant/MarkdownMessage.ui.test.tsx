import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { MarkdownMessage } from "./MarkdownMessage";

describe("MarkdownMessage", () => {
  beforeEach(() => cleanup());
  test("renders common assistant markdown as semantic elements", () => {
    render(<MarkdownMessage content={'## 重点\n\n这是 **重要** 内容。\n\n- 第一项\n- 第二项\n\n`code` [文档](https://example.com)'} />);

    expect(screen.getByRole("heading", { name: "重点" })).toBeTruthy();
    expect(screen.getByText("重要").tagName).toBe("STRONG");
    expect(screen.getByRole("list")).toBeTruthy();
    expect(screen.getByText("code").tagName).toBe("CODE");
    expect(screen.getByRole("link", { name: "文档" }).getAttribute("href")).toBe("https://example.com");
  });

  test("does not create unsafe links", () => {
    render(<MarkdownMessage content="[危险](javascript:alert(1))" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("[危险](javascript:alert(1))")).toBeTruthy();
  });
});

