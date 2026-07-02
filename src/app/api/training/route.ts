import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { answerTimes, options, questionStats } from "@/db/schema";
import { getTrainingQuestion } from "@/lib/quiz-data";
import { isTrainingMode, type TrainingMode } from "@/lib/training-modes";

const answerSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionId: z.string().nullable(),
  elapsedMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).default(0),
});

export async function GET(request: NextRequest) {
  const exclude = request.nextUrl.searchParams.get("exclude") ?? undefined;
  const modeParam = request.nextUrl.searchParams.get("mode") ?? "";
  const mode: TrainingMode = isTrainingMode(modeParam) ? modeParam : "random";
  const question = await getTrainingQuestion(mode, exclude);

  return NextResponse.json({ question });
}

export async function POST(request: NextRequest) {
  const body = answerSchema.parse(await request.json());
  const optionRows = await db
    .select({ id: options.id, questionId: options.questionId, isCorrect: options.isCorrect })
    .from(options)
    .where(eq(options.questionId, body.questionId));

  const correctOption = optionRows.find((option) => option.isCorrect);
  const selectedOption = body.selectedOptionId
    ? optionRows.find((option) => option.id === body.selectedOptionId)
    : null;

  if (body.selectedOptionId && !selectedOption) {
    return NextResponse.json({ error: "Invalid option for question" }, { status: 400 });
  }

  const outcome = !body.selectedOptionId ? "skipped" : selectedOption?.isCorrect ? "correct" : "wrong";
  const delta = outcome === "correct" ? 1 : -1;
  const now = new Date().toISOString();

  const [existingStats] = await db
    .select()
    .from(questionStats)
    .where(eq(questionStats.questionId, body.questionId))
    .limit(1);

  const nextStats = {
    masteryScore: (existingStats?.masteryScore ?? 0) + delta,
    seenCount: (existingStats?.seenCount ?? 0) + 1,
    correctCount: (existingStats?.correctCount ?? 0) + (outcome === "correct" ? 1 : 0),
    wrongCount: (existingStats?.wrongCount ?? 0) + (outcome === "wrong" ? 1 : 0),
    skippedCount: (existingStats?.skippedCount ?? 0) + (outcome === "skipped" ? 1 : 0),
    lastWrongAt: outcome === "correct" ? (existingStats?.lastWrongAt ?? null) : now,
    updatedAt: now,
  };

  await db
    .insert(questionStats)
    .values({ questionId: body.questionId, ...nextStats })
    .onConflictDoUpdate({
      target: questionStats.questionId,
      set: nextStats,
    });

  await db.insert(answerTimes).values({
    questionId: body.questionId,
    outcome,
    elapsedMs: body.elapsedMs,
    answeredAt: now,
  });

  const history = await db
    .select({
      elapsedMs: answerTimes.elapsedMs,
      outcome: answerTimes.outcome,
      answeredAt: answerTimes.answeredAt,
    })
    .from(answerTimes)
    .where(eq(answerTimes.questionId, body.questionId))
    .orderBy(asc(answerTimes.id));

  return NextResponse.json({
    outcome,
    delta,
    score: nextStats.masteryScore,
    correctOptionId: correctOption?.id ?? null,
    elapsedMs: body.elapsedMs,
    history,
  });
}
