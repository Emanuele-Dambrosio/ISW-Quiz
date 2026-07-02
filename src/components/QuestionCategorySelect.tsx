"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type CategoryOption = {
  id: string;
  name: string;
};

export function QuestionCategorySelect({
  questionId,
  categories,
  currentCategoryId,
}: {
  questionId: string;
  categories: CategoryOption[];
  currentCategoryId: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentCategoryId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(nextValue: string) {
    const previous = value;
    setValue(nextValue);
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/questions/category", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId, categoryId: nextValue || null }),
      });
      if (!response.ok) throw new Error("Cambio categoria fallito.");
      router.refresh();
    } catch (err) {
      setValue(previous);
      setError(err instanceof Error ? err.message : "Cambio categoria fallito.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        value={value}
        onChange={(event) => assign(event.target.value)}
        disabled={busy}
        aria-label="Categoria della domanda"
        title="Riassegna la categoria di questa domanda"
        className="h-8 rounded-md border border-[#d8d6cc] bg-[#f3f1e8] px-2 text-sm outline-none focus:border-[#28666e] disabled:opacity-60"
      >
        <option value="">Non classificata</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      {busy ? <Loader2 size={14} className="animate-spin text-[#667064]" aria-hidden="true" /> : null}
      {error ? <span className="text-xs font-medium text-[#7f1d1d]">{error}</span> : null}
    </span>
  );
}
