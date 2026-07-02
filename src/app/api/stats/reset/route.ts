import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { answerTimes, questionStats } from "@/db/schema";

const resetSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("all") }),
  z.object({ scope: z.literal("question"), questionId: z.string().min(1) }),
]);

export async function POST(request: NextRequest) {
  const parsed = resetSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.scope === "all") {
    await db.delete(answerTimes);
    await db.delete(questionStats);
    return NextResponse.json({ scope: "all", reset: true });
  }

  await db.delete(answerTimes).where(eq(answerTimes.questionId, body.questionId));
  await db.delete(questionStats).where(eq(questionStats.questionId, body.questionId));
  return NextResponse.json({ scope: "question", questionId: body.questionId, reset: true });
}
