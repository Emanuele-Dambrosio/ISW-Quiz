import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { exams } from "../src/db/schema";
import { examSchema } from "../src/lib/question-bank";

const inputPath = process.argv[2] ?? "data/raw/question-bank.json";

async function main() {
  const raw = JSON.parse(await readFile(inputPath, "utf8")) as Record<string, unknown>;
  const examRows = examSchema.array().parse(raw.exams ?? []);
  let updated = 0;

  for (const exam of examRows) {
    await db
      .update(exams)
      .set({
        title: exam.title,
        date: exam.date ?? null,
        sourceUrl: exam.sourceUrl ?? null,
      })
      .where(eq(exams.id, exam.id));
    updated += 1;
  }

  console.log(`Updated metadata for ${updated} exams from ${inputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
