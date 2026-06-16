export const EXAM_RULES = {
  questionCount: 50,
  optionCount: 4,
  durationSeconds: 30 * 60,
  correctAnswerPoints: 2,
  wrongAnswerPoints: -0.5,
  skippedAnswerPoints: 0,
} as const;

export type AnswerOutcome = "correct" | "wrong" | "skipped";

export function scoreAnswer(outcome: AnswerOutcome): number {
  if (outcome === "correct") return EXAM_RULES.correctAnswerPoints;
  if (outcome === "wrong") return EXAM_RULES.wrongAnswerPoints;
  return EXAM_RULES.skippedAnswerPoints;
}

export function scoreAttempt(outcomes: AnswerOutcome[]): number {
  return outcomes.reduce((total, outcome) => total + scoreAnswer(outcome), 0);
}
