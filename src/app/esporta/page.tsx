import { AppHeader, AppShell } from "@/components/AppShell";
import { PdfExportBuilder } from "@/components/PdfExportBuilder";
import { getQuestionListRows } from "@/lib/quiz-data";

export const dynamic = "force-dynamic";

export default async function ExportPdfPage() {
  const rows = await getQuestionListRows({ limit: 10000, sort: "id_asc" });
  const questions = rows.map((row) => ({
    id: row.id,
    displayNumber: row.displayNumber,
    textPlain: row.textPlain.length > 160 ? `${row.textPlain.slice(0, 160)}...` : row.textPlain,
    isFlagged: row.isFlagged,
  }));

  return (
    <AppShell>
      <AppHeader title="Esporta PDF" />
      <div className="px-5 py-5 md:px-8">
        <PdfExportBuilder questions={questions} />
      </div>
    </AppShell>
  );
}
