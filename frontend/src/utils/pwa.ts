/** Detecta se o app está rodando como PWA instalado (modo standalone). */
export function isStandalonePWA(): boolean {
  /* v8 ignore start -- guarda SSR: window sempre existe no browser/jsdom */
  if (typeof window === 'undefined') return false;
  /* v8 ignore stop */
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}
