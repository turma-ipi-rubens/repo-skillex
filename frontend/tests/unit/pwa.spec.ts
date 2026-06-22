import { describe, it, expect, afterEach, vi } from 'vitest';
import { isStandalonePWA } from '../../src/utils/pwa';

const realMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = realMatchMedia;
  delete (window.navigator as { standalone?: boolean }).standalone;
});

describe('isStandalonePWA', () => {
  it('retorna true quando display-mode é standalone', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    expect(isStandalonePWA()).toBe(true);
  });

  it('retorna true quando navigator.standalone é true (iOS)', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    (window.navigator as { standalone?: boolean }).standalone = true;
    expect(isStandalonePWA()).toBe(true);
  });

  it('retorna false fora do modo standalone', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    expect(isStandalonePWA()).toBe(false);
  });
});
