import { useCallback, useEffect, useRef, useState } from "react";
import { answerForOption, type LearningQuestion, type ResolvedOption } from "./questionCompatibility";

type LearningSessionOptions = {
  articleId: number;
  loadQuestions: (articleId: number) => Promise<LearningQuestion[]>;
  submitAnswer: (questionId: number, answer: string) => Promise<boolean>;
};

type QuestionState = Record<number, number>;
type ResultState = Record<number, boolean>;
type SubmittingState = Record<number, boolean>;

function keepKnownQuestions<T>(state: Record<number, T>, questions: LearningQuestion[]) {
  const validIds = new Set(questions.map((question) => question.id));
  return Object.fromEntries(Object.entries(state).filter(([id]) => validIds.has(Number(id)))) as Record<number, T>;
}

export function useLearningSession({ articleId, loadQuestions, submitAnswer }: LearningSessionOptions) {
  const [questions, setQuestions] = useState<LearningQuestion[]>([]);
  const [answers, setAnswers] = useState<QuestionState>({});
  const [results, setResults] = useState<ResultState>({});
  const [submitting, setSubmitting] = useState<SubmittingState>({});
  const [notice, setNotice] = useState("");
  const requestIdRef = useRef(0);

  const refreshQuestions = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const nextQuestions = await loadQuestions(articleId);
      if (requestId !== requestIdRef.current) return;
      setQuestions(nextQuestions);
      setAnswers((current) => keepKnownQuestions(current, nextQuestions));
      setResults((current) => keepKnownQuestions(current, nextQuestions));
      setSubmitting({});
      setNotice("");
    } catch (error) {
      if (requestId === requestIdRef.current) setNotice(`加载练习失败：${String(error)}`);
    }
  }, [articleId, loadQuestions]);

  useEffect(() => {
    void refreshQuestions();
  }, [refreshQuestions]);

  const selectAnswer = useCallback((questionId: number, optionId: number) => {
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
  }, []);

  const submit = useCallback(async (question: LearningQuestion, option?: ResolvedOption) => {
    if (!option) {
      setNotice("请先选择一个答案");
      return;
    }
    if (submitting[question.id]) return;
    const requestId = requestIdRef.current;
    setSubmitting((current) => ({ ...current, [question.id]: true }));
    setNotice("");
    try {
      const correct = await submitAnswer(question.id, answerForOption(option));
      if (requestId === requestIdRef.current) {
        setResults((current) => ({ ...current, [question.id]: correct }));
      }
    } catch (error) {
      if (requestId === requestIdRef.current) setNotice(`提交答案失败：${String(error)}`);
    } finally {
      if (requestId === requestIdRef.current) {
        setSubmitting((current) => ({ ...current, [question.id]: false }));
      }
    }
  }, [submitAnswer, submitting]);

  return { questions, answers, results, submitting, notice, setNotice, refreshQuestions, selectAnswer, submit };
}