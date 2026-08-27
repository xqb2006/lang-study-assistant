export type Mark = {
  id: number;
  word: string;
  startIndex: number;
  endIndex: number;
  lineNumber: number;
};

export type CardReference = {
  id: number;
  articleId: number;
  articleTitle: string;
  lineNumber: number;
  contextSentence: string;
  contextualMeaning: string;
  sentenceTranslation: string;
  usageNote: string;
  learningNote: string;
  analysisSource: string;
  isUserEdited: boolean;
};

export type Card = {
  id: number;
  word: string;
  lineNumber: number;
  contextSentence: string;
  translation: string;
  phonetic: string;
  definition: string;
  note: string;
  references: CardReference[];
};

export type CardCreateResult = {
  created: boolean;
  word: string;
  contextCount: number;
};

export type Selection = {
  word: string;
  startIndex: number;
  endIndex: number;
  lineNumber: number;
  contextSentence: string;
  origin?: "article" | "question";
};
