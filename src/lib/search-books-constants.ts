// Fuori dai moduli "use server" (mongo-books/search.ts, open-library/search.ts,
// search-books.ts) perché quei file possono esportare solo funzioni async —
// una costante condivisa va tenuta a parte.
export const SEARCH_PAGE_SIZE = 10;
