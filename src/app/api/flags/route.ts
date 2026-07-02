import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { questionFlags, questions } from "@/db/schema";

const flagSchema = z.object({
  questionId: z.string().min(1),
  flagged: z.boolean(),
});

export async function POST(request: NextRequest) {
  const body = flagSchema.parse(await request.json());

  const [question] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.id, body.questionId))
    .limit(1);

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  if (body.flagged) {
    await db
      .insert(questionFlags)
      .values({ questionId: body.questionId, flaggedAt: new Date().toISOString() })
      .onConflictDoNothing();
  } else {
    await db.delete(questionFlags).where(eq(questionFlags.questionId, body.questionId));
  }

  return NextResponse.json({ questionId: body.questionId, flagged: body.flagged });
}
