"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

/**
 * Azione distruttiva con frizione: il pulsante si abilita solo dopo aver
 * digitato la parola di conferma.
 */
export function DangerActionBox({
  title,
  description,
  buttonLabel,
  confirmWord = "ELIMINA",
  onConfirm,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  confirmWord?: string;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const armed = typed.trim().toUpperCase() === confirmWord;

  async function handleClick() {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await onConfirm();
      setTyped("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operazione fallita.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#f3c6c6] bg-[#fff7f7] p-4">
      <h3 className="text-sm font-semibold text-[#7f1d1d]">{title}</h3>
      <p className="mt-1 text-sm text-[#8a5a5a]">{description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
            setDone(false);
          }}
          placeholder={`Scrivi ${confirmWord} per confermare`}
          className="h-10 w-64 max-w-full rounded-lg border border-[#e5b9b9] bg-white px-3 text-sm outline-none focus:border-[#b91c1c]"
        />
        <button
          type="button"
          onClick={handleClick}
          disabled={!armed || busy}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#b91c1c] px-4 text-sm font-semibold text-white hover:bg-[#991b1b] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}
          {buttonLabel}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm font-medium text-[#7f1d1d]">{error}</p> : null}
      {done ? <p className="mt-2 text-sm font-medium text-[#14532d]">Fatto: dati eliminati.</p> : null}
    </div>
  );
}
