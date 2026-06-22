/**
 * ============================================================================
 *  MOTOR DE CORRESPONDÊNCIA APROXIMADA (FUZZY MATCHING)
 * ----------------------------------------------------------------------------
 *  Funções puras (sem banco) para comparar termos que NÃO são exatamente
 *  iguais — como fazem os mecanismos de busca. Tolera diferenças de:
 *
 *    • acentuação e caixa  ("Inglês" ≈ "ingles")
 *    • erros de digitação   ("javascrpit" ≈ "javascript")  → distância de edição
 *    • variações/sinônimos por sobreposição de palavras
 *      ("Programação JavaScript" ⊇ "JavaScript")           → contenção de tokens
 *
 *  É usado tanto nas buscas (habilidades, usuários, admin) quanto no
 *  algoritmo de match, mantendo uma única fonte de verdade da similaridade.
 * ============================================================================
 */

/** Normaliza um texto para comparação: sem acento, minúsculo, sem pontuação. */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos (acentos)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ') // pontuação vira espaço
    .replace(/\s+/g, ' ') // colapsa espaços
    .trim();
}

/** Quebra um texto normalizado em palavras (tokens). */
export function tokenize(value: string | null | undefined): string[] {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(' ') : [];
}

/**
 * Distância de Levenshtein: nº mínimo de inserções/remoções/substituições
 * para transformar `a` em `b`. Implementação iterativa O(n·m) com uma linha.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // remoção
        curr[j - 1] + 1, // inserção
        prev[j - 1] + cost, // substituição
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Similaridade 0–1 derivada da distância de Levenshtein (1 = idênticos). */
export function levenshteinRatio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/**
 * Similaridade por tokens (palavras): combina o índice de Jaccard com um
 * bônus de contenção — se todas as palavras do termo menor estão no maior,
 * a similaridade é alta (é o que liga "Programação JavaScript" a "JavaScript").
 */
export function tokenSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const setA = new Set(ta);
  const setB = new Set(tb);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;

  const union = new Set([...setA, ...setB]).size;
  const jaccard = intersection / union;

  // Contenção: proporção do menor conjunto coberta pela interseção.
  const containment = intersection / Math.min(setA.size, setB.size);

  return Math.max(jaccard, containment * 0.95);
}

/**
 * Similaridade geral entre dois termos (0–1). Usa o melhor entre a distância
 * de edição (boa para typos) e a sobreposição de palavras (boa para
 * variações/sinônimos). Retorna 1 quando os textos normalizados são iguais.
 */
export function similarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return Math.max(levenshteinRatio(na, nb), tokenSimilarity(a, b));
}

/** Indica se dois termos são "aproximadamente iguais" para o limiar dado. */
export function isFuzzyMatch(a: string, b: string, threshold = 0.72): boolean {
  return similarity(a, b) >= threshold;
}

/**
 * Pontua o quão bem `text` responde a uma `query` de busca (0–1).
 * Privilegia correspondências de prefixo/substring (como o autocomplete de
 * um buscador) e cai para a similaridade geral em caso de erro de digitação.
 */
export function fuzzyQueryScore(text: string, query: string): number {
  const t = normalizeText(text);
  const q = normalizeText(query);
  if (!q) return 1; // sem busca → tudo é relevante
  if (!t) return 0;

  if (t === q) return 1;
  if (t.startsWith(q)) return 0.97;
  if (t.includes(q)) return 0.9;

  // Tolerância a erro de digitação: cada palavra da busca precisa ter uma
  // correspondente próxima no texto (semântica "E"). Isso evita falsos
  // positivos por palavras genéricas compartilhadas (ex.: domínios de e-mail).
  const tTokens = t.split(' ').filter(Boolean);
  const qTokens = q.split(' ').filter(Boolean);
  let worst = 1;
  for (const qt of qTokens) {
    let bestForToken = 0;
    for (const tt of tTokens) {
      const ratio = tt === qt ? 1 : levenshteinRatio(qt, tt);
      if (ratio > bestForToken) bestForToken = ratio;
    }
    if (bestForToken < worst) worst = bestForToken;
  }
  return worst;
}

export interface RankOptions {
  /** Score mínimo para um item ser considerado relevante. */
  threshold?: number;
  /** Limite de itens retornados. */
  limit?: number;
}

export interface Ranked<T> {
  item: T;
  score: number;
}

/**
 * Filtra e ordena uma lista pela relevância fuzzy em relação à `query`.
 * Sem `query`, devolve os itens originais (respeitando `limit`).
 */
export function rankByFuzzy<T>(
  items: T[],
  query: string | null | undefined,
  getText: (item: T) => string,
  options: RankOptions = {},
): Ranked<T>[] {
  const { threshold = 0.62, limit } = options;
  const q = normalizeText(query);

  if (!q) {
    const passthrough = items.map((item) => ({ item, score: 1 }));
    return limit ? passthrough.slice(0, limit) : passthrough;
  }

  const ranked = items
    .map((item) => ({ item, score: fuzzyQueryScore(getText(item), query as string) }))
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score);

  return limit ? ranked.slice(0, limit) : ranked;
}
