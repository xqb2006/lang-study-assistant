export type ResourceLanguage = "zh" | "en" | "ja" | "ko" | "fr" | "de" | "es" | "it" | "pt" | "ru" | "ar" | "other";
export type ResourceType = "dictionary" | "wordlist" | "terminology" | "examples";

export type CustomDictionaryStatus = {
  id: string;
  name: string;
  entryCount: number;
  source: string;
  installedAt: string;
  language: ResourceLanguage | string;
  definitionLanguage: ResourceLanguage | string;
  resourceType: ResourceType | string;
  enabled: boolean;
};

export type ResourceImportAnalysis = {
  suggestedName: string;
  lookupLanguage: ResourceLanguage | string;
  definitionLanguage: ResourceLanguage | string;
  resourceType: ResourceType;
  confidence: "high" | "medium" | "low";
  sampleCount: number;
  note: string;
};

export type DictionaryInstallProgress = {
  phase: string;
  percent: number;
  detail: string;
};

export type LocalDictionaryResult = {
  found: boolean;
  word: string;
  translation: string;
  phonetic: string;
  definition: string;
  commonMeanings?: string[];
  contextualMeaning?: string;
  sentenceTranslation?: string;
  usageNote?: string;
  partOfSpeech: string;
  exchange: string;
};