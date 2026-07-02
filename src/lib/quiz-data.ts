import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { normalizeSearchText } from "@/lib/search-text";
import {
  categories,
  exams,
  options,
  questionAppearances,
  questionFlags,
  questions,
  questionStats,
} from "@/db/schema";

export type QuestionListRow = {
  id: string;
  displayNumber: number;
  textPlain: string;
  categoryName: string | null;
  appearanceCount: number;
  appearanceLabels: string | null;
  masteryScore: number;
  isFlagged: boolean;
};

export type QuestionListSort =
  | "id_asc"
  | "id_desc"
  | "appearances_asc"
  | "appearances_desc"
  | "counter_asc"
  | "counter_desc";

export type QuizOptionData = {
  id: string;
  label: string;
  textHtml: string;
  textPlain: string;
  isCorrect: boolean;
};

export type QuizQuestionData = {
  id: string;
  displayNumber: number;
  textHtml: string;
  textPlain: string;
  categoryName: string | null;
  options: QuizOptionData[];
};

export type TrainingQuestionData = QuizQuestionData & {
  masteryScore: number;
  appearanceCount: number;
  appearanceLabels: string | null;
  isFlagged: boolean;
};

export async function getCategoryRows() {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .innerJoin(questions, eq(questions.primaryCategoryId, categories.id))
    .groupBy(categories.id, categories.name)
    .orderBy(categories.name);
}

export async function getExamRows(limit = 50) {
  return db
    .select({ id: exams.id, title: exams.title, date: exams.date })
    .from(exams)
    .orderBy(desc(exams.date), desc(exams.createdAt))
    .limit(limit);
}

export async function getQuestionListRows(filters?: {
  categoryId?: string;
  examId?: string;
  query?: string;
  limit?: number;
  offset?: number;
  sort?: QuestionListSort;
}) {
  const conditions = buildQuestionConditions(filters);

  const appearanceCount = sql<number>`count(distinct ${questionAppearances.examId})`;
  const appearanceLabels = sql<string>`group_concat(distinct coalesce(${exams.date}, ${exams.title}))`;
  const masteryScore = sql<number>`coalesce(${questionStats.masteryScore}, 0)`;
  const orderBy = getQuestionListOrderBy(filters?.sort, appearanceCount, masteryScore);

  const rows = await db
    .select({
      id: questions.id,
      displayNumber: questions.displayNumber,
      textPlain: questions.textPlain,
      categoryName: categories.name,
      appearanceCount,
      appearanceLabels,
      masteryScore,
      isFlagged: sql<number>`case when ${questionFlags.questionId} is not null then 1 else 0 end`,
    })
    .from(questions)
    .leftJoin(categories, eq(questions.primaryCategoryId, categories.id))
    .leftJoin(questionAppearances, eq(questionAppearances.questionId, questions.id))
    .leftJoin(exams, eq(questionAppearances.examId, exams.id))
    .leftJoin(questionStats, eq(questionStats.questionId, questions.id))
    .leftJoin(questionFlags, eq(questionFlags.questionId, questions.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(questions.id)
    .orderBy(...orderBy)
    .limit(filters?.limit ?? 100)
    .offset(filters?.offset ?? 0);

  return rows.map((row) => ({ ...row, isFlagged: Boolean(row.isFlagged) }));
}

export async function getFlaggedQuestionRows(): Promise<QuestionListRow[]> {
  const appearanceCount = sql<number>`count(distinct ${questionAppearances.examId})`;
  const appearanceLabels = sql<string>`group_concat(distinct coalesce(${exams.date}, ${exams.title}))`;
  const masteryScore = sql<number>`coalesce(${questionStats.masteryScore}, 0)`;

  const rows = await db
    .select({
      id: questions.id,
      displayNumber: questions.displayNumber,
      textPlain: questions.textPlain,
      categoryName: categories.name,
      appearanceCount,
      appearanceLabels,
      masteryScore,
      flaggedAt: questionFlags.flaggedAt,
    })
    .from(questionFlags)
    .innerJoin(questions, eq(questions.id, questionFlags.questionId))
    .leftJoin(categories, eq(questions.primaryCategoryId, categories.id))
    .leftJoin(questionAppearances, eq(questionAppearances.questionId, questions.id))
    .leftJoin(exams, eq(questionAppearances.examId, exams.id))
    .leftJoin(questionStats, eq(questionStats.questionId, questions.id))
    .groupBy(questions.id)
    .orderBy(desc(questionFlags.flaggedAt));

  return rows.map((row) => ({
    id: row.id,
    displayNumber: row.displayNumber,
    textPlain: row.textPlain,
    categoryName: row.categoryName,
    appearanceCount: Number(row.appearanceCount ?? 0),
    appearanceLabels: row.appearanceLabels ?? null,
    masteryScore: Number(row.masteryScore ?? 0),
    isFlagged: true,
  }));
}

export async function getQuestionListCount(filters?: {
  categoryId?: string;
  examId?: string;
  query?: string;
}) {
  const conditions = buildQuestionConditions(filters);
  const [row] = await db
    .select({ value: sql<number>`count(distinct ${questions.id})` })
    .from(questions)
    .leftJoin(questionAppearances, eq(questionAppearances.questionId, questions.id))
    .where(conditions.length ? and(...conditions) : undefined);

  return Number(row?.value ?? 0);
}

export async function getFlaggedQuestionCount() {
  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(questionFlags);

  return Number(row?.value ?? 0);
}

export async function getRandomQuizQuestions(limit = 50) {
  const rows = await db
    .select({
      id: questions.id,
      displayNumber: questions.displayNumber,
      textHtml: questions.textHtml,
      textPlain: questions.textPlain,
      categoryName: categories.name,
    })
    .from(questions)
    .leftJoin(categories, eq(questions.primaryCategoryId, categories.id))
    .orderBy(sql`random()`)
    .limit(limit);

  return hydrateQuizQuestions(rows);
}

export async function getRandomTrainingQuestion(excludeQuestionId?: string): Promise<TrainingQuestionData | null> {
  const appearanceCount = sql<number>`count(distinct ${questionAppearances.examId})`;
  const appearanceLabels = sql<string>`group_concat(distinct coalesce(${exams.date}, ${exams.title}))`;

  const rows = await db
    .select({
      id: questions.id,
      displayNumber: questions.displayNumber,
      textHtml: questions.textHtml,
      textPlain: questions.textPlain,
      categoryName: categories.name,
      masteryScore: sql<number>`coalesce(${questionStats.masteryScore}, 0)`,
      appearanceCount,
      appearanceLabels,
      isFlagged: sql<number>`case when ${questionFlags.questionId} is not null then 1 else 0 end`,
    })
    .from(questions)
    .leftJoin(categories, eq(questions.primaryCategoryId, categories.id))
    .leftJoin(questionAppearances, eq(questionAppearances.questionId, questions.id))
    .leftJoin(exams, eq(questionAppearances.examId, exams.id))
    .leftJoin(questionStats, eq(questionStats.questionId, questions.id))
    .leftJoin(questionFlags, eq(questionFlags.questionId, questions.id))
    .where(excludeQuestionId ? sql`${questions.id} <> ${excludeQuestionId}` : undefined)
    .groupBy(questions.id)
    .orderBy(sql`random()`)
    .limit(1);

  if (rows.length === 0) return null;

  const [hydrated] = await hydrateQuizQuestions(rows);
  if (!hydrated) return null;

  return {
    ...hydrated,
    masteryScore: Number(rows[0].masteryScore ?? 0),
    appearanceCount: Number(rows[0].appearanceCount ?? 0),
    appearanceLabels: rows[0].appearanceLabels ?? null,
    isFlagged: Boolean(rows[0].isFlagged),
  };
}

export async function getQuestionDetail(id: string) {
  const [question] = await db
    .select({
      id: questions.id,
      displayNumber: questions.displayNumber,
      textHtml: questions.textHtml,
      textPlain: questions.textPlain,
      categoryName: categories.name,
      masteryScore: sql<number>`coalesce(${questionStats.masteryScore}, 0)`,
      isFlagged: sql<number>`case when ${questionFlags.questionId} is not null then 1 else 0 end`,
    })
    .from(questions)
    .leftJoin(categories, eq(questions.primaryCategoryId, categories.id))
    .leftJoin(questionStats, eq(questionStats.questionId, questions.id))
    .leftJoin(questionFlags, eq(questionFlags.questionId, questions.id))
    .where(eq(questions.id, id))
    .limit(1);

  if (!question) return null;

  const [hydrated] = await hydrateQuizQuestions([question]);
  const appearances = await db
    .select({
      examId: exams.id,
      title: exams.title,
      date: exams.date,
      questionNumber: questionAppearances.questionNumber,
    })
    .from(questionAppearances)
    .innerJoin(exams, eq(questionAppearances.examId, exams.id))
    .where(eq(questionAppearances.questionId, id))
    .orderBy(exams.date, exams.title);

  return {
    ...hydrated,
    masteryScore: Number(question.masteryScore ?? 0),
    isFlagged: Boolean(question.isFlagged),
    appearances,
  };
}

async function hydrateQuizQuestions(
  rows: Array<{
    id: string;
    displayNumber: number;
    textHtml: string;
    textPlain: string;
    categoryName: string | null;
  }>,
): Promise<QuizQuestionData[]> {
  if (rows.length === 0) return [];

  const optionRows = await db
    .select({
      id: options.id,
      questionId: options.questionId,
      label: options.label,
      textHtml: options.textHtml,
      textPlain: options.textPlain,
      isCorrect: options.isCorrect,
      position: options.position,
    })
    .from(options)
    .where(
      inArray(
        options.questionId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(options.questionId, options.position);

  const optionsByQuestion = new Map<string, QuizOptionData[]>();
  for (const option of optionRows) {
    const values = optionsByQuestion.get(option.questionId) ?? [];
    values.push({
      id: option.id,
      label: option.label,
      textHtml: option.textHtml,
      textPlain: option.textPlain,
      isCorrect: option.isCorrect,
    });
    optionsByQuestion.set(option.questionId, values);
  }

  return rows.map((row) => ({
    id: row.id,
    displayNumber: row.displayNumber,
    textHtml: row.textHtml,
    textPlain: row.textPlain,
    categoryName: row.categoryName,
    options: optionsByQuestion.get(row.id) ?? [],
  }));
}

function getQuestionListOrderBy(
  sort: QuestionListSort | undefined,
  appearanceCount: SQL<number>,
  masteryScore: SQL<number>,
) {
  switch (sort) {
    case "id_asc":
      return [asc(questions.displayNumber)];
    case "id_desc":
      return [desc(questions.displayNumber)];
    case "appearances_asc":
      return [asc(appearanceCount), desc(questions.updatedAt)];
    case "appearances_desc":
      return [desc(appearanceCount), desc(questions.updatedAt)];
    case "counter_asc":
      return [asc(masteryScore), desc(questions.updatedAt)];
    case "counter_desc":
      return [desc(masteryScore), desc(questions.updatedAt)];
    default:
      return [desc(questions.updatedAt)];
  }
}

function buildQuestionConditions(filters?: {
  categoryId?: string;
  examId?: string;
  query?: string;
}) {
  const conditions: SQL[] = [];

  if (filters?.categoryId) {
    conditions.push(eq(questions.primaryCategoryId, filters.categoryId));
  }

  if (filters?.examId) {
    conditions.push(eq(questionAppearances.examId, filters.examId));
  }

  const query = filters?.query?.trim();
  if (query) {
    const displayNumberMatch = query.match(/^#?(\d+)$/);
    const textCondition = buildTextSearchCondition(query);
    if (displayNumberMatch) {
      const numberCondition = eq(questions.displayNumber, Number(displayNumberMatch[1]));
      conditions.push(textCondition ? or(numberCondition, textCondition)! : numberCondition);
    } else if (textCondition) {
      conditions.push(textCondition);
    }
  }

  return conditions;
}

/**
 * Ricerca elastica: ogni parola della query deve comparire (in qualsiasi
 * ordine) nel testo della domanda o in una delle opzioni. Il confronto
 * avviene sulla colonna precalcolata text_search (minuscole, senza accenti).
 */
function buildTextSearchCondition(query: string): SQL | null {
  const tokens = normalizeSearchText(query)
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return null;

  const tokenConditions = tokens.map((token) => {
    const pattern = `%${escapeLikePattern(token)}%`;
    const questionMatch = sql`${questions.textSearch} like ${pattern} escape '\\'`;
    const optionMatch = sql`exists (select 1 from ${options} where ${options.questionId} = ${questions.id} and ${options.textSearch} like ${pattern} escape '\\')`;
    return or(questionMatch, optionMatch)!;
  });

  return and(...tokenConditions)!;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
