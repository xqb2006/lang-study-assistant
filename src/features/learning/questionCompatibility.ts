export type LearningQuestionOption = {
  id: number;
  content: string;
};

export type QuestionForLearning = {
  prompt: string;
  answer: string;
  options: LearningQuestionOption[];
};

export type LearningQuestion = QuestionForLearning & {
  id: number;
  explanation: string;
  sourceLine?: number;
};

export type ResolvedOption = {
  id: number;
  label: string;
  content: string;
  legacy: boolean;
};

export type ResolvedQuestion = {
  prompt: string;
  options: ResolvedOption[];
};

function optionLabel(index: number) {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

export function resolveQuestion(question: QuestionForLearning): ResolvedQuestion {
  if (question.options.length) {
    return {
      prompt: question.prompt,
      options: question.options.map((option, index) => ({
        id: option.id,
        label: optionLabel(index),
        content: option.content,
        legacy: false,
      })),
    };
  }

  const markers = [...question.prompt.matchAll(/(?:^|\s)([A-H])[).、]\s*/g)];
  if (markers.length < 2) return { prompt: question.prompt, options: [] };
  const options = markers.map((marker, index) => {
    const contentStart = (marker.index ?? 0) + marker[0].length;
    const contentEnd = index + 1 < markers.length
      ? markers[index + 1].index ?? question.prompt.length
      : question.prompt.length;
    return {
      id: -(index + 1),
      label: marker[1].toUpperCase(),
      content: question.prompt.slice(contentStart, contentEnd).trim(),
      legacy: true,
    };
  }).filter((option) => option.content);
  return {
    prompt: question.prompt.slice(0, markers[0].index).trim(),
    options,
  };
}

export function answerForOption(option: ResolvedOption) {
  return option.legacy ? option.label : option.content;
}
export function correctAnswerText(question: QuestionForLearning, resolved: ResolvedQuestion) {
  const answer = question.answer.trim();
  const byLabel = resolved.options.find((option) => option.label === answer.toUpperCase());
  const byContent = resolved.options.find(
    (option) => option.content.trim().toLocaleLowerCase() === answer.toLocaleLowerCase(),
  );
  return byLabel?.content || byContent?.content || answer || "暂无";
}