// Migrazione idempotente dello schema runtime (eseguita anche dall'entrypoint
// Docker). Plain JS senza dipendenze dev, così gira con il solo @libsql/client.
import { createClient } from "@libsql/client";

const url = process.env.DB_FILE_NAME ?? "file:local.db";
const db = createClient({ url });

// Deve restare allineata a src/lib/search-text.ts.
function normalizeSearchText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function columnExists(table, column) {
  const result = await db.execute(`pragma table_info(${table})`);
  return result.rows.some((row) => row.name === column);
}

async function main() {
  await db.execute(`CREATE TABLE IF NOT EXISTS question_flags (
    question_id TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
    flagged_at TEXT NOT NULL
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS answer_times (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    outcome TEXT NOT NULL,
    elapsed_ms INTEGER NOT NULL,
    answered_at TEXT NOT NULL
  )`);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS answer_times_question_idx ON answer_times (question_id)`,
  );

  await db.execute(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);

  for (const table of ["questions", "options"]) {
    if (!(await columnExists(table, "text_search"))) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN text_search TEXT NOT NULL DEFAULT ''`);
      console.log(`Added ${table}.text_search column.`);
    }
  }

  let backfilled = 0;
  for (const table of ["questions", "options"]) {
    const rows = await db.execute(`SELECT id, text_plain FROM ${table} WHERE text_search = ''`);
    for (const row of rows.rows) {
      await db.execute({
        sql: `UPDATE ${table} SET text_search = ? WHERE id = ?`,
        args: [normalizeSearchText(String(row.text_plain ?? "")), row.id],
      });
      backfilled += 1;
    }
  }
  if (backfilled > 0) {
    console.log(`Backfilled text_search for ${backfilled} rows.`);
  }

  console.log(`Database migration complete: ${url}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
