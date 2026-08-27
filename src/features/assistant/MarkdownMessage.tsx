import { Fragment, type ReactNode } from "react";

type MarkdownMessageProps = {
  content: string;
};

type InlineToken =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; value: string }
  | { type: "em"; value: string }
  | { type: "link"; label: string; href: string };

function safeHref(href: string) {
  return /^(https?:\/\/|mailto:)/i.test(href.trim()) ? href.trim() : "";
}

function parseInline(value: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\(([^)]+)\))/g;
  let lastIndex = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) tokens.push({ type: "text", value: value.slice(lastIndex, index) });
    const raw = match[0];
    if (raw.startsWith("`") && raw.endsWith("`")) tokens.push({ type: "code", value: raw.slice(1, -1) });
    else if (raw.startsWith("**") || raw.startsWith("__")) tokens.push({ type: "strong", value: raw.slice(2, -2) });
    else if (raw.startsWith("*") || raw.startsWith("_")) tokens.push({ type: "em", value: raw.slice(1, -1) });
    else {
      const linkMatch = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = linkMatch ? safeHref(linkMatch[2]) : "";
      if (linkMatch && href) tokens.push({ type: "link", label: linkMatch[1], href });
      else tokens.push({ type: "text", value: raw });
    }
    lastIndex = index + raw.length;
  }
  if (lastIndex < value.length) tokens.push({ type: "text", value: value.slice(lastIndex) });
  return tokens;
}

function renderInline(value: string): ReactNode[] {
  return parseInline(value).map((token, index) => {
    if (token.type === "code") return <code key={index}>{token.value}</code>;
    if (token.type === "strong") return <strong key={index}>{token.value}</strong>;
    if (token.type === "em") return <em key={index}>{token.value}</em>;
    if (token.type === "link") return <a key={index} href={token.href} target="_blank" rel="noreferrer">{token.label}</a>;
    return <Fragment key={index}>{token.value}</Fragment>;
  });
}

function renderBlocks(content: string): ReactNode[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(<pre key={blocks.length}><code data-language={language || undefined}>{codeLines.join("\n")}</code></pre>);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Tag = `h${heading[1].length}` as "h1" | "h2" | "h3";
      blocks.push(<Tag key={blocks.length}>{renderInline(heading[2])}</Tag>);
      index += 1;
      continue;
    }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      blocks.push(<hr key={blocks.length} />);
      index += 1;
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push(<blockquote key={blocks.length}>{renderBlocks(quoteLines.join("\n"))}</blockquote>);
      continue;
    }
    const listMatch = line.match(/^\s*([-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*([-*+]\s+|\d+[.)]\s+)(.+)$/);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        items.push(item[2]);
        index += 1;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(<ListTag key={blocks.length}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ListTag>);
      continue;
    }
    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+/.test(lines[index]) && !/^\s*(?:[-*+]\s+|\d+[.)]\s+|>\s?)/.test(lines[index]) && !lines[index].trim().startsWith("```")) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push(<p key={blocks.length}>{paragraphLines.map((paragraphLine, lineIndex) => <Fragment key={lineIndex}>{lineIndex > 0 && <br />}{renderInline(paragraphLine)}</Fragment>)}</p>);
  }
  return blocks;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return <div className="reading-assistant-markdown">{renderBlocks(content)}</div>;
}
