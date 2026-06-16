import Link from "next/link";
import { CheckCircle2, Database, Filter, Target, TrendingUp } from "lucide-react";
import { asc, count, desc, eq, sql } from "drizzle-orm";
import { AppHeader, AppShell } from "@/components/AppShell";
import { exams, questionStats, questions } from "@/db/schema";
import { db } from "@/db/client";
import { formatExamLabel } from "@/lib/exam-format";
import { getCategoryRows, getExamRows, getQuestionListRows } from "@/lib/quiz-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [
    [questionMetric],
    [examMetric],
    [trainedMetric],
    [averageCounterMetric],
    categoryRows,
    examRows,
    questionRows,
    weakRows,
    strongRows,
  ] = await Promise.all([
    db.select({ value: count() }).from(questions),
    db.select({ value: count() }).from(exams),
    db.select({ value: count() }).from(questionStats),
    db.select({ value: sql<number>`coalesce(avg(${questionStats.masteryScore}), 0)` }).from(questionStats),
    getCategoryRows(),
    getExamRows(30),
    getQuestionListRows({ limit: 10 }),
    db
      .select({
        questionId: questions.id,
        displayNumber: questions.displayNumber,
        textPlain: questions.textPlain,
        masteryScore: questionStats.masteryScore,
        seenCount: questionStats.seenCount,
      })
      .from(questionStats)
      .innerJoin(questions, eq(questionStats.questionId, questions.id))
      .orderBy(asc(questionStats.masteryScore), desc(questionStats.seenCount))
      .limit(6),
    db
      .select({
        questionId: questions.id,
        displayNumber: questions.displayNumber,
        textPlain: questions.textPlain,
        masteryScore: questionStats.masteryScore,
        seenCount: questionStats.seenCount,
      })
      .from(questionStats)
      .innerJoin(questions, eq(questionStats.questionId, questions.id))
      .orderBy(desc(questionStats.masteryScore), desc(questionStats.seenCount))
      .limit(6),
  ]);

  return (
    <AppShell>
      <AppHeader title="ISW Quiz" />

      <div className="grid gap-5 px-5 py-5 md:px-8">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.45fr]">
          <MetricCard
            icon={Database}
            label="Domande"
            value={questionMetric.value}
            detail="importate nel database"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Esami importati"
            value={examMetric.value}
            detail="revisioni Moodle"
          />
          <section className="rounded-lg border border-[#dfded6] bg-white p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Allenamento</h2>
                <p className="text-sm text-[#667064]">Una domanda random alla volta</p>
              </div>
              <Target size={19} className="text-[#28666e]" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <RuleBox value="+1" label="corretta" tone="positive" />
              <RuleBox value="-1" label="errata" tone="negative" />
              <RuleBox value="-1" label="passata" tone="negative" />
            </div>
            <Link
              href="/allenamento"
              className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#1b4332] px-4 text-sm font-semibold text-white hover:bg-[#143527]"
            >
              Avvia allenamento
            </Link>
          </section>
        </div>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <section className="min-w-0 rounded-lg border border-[#dfded6] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe9df] p-4">
              <div>
                <h2 className="text-lg font-semibold">Browser Domande</h2>
                <p className="text-sm text-[#667064]">Archivio filtrabile con contatore per domanda</p>
              </div>
              <Link
                href="/questions"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8d6cc] px-3 text-sm font-medium hover:bg-[#f3f1e8]"
              >
                <Filter size={16} aria-hidden="true" />
                Apri browser
              </Link>
            </div>

            <form className="grid gap-3 border-b border-[#ebe9df] p-4 sm:grid-cols-[1fr_1fr_auto]" action="/questions">
              <label className="grid min-w-0 gap-1 text-sm">
                <span className="font-medium text-[#4d554c]">Categoria</span>
                <select
                  name="category"
                  className="h-10 w-full min-w-0 rounded-lg border border-[#d8d6cc] bg-white px-3 outline-none focus:border-[#28666e]"
                >
                  <option value="">Tutte</option>
                  {categoryRows.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-sm">
                <span className="font-medium text-[#4d554c]">Esame</span>
                <select
                  name="exam"
                  className="h-10 w-full min-w-0 rounded-lg border border-[#d8d6cc] bg-white px-3 outline-none focus:border-[#28666e]"
                >
                  <option value="">Tutti</option>
                  {examRows.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {formatExamLabel(exam)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-lg bg-[#1b4332] px-4 text-sm font-semibold text-white hover:bg-[#143527]"
              >
                <Filter size={16} aria-hidden="true" />
                Filtra
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                <thead className="bg-[#fbfbf8] text-[#667064]">
                  <tr>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Domanda</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Contatore</th>
                    <th className="px-4 py-3 font-medium">Apri</th>
                  </tr>
                </thead>
                <tbody>
                  {questionRows.map((question) => (
                    <tr key={question.id} className="border-t border-[#ebe9df]">
                      <td className="px-4 py-4">
                        <QuestionNumberBadge value={question.displayNumber} />
                      </td>
                      <td className="max-w-[320px] px-4 py-4">{previewText(question.textPlain, 140)}</td>
                      <td className="px-4 py-4">{question.categoryName ?? "Non classificata"}</td>
                      <td className="px-4 py-4">
                        <CounterBadge value={question.masteryScore} />
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/questions/${question.id}`}
                          className="rounded-md border border-[#d8d6cc] px-3 py-2 text-sm font-medium hover:bg-[#f3f1e8]"
                        >
                          Apri
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="min-w-0 rounded-lg border border-[#dfded6] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe9df] p-4">
              <div>
                <h2 className="text-lg font-semibold">Statistiche Allenamento</h2>
                <p className="text-sm text-[#667064]">Basate sul contatore +1/-1</p>
              </div>
              <TrendingUp size={19} className="text-[#28666e]" aria-hidden="true" />
            </div>

            <div className="grid grid-cols-2 gap-px border-b border-[#ebe9df] bg-[#ebe9df]">
              <StatBand label="Domande allenate" value={trainedMetric.value} />
              <StatBand label="Media contatore" value={Number(averageCounterMetric.value).toFixed(1)} />
            </div>

            <QuestionScoreList
              title="Da ripassare"
              rows={weakRows}
              emptyText="Nessuna statistica: avvia l'allenamento."
            />
            <QuestionScoreList
              title="Punti forti"
              rows={strongRows.filter((row) => row.masteryScore > 0)}
              emptyText="Ancora nessuna domanda con contatore positivo."
            />
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <section className="rounded-lg border border-[#dfded6] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-[#667064]">{label}</span>
        <Icon size={18} className="text-[#28666e]" aria-hidden={true} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold">{value}</span>
        <span className="text-sm text-[#667064]">{detail}</span>
      </div>
    </section>
  );
}

function RuleBox({ value, label, tone }: { value: string; label: string; tone: "positive" | "negative" }) {
  return (
    <div className="rounded-lg bg-[#f3f1e8] p-3 text-center">
      <div className={tone === "positive" ? "text-lg font-semibold text-[#15803d]" : "text-lg font-semibold text-[#b91c1c]"}>
        {value}
      </div>
      <div className="text-xs text-[#667064]">{label}</div>
    </div>
  );
}

function StatBand({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white p-4">
      <div className="text-sm text-[#667064]">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function QuestionScoreList({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: Array<{ questionId: string; displayNumber: number; textPlain: string; masteryScore: number; seenCount: number }>;
  emptyText: string;
}) {
  return (
    <div className="border-b border-[#ebe9df] p-4 last:border-b-0">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="grid gap-2">
        {rows.map((row) => (
          <Link
            key={row.questionId}
            href={`/questions/${row.questionId}`}
            className="grid gap-2 rounded-md bg-[#fbfbf8] p-3 text-sm hover:bg-[#f3f1e8]"
          >
            <span>
              <QuestionNumberBadge value={row.displayNumber} /> {previewText(row.textPlain, 130)}
            </span>
            <span className="font-semibold">
              Contatore <CounterText value={row.masteryScore} /> · {row.seenCount} viste
            </span>
          </Link>
        ))}
        {rows.length === 0 ? <div className="rounded-md bg-[#fbfbf8] p-3 text-sm text-[#667064]">{emptyText}</div> : null}
      </div>
    </div>
  );
}

function QuestionNumberBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex rounded-md bg-[#f3f1e8] px-2 py-1 text-xs font-semibold text-[#4d554c]">
      #{value}
    </span>
  );
}

function CounterBadge({ value }: { value: number }) {
  const tone =
    value > 0
      ? "bg-[#dcfce7] text-[#14532d]"
      : value < 0
        ? "bg-[#fee2e2] text-[#7f1d1d]"
        : "bg-[#f3f1e8] text-[#4d554c]";

  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>{formatCounter(value)}</span>;
}

function CounterText({ value }: { value: number }) {
  const color = value > 0 ? "text-[#15803d]" : value < 0 ? "text-[#b91c1c]" : "text-[#4d554c]";
  return <span className={color}>{formatCounter(value)}</span>;
}

function formatCounter(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function previewText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
