import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const execFileAsync = promisify(execFile);

const requestSchema = z.object({
  preset: z.enum(["all", "flagged", "custom"]).default("custom"),
  questionIds: z.array(z.string().min(1)).min(1).max(5000),
});

const PDF_TITLES: Record<"all" | "flagged" | "custom", string> = {
  all: "Banca domande ISW",
  flagged: "Domande segnate ISW",
  custom: "Selezione domande ISW",
};

export async function POST(request: NextRequest) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }
  const body = parsed.data;

  const workspaceRoot = process.cwd();
  // Percorso letto da env a runtime: un path letterale verso .venv romperebbe
  // l'analisi statica di Turbopack (symlink fuori dal progetto).
  const pythonBin = path.resolve(/* turbopackIgnore: true */ workspaceRoot, process.env.PDF_PYTHON_BIN ?? "python3");
  const scriptPath = path.join(/* turbopackIgnore: true */ workspaceRoot, "scripts", "generate-question-bank-pdf.py");
  // Stesso database usato dall'app (in Docker sta fuori dalla workspace).
  const dbPath = path.resolve(
    /* turbopackIgnore: true */ workspaceRoot,
    (process.env.DB_FILE_NAME ?? "file:local.db").replace(/^file:/, ""),
  );

  const workDir = await mkdtemp(path.join(tmpdir(), "isw-pdf-"));
  const outputPath = path.join(workDir, `${randomUUID()}.pdf`);

  try {
    const idsPath = path.join(workDir, "ids.txt");
    await writeFile(idsPath, body.questionIds.join("\n"), "utf8");

    const args = [
      scriptPath,
      "--db",
      dbPath,
      "--output",
      outputPath,
      "--title",
      PDF_TITLES[body.preset],
      "--ids-file",
      idsPath,
    ];

    await execFileAsync(pythonBin, args, { timeout: 120_000 });

    const pdf = await readFile(outputPath);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'inline; filename="isw-domande.pdf"',
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const noMatches = message.includes("No questions matched");
    return NextResponse.json(
      { error: noMatches ? "Nessuna domanda corrisponde alla selezione." : "Generazione del PDF fallita." },
      { status: noMatches ? 400 : 500 },
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
