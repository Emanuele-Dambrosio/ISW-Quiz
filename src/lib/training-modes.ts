export const TRAINING_MODES = [
  "exam_frequency",
  "random",
  "most_wrong",
  "slowest",
  "never_seen",
] as const;

export type TrainingMode = (typeof TRAINING_MODES)[number];

export function isTrainingMode(value: string): value is TrainingMode {
  return (TRAINING_MODES as readonly string[]).includes(value);
}

export const TRAINING_MODE_LABELS: Record<TrainingMode, { title: string; description: string }> = {
  exam_frequency: {
    title: "Più presenti in esami",
    description: "Domande pescate a caso partendo da quelle comparse più spesso negli esami.",
  },
  random: {
    title: "Random",
    description: "Domande scelte completamente a caso da tutta la banca.",
  },
  most_wrong: {
    title: "Più sbagliate",
    description: "Domande pescate a caso partendo da quelle con il contatore più basso.",
  },
  slowest: {
    title: "Più lente",
    description: "Domande pescate a caso partendo da quelle con il tempo medio di risposta più alto.",
  },
  never_seen: {
    title: "Mai viste",
    description: "Solo domande a cui non hai mai risposto (nemmeno saltandole).",
  },
};
