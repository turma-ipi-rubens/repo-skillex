import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  tokenize,
  levenshtein,
  levenshteinRatio,
  tokenSimilarity,
  similarity,
  isFuzzyMatch,
  fuzzyQueryScore,
  rankByFuzzy,
} from '../../../src/utils/fuzzy';

describe('normalizeText', () => {
  it('remove acentos, caixa e pontuação', () => {
    expect(normalizeText('Programação, Avançada!')).toBe('programacao avancada');
  });
  it('colapsa espaços e apara pontas', () => {
    expect(normalizeText('  Inglês   Técnico  ')).toBe('ingles tecnico');
  });
  it('trata nulo/indefinido como vazio', () => {
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText(null)).toBe('');
  });
});

describe('tokenize', () => {
  it('quebra em palavras normalizadas', () => {
    expect(tokenize('Programação JavaScript')).toEqual(['programacao', 'javascript']);
  });
  it('texto vazio → lista vazia', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('levenshtein', () => {
  it('distância zero para iguais', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });
  it('conta substituições/insercoes', () => {
    expect(levenshtein('javascrpit', 'javascript')).toBeLessThanOrEqual(2);
  });
  it('string vazia → tamanho da outra', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
});

describe('levenshteinRatio', () => {
  it('1 para idênticos, <1 para diferentes', () => {
    expect(levenshteinRatio('node', 'node')).toBe(1);
    expect(levenshteinRatio('node', 'code')).toBeLessThan(1);
  });
  it('duas vazias → 1', () => {
    expect(levenshteinRatio('', '')).toBe(1);
  });
});

describe('tokenSimilarity (contenção de palavras)', () => {
  it('alto quando o termo menor está contido no maior', () => {
    expect(tokenSimilarity('Programação JavaScript', 'JavaScript')).toBeGreaterThan(0.7);
  });
  it('zero quando não há palavras em comum', () => {
    expect(tokenSimilarity('violino', 'francês')).toBe(0);
  });
  it('zero quando um dos lados não tem palavras', () => {
    expect(tokenSimilarity('', 'javascript')).toBe(0);
    expect(tokenSimilarity('javascript', '   ')).toBe(0);
  });
});

describe('similarity', () => {
  it('1 para textos equivalentes (acento/caixa)', () => {
    expect(similarity('Inglês', 'ingles')).toBe(1);
  });
  it('alto para erro de digitação', () => {
    expect(similarity('javascrpit', 'javascript')).toBeGreaterThan(0.75);
  });
  it('alto para variação por palavra extra', () => {
    expect(similarity('Programação JavaScript', 'JavaScript')).toBeGreaterThan(0.7);
  });
  it('baixo para termos não relacionados', () => {
    expect(similarity('violino', 'contabilidade')).toBeLessThan(0.4);
  });
  it('zero quando um dos termos é vazio', () => {
    expect(similarity('', 'javascript')).toBe(0);
    expect(similarity('javascript', '')).toBe(0);
  });
});

describe('isFuzzyMatch', () => {
  it('reconhece "Programação JavaScript" ≈ "JavaScript"', () => {
    expect(isFuzzyMatch('Programação JavaScript', 'JavaScript')).toBe(true);
  });
  it('reconhece typo "javascrpit" ≈ "javascript"', () => {
    expect(isFuzzyMatch('javascrpit', 'javascript')).toBe(true);
  });
  it('rejeita termos distintos', () => {
    expect(isFuzzyMatch('violino', 'javascript')).toBe(false);
  });
});

describe('fuzzyQueryScore', () => {
  it('busca vazia → tudo relevante', () => {
    expect(fuzzyQueryScore('qualquer', '')).toBe(1);
  });
  it('texto vazio com busca preenchida → zero', () => {
    expect(fuzzyQueryScore('', 'java')).toBe(0);
  });
  it('prefixo pontua mais que substring no meio', () => {
    expect(fuzzyQueryScore('JavaScript', 'java')).toBeGreaterThan(
      fuzzyQueryScore('Programação JavaScript', 'java'),
    );
  });
  it('tolera erro de digitação na busca', () => {
    expect(fuzzyQueryScore('JavaScript', 'javascrpit')).toBeGreaterThan(0.6);
  });
});

describe('rankByFuzzy', () => {
  const skills = [
    { name: 'JavaScript' },
    { name: 'Programação JavaScript' },
    { name: 'Java' },
    { name: 'Violino' },
  ];

  it('ordena por relevância e descarta irrelevantes', () => {
    const ranked = rankByFuzzy(skills, 'javascript', (s) => s.name);
    const names = ranked.map((r) => r.item.name);
    expect(names[0]).toBe('JavaScript');
    expect(names).toContain('Programação JavaScript');
    expect(names).not.toContain('Violino');
  });

  it('sem query devolve todos (passthrough) respeitando o limite', () => {
    const ranked = rankByFuzzy(skills, '', (s) => s.name, { limit: 2 });
    expect(ranked).toHaveLength(2);
  });

  it('sem query e sem limite devolve a lista inteira', () => {
    const ranked = rankByFuzzy(skills, null, (s) => s.name);
    expect(ranked).toHaveLength(skills.length);
    expect(ranked.every((r) => r.score === 1)).toBe(true);
  });

  it('acha resultado mesmo com typo', () => {
    const ranked = rankByFuzzy(skills, 'javascrpit', (s) => s.name);
    expect(ranked.map((r) => r.item.name)).toContain('JavaScript');
  });
});
