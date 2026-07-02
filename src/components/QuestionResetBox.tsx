"use client";

import { useRouter } from "next/navigation";
import { DangerActionBox } from "@/components/DangerActionBox";

export function QuestionResetBox({ questionId, displayNumber }: { questionId: string; displayNumber: number }) {
  const router = useRouter();

  return (
    <DangerActionBox
      title={`Resetta i dati della domanda #${displayNumber}`}
      description="Azzera il contatore ed elimina tutti i tempi di risposta registrati per questa domanda. L'azione non è reversibile."
      buttonLabel="Resetta dati"
      onConfirm={async () => {
        const response = await fetch("/api/stats/reset", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope: "question", questionId }),
        });
        if (!response.ok) throw new Error("Reset fallito.");
        router.refresh();
      }}
    />
  );
}
