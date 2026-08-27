import { useCallback } from "react";
import { appInvoke } from "../../services/appInvoke";

type Paragraph = {
  id: number;
  position: number;
  sourceText: string;
  translation: string;
  translationSource: string;
};

type QuizOption = {
  id: number;
  position: number;
  content: string;
  isCorrect: boolean;
};

type QuizQuestion = {
  id: number;
  prompt: string;
  answer: string;
  explanation: string;
  options: QuizOption[];
};

export function useLearningWorkspace() {
  const loadArticleParagraphs = useCallback(
    (articleId: number) => appInvoke<Paragraph[]>("get_paragraphs", { articleId }),
    [],
  );
  const loadLearningQuestions = useCallback(
    (articleId: number) => appInvoke<QuizQuestion[]>("get_questions", { articleId }),
    [],
  );
  const submitLearningAnswer = useCallback(
    (questionId: number, answer: string) =>
      appInvoke<boolean>("submit_question_answer", { questionId, answer }),
    [],
  );

  return { loadArticleParagraphs, loadLearningQuestions, submitLearningAnswer };
}
