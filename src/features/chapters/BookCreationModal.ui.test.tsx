import type { FormEvent } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BookCreationModal } from "./BookCreationModal";
import { initialBookDraft } from "./useBookImport";

afterEach(() => cleanup());

function renderModal(isSubmitting = false, displayLanguage: "zh-CN" | "en" = "zh-CN") {
  const onCancel = vi.fn();
  const onClose = vi.fn();
  const onDraftChange = vi.fn();
  const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
  const onOpenPackageImport = vi.fn();
  render(
    <BookCreationModal
      draft={initialBookDraft}
      isSubmitting={isSubmitting}
      onCancel={onCancel}
      onClose={onClose}
      onDraftChange={onDraftChange}
      onOpenPackageImport={onOpenPackageImport}
      onSubmit={onSubmit}
      displayLanguage={displayLanguage}
    />,
  );
  return { onCancel, onClose, onDraftChange, onOpenPackageImport, onSubmit };
}

describe("BookCreationModal", () => {
  test("编辑字段并委托关闭、取消与提交操作", async () => {
    const user = userEvent.setup();
    const actions = renderModal();
    fireEvent.change(screen.getByLabelText("书名"), { target: { value: "英语精读" } });
    fireEvent.change(screen.getByLabelText("作者（可选）"), { target: { value: "Alice" } });
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    await user.click(screen.getByRole("button", { name: "取消" }));
    await user.click(screen.getByRole("button", { name: "关闭" }));

    expect(actions.onDraftChange).toHaveBeenCalledWith({ ...initialBookDraft, title: "英语精读" });
    expect(actions.onDraftChange).toHaveBeenCalledWith({ ...initialBookDraft, author: "Alice" });
    expect(actions.onSubmit).toHaveBeenCalledOnce();
    expect(actions.onCancel).toHaveBeenCalledOnce();
    expect(actions.onClose).toHaveBeenCalledOnce();
  });

  test("提交期间禁用创建按钮并提示进度", () => {
    renderModal(true);
    const submit = screen.getByRole("button", { name: "正在创建…" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  test("将整书或多章节导入入口委托给应用状态", async () => {
    const user = userEvent.setup();
    const actions = renderModal();

    await user.click(screen.getByRole("button", { name: "导入阅读包" }));

    expect(actions.onOpenPackageImport).toHaveBeenCalledOnce();
  });
  test("切换英文界面时本地书籍导入入口不混入中文", () => {
    renderModal(false, "en");

    expect(screen.getByRole("button", { name: "Import reading package" })).toBeTruthy();
  });
});