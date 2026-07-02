/**
 * Normalizza il testo per la ricerca: minuscole, accenti rimossi,
 * spazi compattati. Usata sia per popolare la colonna text_search
 * sia per normalizzare la query dell'utente.
 */
export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
