import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AppSidebar } from "./AppSidebar";

afterEach(() => cleanup());

function renderSidebar() {
  const onNewBook = vi.fn();
  const onOpenDictionary = vi.fn();
  const onOpenSettings = vi.fn();
  const onToggleNavigation = vi.fn();
  const onViewChange = vi.fn();
  render(
    <AppSidebar
      activeView="library"
      articleCount={3}
      configured={false}
      markCount={7}
      navCollapsed={false}
      onNewBook={onNewBook}
      onOpenDictionary={onOpenDictionary}
      onOpenSettings={onOpenSettings}
      onToggleNavigation={onToggleNavigation}
      onViewChange={onViewChange}
      reviewCardCount={5}
    />,
  );
  return { onNewBook, onOpenDictionary, onOpenSettings, onToggleNavigation, onViewChange };
}

describe("AppSidebar", () => {
  test("显示当前数据并标识活动视图", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: /全部章节/ }).className).toContain("active");
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("本地优先 · 7 个标记")).toBeTruthy();
    expect(screen.getByText("未配置")).toBeTruthy();
  });

  test("将侧边栏操作交给页面状态", async () => {
    const user = userEvent.setup();
    const actions = renderSidebar();
    await user.click(screen.getByRole("button", { name: /新建书籍/ }));
    await user.click(screen.getByRole("button", { name: /语言资源/ }));
    await user.click(screen.getByRole("button", { name: /AI 模型配置/ }));
    await user.click(screen.getByRole("button", { name: "折叠主导航" }));
    await user.click(screen.getByRole("button", { name: /单词复习/ }));
    await user.click(screen.getByRole("button", { name: /版本与诊断/ }));

    expect(actions.onNewBook).toHaveBeenCalledOnce();
    expect(actions.onOpenDictionary).toHaveBeenCalledOnce();
    expect(actions.onOpenSettings).toHaveBeenCalledOnce();
    expect(actions.onToggleNavigation).toHaveBeenCalledOnce();
    expect(actions.onViewChange).toHaveBeenNthCalledWith(1, "vocabulary");
    expect(actions.onViewChange).toHaveBeenNthCalledWith(2, "diagnostics");
  });
});