/**
 * Fuzzy / accent-insensitive / synonym-aware product search utility.
 *
 * Handles:
 * - Accent removal ("calca" matches "calça", "media" matches "média")
 * - Common synonym expansion ("camiseta" ↔ "blusa", "bermuda" ↔ "short")
 * - Partial / substring matching
 * - Multi-word queries (all tokens must match)
 */

// ── Accent normalisation ────────────────────────────────────────────────────
const normalise = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')                          // decompose accented chars
    .replace(/[\u0300-\u036f]/g, '')           // strip combining diacritics
    .replace(/[^a-z0-9\s]/g, '')              // remove punctuation
    .trim();

// ── Synonym map (bidirectional – both directions are generated automatically)
const SYNONYM_PAIRS: string[][] = [
  ['camiseta', 'blusa', 'camisa', 'tshirt', 't-shirt', 'baby look'],
  ['calca', 'calças', 'pants'],
  ['bermuda', 'short', 'shorts'],
  ['moletom', 'casaco', 'jaqueta', 'blusa de frio'],
  ['bone', 'chapeu', 'cap'],
  ['tenis', 'sapato', 'sapatenis'],
  ['regata', 'cavada'],
  ['cropped', 'top', 'croped'],
  ['vestido', 'dress'],
  ['saia', 'skirt'],
  ['conjunto', 'kit', 'set'],
  ['infantil', 'kids', 'crianca'],
  ['masculino', 'masc', 'homem'],
  ['feminino', 'fem', 'mulher'],
  ['gola', 'colarinho'],
  ['media', 'medio'],
  ['manga longa', 'ml'],
  ['manga curta', 'mc'],
  ['polo', 'gola polo'],
  ['moleton', 'moletom'],
];

// Build lookup: normalised word → set of synonyms (also normalised)
const synonymLookup = new Map<string, string[]>();

for (const group of SYNONYM_PAIRS) {
  const normGroup = group.map(normalise);
  for (const word of normGroup) {
    const existing = synonymLookup.get(word) || [];
    const merged = Array.from(new Set([...existing, ...normGroup.filter(w => w !== word)]));
    synonymLookup.set(word, merged);
  }
}

/** Expand a single normalised token into itself + its synonyms. */
const expandToken = (token: string): string[] => {
  const results = [token];
  // Direct lookup
  const directSynonyms = synonymLookup.get(token);
  if (directSynonyms) results.push(...directSynonyms);
  // Also check if the token is a substring of any synonym key or vice-versa
  for (const [key, syns] of synonymLookup.entries()) {
    if (key !== token && (key.includes(token) || token.includes(key))) {
      results.push(key, ...syns);
    }
  }
  return Array.from(new Set(results));
};

// ── Main search function ────────────────────────────────────────────────────

interface SearchableItem {
  name: string;
  description?: string | null;
}

/**
 * Returns true if the item matches the query using fuzzy logic.
 * All query tokens must match at least one searchable field.
 */
export const fuzzyMatch = (item: SearchableItem, rawQuery: string): boolean => {
  if (!rawQuery || !rawQuery.trim()) return true;

  const normName = normalise(item.name);
  const normDesc = item.description ? normalise(item.description) : '';
  const searchableText = `${normName} ${normDesc}`;

  const queryTokens = normalise(rawQuery).split(/\s+/).filter(Boolean);

  return queryTokens.every(token => {
    // Check direct match first
    if (searchableText.includes(token)) return true;

    // Check expanded synonyms
    const expanded = expandToken(token);
    return expanded.some(syn => searchableText.includes(syn));
  });
};

/**
 * Filter an array of searchable items by query.
 */
export const fuzzyFilterProducts = <T extends SearchableItem>(
  items: T[],
  query: string
): T[] => {
  if (!query || !query.trim()) return items;
  return items.filter(item => fuzzyMatch(item, query));
};
