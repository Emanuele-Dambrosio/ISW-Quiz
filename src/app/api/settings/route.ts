import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MAX_EXAM_SECONDS, MIN_EXAM_SECONDS, setExamSecondsLimit } from "@/lib/settings";

const settingsSchema = z.object({
  examSecondsLimit: z.number().int().min(MIN_EXAM_SECONDS).max(MAX_EXAM_SECONDS),
});

export async function POST(request: NextRequest) {
  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Il limite deve essere un numero intero tra ${MIN_EXAM_SECONDS} e ${MAX_EXAM_SECONDS} secondi.` },
      { status: 400 },
    );
  }

  await setExamSecondsLimit(parsed.data.examSecondsLimit);
  return NextResponse.json({ examSecondsLimit: parsed.data.examSecondsLimit });
}
