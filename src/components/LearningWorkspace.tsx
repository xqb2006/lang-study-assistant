import { type ReactNode, useState } from "react";
import { extractSelectedSentence } from "../sentenceContext";
import { learningT, type DisplayLanguage } from "../i18n/ui";
import { correctAnswerText, resolveQuestion, type LearningQuestion } from "../features/learning/questionCompatibility";
import { useLearningSession } from "../features/learning/useLearningSession";

export type { LearningQuestion } from "../features/learning/questionCompatibility";

type QuestionSelection = {
  word: string;
  contextSentence: string;
};

export function LearningWorkspace({
  articleId,
  questionImport,
  emptyState,
  loadQuestions,
  submitAnswer,
  onLookupSelection,
  onTranslateQuestion = async () => {
    throw new Error("题目翻译功能暂不可用");
  },
  displayLanguage = "zh-CN",
}: {
  articleId: number;
  questionImport: (onSaved: () => Promise<void>) => ReactNode;
  emptyState: ReactNode;
  loadQuestions: (articleId: number) => Promise<LearningQuestion[]>;
  submitAnswer: (questionId: number, answer: string) => Promise<boolean>;
  onLookupSelection: (selection: QuestionSelection, mode: "dictionary" | "ai") => void;
  onTranslateQuestion?: (question: string) => Promise<string>;
  displayLanguage?: DisplayLanguage;
}) {
  const [selection, setSelection] = useState<QuestionSelection | null>(null);
  const [questionTranslations, setQuestionTranslations] = useState<Record<number, string>>({});
  const [translatingQuestionId, setTranslatingQuestionId] = useState<number | null>(null);
  const {
    questions,
    answers,
    results,
    submitting,
    notice,
    setNotice,
    refreshQuestions,
    selectAnswer,
    submit,
  } = useLearningSession({ articleId, loadQuestions, submitAnswer });

  const captureSelection = (contextText: string) => {
    const selectedText = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (!selectedText || selectedText.length > 120) return;
    const contextSentence = extractSelectedSentence(contextText, selectedText);
    if (!contextSentence) {
      setNotice(learningT(displayLanguage, "selectionNotLocated"));
      return;
    }
    setSelection({ word: selectedText, contextSentence });
  };

  const translateQuestion = async (questionId: number, questionText: string) => {
    setTranslatingQuestionId(questionId);
    try {
      const translation = await onTranslateQuestion(questionText);
      setQuestionTranslations((current) => ({ ...current, [questionId]: translation }));
    } catch (error) {
      setNotice(`题目翻译失败：${String(error)}`);
    } finally {
      setTranslatingQuestionId(null);
    }
  };

  return (
    <section className="learning-workspace">
      {questionImport(refreshQuestions)}
      {notice && <p className="settings-feedback">{notice}</p>}
      <div className="learning-heading">
        <h3>{learningT(displayLanguage, "workspaceTitle")}</h3>
        <span>{learningT(displayLanguage, "questionCount", { count: questions.length })}</span>
      </div>
      {selection && (
        <div className="question-selection-actions" role="status">
          <span>{learningT(displayLanguage, "selected", { word: selection.word })}</span>
          <button className="secondary-button" type="button" onClick={() => onLookupSelection(selection, "dictionary")}>{learningT(displayLanguage, "dictionaryLookup")}</button>
          <button className="primary-button" type="button" onClick={() => onLookupSelection(selection, "ai")}>{learningT(displayLanguage, "contextAnalysis")}</button>
          <button className="icon-button" type="button" aria-label={learningT(displayLanguage, "closeSelection")} onClick={() => setSelection(null)}>&times;</button>
        </div>
      )}
      <div className="question-list">
        {questions.length ? questions.map((question, index) => {
          const resolved = resolveQuestion(question);
          const selectedOptionId = answers[question.id];
          const selectedOption = resolved.options.find((option) => option.id === selectedOptionId);
          const submitted = results[question.id] !== undefined;
          return (
            <article key={`question-${question.id}`}>
               <b className="question-prompt question-selectable" onMouseUp={() => captureSelection(resolved.prompt)}>
                 {index + 1}. {resolved.prompt}
               </b>
               <button className="secondary-button question-submit-button" type="button" disabled={translatingQuestionId === question.id} onClick={() => void translateQuestion(question.id, resolved.prompt)}>
                 {translatingQuestionId === question.id ? "正在翻译题目…" : "翻译题目"}
               </button>
               {questionTranslations[question.id] && <p className="question-translation">{questionTranslations[question.id]}</p>}
              {resolved.options.length ? (
                <div className="question-options" role="radiogroup" aria-label={learningT(displayLanguage, "optionLabel", { index: index + 1 })}>
                  {resolved.options.map((option) => (
                    <label
                      key={`question-${question.id}-option-${option.id}`}
                      className={`question-option question-selectable ${selectedOptionId === option.id ? "selected" : ""}`}
                    >
                      <span className="question-option-letter" aria-hidden="true">{option.label}</span>
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={option.id}
                        aria-label={learningT(displayLanguage, "chooseOption", { option: option.label })}
                        checked={selectedOptionId === option.id}
                        disabled={submitting[question.id]}
                        onChange={() => selectAnswer(question.id, option.id)}
                      />
                      <span onMouseUp={() => captureSelection(option.content)}>{option.content}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="question-option-missing">{learningT(displayLanguage, "optionsMissing")}</p>
              )}
              <button className="primary-button question-submit-button" type="button" disabled={submitting[question.id] || selectedOptionId === undefined || !resolved.options.length} onClick={() => void submit(question, selectedOption)}>
                {submitting[question.id] ? learningT(displayLanguage, "submitting") : submitted ? learningT(displayLanguage, "resubmit") : learningT(displayLanguage, "submit")}
              </button>
              {submitted && (
                <div className={`answer-analysis ${results[question.id] ? "correct" : "incorrect"}`}>
                  <strong>{results[question.id] ? learningT(displayLanguage, "correct") : learningT(displayLanguage, "incorrect")}</strong>
                  <p>{learningT(displayLanguage, "correctAnswer", { answer: correctAnswerText(question, resolved) })}</p>
                  <p className="question-selectable" onMouseUp={() => captureSelection(question.explanation)}>{question.explanation || learningT(displayLanguage, "noExplanation")}</p>
                  {question.sourceLine && <p>{learningT(displayLanguage, "sourceLine", { line: question.sourceLine })}</p>}
                </div>
              )}
            </article>
          );
        }) : emptyState}
      </div>
    </section>
  );
}
