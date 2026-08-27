import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Bookshelf } from "./Bookshelf";

const { appInvoke } = vi.hoisted(() => ({ appInvoke: vi.fn() }));

vi.mock("../../services/appInvoke", () => ({ appInvoke }));

afterEach(() => cleanup());

describe("Bookshelf", () => {
  beforeEach(() => {
    appInvoke.mockReset();
  });

  it("keeps the shelf visible and reports a loading failure", async () => {
    appInvoke.mockRejectedValueOnce(new Error("database unavailable"));

    render(
      <Bookshelf
        refreshKey="test"
        onOpenArticle={vi.fn()}
        onNewBook={vi.fn()}
        onAddChapter={vi.fn()}
        onImportReadingPackage={vi.fn()}
        onExportBook={vi.fn()}
        onArticleTitleChange={vi.fn()}
        onLibraryChanged={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText(/读取书架失败：Error: database unavailable/)).toBeTruthy());
    expect(screen.getByRole("button", { name: "新建书籍" })).toBeTruthy();
  });
  it("localizes bookshelf headings and import actions", async () => {
    appInvoke.mockResolvedValueOnce([]);

    render(
      <Bookshelf
        refreshKey="english-test"
        displayLanguage="en"
        onOpenArticle={vi.fn()}
        onNewBook={vi.fn()}
        onAddChapter={vi.fn()}
        onImportReadingPackage={vi.fn()}
        onExportBook={vi.fn()}
        onArticleTitleChange={vi.fn()}
        onLibraryChanged={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText("Bookshelf")).toBeTruthy());
    expect(screen.getByText("My books")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import multiple chapters" })).toBeTruthy();
  });

  it("opens the multi-chapter import flow from the explicit bookshelf action", async () => {
    appInvoke.mockResolvedValue([]);
    const onImportReadingPackage = vi.fn();

    render(
      <Bookshelf
        refreshKey="batch-import"
        displayLanguage="en"
        onOpenArticle={vi.fn()}
        onNewBook={vi.fn()}
        onAddChapter={vi.fn()}
        onImportReadingPackage={onImportReadingPackage}
        onExportBook={vi.fn()}
        onArticleTitleChange={vi.fn()}
        onLibraryChanged={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Import multiple chapters" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Import multiple chapters" }));
    expect(onImportReadingPackage).toHaveBeenCalledOnce();
  });
});
