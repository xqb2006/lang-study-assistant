import type { RefObject } from "react";
import { extractSentenceContext } from "../../sentenceContext";
import type { Selection } from "./types";

function getTextOffset(root: HTMLElement, node: Node, nodeOffset: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (textNode) =>
      textNode.parentElement?.closest("sup")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  let offset = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === node) return offset + nodeOffset;
    offset += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return -1;
}

export function getSelectionDetails(
  reader: RefObject<HTMLElement | null>,
  articleContent: string,
): Selection | null {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const start =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;
  const end =
    range.endContainer.nodeType === Node.ELEMENT_NODE
      ? (range.endContainer as Element)
      : range.endContainer.parentElement;
  const line = start?.closest<HTMLParagraphElement>("p[data-start]");
  if (!reader.current || !line || line !== end?.closest("p[data-start]")) {
    return null;
  }
  const startInLine = getTextOffset(
    line,
    range.startContainer,
    range.startOffset,
  );
  const endInLine = getTextOffset(line, range.endContainer, range.endOffset);
  if (startInLine < 0 || endInLine <= startInLine) return null;
  const lineStart = Number(line.dataset.start);
  const word = articleContent.slice(lineStart + startInLine, lineStart + endInLine).trim();
  if (!word) return null;
  return {
    word,
    startIndex: lineStart + startInLine + articleContent.slice(lineStart + startInLine, lineStart + endInLine).length - articleContent.slice(lineStart + startInLine, lineStart + endInLine).trimStart().length,
    endIndex: lineStart + endInLine - (articleContent.slice(lineStart + startInLine, lineStart + endInLine).length - articleContent.slice(lineStart + startInLine, lineStart + endInLine).trimEnd().length),
    lineNumber: Number(line.dataset.line),
    contextSentence: extractSentenceContext(
      articleContent,
      Number(line.dataset.start) + startInLine,
      Number(line.dataset.start) + endInLine,
    ),
  };
}
