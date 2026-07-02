import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, questions } from "@/db/schema";

const createSchema = z.object({ name: z.string().trim().min(1).max(120) });
const renameSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(120) });
const deleteSchema = z.object({ id: z.string().min(1) });

export async function POST(request: NextRequest) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Nome categoria non valido" }, { status: 400 });
  }

  const category = {
    id: `cat_user_${randomUUID().slice(0, 8)}`,
    name: parsed.data.name,
    description: null,
    keywordsJson: "[]",
  };
  await db.insert(categories).values(category);

  return NextResponse.json({ category });
}

export async function PATCH(request: NextRequest) {
  const parsed = renameSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, parsed.data.id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Categoria non trovata" }, { status: 404 });
  }

  await db.update(categories).set({ name: parsed.data.name }).where(eq(categories.id, parsed.data.id));
  return NextResponse.json({ id: parsed.data.id, name: parsed.data.name });
}

export async function DELETE(request: NextRequest) {
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, parsed.data.id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Categoria non trovata" }, { status: 404 });
  }

  // Le domande della categoria eliminata tornano "Non classificata".
  await db
    .update(questions)
    .set({ primaryCategoryId: null })
    .where(eq(questions.primaryCategoryId, parsed.data.id));
  await db.delete(categories).where(eq(categories.id, parsed.data.id));

  return NextResponse.json({ id: parsed.data.id, deleted: true });
}
