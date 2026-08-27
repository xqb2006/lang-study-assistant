import { memo, type ReactNode, useEffect, useMemo, useState } from "react";
import { articleT, type DisplayLanguage } from "../i18n/ui";

export type ReaderArticle = { id: number; content: string };
export type ReaderMark = { id: number; word: string; startIndex: number; endIndex: number };
export type ReaderParagraphContext = { position: number; sourceText: string; translation: string };
type Paragraph = { id: number; position: number; sourceText: string; translation: string; translationSource: string };
const HighlightedLine = memo(function HighlightedLine({ line, lineStart, marks, displayLanguage }: { line: string; lineStart: number; marks: ReaderMark[]; displayLanguage: DisplayLanguage }) {
  const parts: ReactNode[] = []; let cursor = 0;
  marks.forEach((mark) => { const start = Math.max(0, mark.startIndex - lineStart); const end = Math.min(line.length, mark.endIndex - lineStart); if (start < cursor || end <= start) return; if (cursor < start) parts.push(line.slice(cursor, start)); parts.push(<mark key={mark.id} title={articleT(displayLanguage, "marked", { word: mark.word })}>{line.slice(start, end)}</mark>); cursor = end; });
  if (cursor < line.length) parts.push(line.slice(cursor)); return <>{parts}</>;
});
export function BilingualArticle({ article, marks, loadParagraphs, onCurrentParagraphChange, displayLanguage = "zh-CN" }: { article: ReaderArticle; marks: ReaderMark[]; loadParagraphs: (articleId: number) => Promise<Paragraph[]>; onCurrentParagraphChange?: (paragraph: ReaderParagraphContext) => void; displayLanguage?: DisplayLanguage }) {
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  useEffect(() => { let isCurrent = true; const fallback = article.content.split("\n").filter(Boolean).map((sourceText, index) => ({ id: -index - 1, position: index + 1, sourceText, translation: "", translationSource: "" })); setParagraphs(fallback); void loadParagraphs(article.id).then((items) => { if (isCurrent && items.length) setParagraphs(items); }).catch(() => { if (isCurrent) setParagraphs(fallback); }); return () => { isCurrent = false; }; }, [article.id, article.content, loadParagraphs]);
  const positionedParagraphs = useMemo(() => { const sortedMarks = [...marks].sort((left, right) => left.startIndex - right.startIndex); let searchOffset = 0; let firstRelevantMark = 0; return paragraphs.map((paragraph, index) => { const matchedStart = article.content.indexOf(paragraph.sourceText, searchOffset); const lineStart = matchedStart >= 0 ? matchedStart : searchOffset; const lineEnd = lineStart + paragraph.sourceText.length; while (firstRelevantMark < sortedMarks.length && sortedMarks[firstRelevantMark].endIndex <= lineStart) firstRelevantMark += 1; const lineMarks: ReaderMark[] = []; for (let markIndex = firstRelevantMark; markIndex < sortedMarks.length && sortedMarks[markIndex].startIndex < lineEnd; markIndex += 1) if (sortedMarks[markIndex].endIndex > lineStart) lineMarks.push(sortedMarks[markIndex]); searchOffset = lineEnd; return { paragraph, index, lineStart, lineMarks }; }); }, [article.content, marks, paragraphs]);
  useEffect(() => {
    if (!onCurrentParagraphChange || typeof IntersectionObserver === "undefined") return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".paragraph-pair"));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (!visible) return;
      const index = Number(visible.target.querySelector("p[data-line]")?.getAttribute("data-line")) - 1;
      const paragraph = positionedParagraphs[index]?.paragraph;
      if (paragraph) onCurrentParagraphChange({ position: paragraph.position, sourceText: paragraph.sourceText, translation: paragraph.translation });
    }, { threshold: [0.2, 0.5, 0.8] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [onCurrentParagraphChange, positionedParagraphs]);
  return <article className="bilingual-article">{positionedParagraphs.map(({ paragraph, index, lineStart, lineMarks }) => <section className="paragraph-pair" key={paragraph.id}><p id={`line-${index + 1}`} data-line={index + 1} data-start={lineStart}><sup aria-hidden="true">{String(index + 1).padStart(2, "0")}</sup><HighlightedLine line={paragraph.sourceText} lineStart={lineStart} marks={lineMarks} displayLanguage={displayLanguage} /></p>{paragraph.translation ? <div className="paragraph-translation">{paragraph.translation}</div> : <div className="paragraph-translation pending">{paragraph.translationSource === "pending_ai" ? articleT(displayLanguage, "translationPending") : articleT(displayLanguage, "translationMissing")}</div>}</section>)}</article>;
}
