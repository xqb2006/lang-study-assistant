export type AppDiagnostics = {
  appVersion: string;
  books: number;
  chapters: number;
  articles: number;
  cards: number;
  questions: number;
  questionsWithoutOptions: number;
};

export function createRedactedDiagnosticReport(
  diagnostics: AppDiagnostics,
  generatedAt = new Date(),
) {
  return [
    "# Reading Learning Assistant Diagnostic Report",
    `Generated at (UTC): ${generatedAt.toISOString()}`,
    "",
    "## Application",
    `Version: ${diagnostics.appVersion}`,
    "",
    "## Local data counts",
    `Books: ${diagnostics.books}`,
    `Chapters: ${diagnostics.chapters}`,
    `Articles: ${diagnostics.articles}`,
    `Vocabulary cards: ${diagnostics.cards}`,
    `Reading questions: ${diagnostics.questions}`,
    `Legacy questions without options: ${diagnostics.questionsWithoutOptions}`,
    "",
    "## Privacy",
    "This report intentionally excludes API keys, service URLs, model names, article text, translations, dictionary content, and vocabulary-card details.",
  ].join("\n").concat("\n");
}