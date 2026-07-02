"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Timer, Trash2, X } from "lucide-react";
import { DangerActionBox } from "@/components/DangerActionBox";

type CategoryRow = {
  id: string;
  name: string;
  questionCount: number;
};

export function SettingsManager({
  categories,
  examSecondsLimit,
  minSeconds,
  maxSeconds,
}: {
  categories: CategoryRow[];
  examSecondsLimit: number;
  minSeconds: number;
  maxSeconds: number;
}) {
  const router = useRouter();

  return (
    <div className="grid min-w-0 max-w-3xl gap-5">
      <TimerSection
        examSecondsLimit={examSecondsLimit}
        minSeconds={minSeconds}
        maxSeconds={maxSeconds}
        onSaved={() => router.refresh()}
      />
      <CategoriesSection categories={categories} onChanged={() => router.refresh()} />

      <section className="rounded-lg border border-[#dfded6] bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">Zona pericolosa</h2>
        <DangerActionBox
          title="Elimina tutte le statistiche"
          description="Azzera il contatore di tutte le domande ed elimina tutti i tempi di risposta registrati. L'azione non è reversibile."
          buttonLabel="Elimina tutto"
          onConfirm={async () => {
            const response = await fetch("/api/stats/reset", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ scope: "all" }),
            });
            if (!response.ok) throw new Error("Reset fallito.");
            router.refresh();
          }}
        />
      </section>
    </div>
  );
}

function TimerSection({
  examSecondsLimit,
  minSeconds,
  maxSeconds,
  onSaved,
}: {
  examSecondsLimit: number;
  minSeconds: number;
  maxSeconds: number;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(String(examSecondsLimit));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save() {
    const seconds = Number(value);
    if (!Number.isInteger(seconds) || seconds < minSeconds || seconds > maxSeconds) {
      setMessage({ tone: "error", text: `Inserisci un numero intero tra ${minSeconds} e ${maxSeconds}.` });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ examSecondsLimit: seconds }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Salvataggio fallito.");
      }
      setMessage({ tone: "ok", text: `Salvato: il timer diventa rosso oltre i ${seconds} secondi.` });
      onSaved();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Salvataggio fallito." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#dfded6] bg-white p-5">
      <div className="mb-1 flex items-center gap-2">
        <Timer size={18} className="text-[#28666e]" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Timer domanda</h2>
      </div>
      <p className="mb-3 text-sm text-[#667064]">
        Secondi a disposizione per domanda: oltre questo limite il timer dell&apos;allenamento diventa rosso e i tempi
        vengono considerati &quot;fuori tempo&quot; nel resoconto e nei grafici.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={minSeconds}
          max={maxSeconds}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-10 w-28 rounded-lg border border-[#d8d6cc] bg-white px-3 text-sm outline-none focus:border-[#28666e]"
          aria-label="Secondi limite per domanda"
        />
        <span className="text-sm text-[#667064]">secondi</span>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1b4332] px-4 text-sm font-semibold text-white hover:bg-[#143527] disabled:opacity-60"
        >
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
          Salva
        </button>
      </div>
      {message ? (
        <p className={`mt-2 text-sm font-medium ${message.tone === "ok" ? "text-[#14532d]" : "text-[#7f1d1d]"}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}

function CategoriesSection({ categories, onChanged }: { categories: CategoryRow[]; onChanged: () => void }) {
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function callApi(method: string, body: unknown) {
    const response = await fetch("/api/categories", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Operazione fallita.");
    }
  }

  async function createCategory() {
    const name = newName.trim();
    if (!name || busyId) return;
    setBusyId("new");
    setError(null);
    try {
      await callApi("POST", { name });
      setNewName("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creazione fallita.");
    } finally {
      setBusyId(null);
    }
  }

  async function renameCategory(id: string) {
    const name = editName.trim();
    if (!name || busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await callApi("PATCH", { id, name });
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rinomina fallita.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteCategory(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await callApi("DELETE", { id });
      setConfirmingDeleteId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eliminazione fallita.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-lg border border-[#dfded6] bg-white p-5">
      <h2 className="mb-1 text-lg font-semibold">Categorie</h2>
      <p className="mb-3 text-sm text-[#667064]">
        Crea, rinomina o elimina le categorie. Le domande di una categoria eliminata tornano &quot;Non
        classificata&quot;. Puoi riassegnare la categoria di una domanda dalla sua pagina di dettaglio.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") createCategory();
          }}
          placeholder="Nome nuova categoria"
          className="h-10 w-72 max-w-full rounded-lg border border-[#d8d6cc] bg-white px-3 text-sm outline-none focus:border-[#28666e]"
        />
        <button
          type="button"
          onClick={createCategory}
          disabled={!newName.trim() || busyId !== null}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1b4332] px-4 text-sm font-semibold text-white hover:bg-[#143527] disabled:opacity-50"
        >
          {busyId === "new" ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Plus size={15} aria-hidden="true" />
          )}
          Crea categoria
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-[#667064]">Nessuna categoria presente.</p>
      ) : (
        <ul className="grid gap-2">
          {categories.map((category) => {
            const editing = editingId === category.id;
            const confirmingDelete = confirmingDeleteId === category.id;
            const busy = busyId === category.id;

            return (
              <li
                key={category.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-[#ebe9df] bg-[#fbfbf8] px-3 py-2 text-sm"
              >
                {editing ? (
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") renameCategory(category.id);
                      if (event.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    className="h-9 min-w-0 flex-1 rounded-lg border border-[#d8d6cc] bg-white px-2 outline-none focus:border-[#28666e]"
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate font-medium">{category.name}</span>
                )}
                <span className="shrink-0 rounded-md bg-[#f3f1e8] px-2 py-0.5 text-xs text-[#4d554c]">
                  {category.questionCount === 1 ? "1 domanda" : `${category.questionCount} domande`}
                </span>

                {editing ? (
                  <>
                    <IconButton
                      title="Salva nome"
                      onClick={() => renameCategory(category.id)}
                      disabled={busy || !editName.trim()}
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </IconButton>
                    <IconButton title="Annulla" onClick={() => setEditingId(null)} disabled={busy}>
                      <X size={14} />
                    </IconButton>
                  </>
                ) : confirmingDelete ? (
                  <>
                    <button
                      type="button"
                      onClick={() => deleteCategory(category.id)}
                      disabled={busy}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-[#b91c1c] px-2.5 text-xs font-semibold text-white hover:bg-[#991b1b] disabled:opacity-60"
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Confermi eliminazione?
                    </button>
                    <IconButton title="Annulla" onClick={() => setConfirmingDeleteId(null)} disabled={busy}>
                      <X size={14} />
                    </IconButton>
                  </>
                ) : (
                  <>
                    <IconButton
                      title="Rinomina categoria"
                      onClick={() => {
                        setEditingId(category.id);
                        setEditName(category.name);
                        setConfirmingDeleteId(null);
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      title="Elimina categoria"
                      tone="danger"
                      onClick={() => {
                        setConfirmingDeleteId(category.id);
                        setEditingId(null);
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="mt-3 text-sm font-medium text-[#7f1d1d]">{error}</p> : null}
    </section>
  );
}

function IconButton({
  title,
  onClick,
  disabled,
  tone = "default",
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        "grid h-8 w-8 shrink-0 place-items-center rounded-md border transition disabled:opacity-50",
        tone === "danger"
          ? "border-[#e5b9b9] text-[#b91c1c] hover:bg-[#fee2e2]"
          : "border-[#d8d6cc] text-[#4d554c] hover:bg-[#f3f1e8]",
      ].join(" ")}
    >
      {children}
      <span className="sr-only">{title}</span>
    </button>
  );
}
