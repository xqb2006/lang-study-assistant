import assert from "node:assert/strict";
import test from "node:test";
import { answerForOption, correctAnswerText, resolveQuestion } from "./questionCompatibility.ts";

test("保留已结构化题目的选项", () => {
  const question = {
    prompt: "Which one is correct?",
    answer: "Second",
    options: [{ id: 11, content: "First" }, { id: 12, content: "Second" }],
  };
  const resolved = resolveQuestion(question);
  assert.equal(resolved.prompt, question.prompt);
  assert.deepEqual(resolved.options.map((option) => option.label), ["A", "B"]);
  assert.equal(correctAnswerText(question, resolved), "Second");
});

test("兼容旧题中嵌入的 A 到 D 选项", () => {
  const question = {
    prompt: "Why did the company change? A) First reason B) Credit crunch C) Third reason D) Fourth reason",
    answer: "B",
    options: [],
  };
  const resolved = resolveQuestion(question);
  assert.equal(resolved.prompt, "Why did the company change?");
  assert.deepEqual(resolved.options.map((option) => option.content), ["First reason", "Credit crunch", "Third reason", "Fourth reason"]);
  assert.equal(answerForOption(resolved.options[1]), "B");
  assert.equal(correctAnswerText(question, resolved), "Credit crunch");
});

test("普通句中的字母不会被误判为选项", () => {
  const resolved = resolveQuestion({
    prompt: "The letter A is part of this sentence.",
    answer: "",
    options: [],
  });
  assert.equal(resolved.options.length, 0);
});

test("兼容中文顿号格式的内嵌选项", () => {
  const question = {
    prompt: "请选择正确答案 A、第一项 B、第二项 C、第三项",
    answer: "第二项",
    options: [],
  };
  const resolved = resolveQuestion(question);
  assert.deepEqual(resolved.options.map((option) => option.label), ["A", "B", "C"]);
  assert.equal(correctAnswerText(question, resolved), "第二项");
});