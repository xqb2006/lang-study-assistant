import { describe, expect, test } from "vitest";
import { createRedactedDiagnosticReport } from "./diagnosticReport";

describe("createRedactedDiagnosticReport", () => {
  test("uses an explicit safe field list", () => {
    const report = createRedactedDiagnosticReport({
      appVersion: "0.1.1",
      books: 2,
      chapters: 5,
      articles: 5,
      cards: 18,
      questions: 9,
      questionsWithoutOptions: 1,
    }, new Date("2026-08-07T12:34:56.000Z"));

    expect(report).toContain("Version: 0.1.1");
    expect(report).toContain("Vocabulary cards: 18");
    expect(report).toContain("Generated at (UTC): 2026-08-07T12:34:56.000Z");
    expect(report).toContain("excludes API keys, service URLs, model names, article text");
    expect(report).not.toContain("apiKey");
    expect(report).not.toContain("Authorization");
  });
});