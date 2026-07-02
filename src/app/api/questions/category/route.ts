import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, questions } from "@/db/schema";

const assignSchema = z.object({
  questionId: z.string().min(1),
  categoryId: z.string().min(1).nullable(),
});

export async function POST(request: NextRequest) {
  const parsed = assignSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }
  const body = parsed.data;

  const [question] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.id, body.questionId))
    .limit(1);
  if (!question) {
    return NextResponse.json({ error: "Domanda non trovata" }, { status: 404 });
  }

  if (body.categoryId) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, body.categoryId))
      .limit(1);
    if (!category) {
      return NextResponse.json({ error: "Categoria non trovata" }, { status: 404 });
    }
  }

  await db
    .update(questions)
    .set({ primaryCategoryId: body.categoryId })
    .where(eq(questions.id, body.questionId));

  return NextResponse.json({ questionId: body.questionId, categoryId: body.categoryId });
}
