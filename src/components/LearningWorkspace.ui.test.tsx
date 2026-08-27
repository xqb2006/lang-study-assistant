import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LearningWorkspace, type LearningQuestion } from "./LearningWorkspace";

const emptyState = <p>暂无练习题</p>;

afterEach(() => cleanup());

function renderWorkspace(
  questions: LearningQuestion[] | ((articleId: number) => Promise<LearningQuestion[]>),
  submitAnswer = vi.fn<(questionId: number, answer: string) => Promise<boolean>>().mockResolvedValue(true),
  articleId = 1,
) {
  const loadQuestions = typeof questions === "function"
    ? vi.fn(questions)
    : vi.fn<(currentArticleId: number) => Promise<LearningQuestion[]>>().mockResolvedValue(questions);
  const view = render(
    <LearningWorkspace
      articleId={articleId}
      questionImport={() => null}
      emptyState={emptyState}
      loadQuestions={loadQuestions}
      submitAnswer={submitAnswer}
      onLookupSelection={vi.fn()}
    />,
  );
  return { ...view, loadQuestions, submitAnswer };
}

describe("LearningWorkspace", () => {
  test("将历史题干内嵌选项渲染为可作答单选项，并按字母提交", async () => {
    const user = userEvent.setup();
    const submitAnswer = vi.fn<(questionId: number, answer: string) => Promise<boolean>>().mockResolvedValue(true);
    renderWorkspace([{
      id: 7,
      prompt: "What caused the change? A) First reason B) Credit crunch C) Third reason D) Fourth reason",
      answer: "B",
      explanation: "经济压力导致调整。",
      options: [],
    }], submitAnswer);

    const optionB = await screen.findByRole("radio", { name: "选择选项 B" });
    expect(screen.getByText(/What caused the change/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "提交答案" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(optionB);
    await user.click(screen.getByRole("button", { name: "提交答案" }));

    await waitFor(() => expect(submitAnswer).toHaveBeenCalledWith(7, "B"));
    expect(await screen.findByText("回答正确")).toBeTruthy();
    expect(screen.getByText("正确答案：Credit crunch")).toBeTruthy();
  });

  test("结构化选项使用选项文本提交并展示答案", async () => {
    const user = userEvent.setup();
    const submitAnswer = vi.fn<(questionId: number, answer: string) => Promise<boolean>>().mockResolvedValue(false);
    renderWorkspace([{
      id: 8,
      prompt: "Which answer is right?",
      answer: "Second answer",
      explanation: "答案在第二项。",
      options: [{ id: 80, content: "First answer" }, { id: 81, content: "Second answer" }],
    }], submitAnswer);

    await user.click(await screen.findByRole("radio", { name: "选择选项 B" }));
    await user.click(screen.getByRole("button", { name: "提交答案" }));

    await waitFor(() => expect(submitAnswer).toHaveBeenCalledWith(8, "Second answer"));
    expect(await screen.findByText("回答错误")).toBeTruthy();
    expect(screen.getByText("正确答案：Second answer")).toBeTruthy();
  });

  test("无选项题显示明确提示且不可提交", async () => {
    renderWorkspace([{
      id: 9,
      prompt: "This question has no answers.",
      answer: "",
      explanation: "",
      options: [],
    }]);

    expect(await screen.findByText("未识别出可选项，请在题目编辑中补充 A/B/C/D 选项。")).toBeTruthy();
    expect((screen.getByRole("button", { name: "提交答案" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("快速切换章节时忽略过期题目请求", async () => {
    let resolveFirst: ((questions: LearningQuestion[]) => void) | undefined;
    let resolveSecond: ((questions: LearningQuestion[]) => void) | undefined;
    const loadQuestions = vi.fn((articleId: number) => new Promise<LearningQuestion[]>((resolve) => {
      if (articleId === 1) resolveFirst = resolve;
      else resolveSecond = resolve;
    }));
    const view = render(
      <LearningWorkspace
        articleId={1}
        questionImport={() => null}
        emptyState={emptyState}
        loadQuestions={loadQuestions}
        submitAnswer={vi.fn().mockResolvedValue(true)}
        onLookupSelection={vi.fn()}
      />,
    );
    await waitFor(() => expect(loadQuestions).toHaveBeenCalledWith(1));
    view.rerender(
      <LearningWorkspace
        articleId={2}
        questionImport={() => null}
        emptyState={emptyState}
        loadQuestions={loadQuestions}
        submitAnswer={vi.fn().mockResolvedValue(true)}
        onLookupSelection={vi.fn()}
      />,
    );
    await waitFor(() => expect(loadQuestions).toHaveBeenCalledWith(2));
    await act(async () => {
      resolveSecond?.([{ id: 22, prompt: "Current chapter question", answer: "", explanation: "", options: [] }]);
      await Promise.resolve();
      resolveFirst?.([{ id: 11, prompt: "Stale chapter question", answer: "", explanation: "", options: [] }]);
      await Promise.resolve();
    });

    expect(await screen.findByText(/Current chapter question/)).toBeTruthy();
    expect(screen.queryByText(/Stale chapter question/)).toBeNull();
  });
});