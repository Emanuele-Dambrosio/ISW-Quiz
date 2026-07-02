import Link from "next/link";
import { Flag } from "lucide-react";
import { AppearanceBadge } from "@/components/AppearanceBadge";
import { AppHeader, AppShell } from "@/components/AppShell";
import { FlagButton } from "@/components/FlagButton";
import { formatExamAppearanceLabel } from "@/lib/exam-format";
import { getFlaggedQuestionRows } from "@/lib/quiz-data";

export const dynamic = "force-dynamic";

export default async function FlaggedQuestionsPage() {
  const questionRows = await getFlaggedQuestionRows();

  return (
    <AppShell>
      <AppHeader title="Domande Segnate" />
      <div className="grid min-w-0 gap-5 px-5 py-5 md:px-8">
        <section className="overflow-hidden rounded-lg border border-[#dfded6] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe9df] p-4">
            <div>
              <h2 className="text-lg font-semibold">
                {questionRows.length === 1 ? "1 domanda segnata" : `${questionRows.length} domande segnate`}
              </h2>
              <p className="text-sm text-[#667064]">
                Le più recenti prima · rimuovi il flag per toglierle dall&apos;elenco
              </p>
            </div>
            <Flag size={18} className="text-[#b45309]" aria-hidden="true" />
          </div>

          {questionRows.length === 0 ? (
            <div className="grid gap-3 p-6 text-sm text-[#667064]">
              <p>Non hai ancora segnato nessuna domanda.</p>
              <p>
                Usa il pulsante con la bandierina in{" "}
                <Link href="/allenamento" className="font-medium text-[#1b4332] underline">
                  Allenamento
                </Link>{" "}
                o nel{" "}
                <Link href="/questions" className="font-medium text-[#1b4332] underline">
                  Browser
                </Link>{" "}
                per ritrovarle qui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] border-collapse text-left text-sm">
                <thead className="bg-[#fbfbf8] text-[#667064]">
                  <tr>
                    <th className="w-[8%] px-4 py-3 font-medium">ID</th>
                    <th className="w-[46%] px-4 py-3 font-medium">Domanda</th>
                    <th className="w-[18%] px-4 py-3 font-medium">Categoria</th>
                    <th className="w-[10%] px-4 py-3 font-medium">Contatore</th>
                    <th className="w-[10%] px-4 py-3 font-medium">Comparse</th>
                    <th className="w-[8%] px-4 py-3 font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {questionRows.map((question) => {
                    const appearanceLabels = formatAppearanceLabels(question.appearanceLabels);
                    const appearanceCount = formatAppearanceCount(question.appearanceCount);

                    return (
                      <tr key={question.id} className="border-t border-[#ebe9df] align-top hover:bg-[#fbfbf8]">
                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-md bg-[#f3f1e8] px-2 py-1 text-xs font-semibold text-[#4d554c]">
                            #{question.displayNumber}
                          </span>
                        </td>
                        <td className="px-4 py-4 leading-6">{previewQuestionText(question.textPlain)}</td>
                        <td className="px-4 py-4">
                          <span className="inline-flex max-w-full items-center rounded-md bg-[#eef6f2] px-2 py-1 text-xs font-medium text-[#28666e]">
                            <span className="truncate">{question.categoryName ?? "Non classificata"}</span>
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <CounterBadge value={question.masteryScore} />
                        </td>
                        <td className="px-4 py-4">
                          <AppearanceBadge count={appearanceCount} labels={appearanceLabels} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/questions/${encodeURIComponent(question.id)}?returnTo=%2Fsegnate`}
                              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d8d6cc] px-3 text-sm font-medium hover:bg-[#f3f1e8]"
                            >
                              Apri
                            </Link>
                            <FlagButton
                              questionId={question.id}
                              initialFlagged={question.isFlagged}
                              variant="compact"
                              refreshOnToggle
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function CounterBadge({ value }: { value: number }) {
  const tone =
    value > 0
      ? "bg-[#dcfce7] text-[#14532d]"
      : value < 0
        ? "bg-[#fee2e2] text-[#7f1d1d]"
        : "bg-[#f3f1e8] text-[#4d554c]";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {value > 0 ? `+${value}` : String(value)}
    </span>
  );
}

function formatAppearanceLabels(value: string | null) {
  const labels = (value ?? "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean)
    .sort(sortAppearanceLabels)
    .map(formatExamAppearanceLabel);

  return labels.length > 0 ? labels : ["Data non disponibile"];
}

function sortAppearanceLabels(first: string, second: string) {
  const firstDate = isIsoDate(first) ? first : "";
  const secondDate = isIsoDate(second) ? second : "";
  return secondDate.localeCompare(firstDate);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatAppearanceCount(count: number) {
  return count === 1 ? "1 esame" : `${count} esami`;
}

function previewQuestionText(value: string) {
  return value.length > 190 ? `${value.slice(0, 190)}...` : value;
}
