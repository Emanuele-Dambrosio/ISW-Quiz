export type AnswerTimeEntry = {
  elapsedMs: number;
  outcome: "correct" | "wrong" | "skipped";
  answeredAt: string;
};

const CHART_MAX_BARS = 20;

export function AnswerTimesChart({
  history,
  limitSeconds,
}: {
  history: AnswerTimeEntry[];
  limitSeconds: number;
}) {
  const entries = history.slice(-CHART_MAX_BARS);
  const limitMs = limitSeconds * 1000;
  const maxMs = Math.max(limitMs, ...entries.map((entry) => entry.elapsedMs)) * 1.15;

  const chartWidth = 100;
  const chartHeight = 40;
  const gap = 1;
  const barWidth = (chartWidth - gap * (entries.length - 1)) / entries.length;
  const limitY = chartHeight - (limitMs / maxMs) * chartHeight;

  return (
    <div className="rounded-lg border border-[#dfded6] bg-[#fbfbf8] p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">Tempi di risposta a questa domanda ({history.length} in totale)</span>
        <span className="text-xs text-[#667064]">Linea tratteggiata: {limitSeconds}s</span>
      </div>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="none"
        className="h-28 w-full"
        role="img"
        aria-label="Grafico dei tempi di risposta"
      >
        {entries.map((entry, index) => {
          const height = Math.max(0.8, (entry.elapsedMs / maxMs) * chartHeight);
          const isLast = index === entries.length - 1;
          const over = entry.elapsedMs > limitMs;
          return (
            <rect
              key={`${entry.answeredAt}-${index}`}
              x={index * (barWidth + gap)}
              y={chartHeight - height}
              width={barWidth}
              height={height}
              rx={0.6}
              fill={over ? "#dc2626" : "#15803d"}
              opacity={isLast ? 1 : 0.55}
            >
              <title>{`Tentativo ${history.length - entries.length + index + 1}: ${formatMs(entry.elapsedMs)} (${outcomeLabel(entry.outcome)})`}</title>
            </rect>
          );
        })}
        <line
          x1={0}
          y1={limitY}
          x2={chartWidth}
          y2={limitY}
          stroke="#b91c1c"
          strokeWidth={0.4}
          strokeDasharray="1.5 1"
        />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-[#667064]">
        <span>{history.length > entries.length ? `Ultimi ${entries.length} tentativi` : "Primo tentativo"}</span>
        <span>Più recente</span>
      </div>
    </div>
  );
}

function outcomeLabel(outcome: AnswerTimeEntry["outcome"]) {
  switch (outcome) {
    case "correct":
      return "corretta";
    case "wrong":
      return "errata";
    default:
      return "non risposta";
  }
}

export function formatMs(elapsedMs: number) {
  const totalSeconds = elapsedMs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  if (minutes > 0) {
    return `${minutes}:${String(Math.floor(seconds)).padStart(2, "0")} min`;
  }
  return `${seconds.toFixed(1).replace(".", ",")} s`;
}
