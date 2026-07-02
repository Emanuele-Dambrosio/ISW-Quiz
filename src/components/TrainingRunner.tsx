"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Shuffle, Timer, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { AppearanceBadge } from "@/components/AppearanceBadge";
import { AnswerTimesChart, formatMs, type AnswerTimeEntry } from "@/components/AnswerTimesChart";
import { FlagButton } from "@/components/FlagButton";
import { formatExamAppearanceLabel } from "@/lib/exam-format";
import type { TrainingQuestionData } from "@/lib/quiz-data";
import { TRAINING_MODE_LABELS, type TrainingMode } from "@/lib/training-modes";

type TrainingResult = {
  outcome: "correct" | "wrong" | "skipped";
  delta: number;
  score: number;
  correctOptionId: string | null;
  elapsedMs: number;
  history: AnswerTimeEntry[];
};

export function TrainingRunner({
  mode,
  initialQuestion,
  examSecondsLimit,
}: {
  mode: TrainingMode;
  initialQuestion: TrainingQuestionData | null;
  examSecondsLimit: number;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [counter, setCounter] = useState(initialQuestion?.masteryScore ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Il timer parte quando la domanda appare e si congela alla risposta.
  useEffect(() => {
    if (!question || result || loading) return;

    setElapsedSeconds(Math.floor((Date.now() - questionStartedAt) / 1000));
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - questionStartedAt) / 1000));
    }, 250);

    return () => window.clearInterval(interval);
  }, [question, result, questionStartedAt]);

  async function submitAnswer(optionId: string | null) {
    if (!question || loading || result) return;

    const elapsedMs = Math.max(0, Date.now() - questionStartedAt);
    setElapsedSeconds(Math.floor(elapsedMs / 1000));
    setLoading(true);
    setError(null);
    setSelectedOptionId(optionId);

    try {
      const response = await fetch("/api/training", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          selectedOptionId: optionId,
          elapsedMs,
        }),
      });

      if (!response.ok) throw new Error("Answer save failed");
      const data = (await response.json()) as TrainingResult;
      setCounter(data.score);
      setResult(data);
    } catch {
      setError("Non sono riuscito a salvare la risposta.");
    } finally {
      setLoading(false);
    }
  }

  async function loadNextQuestion(excludeQuestionId?: string) {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ mode });
      if (excludeQuestionId) params.set("exclude", excludeQuestionId);
      const response = await fetch(`/api/training?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Question load failed");

      const data = (await response.json()) as { question: TrainingQuestionData | null };
      setQuestion(data.question);
      setCounter(data.question?.masteryScore ?? 0);
      setSelectedOptionId(null);
      setResult(null);
      setQuestionStartedAt(Date.now());
      setElapsedSeconds(0);
    } catch {
      setError("Non sono riuscito a caricare la prossima domanda.");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuestionChange() {
    if (!question || loading) return;

    if (result) {
      await loadNextQuestion(question.id);
      return;
    }

    await submitAnswer(null);
  }

  if (!question) {
    return (
      <div className="rounded-lg border border-[#dfded6] bg-white p-6">
        <p className="text-sm text-[#667064]">
          {mode === "never_seen"
            ? "Hai visto tutte le domande: non ce ne sono più di mai viste. Ottimo lavoro!"
            : mode === "slowest"
              ? "Non ci sono ancora tempi registrati: rispondi a qualche domanda in un'altra modalità e riprova."
              : "Non ci sono domande disponibili per questa modalità."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/allenamento"
            className="inline-flex h-10 items-center rounded-lg bg-[#1b4332] px-4 text-sm font-semibold text-white hover:bg-[#143527]"
          >
            Scegli un&apos;altra modalità
          </Link>
          <Link
            href="/questions"
            className="inline-flex h-10 items-center rounded-lg border border-[#d8d6cc] px-4 text-sm font-medium hover:bg-[#f3f1e8]"
          >
            Vai al browser domande
          </Link>
        </div>
      </div>
    );
  }

  const appearanceLabels = formatAppearanceLabels(question.appearanceLabels);

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0 rounded-lg border border-[#dfded6] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe9df] p-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-[#667064]">{TRAINING_MODE_LABELS[mode].title}</span>
              <QuestionNumberBadge value={question.displayNumber} />
              <AppearanceBadge count={formatAppearanceCount(question.appearanceCount)} labels={appearanceLabels} />
            </div>
            <h2 className="text-lg font-semibold">{question.categoryName ?? "Non classificata"}</h2>
          </div>
          <div className="flex items-center gap-2">
            <TimerPill seconds={elapsedSeconds} frozen={Boolean(result)} limitSeconds={examSecondsLimit} />
            <FlagButton key={question.id} questionId={question.id} initialFlagged={question.isFlagged} />
            <CounterPill value={counter} />
          </div>
        </div>

        <div className="p-5">
          <div className="quiz-content text-base leading-7" dangerouslySetInnerHTML={{ __html: question.textHtml }} />

          <div className="mt-5 grid gap-3">
            {question.options.map((option) => {
              const selected = selectedOptionId === option.id;
              const revealCorrect = result && option.id === result.correctOptionId;
              const revealWrong = result?.outcome === "wrong" && selected;

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={loading || Boolean(result)}
                  onClick={() => submitAnswer(option.id)}
                  className={[
                    "grid grid-cols-[32px_1fr] gap-3 rounded-lg border p-3 text-left text-sm transition disabled:cursor-default",
                    selected ? "border-[#1b4332] bg-[#eef7ef]" : "border-[#dfded6] bg-white hover:bg-[#fbfbf8]",
                    revealCorrect ? "border-[#15803d] bg-[#dcfce7]" : "",
                    revealWrong ? "border-[#b91c1c] bg-[#fee2e2]" : "",
                  ].join(" ")}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-[#f3f1e8] font-semibold">
                    {option.label}
                  </span>
                  <span className="quiz-content" dangerouslySetInnerHTML={{ __html: option.textHtml }} />
                </button>
              );
            })}
          </div>

          {result ? <AnswerSummary result={result} limitSeconds={examSecondsLimit} /> : null}

          {error ? <div className="mt-4 rounded-lg bg-[#fee2e2] p-3 text-sm text-[#7f1d1d]">{error}</div> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#ebe9df] p-4">
          <button
            type="button"
            onClick={handleQuestionChange}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1b4332] px-4 text-sm font-semibold text-white hover:bg-[#143527] disabled:opacity-60"
          >
            {result ? "Prossima domanda" : "Cambia domanda (-1)"}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

      <aside className="rounded-lg border border-[#dfded6] bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Regole</h2>
          <Shuffle size={18} className="text-[#28666e]" aria-hidden="true" />
        </div>
        <div className="grid gap-2 text-sm">
          <RuleRow label="Corretta" value="+1" tone="positive" />
          <RuleRow label="Errata" value="-1" tone="negative" />
          <RuleRow label="Cambio senza risposta" value="-1" tone="negative" />
        </div>
        <div className="mt-4 rounded-lg bg-[#fbfbf8] p-3 text-sm text-[#4d554c]">
          Il contatore viene salvato per ogni domanda. Valori negativi indicano domande da ripassare.
        </div>
        <Link
          href={`/questions/${question.id}`}
          className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-[#d8d6cc] text-sm font-medium hover:bg-[#f3f1e8]"
        >
          Apri domanda #{question.displayNumber}
        </Link>
      </aside>
    </div>
  );
}

function QuestionNumberBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex rounded-md bg-[#1b4332] px-2 py-1 text-xs font-semibold text-white">
      Domanda #{value}
    </span>
  );
}

function AnswerSummary({ result, limitSeconds }: { result: TrainingResult; limitSeconds: number }) {
  const overTime = result.elapsedMs > limitSeconds * 1000;
  const positivePoints = result.delta > 0;
  const previous = result.history.length >= 2 ? result.history[result.history.length - 2] : null;
  const diffMs = previous ? result.elapsedMs - previous.elapsedMs : 0;

  const pointsLabel =
    result.outcome === "correct"
      ? "Risposta corretta"
      : result.outcome === "wrong"
        ? "Risposta errata"
        : "Nessuna risposta";

  return (
    <div className="mt-5 grid gap-3">
      <h3 className="text-sm font-semibold text-[#667064]">Resoconto</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard
          positive={positivePoints}
          icon={positivePoints ? <CheckCircle2 size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />}
          value={positivePoints ? "+1" : "-1"}
          label={pointsLabel}
        />
        <SummaryCard
          positive={!overTime}
          icon={<Timer size={18} aria-hidden="true" />}
          value={formatMs(result.elapsedMs)}
          label={overTime ? `Oltre i ${limitSeconds}s dell'esame` : `Entro i ${limitSeconds}s dell'esame`}
        />
      </div>

      {previous ? (
        <div
          className={[
            "flex items-center gap-2 rounded-lg border p-3 text-sm font-medium",
            diffMs < 0
              ? "border-[#15803d] bg-[#dcfce7] text-[#14532d]"
              : diffMs > 0
                ? "border-[#b91c1c] bg-[#fee2e2] text-[#7f1d1d]"
                : "border-[#dfded6] bg-[#fbfbf8] text-[#4d554c]",
          ].join(" ")}
        >
          {diffMs < 0 ? (
            <TrendingDown size={16} aria-hidden="true" />
          ) : diffMs > 0 ? (
            <TrendingUp size={16} aria-hidden="true" />
          ) : (
            <Timer size={16} aria-hidden="true" />
          )}
          {diffMs < 0
            ? `Tempo migliorato: ${formatDiffSeconds(diffMs)} più veloce dell'ultima volta (${formatMs(previous.elapsedMs)}).`
            : diffMs > 0
              ? `Tempo peggiorato: ${formatDiffSeconds(diffMs)} più lento dell'ultima volta (${formatMs(previous.elapsedMs)}).`
              : `Stesso tempo dell'ultima volta (${formatMs(previous.elapsedMs)}).`}
        </div>
      ) : null}

      {result.history.length >= 2 ? <AnswerTimesChart history={result.history} limitSeconds={limitSeconds} /> : null}
    </div>
  );
}

function SummaryCard({
  positive,
  icon,
  value,
  label,
}: {
  positive: boolean;
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-lg border p-4",
        positive ? "border-[#15803d] bg-[#dcfce7] text-[#14532d]" : "border-[#b91c1c] bg-[#fee2e2] text-[#7f1d1d]",
      ].join(" ")}
    >
      {icon}
      <div className="min-w-0">
        <div className="text-xl font-bold tabular-nums">{value}</div>
        <div className="text-sm font-medium">{label}</div>
      </div>
    </div>
  );
}

function formatDiffSeconds(diffMs: number) {
  return `${(Math.abs(diffMs) / 1000).toFixed(1).replace(".", ",")} s`;
}

function TimerPill({ seconds, frozen, limitSeconds }: { seconds: number; frozen: boolean; limitSeconds: number }) {
  const overLimit = seconds > limitSeconds;
  const tone = overLimit
    ? "border-[#b91c1c] bg-[#fee2e2] text-[#7f1d1d]"
    : "border-[#dfded6] bg-[#fbfbf8] text-[#4d554c]";

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums ${tone}`}
      title={
        frozen
          ? "Tempo impiegato per questa domanda"
          : `Tempo sulla domanda (all'esame hai ${limitSeconds}s a domanda)`
      }
    >
      <Timer size={15} aria-hidden="true" />
      {formatSeconds(seconds)}
    </div>
  );
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function CounterPill({ value }: { value: number }) {
  const tone =
    value > 0
      ? "border-[#15803d] bg-[#dcfce7] text-[#14532d]"
      : value < 0
        ? "border-[#b91c1c] bg-[#fee2e2] text-[#7f1d1d]"
        : "border-[#dfded6] bg-[#fbfbf8] text-[#4d554c]";

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm font-semibold ${tone}`}>
      Contatore: {value > 0 ? `+${value}` : value}
    </div>
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

function RuleRow({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#fbfbf8] px-3 py-2">
      <span>{label}</span>
      <span className={tone === "positive" ? "font-semibold text-[#15803d]" : "font-semibold text-[#b91c1c]"}>
        {value}
      </span>
    </div>
  );
}
