import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import {
  assets,
  categories,
  categoryPredictions,
  exams,
  options,
  questionAppearances,
  questions,
} from "../src/db/schema";
import {
  questionBankSchema,
  questionSchema,
  type QuestionBank,
} from "../src/lib/question-bank";
import { cleanAnswerFeedbackHtml, cleanAnswerFeedbackPlain } from "./answer-feedback-cleaner";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: tsx scripts/import-questions.ts <question-bank.json>");
  process.exit(1);
}

const nowIso = () => new Date().toISOString();

function scopedAssetId(assetId: string, questionId: string, optionId: string | null): string {
  const scope = createHash("sha1")
    .update(`${questionId}:${optionId ?? "question"}`)
    .digest("hex")
    .slice(0, 10);
  return `${assetId}_${scope}`;
}

async function main() {
  const raw = await readFile(inputPath, "utf8");
  const rawBank = JSON.parse(raw) as Record<string, unknown>;
  const baseBank = questionBankSchema
    .omit({ questions: true })
    .parse({
      version: rawBank.version,
      exams: rawBank.exams,
      categories: rawBank.categories,
    });
  const rawQuestions = Array.isArray(rawBank.questions) ? rawBank.questions : [];
  const validQuestions: QuestionBank["questions"] = [];
  const skippedQuestions: Array<{ index: number; id: string; reason: string }> = [];

  for (const [index, rawQuestion] of rawQuestions.entries()) {
    const result = questionSchema.safeParse(rawQuestion);
    if (result.success) {
      validQuestions.push(result.data);
      continue;
    }

    const rawQuestionId =
      rawQuestion && typeof rawQuestion === "object" && "id" in rawQuestion
        ? String(rawQuestion.id)
        : "unknown";
    skippedQuestions.push({
      index,
      id: rawQuestionId,
      reason: result.error.issues
        .map((issue) => `${issue.path.join(".") || "question"}: ${issue.message}`)
        .join("; "),
    });
  }

  const bank: QuestionBank = {
    ...baseBank,
    questions: validQuestions,
  };
  const importedAt = nowIso();

  for (const category of bank.categories) {
    await db
      .insert(categories)
      .values({
        id: category.id,
        name: category.name,
        description: category.description,
        keywordsJson: JSON.stringify(category.keywords),
      })
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          name: category.name,
          description: category.description,
          keywordsJson: JSON.stringify(category.keywords),
        },
      });
  }

  for (const exam of bank.exams) {
    await db
      .insert(exams)
      .values({
        id: exam.id,
        title: exam.title,
        sourceUrl: exam.sourceUrl ?? null,
        date: exam.date ?? null,
        createdAt: importedAt,
      })
      .onConflictDoUpdate({
        target: exams.id,
        set: {
          title: exam.title,
          sourceUrl: exam.sourceUrl ?? null,
          date: exam.date ?? null,
        },
      });
  }

  const existingQuestionRows = await db
    .select({ id: questions.id, displayNumber: questions.displayNumber })
    .from(questions);
  const displayNumbersByQuestionId = new Map(
    existingQuestionRows.map((question) => [question.id, question.displayNumber]),
  );
  let nextDisplayNumber = Math.max(0, ...existingQuestionRows.map((question) => question.displayNumber)) + 1;

  for (const question of bank.questions) {
    const primaryCategoryId =
      question.categoryPredictions
        .slice()
        .sort((a, b) => b.confidence - a.confidence)[0]?.categoryId ?? null;
    let displayNumber = displayNumbersByQuestionId.get(question.id);
    if (!displayNumber) {
      displayNumber = nextDisplayNumber;
      displayNumbersByQuestionId.set(question.id, displayNumber);
      nextDisplayNumber += 1;
    }

    await db
      .insert(questions)
      .values({
        id: question.id,
        displayNumber,
        canonicalHash: question.canonicalHash,
        textHtml: question.textHtml,
        textPlain: question.textPlain,
        explanationHtml: question.explanationHtml ?? null,
        primaryCategoryId,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
      })
      .onConflictDoUpdate({
        target: questions.id,
        set: {
          canonicalHash: question.canonicalHash,
          textHtml: question.textHtml,
          textPlain: question.textPlain,
          explanationHtml: question.explanationHtml ?? null,
          primaryCategoryId,
          updatedAt: question.updatedAt,
        },
      });

    await db.delete(categoryPredictions).where(eq(categoryPredictions.questionId, question.id));
    await db.delete(assets).where(eq(assets.questionId, question.id));
    await db.delete(options).where(eq(options.questionId, question.id));

    for (const [index, option] of question.options.entries()) {
      const textHtml = cleanAnswerFeedbackHtml(option.textHtml);
      const textPlain = cleanAnswerFeedbackPlain(option.textPlain);

      await db.insert(options).values({
        id: option.id,
        questionId: question.id,
        label: String.fromCharCode(65 + index),
        textHtml,
        textPlain,
        isCorrect: option.isCorrect,
        position: index,
      });
    }

    for (const image of question.images) {
      await db.insert(assets).values({
        id: scopedAssetId(image.id, question.id, null),
        questionId: question.id,
        optionId: null,
        context: "question",
        originalUrl: image.originalUrl ?? null,
        localPath: image.localPath,
        sha256: image.sha256,
        alt: image.alt ?? "",
      });
    }

    for (const option of question.options) {
      for (const image of option.images) {
        await db.insert(assets).values({
          id: scopedAssetId(image.id, question.id, option.id),
          questionId: question.id,
          optionId: option.id,
          context: "option",
          originalUrl: image.originalUrl ?? null,
          localPath: image.localPath,
          sha256: image.sha256,
          alt: image.alt ?? "",
        });
      }
    }

    for (const prediction of question.categoryPredictions) {
      await db.insert(categoryPredictions).values({
        questionId: question.id,
        categoryId: prediction.categoryId,
        confidence: prediction.confidence,
        method: prediction.method,
      });
    }

    for (const appearance of question.appearances) {
      await db
        .insert(questionAppearances)
        .values({
          questionId: question.id,
          examId: appearance.examId,
          questionNumber: appearance.questionNumber ?? null,
          optionOrderJson: JSON.stringify(appearance.optionOrder),
        })
        .onConflictDoUpdate({
          target: [questionAppearances.questionId, questionAppearances.examId],
          set: {
            questionNumber: appearance.questionNumber ?? null,
            optionOrderJson: JSON.stringify(appearance.optionOrder),
          },
        });
    }

    const duplicateByHash = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.canonicalHash, question.canonicalHash), eq(questions.id, question.id)));

    if (duplicateByHash.length === 0) {
      throw new Error(`Question ${question.id} was not persisted correctly.`);
    }
  }

  console.log(`Imported ${bank.questions.length} questions from ${inputPath}`);
  if (skippedQuestions.length > 0) {
    console.warn(`Skipped ${skippedQuestions.length} invalid questions:`);
    for (const skipped of skippedQuestions) {
      console.warn(`- #${skipped.index} ${skipped.id}: ${skipped.reason}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
