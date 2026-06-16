"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

export type QuestionFilterCategory = {
  id: string;
  name: string;
};

export type QuestionFilterExam = {
  id: string;
  label: string;
};

export function QuestionFilters({
  categories,
  exams,
  selectedCategory,
  selectedExam,
  query,
}: {
  categories: QuestionFilterCategory[];
  exams: QuestionFilterExam[];
  selectedCategory?: string;
  selectedExam?: string;
  query?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [textQuery, setTextQuery] = useState(query ?? "");
  const [, startTransition] = useTransition();

  const updateParam = useCallback((key: "category" | "exam" | "q", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const normalizedValue = value.trim();

    if (normalizedValue) {
      params.set(key, normalizedValue);
    } else {
      params.delete(key);
    }

    params.delete("page");
    const queryString = params.toString();

    startTransition(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const currentQuery = searchParams.get("q") ?? "";
    if (textQuery === currentQuery) return;

    const timeout = window.setTimeout(() => {
      updateParam("q", textQuery);
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [searchParams, textQuery, updateParam]);

  return (
    <div className="rounded-lg border border-[#dfded6] bg-white p-2.5">
      <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(150px,0.85fr)_minmax(190px,1fr)_minmax(220px,1.25fr)_auto] md:items-center">
        <label className="min-w-0 text-sm">
          <span className="sr-only">Categoria</span>
          <select
            name="category"
            aria-label="Categoria"
            value={selectedCategory ?? ""}
            onChange={(event) => updateParam("category", event.target.value)}
            className="h-9 w-full min-w-0 rounded-lg border border-[#d8d6cc] bg-white px-3 outline-none focus:border-[#28666e]"
          >
            <option value="">Tutte le categorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 text-sm">
          <span className="sr-only">Esame</span>
          <select
            name="exam"
            aria-label="Esame"
            value={selectedExam ?? ""}
            onChange={(event) => updateParam("exam", event.target.value)}
            className="h-9 w-full min-w-0 rounded-lg border border-[#d8d6cc] bg-white px-3 outline-none focus:border-[#28666e]"
          >
            <option value="">Tutti gli esami</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 text-sm">
          <span className="sr-only">Testo</span>
          <input
            name="q"
            aria-label="Testo"
            placeholder="Cerca testo o ID"
            value={textQuery}
            onChange={(event) => setTextQuery(event.target.value)}
            className="h-9 w-full min-w-0 rounded-lg border border-[#d8d6cc] bg-white px-3 outline-none focus:border-[#28666e]"
          />
        </label>

        <Link
          href="/questions"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d8d6cc] px-4 text-sm font-medium hover:bg-[#f3f1e8]"
        >
          Reset
        </Link>
      </div>
    </div>
  );
}
