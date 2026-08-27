import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("../../services/appInvoke", () => ({
  appInvoke: invokeMock,
  isTauri: false,
}));

import { ReadingAssistantModal } from "./ReadingAssistantModal";

beforeEach(() => {
  invokeMock.mockReset();
  window.localStorage.clear();
});

afterEach(() => cleanup());

describe("ReadingAssistantModal", () => {
  test("选中内容时自动引用完整句子，用户可主动移除", async () => {
    const user = userEvent.setup();
    invokeMock.mockResolvedValue({ answer: "这是回答" });
    render(
      <ReadingAssistantModal
        activeModel="chat-model"
        aiConfigured
        articleId={9}
        articleLanguage="en"
        onClose={vi.fn()}
        selected={{ word: "context", startIndex: 0, endIndex: 7, lineNumber: 1, contextSentence: "Selected sentence." }}
      />,
    );

    expect(screen.getByText("已引用当前句")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    await user.type(screen.getByPlaceholderText("输入文章学习问题…"), "这句话是什么意思？");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    expect(invokeMock).toHaveBeenLastCalledWith("ask_reading_assistant", expect.objectContaining({
      input: expect.objectContaining({ context: "Selected sentence." }),
    }));
    const firstCall = invokeMock.mock.calls[invokeMock.mock.calls.length - 1];
    const firstInput = firstCall?.[1]?.input as Record<string, unknown>;
    expect(firstInput.assistantPersona).toBe("");

    await user.click(screen.getByRole("button", { name: "移除当前句引用" }));
    expect(screen.queryByText("已引用当前句")).toBeNull();
    await user.type(screen.getByPlaceholderText("输入文章学习问题…"), "再解释一下");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(invokeMock).toHaveBeenLastCalledWith("ask_reading_assistant", expect.objectContaining({
      input: expect.objectContaining({ context: "" }),
    })));
  });

  test("发送问题时会携带当前助手的完整角色设定", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("reading-assistant-helper-settings", JSON.stringify({
      profiles: [{ id: "default", name: "角色助手", avatar: "📚", sprite: null, size: 92, personaPrompt: "你是一位耐心的猫头鹰老师，请称呼我为学习者。" }],
      activeProfileId: "default",
    }));
    invokeMock.mockResolvedValue({ answer: "收到" });
    render(
      <ReadingAssistantModal
        activeModel="chat-model"
        aiConfigured
        articleId={9}
        articleLanguage="en"
        onClose={vi.fn()}
        selected={null}
      />,
    );

    await user.type(screen.getByPlaceholderText("输入文章学习问题…"), "这句话是什么意思？");
    await user.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("ask_reading_assistant", expect.objectContaining({
      input: expect.objectContaining({ assistantPersona: "你是一位耐心的猫头鹰老师，请称呼我为学习者。" }),
    })));
  });
  test("设置页支持自定义人设和多助手切换", async () => {
    const user = userEvent.setup();
    render(
      <ReadingAssistantModal
        activeModel="chat-model"
        aiConfigured
        articleId={9}
        articleLanguage="en"
        onClose={vi.fn()}
        selected={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: "助手设置" }));
    expect(screen.getByText("桌宠形象")).toBeTruthy();
    expect((screen.getByLabelText("完整角色设定") as HTMLTextAreaElement).value).toBe("");
    await user.type(screen.getByLabelText("完整角色设定"), "请用简洁的语气回答。");
    expect((screen.getByLabelText("完整角色设定") as HTMLTextAreaElement).value).toBe("请用简洁的语气回答。");
    await user.click(screen.getByRole("button", { name: "新建助手" }));
    expect(screen.getByRole("option", { name: "新助手" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "导入精灵图" })).toBeTruthy();
    expect(screen.queryByPlaceholderText("输入文章学习问题…")).toBeNull();
    expect(screen.queryByRole("button", { name: "发送" })).toBeNull();
    expect(screen.queryByRole("button", { name: "清空对话" })).toBeNull();


    await user.click(screen.getByRole("button", { name: "返回聊天" }));
    expect(screen.getByPlaceholderText("输入文章学习问题…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "发送" })).toBeTruthy();
  });

  test("按文章恢复历史并允许本地清空", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("reading-assistant-history:9", JSON.stringify([
      { role: "user", content: "历史问题" },
      { role: "assistant", content: "历史回答" },
    ]));
    render(
      <ReadingAssistantModal
        activeModel="chat-model"
        aiConfigured
        articleId={9}
        articleLanguage="en"
        onClose={vi.fn()}
        selected={null}
      />,
    );

    expect(screen.getByText("历史问题")).toBeTruthy();
    expect(screen.getByText("历史回答")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "清空对话" }));

    await waitFor(() => expect(window.localStorage.getItem("reading-assistant-history:9")).toBe("[]"));
    expect(screen.queryByText("历史问题")).toBeNull();
  });
});




