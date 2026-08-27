export type QuestionDraft = {
  prompt: string;
  answer: string;
  explanation: string;
  sourceLine?: number;
  options: { content: string; isCorrect: boolean }[];
};

export type ReadingImageParagraph = {
  sourceText: string;
  translation: string;
  needsReview: boolean;
  pageStart?: number;
  pageEnd?: number;
  continuesFromPrevious?: boolean;
  continuesToNext?: boolean;
  translationSource?: "document" | "user" | "ai" | "missing" | string;
};

export type ReadingImageResult = {
  title: string;
  paragraphs: ReadingImageParagraph[];
};

export type VisualTocEntry = {
  title: string;
  printedPageNumber: number;
};

export type VisualChapterStart = {
  title: string;
  pageNumber: number;
  confidence: number;
};

export type UnifiedImportResult = ReadingImageResult & {
  documentType: "reading" | "questions" | "mixed" | "unknown";
  questions: QuestionDraft[];
  handwritingPages?: number[];
  tocEntries?: VisualTocEntry[];
  chapterStarts?: VisualChapterStart[];
};

export type ReadingPhoto = {
  id: string;
  name: string;
  imageData: string;
  localPath?: string;
  rotation: number;
  sourcePageNumber?: number;
  status: "waiting" | "recognizing" | "done" | "failed";
  result?: UnifiedImportResult;
  error?: string;
};

export type ChapterPhotoDraft = {
  title: string;
  sourceText: string;
  translationText: string;
  questions: QuestionDraft[];
  detectedLanguage?: string;
  languageDetectionReason?: string;
  chapterDrafts?: { title: string; sourceText: string; translationText: string }[];
};
