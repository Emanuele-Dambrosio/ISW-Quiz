export type ExamDisplayData = {
  title: string;
  date?: string | null;
};

export function formatExamDate(date?: string | null) {
  if (!date) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;

  const [, year, month, day] = match;
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

export function formatExamLabel(exam: ExamDisplayData) {
  const formattedDate = formatExamDate(exam.date);
  if (formattedDate) return `Esame ${formattedDate}`;

  const title = compactExamTitle(exam.title);
  return title || "Esame senza data";
}

export function formatExamAppearanceLabel(value: string) {
  return formatExamDate(value) ?? compactExamTitle(value) ?? value;
}

function compactExamTitle(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const ayMatch = /\bAY\s+\d{4}\/\d{2}\b/i.exec(normalized);
  const scoped = ayMatch ? normalized.slice(ayMatch.index + ayMatch[0].length).trim() : normalized;
  return scoped
    .replace(/\bDashboard\b.*?\bSoftware Engineering\b/gi, "")
    .replace(/\bTest a scelta multipla\b/gi, "")
    .replace(/\bTest a scelta Multipla\b/g, "")
    .replace(/\bSE\b\s*[- ]*/gi, "")
    .replace(/\bEXAM\b/gi, "Esame")
    .replace(/\bdel\b\s*\d{4}[/-]\d{2}[/-]\d{2}/gi, "")
    .replace(/\bdel\b\s*\d{2}\/\d{2}\/\d{4}/gi, "")
    .replace(/\d{4}[/-]\d{2}[/-]\d{2}/g, "")
    .replace(/\d{2}\/\d{2}\/\d{4}/g, "")
    .replace(/-+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTH_NAMES = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];
