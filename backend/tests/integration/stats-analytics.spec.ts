import { describe, it, expect } from 'vitest';
import { api, bearer } from '../helpers/app';
import { makeUser, makeCategory, makeSkill, addTeaching, addLearning } from '../helpers/factories';
import { prisma } from '../../src/config/prisma';

/**
 * Cobre as analytics avançadas do painel admin (analytics.service +
 * stats.controller): séries temporais, distribuições, top-N, carteira,
 * saúde do sistema e geografia.
 */

async function makeAdmin() {
  return makeUser({ role: 'ADMIN' });
}

/** Cria um cenário rico: usuários, habilidades, trocas, avaliações, denúncias. */
async function seedRichData() {
  const cat = await makeCategory('Tecnologia Stats');
  const skillTaught = await makeSkill('Habilidade Ensinada', cat.id);
  const skillWanted = await makeSkill('Habilidade Procurada', cat.id);
  await makeSkill('Habilidade Sem Uso', cat.id); // sem vínculos → testa filtros .filter(>0)

  // Segunda categoria com habilidade → exercita a ordenação de topCategories.
  const cat2 = await makeCategory('Artes Stats');
  await makeSkill('Pintura Stats', cat2.id);

  const teacher = await makeUser({ onboardingCompleted: true, city: 'Recife', state: 'PE' });
  const learner = await makeUser({ onboardingCompleted: true, city: 'Olinda', state: 'PE' });
  // Usuário em outro estado → exercita a ordenação de geoDistribution.
  await makeUser({ onboardingCompleted: true, city: 'São Paulo', state: 'SP' });
  // Usuário desativado → exercita o ramo "Desativados" das distribuições.
  const inactive = await makeUser({ onboardingCompleted: true });
  await prisma.user.update({ where: { id: inactive.user.id }, data: { isActive: false } });
  await addTeaching(teacher.user.id, skillTaught.id);
  await addLearning(learner.user.id, skillWanted.id);
  await addLearning(teacher.user.id, skillWanted.id);

  // Solicitação concluída + avaliações (ratings 1 e 5 → exercita o plural "estrela(s)")
  const request = await prisma.exchangeRequest.create({
    data: {
      requesterId: learner.user.id,
      recipientId: teacher.user.id,
      requestedSkillId: skillTaught.id,
      type: 'COIN',
      status: 'COMPLETED',
      coinAmount: 10,
    },
  });
  await prisma.review.create({
    data: { requestId: request.id, authorId: learner.user.id, targetId: teacher.user.id, skillId: skillTaught.id, rating: 5 },
  });
  const request2 = await prisma.exchangeRequest.create({
    data: {
      requesterId: teacher.user.id,
      recipientId: learner.user.id,
      requestedSkillId: skillWanted.id,
      type: 'EXCHANGE',
      status: 'PENDING',
    },
  });
  await prisma.review.create({
    data: { requestId: request2.id, authorId: teacher.user.id, targetId: learner.user.id, skillId: skillWanted.id, rating: 1 },
  });

  // Denúncia (distribuições de report)
  await prisma.report.create({
    data: { reporterId: learner.user.id, targetId: teacher.user.id, type: 'SPAM', description: 'teste' },
  });

  // Transações de moedas: crédito e débito (testa credited/debited e _sum)
  const wallet = await prisma.wallet.findUnique({ where: { userId: teacher.user.id } });
  await prisma.coinTransaction.createMany({
    data: [
      { walletId: wallet!.id, amount: 50, type: 'EARNING', balanceAfter: 150 },
      { walletId: wallet!.id, amount: -20, type: 'SPEND', balanceAfter: 130 },
    ],
  });

  return { teacher, learner, skillTaught, skillWanted };
}

describe('GET /api/stats/timeseries', () => {
  it('retorna séries de N dias para admin', async () => {
    const admin = await makeAdmin();
    await seedRichData();
    const res = await api.get('/api/stats/timeseries?days=14').set('Authorization', bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(14);
    expect(res.body.newUsers).toHaveLength(14);
    expect(res.body).toHaveProperty('completedExchanges');
    expect(res.body).toHaveProperty('newReviews');
    expect(res.body).toHaveProperty('newReports');
  });

  it('aplica limites de dias (mínimo 7, máximo 180)', async () => {
    const admin = await makeAdmin();
    const tooLow = await api.get('/api/stats/timeseries?days=1').set('Authorization', bearer(admin.token));
    expect(tooLow.body.days).toBe(7);
    const tooHigh = await api.get('/api/stats/timeseries?days=999').set('Authorization', bearer(admin.token));
    expect(tooHigh.body.days).toBe(180);
    const noParam = await api.get('/api/stats/timeseries').set('Authorization', bearer(admin.token));
    expect(noParam.body.days).toBe(30);
  });
});

describe('GET /api/stats/distributions', () => {
  it('agrega usuários, solicitações, avaliações, denúncias e transações', async () => {
    const admin = await makeAdmin();
    await seedRichData();
    const res = await api.get('/api/stats/distributions').set('Authorization', bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.usersByRole.length).toBeGreaterThan(0);
    expect(res.body.usersByStatus.length).toBeGreaterThan(0);
    expect(res.body.usersByOnboarding.length).toBeGreaterThan(0);
    expect(res.body.reviewsByRating.length).toBeGreaterThan(0);
    expect(res.body.reportsByType.length).toBeGreaterThan(0);
    expect(res.body.transactionsByType.length).toBeGreaterThan(0);
  });
});

describe('GET /api/stats/top', () => {
  it('lista top categorias e habilidades (somente as com vínculos)', async () => {
    const admin = await makeAdmin();
    const { skillTaught } = await seedRichData();
    const res = await api.get('/api/stats/top?limit=5').set('Authorization', bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.topTeachingSkills.some((s: any) => s.id === skillTaught.id)).toBe(true);
    expect(res.body.topTeachingSkills.every((s: any) => s.count > 0)).toBe(true);
    expect(res.body.topLearningSkills.every((s: any) => s.count > 0)).toBe(true);
    expect(res.body.topReviewedSkills.every((s: any) => s.count > 0)).toBe(true);
    expect(res.body.mostActiveUsers.length).toBeGreaterThan(0);
    // a habilidade sem uso não aparece em nenhuma top-list
    expect(res.body.topTeachingSkills.some((s: any) => s.name === 'Habilidade Sem Uso')).toBe(false);
  });

  it('aplica limites de limit (mínimo 3, máximo 25, default 10)', async () => {
    const admin = await makeAdmin();
    const low = await api.get('/api/stats/top?limit=1').set('Authorization', bearer(admin.token));
    expect(low.status).toBe(200);
    const high = await api.get('/api/stats/top?limit=99').set('Authorization', bearer(admin.token));
    expect(high.status).toBe(200);
    const noParam = await api.get('/api/stats/top').set('Authorization', bearer(admin.token));
    expect(noParam.status).toBe(200);
  });
});

describe('GET /api/stats/wallet', () => {
  it('reporta saldos, circulação e movimentação dos últimos 30 dias', async () => {
    const admin = await makeAdmin();
    await seedRichData();
    const res = await api.get('/api/stats/wallet').set('Authorization', bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.totalWallets).toBeGreaterThan(0);
    expect(res.body.last30Days.credited).toBeGreaterThanOrEqual(50);
    expect(res.body.last30Days.debited).toBeGreaterThanOrEqual(20);
    expect(res.body.inCirculation).toBeGreaterThan(0);
  });

  it('reporta zeros quando não há carteiras', async () => {
    const admin = await makeAdmin();
    await prisma.coinTransaction.deleteMany();
    await prisma.wallet.deleteMany();
    const res = await api.get('/api/stats/wallet').set('Authorization', bearer(admin.token));
    expect(res.body.totalAvailable).toBe(0);
    expect(res.body.averageBalance).toBe(0);
    expect(res.body.inCirculation).toBe(0);
  });
});

describe('GET /api/stats/health', () => {
  it('retorna indicadores de saúde/moderação', async () => {
    const admin = await makeAdmin();
    await seedRichData();
    const res = await api.get('/api/stats/health').set('Authorization', bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pendingReports');
    expect(res.body).toHaveProperty('pendingRequests');
    expect(res.body).toHaveProperty('activeUsersLast24h');
    expect(res.body).toHaveProperty('onboardingPending');
  });
});

describe('GET /api/stats/geo', () => {
  it('agrupa usuários ativos por estado', async () => {
    const admin = await makeAdmin();
    await seedRichData();
    const res = await api.get('/api/stats/geo').set('Authorization', bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.states.some((s: any) => s.label === 'PE')).toBe(true);
  });
});

describe('Analytics — proteção de acesso', () => {
  it('bloqueia não-admins (403) nos endpoints de analytics', async () => {
    const { token } = await makeUser({ role: 'USER' });
    for (const path of ['/timeseries', '/distributions', '/top', '/wallet', '/health', '/geo']) {
      const res = await api.get(`/api/stats${path}`).set('Authorization', bearer(token));
      expect(res.status).toBe(403);
    }
  });
});
