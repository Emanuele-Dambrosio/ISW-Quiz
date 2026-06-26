import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { like, or, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { options } from "../src/db/schema";
import { cleanAnswerFeedbackHtml, cleanAnswerFeedbackPlain } from "./answer-feedback-cleaner";

type QuestionBankLike = {
  questions?: Array<{
    options?: Array<{
      textHtml?: string;
      textPlain?: string;
    }>;
  }>;
};

const jsonPaths = process.argv.slice(2);
const defaultJsonPath = "data/raw/question-bank.json";

async function main() {
  const databaseResult = await cleanDatabase();
  console.log(`Database options cleaned: ${databaseResult.changed}/${databaseResult.checked}`);

  const pathsToClean = jsonPaths.length > 0 ? jsonPaths : [defaultJsonPath];
  for (const path of pathsToClean) {
    if (!existsSync(path)) continue;
    const result = await cleanJson(path);
    console.log(`JSON options cleaned in ${path}: ${result.changed}/${result.checked}`);
  }
}

async function cleanDatabase() {
  const rows = await db
    .select({
      id: options.id,
      textHtml: options.textHtml,
      textPlain: options.textPlain,
    })
    .from(options)
    .where(
      or(
        like(options.textHtml, "%Correct.%"),
        like(options.textPlain, "%Correct.%"),
        like(options.textHtml, "%specificfeedback%"),
      ),
    );

  let changed = 0;
  for (const row of rows) {
    const textHtml = cleanAnswerFeedbackHtml(row.textHtml);
    const textPlain = cleanAnswerFeedbackPlain(row.textPlain);
    if (textHtml === row.textHtml && textPlain === row.textPlain) continue;

    await db
      .update(options)
      .set({ textHtml, textPlain })
      .where(sql`${options.id} = ${row.id}`);
    changed += 1;
  }

  return { checked: rows.length, changed };
}

async function cleanJson(path: string) {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as QuestionBankLike;
  let checked = 0;
  let changed = 0;

  for (const question of parsed.questions ?? []) {
    for (const option of question.options ?? []) {
      checked += 1;
      const textHtml = cleanAnswerFeedbackHtml(option.textHtml ?? "");
      const textPlain = cleanAnswerFeedbackPlain(option.textPlain ?? "");
      if (textHtml === option.textHtml && textPlain === option.textPlain) continue;

      option.textHtml = textHtml;
      option.textPlain = textPlain;
      changed += 1;
    }
  }

  if (changed > 0) {
    await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`);
  }

  return { checked, changed };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
