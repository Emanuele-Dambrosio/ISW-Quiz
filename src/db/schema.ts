import { relations } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const exams = sqliteTable("exams", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  sourceUrl: text("source_url"),
  date: text("date"),
  createdAt: text("created_at").notNull(),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  keywordsJson: text("keywords_json").notNull(),
});

export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    displayNumber: integer("display_number").notNull(),
    canonicalHash: text("canonical_hash").notNull(),
    textHtml: text("text_html").notNull(),
    textPlain: text("text_plain").notNull(),
    textSearch: text("text_search").notNull().default(""),
    explanationHtml: text("explanation_html"),
    primaryCategoryId: text("primary_category_id").references(() => categories.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("questions_display_number_idx").on(table.displayNumber),
    uniqueIndex("questions_canonical_hash_idx").on(table.canonicalHash),
    index("questions_primary_category_idx").on(table.primaryCategoryId),
  ],
);

export const options = sqliteTable(
  "options",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    textHtml: text("text_html").notNull(),
    textPlain: text("text_plain").notNull(),
    textSearch: text("text_search").notNull().default(""),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
    position: integer("position").notNull(),
  },
  (table) => [index("options_question_idx").on(table.questionId)],
);

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    optionId: text("option_id").references(() => options.id, {
      onDelete: "cascade",
    }),
    context: text("context", { enum: ["question", "option"] }).notNull(),
    originalUrl: text("original_url"),
    localPath: text("local_path").notNull(),
    sha256: text("sha256").notNull(),
    alt: text("alt"),
  },
  (table) => [
    index("assets_question_idx").on(table.questionId),
    index("assets_option_idx").on(table.optionId),
  ],
);

export const questionAppearances = sqliteTable(
  "question_appearances",
  {
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    questionNumber: integer("question_number"),
    optionOrderJson: text("option_order_json").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.questionId, table.examId] }),
    index("appearances_exam_idx").on(table.examId),
  ],
);

export const categoryPredictions = sqliteTable(
  "category_predictions",
  {
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    confidence: real("confidence").notNull(),
    method: text("method").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.questionId, table.categoryId, table.method] }),
  ],
);

export const quizAttempts = sqliteTable("quiz_attempts", {
  id: text("id").primaryKey(),
  mode: text("mode", { enum: ["simulation", "recovery", "practice"] }).notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  durationSeconds: integer("duration_seconds").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  score: real("score").notNull(),
});

export const attemptAnswers = sqliteTable(
  "attempt_answers",
  {
    attemptId: text("attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    selectedOptionId: text("selected_option_id").references(() => options.id),
    isCorrect: integer("is_correct", { mode: "boolean" }),
    scoreDelta: real("score_delta").notNull(),
    answeredAt: text("answered_at"),
  },
  (table) => [
    primaryKey({ columns: [table.attemptId, table.questionId] }),
    index("attempt_answers_question_idx").on(table.questionId),
  ],
);

export const questionStats = sqliteTable("question_stats", {
  questionId: text("question_id")
    .primaryKey()
    .references(() => questions.id, { onDelete: "cascade" }),
  masteryScore: integer("mastery_score").notNull().default(0),
  seenCount: integer("seen_count").notNull(),
  correctCount: integer("correct_count").notNull(),
  wrongCount: integer("wrong_count").notNull(),
  skippedCount: integer("skipped_count").notNull(),
  lastWrongAt: text("last_wrong_at"),
  updatedAt: text("updated_at").notNull(),
});

export const questionFlags = sqliteTable("question_flags", {
  questionId: text("question_id")
    .primaryKey()
    .references(() => questions.id, { onDelete: "cascade" }),
  flaggedAt: text("flagged_at").notNull(),
});

export const questionsRelations = relations(questions, ({ many, one }) => ({
  category: one(categories, {
    fields: [questions.primaryCategoryId],
    references: [categories.id],
  }),
  options: many(options),
  assets: many(assets),
  appearances: many(questionAppearances),
}));

export const optionsRelations = relations(options, ({ one, many }) => ({
  question: one(questions, {
    fields: [options.questionId],
    references: [questions.id],
  }),
  assets: many(assets),
}));
