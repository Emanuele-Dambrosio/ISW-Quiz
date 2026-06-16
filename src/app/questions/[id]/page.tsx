import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { AppHeader, AppShell } from "@/components/AppShell";
import { formatExamLabel } from "@/lib/exam-format";
import { getQuestionDetail } from "@/lib/quiz-data";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ returnTo?: string }>;

export default async function QuestionDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, filters] = await Promise.all([params, searchParams]);
  const question = await getQuestionDetail(id);
  if (!question) notFound();
  const returnHref = normalizeQuestionsReturn(filters.returnTo);

  return (
    <AppShell>
      <AppHeader
        title="Dettaglio Domanda"
        action={
          <Link
            href={returnHref}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8d6cc] bg-white px-3 text-sm font-medium hover:bg-[#f3f1e8]"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Browser
          </Link>
        }
      />
      <div className="grid gap-5 px-5 py-5 md:px-8">
        <section className="rounded-lg border border-[#dfded6] bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md bg-[#1b4332] px-2 py-1 font-semibold text-white">
              Domanda #{question.displayNumber}
            </span>
            <span className="rounded-md bg-[#f3f1e8] px-2 py-1">
              {question.categoryName ?? "Non classificata"}
            </span>
            <span className="rounded-md bg-[#f3f1e8] px-2 py-1">
              {question.appearances.length} comparse
            </span>
            <span className={`rounded-md px-2 py-1 font-medium ${counterTone(question.masteryScore)}`}>
              Contatore {formatCounter(question.masteryScore)}
            </span>
          </div>
          <div className="quiz-content leading-7" dangerouslySetInnerHTML={{ __html: question.textHtml }} />
        </section>

        <section className="rounded-lg border border-[#dfded6] bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold">Opzioni</h2>
          <div className="grid gap-3">
            {question.options.map((option) => (
              <div
                key={option.id}
                className={[
                  "grid grid-cols-[32px_1fr_auto] gap-3 rounded-lg border p-3 text-sm",
                  option.isCorrect ? "border-[#15803d] bg-[#dcfce7]" : "border-[#dfded6]",
                ].join(" ")}
              >
                <span className="grid h-8 w-8 place-items-center rounded-md bg-white font-semibold">
                  {option.label}
                </span>
                <span className="quiz-content" dangerouslySetInnerHTML={{ __html: option.textHtml }} />
                {option.isCorrect ? <CheckCircle2 size={18} className="text-[#15803d]" aria-hidden="true" /> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#dfded6] bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold">Comparse</h2>
          <div className="grid gap-2 text-sm">
            {question.appearances.map((appearance) => (
              <div
                key={`${appearance.examId}-${appearance.questionNumber}`}
                className="flex flex-wrap items-center gap-2 rounded-md bg-[#fbfbf8] p-3"
              >
                <span className="font-medium">{formatExamLabel(appearance)}</span>
                {appearance.questionNumber ? (
                  <span className="rounded-md bg-white px-2 py-1 text-xs text-[#667064]">
                    Domanda {appearance.questionNumber}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function counterTone(value: number) {
  if (value > 0) return "bg-[#dcfce7] text-[#14532d]";
  if (value < 0) return "bg-[#fee2e2] text-[#7f1d1d]";
  return "bg-[#f3f1e8] text-[#4d554c]";
}

function formatCounter(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function normalizeQuestionsReturn(value?: string) {
  if (!value) return "/questions";
  if (value === "/questions" || value.startsWith("/questions?")) return value;
  return "/questions";
}
