/**
 * Testes de UI responsiva.
 *
 * A SPA tem um único breakpoint estrutural em 1024px (definido em
 * frontend/src/styles/components/_shell.scss): abaixo dele a navegação
 * principal fica fixa no rodapé (mobile/tablet); a partir dele ela vira
 * uma sidebar lateral (desktop).
 *
 * Este spec roda o mesmo fluxo em 3 viewports representativos e valida:
 *  - elementos críticos do shell renderizam em qualquer tamanho;
 *  - a posição/forma da navegação corresponde ao breakpoint correto;
 *  - todos os 5 links de navegação ficam visíveis e clicáveis.
 *
 * Screenshots são gravados em e2e/snapshots/ para revisão visual manual.
 */
import { test, expect, devices, type Page } from '@playwright/test';
import * as path from 'node:path';
import { loginAs } from '../support/auth';

type Profile = {
  name: 'mobile' | 'tablet' | 'desktop';
  layout: 'bottom-bar' | 'sidebar';
  use: Parameters<typeof test.use>[0];
};

// `devices[...]` traz `defaultBrowserType` que o Playwright não permite em
// `describe.use()` — extraímos apenas viewport/userAgent/isMobile/hasTouch.
const pixel7 = devices['Pixel 7'];

const PROFILES: Profile[] = [
  {
    // Pixel 7 — Android moderno, retrato (~412 × 915)
    name: 'mobile',
    layout: 'bottom-bar',
    use: {
      viewport: pixel7.viewport,
      userAgent: pixel7.userAgent,
      deviceScaleFactor: pixel7.deviceScaleFactor,
      isMobile: pixel7.isMobile,
      hasTouch: pixel7.hasTouch,
    },
  },
  {
    // iPad-like — fica abaixo do breakpoint de 1024px → ainda mobile-layout
    name: 'tablet',
    layout: 'bottom-bar',
    use: { viewport: { width: 820, height: 1180 } },
  },
  {
    // Desktop padrão — acima de 1024px → sidebar lateral
    name: 'desktop',
    layout: 'sidebar',
    use: { viewport: { width: 1440, height: 900 } },
  },
];

const SNAPSHOT_DIR = path.resolve(__dirname, '..', 'snapshots');

async function snapshot(page: Page, file: string) {
  await page.screenshot({ path: path.join(SNAPSHOT_DIR, file), fullPage: false });
}

for (const profile of PROFILES) {
  test.describe(`UI responsiva — ${profile.name}`, () => {
    test.use(profile.use);

    test('shell e navegação principal renderizam', async ({ page }) => {
      await loginAs(page);
      await expect(page.locator('.app-shell')).toBeVisible();
      await expect(page.locator('.app-header')).toBeVisible();
      await expect(page.locator('.bottom-nav')).toBeVisible();

      // Os 5 itens da nav devem estar visíveis em qualquer viewport
      for (const navKey of ['feed', 'search', 'requests', 'wallet', 'profile']) {
        await expect(page.locator(`a[data-nav="${navKey}"]`)).toBeVisible();
      }

      await snapshot(page, `${profile.name}-feed.png`);
    });

    test(`nav respeita o breakpoint (${profile.layout})`, async ({ page }) => {
      await loginAs(page);

      const nav = page.locator('.bottom-nav');
      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();

      const box = await nav.boundingBox();
      expect(box, 'bottom-nav deve estar visível e ter caixa').not.toBeNull();

      if (profile.layout === 'sidebar') {
        // Desktop: sidebar lateral à esquerda
        expect(box!.x).toBeLessThan(50);
        expect(box!.width).toBeLessThan(300);
        // Sidebar é alta (ocupa boa parte da viewport vertical)
        expect(box!.height).toBeGreaterThan(viewport!.height * 0.4);
      } else {
        // Mobile/tablet: barra inferior — larga e baixa, colada no bottom
        expect(box!.width).toBeGreaterThan(viewport!.width * 0.7);
        expect(box!.height).toBeLessThan(120);
        const bottomEdge = box!.y + box!.height;
        expect(bottomEdge).toBeGreaterThan(viewport!.height * 0.85);
      }
    });

    test('navegação clicável leva para a carteira', async ({ page }) => {
      await loginAs(page);
      await page.click('a[data-nav="wallet"]');
      await expect(page).toHaveURL(/\/wallet/);
      await expect(page.getByRole('heading', { name: 'Carteira' })).toBeVisible();

      await snapshot(page, `${profile.name}-wallet.png`);
    });

    test('login (não autenticado) é utilizável', async ({ page }) => {
      await page.goto('/login');
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();

      await snapshot(page, `${profile.name}-login.png`);
    });
  });
}
