/**
 * Tour guiado pela aplicação SkillEx.
 *
 * NÃO é um teste — é um demo automatizado pensado para ser ASSISTIDO por
 * humanos. Roda em modo *headed*, em ritmo lento, com legendas em overlay
 * explicando cada feature enquanto o cursor navega pelo app.
 *
 *   npm run tour                  # ritmo padrão (slowMo 450ms)
 *   SLOWMO=700 npm run tour       # mais devagar (apresentação)
 *   $env:SLOWMO=200; npm run tour # mais rápido (gravação)
 *
 * Não há assertions agressivas: se um elemento opcional não estiver presente,
 * o tour pula a seção em vez de quebrar. O objetivo é nunca interromper
 * uma demo ao vivo.
 */
import { test, type Page } from '@playwright/test';

// ────────────────────────────────────────────────────────────────────────────
//  Overlays narrativos
// ────────────────────────────────────────────────────────────────────────────

/** Mostra uma legenda fixa no rodapé da tela e segura por `holdMs`. */
async function narrate(page: Page, title: string, body: string, holdMs = 3500) {
  await page.evaluate(
    ({ title, body }) => {
      let el = document.getElementById('tour-overlay') as HTMLDivElement | null;
      if (!el) {
        el = document.createElement('div');
        el.id = 'tour-overlay';
        el.style.cssText = [
          'position:fixed',
          'left:50%',
          'bottom:28px',
          'transform:translateX(-50%)',
          'background:rgba(20,20,28,.94)',
          'color:#fff',
          'padding:16px 22px',
          'border-radius:14px',
          'box-shadow:0 20px 60px rgba(0,0,0,.4)',
          'font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif',
          'max-width:520px',
          'min-width:320px',
          'z-index:2147483647',
          'opacity:0',
          'transition:opacity .25s ease, transform .25s ease',
          'border-left:4px solid #f97316',
          'pointer-events:none',
        ].join(';');
        document.body.appendChild(el);
      }
      el.innerHTML =
        `<div style="font-weight:700;font-size:15px;margin-bottom:4px;color:#fdba74">${title}</div>` +
        `<div style="opacity:.92">${body}</div>`;
      requestAnimationFrame(() => {
        el!.style.opacity = '1';
        el!.style.transform = 'translateX(-50%) translateY(0)';
      });
    },
    { title, body },
  );
  await page.waitForTimeout(holdMs);
}

/** Esconde a legenda (suave). Útil antes de abrir outra página. */
async function clearNarration(page: Page) {
  await page.evaluate(() => {
    const el = document.getElementById('tour-overlay');
    if (el) el.style.opacity = '0';
  });
  await page.waitForTimeout(300);
}

/** Destaca visualmente um elemento por alguns segundos (outline laranja). */
async function highlight(page: Page, selector: string, holdMs = 2200) {
  await page.evaluate(
    ({ selector }) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return;
      const prevOutline = el.style.outline;
      const prevOffset = el.style.outlineOffset;
      el.style.outline = '3px solid #f97316';
      el.style.outlineOffset = '4px';
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        el.style.outline = prevOutline;
        el.style.outlineOffset = prevOffset;
      }, 2200);
    },
    { selector },
  );
  await page.waitForTimeout(holdMs);
}

/** Tenta executar uma seção, mas nunca falha o tour se algo opcional não existir. */
async function trySection(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.warn(`[tour] seção "${name}" pulada: ${(err as Error).message}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  Roteiro
// ────────────────────────────────────────────────────────────────────────────

test('Tour guiado pela SkillEx', async ({ page }) => {
  test.setTimeout(10 * 60_000);

  // ── 1. Landing pública ────────────────────────────────────────────────────
  await trySection('Landing', async () => {
    await page.goto('/');
    await narrate(
      page,
      '👋 Bem-vindo à SkillEx',
      'Plataforma social de troca de habilidades. Vou navegar pelas principais funcionalidades.',
      4500,
    );
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(800);
    await page.mouse.wheel(0, 500);
    await narrate(
      page,
      'Página inicial pública',
      'A landing apresenta a proposta, depoimentos e CTA para criar conta ou entrar.',
      4000,
    );
    await clearNarration(page);
  });

  // ── 2. Login ──────────────────────────────────────────────────────────────
  await trySection('Login', async () => {
    await page.goto('/login');
    await narrate(
      page,
      '🔐 Login',
      'Vamos entrar com a conta da Ana — uma das contas seed (admin, match perfeito com o Bruno).',
      4000,
    );
    await highlight(page, 'input[name="email"]');
    await page.fill('input[name="email"]', 'ana@skillex.com');
    await page.fill('input[name="password"]', 'senha123');
    await highlight(page, 'button[type="submit"]', 1500);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/feed/);
  });

  // ── 3. Feed e matches ─────────────────────────────────────────────────────
  await trySection('Feed', async () => {
    await narrate(
      page,
      '🏠 Feed de matches',
      'O algoritmo de compatibilidade ranqueia pessoas pela troca de habilidades. Bruno aparece com score 100 (troca perfeita: violino ↔ tricô).',
      5000,
    );
    await highlight(page, 'article.user-card', 2500);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(900);
  });

  // ── 4. Perfil do match ────────────────────────────────────────────────────
  await trySection('Perfil do Bruno', async () => {
    const brunoCard = page.locator('article.user-card', { hasText: 'Bruno Carvalho' });
    await brunoCard.getByRole('link', { name: /Ver perfil/i }).click();
    await page.waitForURL(/\/profile\//);
    await narrate(
      page,
      '👤 Perfil de outro usuário',
      'Bio, habilidades que ensina e quer aprender, avaliações, e ações: favoritar, solicitar troca ou comprar aula com moedas.',
      5000,
    );
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(800);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(800);
  });

  // ── 5. Busca ──────────────────────────────────────────────────────────────
  await trySection('Busca', async () => {
    await page.click('a[data-nav="search"]');
    await page.waitForURL(/\/search/);
    await narrate(
      page,
      '🔍 Busca',
      'Procure pessoas por habilidade, modalidade (online/presencial) e cidade. Resultados ordenados pelo score de match.',
      4500,
    );
    const input = page.locator('input[placeholder*="Buscar" i], input[type="search"]').first();
    if (await input.count()) {
      await input.click();
      await input.type('viol', { delay: 120 });
      await page.waitForTimeout(1500);
    }
  });

  // ── 6. Tendências ─────────────────────────────────────────────────────────
  await trySection('Tendências', async () => {
    await page.goto('/trends');
    await narrate(
      page,
      '📈 Tendências',
      'Habilidades mais ensinadas e procuradas da plataforma — descubra o que está em alta.',
      4000,
    );
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(800);
  });

  // ── 7. Ranking ────────────────────────────────────────────────────────────
  await trySection('Ranking', async () => {
    await page.goto('/ranking');
    await narrate(
      page,
      '🏆 Ranking',
      'Top usuários por avaliações, trocas concluídas e contribuições à comunidade.',
      4000,
    );
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(800);
  });

  // ── 8. Skills ─────────────────────────────────────────────────────────────
  await trySection('Habilidades', async () => {
    await page.goto('/skills');
    await narrate(
      page,
      '🎯 Suas habilidades',
      'Cadastre o que você ensina (nível, modalidade, preço em moedas) e o que quer aprender (objetivo, nível atual).',
      4500,
    );
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(800);
  });

  // ── 9. Favoritos ──────────────────────────────────────────────────────────
  await trySection('Favoritos', async () => {
    await page.goto('/favorites');
    await narrate(
      page,
      '❤️ Favoritos',
      'Pessoas que você marcou para conversar depois — separadas do feed principal.',
      3800,
    );
  });

  // ── 10. Trocas ────────────────────────────────────────────────────────────
  await trySection('Trocas', async () => {
    await page.click('a[data-nav="requests"]');
    await page.waitForURL(/\/requests/);
    await narrate(
      page,
      '🔄 Trocas e solicitações',
      'Histórico de pedidos enviados e recebidos, com status: pendente, aceito, em andamento, concluído.',
      4500,
    );
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(800);
  });

  // ── 11. Carteira ──────────────────────────────────────────────────────────
  await trySection('Carteira', async () => {
    await page.click('a[data-nav="wallet"]');
    await page.waitForURL(/\/wallet/);
    await narrate(
      page,
      '💰 Carteira de moedas',
      'Moeda interna da plataforma — recebida ao ensinar, gasta para comprar aulas. Saldo e histórico de transações.',
      5000,
    );
    await highlight(page, '.wallet-card__balance', 2000);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(800);
  });

  // ── 12. Notificações ──────────────────────────────────────────────────────
  await trySection('Notificações', async () => {
    await page.click('button[data-action="notifications"]');
    await page.waitForURL(/\/notifications/);
    await narrate(
      page,
      '🔔 Notificações',
      'Novas solicitações, mensagens, avaliações — atualizadas ao vivo via WebSocket (socket.io).',
      4500,
    );
  });

  // ── 13. Configurações ─────────────────────────────────────────────────────
  await trySection('Configurações', async () => {
    await page.click('button[data-action="settings"]');
    await page.waitForURL(/\/settings/);
    await narrate(
      page,
      '⚙️ Configurações',
      'Tema (claro/escuro), notificações, privacidade, alteração de senha e exclusão de conta.',
      4500,
    );
    // Demonstra o toggle de tema (claro ↔ escuro)
    const themeBtn = page.locator('button[data-action="theme"]').first();
    if (await themeBtn.count()) {
      await highlight(page, 'button[data-action="theme"]', 1500);
      await themeBtn.click();
      await page.waitForTimeout(1200);
      await themeBtn.click();
      await page.waitForTimeout(800);
    }
  });

  // ── 14. Perfil próprio ────────────────────────────────────────────────────
  await trySection('Meu perfil', async () => {
    await page.click('a[data-nav="profile"]');
    await page.waitForURL(/\/profile\/me|\/profile\//);
    await narrate(
      page,
      '🪪 Meu perfil',
      'Visão pública do seu perfil. Aqui você edita informações, gerencia conta e (quando aplicável) acessa o painel admin.',
      4500,
    );
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(800);
  });

  // ── 15. Painel admin (Ana é admin) ────────────────────────────────────────
  await trySection('Painel admin', async () => {
    await page.goto('/admin');
    await narrate(
      page,
      '🛡️ Painel administrativo',
      'Visível só para admins: gerenciar usuários, denúncias, e ver métricas da plataforma.',
      4500,
    );
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(800);
  });

  // ── 16. Logout ────────────────────────────────────────────────────────────
  await trySection('Logout', async () => {
    await page.goto('/profile/me');
    await page.waitForTimeout(400);
    const sair = page.getByRole('button', { name: /Sair/ });
    if (await sair.count()) {
      await narrate(
        page,
        '👋 Encerrando o tour',
        'Vamos fazer logout. Esse foi um tour guiado pelas principais features da SkillEx — obrigado por assistir!',
        5500,
      );
      await sair.click();
      const ok = page.locator('[data-ok]');
      if (await ok.count()) await ok.click();
      await page.waitForURL(/\/login/);
    }
  });

  // Mensagem final
  await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(20,20,28,.7)',
      'color:#fff',
      'display:grid',
      'place-items:center',
      'font:600 22px/1.4 -apple-system,Segoe UI,Roboto,sans-serif',
      'z-index:2147483647',
    ].join(';');
    el.innerHTML =
      '<div style="text-align:center"><div style="font-size:32px">✨</div>' +
      '<div style="margin-top:12px;color:#fdba74">Tour finalizado</div>' +
      '<div style="margin-top:8px;font-size:14px;opacity:.85">SkillEx — plataforma de troca de habilidades</div></div>';
    document.body.appendChild(el);
  });
  await page.waitForTimeout(3500);
});
