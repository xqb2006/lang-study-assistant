const sentenceAbbreviations = new Set([
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "prof.",
  "sr.",
  "jr.",
  "e.g.",
  "i.e.",
  "etc.",
  "vs.",
  "no.",
  "fig.",
]);

function utf16OffsetToCharIndex(chars: string[], offset: number) {
  let consumed = 0;
  for (let index = 0; index < chars.length; index += 1) {
    if (consumed >= offset) return index;
    consumed += chars[index].length;
    if (consumed >= offset) return index + 1;
  }
  return chars.length;
}

function isSentenceBoundary(chars: string[], index: number) {
  const character = chars[index];
  if (character === "!" || character === "?" || character === "！" || character === "？" || character === "。") return true;
  if (character !== ".") return false;
  const previous = chars[index - 1] || "";
  const next = chars[index + 1] || "";
  if (/\d/.test(previous) && /\d/.test(next)) return false;
  let tokenStart = index;
  while (tokenStart > 0 && !/\s/.test(chars[tokenStart - 1])) tokenStart -= 1;
  const token = chars.slice(tokenStart, index + 1).join("").toLowerCase();
  if (sentenceAbbreviations.has(token) || /^(?:[a-z]\.){2,}$/i.test(token)) return false;
  return !next || /\s|[\"'”’)}\]]/.test(next);
}

export function extractSentenceContext(content: string, startIndex: number, endIndex: number) {
  const chars = Array.from(content);
  if (!chars.length) return "";
  const start = utf16OffsetToCharIndex(chars, Math.max(0, startIndex));
  const end = utf16OffsetToCharIndex(chars, Math.max(startIndex, endIndex));
  let sentenceStart = 0;
  for (let index = start - 1; index >= 0; index -= 1) {
    if (chars[index] === "\n" && chars[index - 1] === "\n") {
      sentenceStart = index + 1;
      break;
    }
    if (isSentenceBoundary(chars, index)) {
      sentenceStart = index + 1;
      break;
    }
  }
  while (sentenceStart < chars.length && /\s|[\"'“‘([{]/.test(chars[sentenceStart])) sentenceStart += 1;

  let sentenceEnd = chars.length;
  for (let index = end; index < chars.length; index += 1) {
    if (chars[index] === "\n" && chars[index + 1] === "\n") {
      sentenceEnd = index;
      break;
    }
    if (isSentenceBoundary(chars, index)) {
      sentenceEnd = index + 1;
      while (sentenceEnd < chars.length && /[\"'”’)}\]]/.test(chars[sentenceEnd])) sentenceEnd += 1;
      break;
    }
  }
  return chars.slice(sentenceStart, sentenceEnd).join("").replace(/\s+/g, " ").trim();
}

export function extractSelectedSentence(content: string, selectedText: string) {
  const normalizedSelected = selectedText.replace(/\s+/g, " ").trim();
  const startIndex = content.indexOf(normalizedSelected);
  if (!normalizedSelected || startIndex < 0) return "";
  return extractSentenceContext(content, startIndex, startIndex + normalizedSelected.length);
}

export function isAiSentenceContext(contextSentence: string, selectedText: string) {
  const normalizedContext = contextSentence.replace(/\s+/g, " ").trim();
  const normalizedSelected = selectedText.replace(/\s+/g, " ").trim();
  return Boolean(normalizedContext && normalizedSelected && normalizedContext.includes(normalizedSelected) && normalizedContext.length <= 600);
}
