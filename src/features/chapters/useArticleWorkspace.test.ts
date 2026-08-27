import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const appInvokeMock = vi.hoisted(() => vi.fn());

vi.mock("../../services/appInvoke", () => ({ appInvoke: appInvokeMock }));

import { useArticleWorkspace } from "./useArticleWorkspace";

describe("useArticleWorkspace", () => {
  it("clears the current reading state when its article was deleted", async () => {
    let articleExists = true;
    appInvokeMock.mockImplementation((command: string) => {
      if (command === "get_articles") return Promise.resolve(articleExists ? [{ id: 9, title: "Chapter 1", createdAt: "", wordCount: 3, language: "en" }] : []);
      if (command === "get_article") return Promise.resolve({ id: 9, title: "Chapter 1", content: "Text", createdAt: "", language: "en" });
      if (command === "get_markings_by_article") return Promise.resolve([{ id: 1 }]);
      if (command === "get_cards_by_article") return Promise.resolve([{ id: 2 }]);
      return Promise.resolve(undefined);
    });
    const { result } = renderHook(() => useArticleWorkspace(vi.fn()));

    await act(async () => { await result.current.load(9); });
    await waitFor(() => expect(result.current.article?.id).toBe(9));

    articleExists = false;
    await act(async () => { await result.current.refresh(); });

    expect(result.current.article).toBeNull();
    expect(result.current.marks).toEqual([]);
    expect(result.current.cards).toEqual([]);
  });
  it("invalidates an in-flight article load when clearing the reader", async () => {
    let resolveArticle: ((value: { id: number; title: string; content: string; createdAt: string; language: string }) => void) | undefined;
    appInvokeMock.mockImplementation((command: string) => {
      if (command === "get_article") return new Promise((resolve) => { resolveArticle = resolve; });
      if (command === "get_markings_by_article" || command === "get_cards_by_article") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    const { result } = renderHook(() => useArticleWorkspace(vi.fn()));

    let loading: Promise<void> | undefined;
    await act(async () => { loading = result.current.load(12); });
    await act(async () => { result.current.clearCurrentArticle(); });
    await act(async () => { resolveArticle?.({ id: 12, title: "Deleted", content: "Old", createdAt: "", language: "en" }); await loading; });

    expect(result.current.article).toBeNull();
    expect(result.current.marks).toEqual([]);
    expect(result.current.cards).toEqual([]);
  });
  it("keeps the reader empty when the bookshelf has no valid articles at startup", async () => {
    appInvokeMock.mockImplementation((command: string) => {
      if (command === "get_articles") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    const { result } = renderHook(() => useArticleWorkspace(vi.fn()));

    await act(async () => { await result.current.refresh(true); });

    expect(result.current.articles).toEqual([]);
    expect(result.current.article).toBeNull();
    expect(result.current.marks).toEqual([]);
    expect(result.current.cards).toEqual([]);
  });
});
