import Link from "next/link";
import { ArrowDownUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { AppearanceBadge } from "@/components/AppearanceBadge";
import { AppHeader, AppShell } from "@/components/AppShell";
import { QuestionFilters } from "@/components/QuestionFilters";
import { formatExamAppearanceLabel, formatExamLabel } from "@/lib/exam-format";
import {
  getCategoryRows,
  getExamRows,
  getQuestionListCount,
  getQuestionListRows,
  type QuestionListSort,
} from "@/lib/quiz-data";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = Promise<{
  category?: string;
  exam?: string;
  q?: string;
  sort?: string;
  page?: string;
}>;

export default async function QuestionsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const sort = parseQuestionListSort(filters.sort);
  const requestedPage = parsePage(filters.page);
  const countFilters = {
    categoryId: filters.category,
    examId: filters.exam,
    query: filters.q,
  };

  const [categoryRows, examRows, totalQuestions] = await Promise.all([
    getCategoryRows(),
    getExamRows(),
    getQuestionListCount(countFilters),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalQuestions / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const questionRows = await getQuestionListRows({
    ...countFilters,
    sort,
    limit: PAGE_SIZE,
    offset,
  });
  const pageStart = totalQuestions === 0 ? 0 : offset + 1;
  const pageEnd = offset + questionRows.length;
  const sortDescription = getSortDescription(sort);
  const nextIdSort = sort === "id_asc" ? "id_desc" : "id_asc";
  const nextAppearanceSort = sort === "appearances_desc" ? "appearances_asc" : "appearances_desc";
  const nextCounterSort = sort === "counter_asc" ? "counter_desc" : "counter_asc";
  const idSortHref = buildQuestionsHref({
    category: filters.category,
    exam: filters.exam,
    q: filters.q,
    sort: nextIdSort,
  });
  const appearanceSortHref = buildQuestionsHref({
    category: filters.category,
    exam: filters.exam,
    q: filters.q,
    sort: nextAppearanceSort,
  });
  const counterSortHref = buildQuestionsHref({
    category: filters.category,
    exam: filters.exam,
    q: filters.q,
    sort: nextCounterSort,
  });
  const currentQuestionsHref = buildQuestionsHref({
    category: filters.category,
    exam: filters.exam,
    q: filters.q,
    sort,
    page: currentPage,
  });

  return (
    <AppShell>
      <AppHeader title="Browser Domande" />
      <div className="grid min-w-0 gap-5 px-5 py-5 md:px-8">
        <QuestionFilters
          key={`${filters.category ?? ""}-${filters.exam ?? ""}-${filters.q ?? ""}`}
          categories={categoryRows}
          exams={examRows.map((exam) => ({ id: exam.id, label: formatExamLabel(exam) }))}
          selectedCategory={filters.category}
          selectedExam={filters.exam}
          query={filters.q}
        />

        <section className="overflow-hidden rounded-lg border border-[#dfded6] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe9df] p-4">
            <div>
              <h2 className="text-lg font-semibold">
                {pageStart}-{pageEnd} di {totalQuestions} domande
              </h2>
              <p className="text-sm text-[#667064]">
                {sortDescription} · {PAGE_SIZE} righe per pagina
              </p>
            </div>
            <Search size={18} className="text-[#28666e]" aria-hidden="true" />
          </div>

          {questionRows.length === 0 ? (
            <div className="p-6 text-sm text-[#667064]">Nessuna domanda trovata con questi filtri.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] border-collapse text-left text-sm">
                <thead className="bg-[#fbfbf8] text-[#667064]">
                  <tr>
                    <th className="w-[8%] px-4 py-3 font-medium">
                      <Link
                        href={idSortHref}
                        className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[#ebe9df] hover:text-[#181917]"
                        title="Ordina per ID domanda"
                      >
                        <ArrowDownUp size={14} aria-hidden="true" />
                        ID
                      </Link>
                    </th>
                    <th className="w-[42%] px-4 py-3 font-medium">Domanda</th>
                    <th className="w-[18%] px-4 py-3 font-medium">Categoria</th>
                    <th className="w-[12%] px-4 py-3 font-medium">
                      <Link
                        href={counterSortHref}
                        className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[#ebe9df] hover:text-[#181917]"
                        title="Ordina per contatore"
                      >
                        <ArrowDownUp size={14} aria-hidden="true" />
                        Contatore
                      </Link>
                    </th>
                    <th className="w-[12%] px-4 py-3 font-medium">
                      <Link
                        href={appearanceSortHref}
                        className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[#ebe9df] hover:text-[#181917]"
                        title="Ordina per numero di comparse"
                      >
                        <ArrowDownUp size={14} aria-hidden="true" />
                        Comparse
                      </Link>
                    </th>
                    <th className="w-[8%] px-4 py-3 font-medium">Apri</th>
                  </tr>
                </thead>
                <tbody>
                  {questionRows.map((question) => {
                    const appearanceLabels = formatAppearanceLabels(question.appearanceLabels);
                    const appearanceCount = formatAppearanceCount(question.appearanceCount);

                    return (
                      <tr key={question.id} className="border-t border-[#ebe9df] align-top hover:bg-[#fbfbf8]">
                        <td className="px-4 py-4">
                          <QuestionNumberBadge value={question.displayNumber} />
                        </td>
                        <td className="px-4 py-4 leading-6">{previewQuestionText(question.textPlain)}</td>
                        <td className="px-4 py-4">
                          <CategoryPill label={question.categoryName ?? "Non classificata"} />
                        </td>
                        <td className="px-4 py-4">
                          <CounterBadge value={question.masteryScore} />
                        </td>
                        <td className="px-4 py-4">
                          <AppearanceBadge count={appearanceCount} labels={appearanceLabels} />
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={buildQuestionDetailHref(question.id, currentQuestionsHref)}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d8d6cc] px-3 text-sm font-medium hover:bg-[#f3f1e8]"
                          >
                            Apri
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            buildHref={(page) =>
              buildQuestionsHref({
                category: filters.category,
                exam: filters.exam,
                q: filters.q,
                sort,
                page,
              })
            }
          />
        </section>
      </div>
    </AppShell>
  );
}

function CategoryPill({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-md bg-[#eef6f2] px-2 py-1 text-xs font-medium text-[#28666e]">
      <span className="truncate">{label}</span>
    </span>
  );
}

function QuestionNumberBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex rounded-md bg-[#f3f1e8] px-2 py-1 text-xs font-semibold text-[#4d554c]">
      #{value}
    </span>
  );
}

function CounterBadge({ value }: { value: number }) {
  const tone =
    value > 0
      ? "bg-[#dcfce7] text-[#14532d]"
      : value < 0
        ? "bg-[#fee2e2] text-[#7f1d1d]"
        : "bg-[#f3f1e8] text-[#4d554c]";

  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>{formatCounter(value)}</span>;
}

function Pagination({
  currentPage,
  totalPages,
  buildHref,
}: {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  const pageItems = buildPageItems(currentPage, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ebe9df] p-4 text-sm">
      <div className="text-[#667064]">
        Pagina {currentPage} di {totalPages}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PaginationLink disabled={currentPage === 1} href={buildHref(currentPage - 1)} label="Precedente">
          <ChevronLeft size={16} aria-hidden="true" />
          Precedente
        </PaginationLink>

        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="px-2 text-[#667064]">
              ...
            </span>
          ) : (
            <Link
              key={item}
              href={buildHref(item)}
              aria-current={item === currentPage ? "page" : undefined}
              className={[
                "grid h-9 min-w-9 place-items-center rounded-lg border px-3 font-medium",
                item === currentPage
                  ? "border-[#1b4332] bg-[#1b4332] text-white"
                  : "border-[#d8d6cc] hover:bg-[#f3f1e8]",
              ].join(" ")}
            >
              {item}
            </Link>
          ),
        )}

        <PaginationLink disabled={currentPage === totalPages} href={buildHref(currentPage + 1)} label="Successiva">
          Successiva
          <ChevronRight size={16} aria-hidden="true" />
        </PaginationLink>
      </div>
    </div>
  );
}

function PaginationLink({
  children,
  disabled,
  href,
  label,
}: {
  children: React.ReactNode;
  disabled: boolean;
  href: string;
  label: string;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#ebe9df] px-3 font-medium text-[#a5aa9f]"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#d8d6cc] px-3 font-medium hover:bg-[#f3f1e8]"
    >
      {children}
    </Link>
  );
}

function buildPageItems(currentPage: number, totalPages: number) {
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const validPages = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];

  for (const page of validPages) {
    const previous = items[items.length - 1];
    if (typeof previous === "number" && page - previous > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  }

  return items;
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

function formatCounter(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function previewQuestionText(value: string) {
  return value.length > 190 ? `${value.slice(0, 190)}...` : value;
}

function parsePage(value?: string) {
  if (!value) return 1;
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseQuestionListSort(value?: string): QuestionListSort | undefined {
  if (
    value === "id_asc" ||
    value === "id_desc" ||
    value === "appearances_asc" ||
    value === "appearances_desc" ||
    value === "counter_asc" ||
    value === "counter_desc"
  ) {
    return value;
  }

  return undefined;
}

function getSortDescription(sort: QuestionListSort | undefined) {
  switch (sort) {
    case "id_asc":
      return "ID crescente";
    case "id_desc":
      return "ID decrescente";
    case "appearances_desc":
      return "Piu frequenti prima";
    case "appearances_asc":
      return "Meno frequenti prima";
    case "counter_asc":
      return "Contatore basso prima";
    case "counter_desc":
      return "Contatore alto prima";
    default:
      return "Ordine recente";
  }
}

function buildQuestionsHref(params: {
  category?: string;
  exam?: string;
  q?: string;
  sort?: QuestionListSort;
  page?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set("category", params.category);
  if (params.exam) searchParams.set("exam", params.exam);
  if (params.q) searchParams.set("q", params.q);
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.page && params.page > 1) searchParams.set("page", String(params.page));
  const queryString = searchParams.toString();
  return queryString ? `/questions?${queryString}` : "/questions";
}

function buildQuestionDetailHref(questionId: string, returnTo: string) {
  const searchParams = new URLSearchParams({ returnTo });
  return `/questions/${encodeURIComponent(questionId)}?${searchParams.toString()}`;
}
