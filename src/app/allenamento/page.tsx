import Link from "next/link";
import { ArrowLeft, BarChart3, EyeOff, Hourglass, Shuffle, XCircle, type LucideIcon } from "lucide-react";
import { AppHeader, AppShell } from "@/components/AppShell";
import { TrainingRunner } from "@/components/TrainingRunner";
import { getNeverSeenQuestionCount, getQuestionListCount, getTrainingQuestion } from "@/lib/quiz-data";
import { getExamSecondsLimit } from "@/lib/settings";
import {
  TRAINING_MODE_LABELS,
  TRAINING_MODES,
  isTrainingMode,
  type TrainingMode,
} from "@/lib/training-modes";

export const dynamic = "force-dynamic";

const MODE_ICONS: Record<TrainingMode, LucideIcon> = {
  exam_frequency: BarChart3,
  random: Shuffle,
  most_wrong: XCircle,
  slowest: Hourglass,
  never_seen: EyeOff,
};

type SearchParams = Promise<{ mode?: string }>;

export default async function TrainingPage({ searchParams }: { searchParams: SearchParams }) {
  const { mode: modeParam } = await searchParams;

  if (!modeParam || !isTrainingMode(modeParam)) {
    return <ModeMenu />;
  }

  const [question, examSecondsLimit] = await Promise.all([
    getTrainingQuestion(modeParam),
    getExamSecondsLimit(),
  ]);

  return (
    <AppShell>
      <AppHeader
        title={`Allenamento · ${TRAINING_MODE_LABELS[modeParam].title}`}
        action={
          <Link
            href="/allenamento"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8d6cc] bg-white px-3 text-sm font-medium hover:bg-[#f3f1e8]"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Cambia modalità
          </Link>
        }
      />
      <div className="px-5 py-5 md:px-8">
        <TrainingRunner mode={modeParam} initialQuestion={question} examSecondsLimit={examSecondsLimit} />
      </div>
    </AppShell>
  );
}

async function ModeMenu() {
  const [totalQuestions, neverSeenCount] = await Promise.all([
    getQuestionListCount(),
    getNeverSeenQuestionCount(),
  ]);

  return (
    <AppShell>
      <AppHeader title="Allenamento" />
      <div className="px-5 py-5 md:px-8">
        <p className="mb-4 text-sm text-[#667064]">
          Scegli la modalità di allenamento: cambia solo il criterio con cui vengono pescate le domande.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TRAINING_MODES.map((mode) => {
            const Icon = MODE_ICONS[mode];
            const { title, description } = TRAINING_MODE_LABELS[mode];
            const badge =
              mode === "never_seen"
                ? neverSeenCount === 0
                  ? "Nessuna rimasta"
                  : `${neverSeenCount} rimaste`
                : mode === "random"
                  ? `${totalQuestions} domande`
                  : null;

            return (
              <Link
                key={mode}
                href={`/allenamento?mode=${mode}`}
                className="group flex flex-col gap-3 rounded-lg border border-[#dfded6] bg-white p-5 transition hover:border-[#1b4332] hover:shadow-[0_8px_24px_rgba(24,25,23,0.08)]"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#eef7ef] text-[#1b4332] transition group-hover:bg-[#1b4332] group-hover:text-white">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  {badge ? (
                    <span className="rounded-md bg-[#f3f1e8] px-2 py-1 text-xs font-medium text-[#4d554c]">
                      {badge}
                    </span>
                  ) : null}
                </div>
                <div>
                  <h2 className="text-base font-semibold">{title}</h2>
                  <p className="mt-1 text-sm leading-5 text-[#667064]">{description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
