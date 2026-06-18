import { test, expect } from '@playwright/test';
import { loginAs } from '../support/auth';

/**
 * Tempo real (socket.io): dois navegadores conversando na mesma solicitação.
 * Usa a troca ACEITA do seed entre carlos (solicitante) e Diego (destinatário).
 */
test.describe('Chat e notificações em tempo real', () => {
  test('mensagem aparece para o outro participante sem recarregar a página', async ({
    page,
    browser,
  }) => {
    // Diego abre a solicitação aceita com a carlos
    await loginAs(page, 'diego@skillex.com');
    await page.goto('/requests');
    await page.locator('.request-item', { hasText: 'carlos' }).first().click();
    await expect(page.locator('#chat')).toBeVisible();
    const requestPath = new URL(page.url()).pathname; // /requests/<id>

    // carlos abre a mesma solicitação em outro navegador
    const carlosCtx = await browser.newContext();
    const carlosPage = await carlosCtx.newPage();
    await loginAs(carlosPage, 'carlos@skillex.com');
    await carlosPage.goto(requestPath);
    await expect(carlosPage.locator('#chat')).toBeVisible();

    // Diego envia uma mensagem → aparece para ele (otimista)...
    const texto = `Mensagem ao vivo ${Date.now()}`;
    await page.fill('#chat-form input[name="content"]', texto);
    await page.click('#chat-form button[type="submit"]');
    await expect(page.locator('#chat')).toContainText(texto);

    // ...e chega na tela da carlos SEM reload (WebSocket)
    await expect(carlosPage.locator('#chat')).toContainText(texto, { timeout: 5000 });

    // Resposta da carlos chega ao Diego ao vivo
    const resposta = `Resposta ao vivo ${Date.now()}`;
    await carlosPage.fill('#chat-form input[name="content"]', resposta);
    await carlosPage.click('#chat-form button[type="submit"]');
    await expect(page.locator('#chat')).toContainText(resposta, { timeout: 5000 });

    await carlosCtx.close();
  });

  test('badge de notificações incrementa ao vivo fora do chat', async ({ page, browser }) => {
    // Diego fica no feed (fora da room do chat)
    await loginAs(page, 'diego@skillex.com');
    const badge = page.locator('[data-unread]');
    const antes = (await badge.isVisible()) ? Number(await badge.textContent()) : 0;

    // carlos envia uma mensagem na solicitação aceita entre eles
    const carlosCtx = await browser.newContext();
    const carlosPage = await carlosCtx.newPage();
    await loginAs(carlosPage, 'carlos@skillex.com');
    await carlosPage.goto('/requests');
    // A troca com Diego está na caixa "Enviadas" da carlos
    await carlosPage.click('#req-seg button[data-box="sent"]');
    await carlosPage.locator('.request-item', { hasText: 'Diego' }).first().click();
    await expect(carlosPage.locator('#chat')).toBeVisible();
    await carlosPage.fill('#chat-form input[name="content"]', `Aviso ${Date.now()}`);
    await carlosPage.click('#chat-form button[type="submit"]');

    // O badge do Diego atualiza sem reload (notification:new → refreshUnread)
    await expect(badge).toHaveText(String(antes + 1), { timeout: 5000 });

    await carlosCtx.close();
  });
});
