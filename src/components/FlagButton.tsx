"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";

export function FlagButton({
  questionId,
  initialFlagged,
  variant = "default",
  refreshOnToggle = false,
}: {
  questionId: string;
  initialFlagged: boolean;
  variant?: "default" | "compact";
  refreshOnToggle?: boolean;
}) {
  const router = useRouter();
  const [flagged, setFlagged] = useState(initialFlagged);
  const [loading, setLoading] = useState(false);

  async function toggleFlag() {
    if (loading) return;
    setLoading(true);

    const nextFlagged = !flagged;
    try {
      const response = await fetch("/api/flags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId, flagged: nextFlagged }),
      });
      if (!response.ok) throw new Error("Flag toggle failed");

      setFlagged(nextFlagged);
      if (refreshOnToggle) router.refresh();
    } catch {
      // Stato invariato: il prossimo click ritenta.
    } finally {
      setLoading(false);
    }
  }

  const label = flagged ? "Segnata" : "Segna";
  const title = flagged ? "Rimuovi il flag da questa domanda" : "Segna questa domanda";

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={toggleFlag}
        disabled={loading}
        title={title}
        aria-pressed={flagged}
        className={[
          "grid h-9 w-9 place-items-center rounded-lg border transition disabled:opacity-60",
          flagged
            ? "border-[#b45309] bg-[#fef3c7] text-[#b45309]"
            : "border-[#d8d6cc] bg-white text-[#667064] hover:bg-[#f3f1e8]",
        ].join(" ")}
      >
        <Flag size={16} fill={flagged ? "currentColor" : "none"} aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleFlag}
      disabled={loading}
      title={title}
      aria-pressed={flagged}
      className={[
        "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-60",
        flagged
          ? "border-[#b45309] bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a]"
          : "border-[#d8d6cc] bg-white text-[#4b5148] hover:bg-[#f3f1e8]",
      ].join(" ")}
    >
      <Flag size={16} fill={flagged ? "currentColor" : "none"} aria-hidden="true" />
      {label}
    </button>
  );
}
