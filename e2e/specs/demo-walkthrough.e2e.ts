/**
 * Walkthrough completo do fluxo principal da SkillEx.
 *
 * Pensado para rodar em modo *headed* (com o navegador visível) durante a
 * apresentação da banca: cada passo aguarda o elemento ficar visível e usa
 * IDs/seletores resilientes para que a demo não engasgue.
 *
 *   npm run test:e2e:headed             # headed normal
 *   npm run test:e2e:demo               # headed + slowMo (passo a passo visível)
 *   SLOWMO=500 npm run test:e2e:headed  # qualquer teste com slowMo
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../support/auth';

test.describe('Walkthrough — demo da apresentação', () => {
  test('login → feed → perfil do match → busca → carteira → logout', async ({ page }) => {
    await test.step('Login como Ana (admin com match perfeito)', async () => {
      await loginAs(page);
    });

    await test.step('Feed mostra Bruno como match (violino ↔ tricô)', async () => {
      await expect(page).toHaveURL(/\/feed/);
      await expect(page.getByText('Para você')).toBeVisible();
      await expect(page.getByText('Bruno Carvalho')).toBeVisible();
    });

    await test.step('Abrir o perfil do Bruno a partir do feed', async () => {
      const brunoCard = page.locator('article.user-card', { hasText: 'Bruno Carvalho' });
      await brunoCard.getByRole('link', { name: /Ver perfil/i }).click();
      await expect(page).toHaveURL(/\/profile\//);
      await expect(page.locator('.profile-header__name')).toContainText(/Bruno/i);
    });

    await test.step('Voltar para a busca pela barra de navegação', async () => {
      await page.click('a[data-nav="search"]');
      await expect(page).toHaveURL(/\/search/);
    });

    await test.step('Carteira mostra saldo numérico', async () => {
      await page.click('a[data-nav="wallet"]');
      await expect(page).toHaveURL(/\/wallet/);
      await expect(page.getByRole('heading', { name: 'Carteira' })).toBeVisible();
      await expect(page.locator('.wallet-card__balance')).toContainText(/\d+/);
    });

    await test.step('Logout encerra a sessão e volta para login', async () => {
      await page.goto('/profile/me');
      await page.getByRole('button', { name: /Sair/ }).click();
      await page.locator('[data-ok]').click();
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('input[name="email"]')).toBeVisible();
    });
  });
});
