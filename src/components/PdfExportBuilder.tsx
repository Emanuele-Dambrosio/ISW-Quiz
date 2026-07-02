"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Flag, Loader2, Plus, Search, X } from "lucide-react";

type Preset = "all" | "flagged" | "custom";

type QuestionSummary = {
  id: string;
  displayNumber: number;
  textPlain: string;
  isFlagged: boolean;
};

type SearchResult = {
  id: string;
  displayNumber: number;
  textPlain: string;
  categoryName: string | null;
  isFlagged: boolean;
};

const PRESET_FILENAMES: Record<Preset, string> = {
  all: "isw-domande-tutte.pdf",
  flagged: "isw-domande-segnate.pdf",
  custom: "isw-domande-selezione.pdf",
};

export function PdfExportBuilder({ questions }: { questions: QuestionSummary[] }) {
  const flaggedQuestions = useMemo(() => questions.filter((question) => question.isFlagged), [questions]);
  const questionsById = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);

  const [preset, setPreset] = useState<Preset>("all");
  const [selected, setSelected] = useState<QuestionSummary[]>(questions);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const selectedIds = useMemo(() => new Set(selected.map((question) => question.id)), [selected]);
  const idsKey = useMemo(() => selected.map((question) => question.id).join(","), [selected]);

  function applyPreset(next: Preset) {
    setPreset(next);
    setSelected(next === "all" ? questions : next === "flagged" ? flaggedQuestions : []);
  }

  function addQuestion(result: SearchResult) {
    setSelected((current) => {
      if (current.some((question) => question.id === result.id)) return current;
      const summary = questionsById.get(result.id) ?? {
        id: result.id,
        displayNumber: result.displayNumber,
        textPlain: result.textPlain,
        isFlagged: result.isFlagged,
      };
      const next = [...current, summary];
      next.sort((a, b) => a.displayNumber - b.displayNumber);
      return next;
    });
  }

  function removeQuestion(id: string) {
    setSelected((current) => current.filter((question) => question.id !== id));
  }

  // Ricerca per aggiungere domande (debounce + abort).
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/pdf/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as { results: SearchResult[] };
        setSearchResults(data.results);
      } catch {
        if (!controller.signal.aborted) setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [searchQuery]);

  // Anteprima automatica: rigenera il PDF a ogni variazione della selezione.
  useEffect(() => {
    if (!idsKey) {
      setPreviewUrl(null);
      setGenerating(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setGenerating(true);
    setError(null);

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/pdf", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ preset, questionIds: idsKey.split(",") }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Generazione del PDF fallita.");
        }

        const blob = await response.blob();
        if (controller.signal.aborted) return;
        setPreviewUrl(URL.createObjectURL(blob));
        setGenerating(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Generazione del PDF fallita.");
        setGenerating(false);
      }
    }, 700);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [idsKey, preset]);

  // L'object URL precedente va revocato per non accumulare blob in memoria.
  useEffect(() => {
    previewUrlRef.current = previewUrl;
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [previewUrl]);

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <section className="grid min-w-0 content-start gap-4">
        <div className="min-w-0 overflow-hidden rounded-lg border border-[#dfded6] bg-white p-4">
          <h2 className="mb-1 text-lg font-semibold">Domande da includere</h2>
          <p className="mb-3 text-sm text-[#667064]">
            Parti da un insieme e poi personalizzalo: puoi sempre togliere o aggiungere singole domande.
          </p>
          <div className="grid gap-2">
            <PresetOption
              active={preset === "all"}
              onSelect={() => applyPreset("all")}
              icon={<FileText size={16} aria-hidden="true" />}
              title="Tutte le domande"
              description={`Parti da tutte le ${questions.length} domande`}
            />
            <PresetOption
              active={preset === "flagged"}
              onSelect={() => applyPreset("flagged")}
              icon={<Flag size={16} aria-hidden="true" />}
              title="Domande segnate"
              description={
                flaggedQuestions.length === 0
                  ? "Nessuna domanda segnata al momento"
                  : `Parti dalle ${flaggedQuestions.length} ${flaggedQuestions.length === 1 ? "domanda segnata" : "domande segnate"}`
              }
            />
            <PresetOption
              active={preset === "custom"}
              onSelect={() => applyPreset("custom")}
              icon={<Search size={16} aria-hidden="true" />}
              title="Selezione manuale"
              description="Parti da zero e aggiungi le domande che vuoi"
            />
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-lg border border-[#dfded6] bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">Aggiungi domande</h3>
          <label className="mb-3 block text-sm">
            <span className="sr-only">Cerca domande</span>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#667064]"
                aria-hidden="true"
              />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cerca per testo o ID (es. #42)"
                className="h-10 w-full rounded-lg border border-[#d8d6cc] bg-white pl-9 pr-3 outline-none focus:border-[#28666e]"
              />
            </div>
          </label>

          {searching ? (
            <p className="flex items-center gap-2 py-1 text-sm text-[#667064]">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Ricerca in corso...
            </p>
          ) : searchResults.length > 0 ? (
            <ul className="grid max-h-64 min-w-0 gap-2 overflow-y-auto pr-1">
              {searchResults.map((result) => {
                const alreadySelected = selectedIds.has(result.id);
                return (
                  <li
                    key={result.id}
                    className="flex min-w-0 items-start gap-2 rounded-lg border border-[#ebe9df] bg-[#fbfbf8] p-2.5 text-sm"
                  >
                    <span className="mt-0.5 shrink-0 rounded-md bg-[#f3f1e8] px-1.5 py-0.5 text-xs font-semibold text-[#4d554c]">
                      #{result.displayNumber}
                    </span>
                    <span className="min-w-0 flex-1 break-words leading-5">{result.textPlain}</span>
                    <button
                      type="button"
                      onClick={() => addQuestion(result)}
                      disabled={alreadySelected}
                      title={alreadySelected ? "Già inclusa" : "Aggiungi al PDF"}
                      className={[
                        "grid h-7 w-7 shrink-0 place-items-center rounded-md border transition",
                        alreadySelected
                          ? "border-[#ebe9df] text-[#a5aa9f]"
                          : "border-[#d8d6cc] text-[#1b4332] hover:bg-[#eef7ef]",
                      ].join(" ")}
                    >
                      <Plus size={14} aria-hidden="true" />
                      <span className="sr-only">Aggiungi domanda #{result.displayNumber}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : searchQuery.trim() ? (
            <p className="py-1 text-sm text-[#667064]">Nessuna domanda trovata.</p>
          ) : (
            <p className="py-1 text-sm text-[#667064]">
              Digita per cercare: parole del testo, numero (es. 42) o #42.
            </p>
          )}
        </div>

        <div className="min-w-0 overflow-hidden rounded-lg border border-[#dfded6] bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Incluse nel PDF ({selected.length})
            </h3>
            {selected.length > 0 ? (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="text-xs font-medium text-[#667064] underline hover:text-[#181917]"
              >
                Svuota
              </button>
            ) : null}
          </div>

          {selected.length === 0 ? (
            <p className="py-1 text-sm text-[#667064]">
              Nessuna domanda inclusa: scegli un insieme di partenza o aggiungi domande dalla ricerca.
            </p>
          ) : (
            /* Altezza tarata su ~10 righe: oltre si naviga con lo scroll. */
            <ul className="grid max-h-[340px] min-w-0 gap-1.5 overflow-y-auto pr-1">
              {selected.map((question) => (
                <li
                  key={question.id}
                  className="flex min-w-0 items-center gap-2 rounded-lg bg-[#fbfbf8] px-2.5 py-1.5 text-sm"
                >
                  <span className="shrink-0 text-xs font-semibold text-[#4d554c]">#{question.displayNumber}</span>
                  {question.isFlagged ? (
                    <Flag size={12} className="shrink-0 text-[#b45309]" fill="currentColor" aria-hidden="true" />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{question.textPlain}</span>
                  <button
                    type="button"
                    onClick={() => removeQuestion(question.id)}
                    title="Escludi dal PDF"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#4d554c] hover:bg-[#fee2e2] hover:text-[#7f1d1d]"
                  >
                    <X size={13} aria-hidden="true" />
                    <span className="sr-only">Escludi domanda #{question.displayNumber}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#dfded6] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe9df] p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Anteprima</h2>
            {generating ? (
              <span className="flex items-center gap-1.5 text-sm text-[#667064]">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                Aggiornamento...
              </span>
            ) : null}
          </div>
          {previewUrl ? (
            <a
              href={previewUrl}
              download={PRESET_FILENAMES[preset]}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1b4332] px-4 text-sm font-semibold text-white hover:bg-[#143527]"
            >
              <Download size={16} aria-hidden="true" />
              Scarica PDF
            </a>
          ) : null}
        </div>

        {error ? <div className="m-4 rounded-lg bg-[#fee2e2] p-3 text-sm text-[#7f1d1d]">{error}</div> : null}

        <div className="relative">
          {previewUrl ? (
            <iframe src={previewUrl} title="Anteprima PDF" className="h-[75vh] min-h-[480px] w-full" />
          ) : (
            <div className="grid h-[75vh] min-h-[480px] place-items-center p-6 text-center">
              <div className="grid justify-items-center gap-3 text-[#667064]">
                {generating ? (
                  <>
                    <Loader2 size={40} strokeWidth={1.2} className="animate-spin" aria-hidden="true" />
                    <p className="max-w-xs text-sm">Sto generando l&apos;anteprima del PDF...</p>
                  </>
                ) : (
                  <>
                    <FileText size={40} strokeWidth={1.2} aria-hidden="true" />
                    <p className="max-w-xs text-sm">
                      L&apos;anteprima si aggiorna automaticamente quando aggiungi o togli domande.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
          {previewUrl && generating ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/60">
              <span className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium shadow">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Aggiornamento anteprima...
              </span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function PresetOption({
  active,
  onSelect,
  icon,
  title,
  description,
}: {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={[
        "flex items-start gap-3 rounded-lg border p-3 text-left transition",
        active ? "border-[#1b4332] bg-[#eef7ef]" : "border-[#dfded6] bg-white hover:bg-[#fbfbf8]",
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md",
          active ? "bg-[#1b4332] text-white" : "bg-[#f3f1e8] text-[#4d554c]",
        ].join(" ")}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-sm text-[#667064]">{description}</span>
      </span>
    </button>
  );
}
