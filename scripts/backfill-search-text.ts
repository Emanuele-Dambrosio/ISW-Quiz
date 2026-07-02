import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { options, questions } from "../src/db/schema";
import { normalizeSearchText } from "../src/lib/search-text";

async function main() {
  const questionRows = await db
    .select({ id: questions.id, textPlain: questions.textPlain })
    .from(questions);

  for (const row of questionRows) {
    await db
      .update(questions)
      .set({ textSearch: normalizeSearchText(row.textPlain) })
      .where(eq(questions.id, row.id));
  }

  const optionRows = await db
    .select({ id: options.id, textPlain: options.textPlain })
    .from(options);

  for (const row of optionRows) {
    await db
      .update(options)
      .set({ textSearch: normalizeSearchText(row.textPlain) })
      .where(eq(options.id, row.id));
  }

  console.log(`Backfilled text_search for ${questionRows.length} questions and ${optionRows.length} options.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
