import { describe, it, expect } from 'vitest';
import { normalizeText, fuzzyQueryScore } from '../../src/utils/fuzzy';

describe('normalizeText', () => {
  it('remove acentos, caixa e pontuação', () => {
    expect(normalizeText('Programação, JS!')).toBe('programacao js');
  });
  it('colapsa espaços', () => {
    expect(normalizeText('  Inglês   Técnico ')).toBe('ingles tecnico');
  });
  it('nulo/indefinido/vazio → string vazia', () => {
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText(null)).toBe('');
    expect(normalizeText('')).toBe('');
  });
});

describe('fuzzyQueryScore', () => {
  it('busca vazia → relevância total', () => {
    expect(fuzzyQueryScore('São Paulo', '')).toBe(1);
  });
  it('texto vazio com busca preenchida → zero', () => {
    expect(fuzzyQueryScore('', 'sp')).toBe(0);
  });
  it('igualdade normalizada → 1', () => {
    expect(fuzzyQueryScore('Inglês', 'ingles')).toBe(1);
  });
  it('prefixo pontua alto', () => {
    expect(fuzzyQueryScore('JavaScript', 'java')).toBe(0.97);
  });
  it('substring no meio pontua alto', () => {
    expect(fuzzyQueryScore('Programação JavaScript', 'script')).toBe(0.9);
  });
  it('tolera erro de digitação (uma palavra)', () => {
    expect(fuzzyQueryScore('São Paulo', 'Sao Paolo')).toBeGreaterThan(0.6);
  });
  it('palavra exata + palavra distante → relevância baixa (semântica E)', () => {
    // "node" casa exatamente; "xyz" não casa nada → o pior caso domina.
    expect(fuzzyQueryScore('Node Mobile', 'xyz node')).toBeLessThan(0.5);
  });
  it('termo totalmente diferente → baixo', () => {
    expect(fuzzyQueryScore('Violino', 'javascript')).toBeLessThan(0.5);
  });
});
