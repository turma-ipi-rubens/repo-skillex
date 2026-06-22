/**
 * Correspondência aproximada (fuzzy) no cliente — versão enxuta do motor do
 * backend (`backend/src/utils/fuzzy.ts`). Usada pelos comboboxes para tolerar
 * acento, caixa e pequenos erros de digitação no autocomplete.
 */

/** Normaliza um texto para comparação: sem acento, minúsculo, sem pontuação. */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distância de Levenshtein (DP iterativo) entre dois textos. */
function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let k = 0; k <= b.length; k++) prev[k] = curr[k];
  }
  return prev[b.length];
}

/** Similaridade 0–1 entre dois termos não vazios. */
function ratio(a: string, b: string): number {
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/**
 * Pontua o quão bem `text` responde a uma `query` (0–1). Privilegia
 * prefixo/substring e tolera erro de digitação exigindo que cada palavra da
 * busca tenha correspondente próxima no texto.
 */
export function fuzzyQueryScore(text: string, query: string): number {
  const t = normalizeText(text);
  const q = normalizeText(query);
  if (!q) return 1;
  if (!t) return 0;
  if (t === q) return 1;
  if (t.startsWith(q)) return 0.97;
  if (t.includes(q)) return 0.9;

  const tTokens = t.split(' ');
  const qTokens = q.split(' ');
  let worst = 1;
  for (const qt of qTokens) {
    let best = 0;
    for (const tt of tTokens) {
      const r = tt === qt ? 1 : ratio(qt, tt);
      if (r > best) best = r;
    }
    if (best < worst) worst = best;
  }
  return worst;
}
