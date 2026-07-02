import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appSettings } from "@/db/schema";

export const DEFAULT_EXAM_SECONDS = 36;
export const MIN_EXAM_SECONDS = 5;
export const MAX_EXAM_SECONDS = 600;

const EXAM_SECONDS_KEY = "exam_seconds_per_question";

export async function getExamSecondsLimit(): Promise<number> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, EXAM_SECONDS_KEY))
    .limit(1);

  const parsed = Number(row?.value);
  if (!Number.isInteger(parsed) || parsed < MIN_EXAM_SECONDS || parsed > MAX_EXAM_SECONDS) {
    return DEFAULT_EXAM_SECONDS;
  }
  return parsed;
}

export async function setExamSecondsLimit(seconds: number) {
  await db
    .insert(appSettings)
    .values({ key: EXAM_SECONDS_KEY, value: String(seconds) })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: String(seconds) } });
}
