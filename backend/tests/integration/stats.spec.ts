import { describe, it, expect } from 'vitest';
import { api, bearer } from '../helpers/app';
import { makeUser, makeSkill, addTeaching, addLearning } from '../helpers/factories';
import { prisma } from '../../src/config/prisma';

describe('GET /api/stats/trends', () => {
  it('retorna habilidades populares e mais procuradas', async () => {
    const teacher = await makeUser({ onboardingCompleted: true });
    const learner = await makeUser({ onboardingCompleted: true });
    // duas habilidades com demanda → exercita os comparadores de ordenação
    const skill = await makeSkill('Marketing Trend');
    const skill2 = await makeSkill('Design Trend');
    await addTeaching(teacher.user.id, skill.id);
    await addLearning(learner.user.id, skill.id);
    await addLearning(learner.user.id, skill2.id);
    await addTeaching(teacher.user.id, skill2.id);
    // habilidade sem demanda (não entra em popular/mostWanted)
    await makeSkill('Sem Demanda');

    const res = await api.get('/api/stats/trends').set('Authorization', bearer(teacher.token));
    expect(res.status).toBe(200);
    expect(res.body.popular.some((s: any) => s.id === skill.id)).toBe(true);
    expect(res.body.mostWanted.some((s: any) => s.id === skill.id)).toBe(true);
    expect(res.body.popular.some((s: any) => s.name === 'Sem Demanda')).toBe(false);
  });
});

describe('GET /api/stats/ranking', () => {
  it('classifica usuários por reputação (avaliações + trocas)', async () => {
    const a = await makeUser({ onboardingCompleted: true });
    const b = await makeUser({ onboardingCompleted: true });
    const skill = await makeSkill('Aula Rank');
    // O filtro de descobertas exige ao menos 1 teaching skill — b é o
    // professor que vai aparecer no ranking, então precisa cadastrar.
    await addTeaching(b.user.id, skill.id);

    const request = await prisma.exchangeRequest.create({
      data: {
        requesterId: a.user.id,
        recipientId: b.user.id,
        requestedSkillId: skill.id,
        type: 'COIN',
        status: 'COMPLETED',
        coinAmount: 10,
      },
    });
    await prisma.review.create({
      data: {
        requestId: request.id,
        authorId: a.user.id,
        targetId: b.user.id,
        skillId: skill.id,
        rating: 5,
      },
    });
    // usuário sem reviews nem trocas → fora do ranking
    await makeUser({ onboardingCompleted: true });

    const res = await api.get('/api/stats/ranking').set('Authorization', bearer(a.token));
    const ids = res.body.ranking.map((u: any) => u.id);
    expect(ids).toContain(b.user.id);
    expect(res.body.ranking[0].position).toBe(1);
  });

  it('ordena dois usuários reputados e conta trocas só das concluídas', async () => {
    const viewer = await makeUser({ onboardingCompleted: true });
    const top = await makeUser({ onboardingCompleted: true });
    const second = await makeUser({ onboardingCompleted: true });
    const skill = await makeSkill('Aula Ranking 2');
    await addTeaching(top.user.id, skill.id);
    await addTeaching(second.user.id, skill.id);

    // `top`: nota 5 numa troca CONCLUÍDA → entra na contagem de trocas.
    // `second`: nota 3 numa troca apenas ACEITA → tem avaliação mas ZERO trocas
    //           concluídas (exercita o fallback `completedCount.get(id) ?? 0`).
    const reqTop = await prisma.exchangeRequest.create({
      data: {
        requesterId: viewer.user.id,
        recipientId: top.user.id,
        requestedSkillId: skill.id,
        type: 'COIN',
        status: 'COMPLETED',
        coinAmount: 10,
      },
    });
    await prisma.review.create({
      data: { requestId: reqTop.id, authorId: viewer.user.id, targetId: top.user.id, skillId: skill.id, rating: 5 },
    });

    const reqSecond = await prisma.exchangeRequest.create({
      data: {
        requesterId: viewer.user.id,
        recipientId: second.user.id,
        requestedSkillId: skill.id,
        type: 'COIN',
        status: 'ACCEPTED',
        coinAmount: 10,
      },
    });
    await prisma.review.create({
      data: { requestId: reqSecond.id, authorId: viewer.user.id, targetId: second.user.id, skillId: skill.id, rating: 3 },
    });

    const res = await api.get('/api/stats/ranking').set('Authorization', bearer(viewer.token));
    const ids = res.body.ranking.map((u: any) => u.id);
    expect(ids.indexOf(top.user.id)).toBeLessThan(ids.indexOf(second.user.id));
    const secondRow = res.body.ranking.find((u: any) => u.id === second.user.id);
    expect(secondRow.completedExchanges).toBe(0);
  });
});

describe('GET /api/stats/overview', () => {
  it('bloqueia usuários não administradores com 403', async () => {
    const { token } = await makeUser({ role: 'USER' });
    const res = await api.get('/api/stats/overview').set('Authorization', bearer(token));
    expect(res.status).toBe(403);
  });

  it('retorna a visão geral para administradores', async () => {
    const admin = await makeUser({ role: 'ADMIN' });
    await makeSkill('Skill Overview');
    const res = await api.get('/api/stats/overview').set('Authorization', bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBeGreaterThanOrEqual(1);
    expect(res.body).toHaveProperty('coinsInCirculation');
    expect(res.body).toHaveProperty('averageRating');
  });

  it('reporta zero moedas em circulação quando não há carteiras', async () => {
    const admin = await makeUser({ role: 'ADMIN' });
    await prisma.coinTransaction.deleteMany();
    await prisma.wallet.deleteMany();
    const res = await api.get('/api/stats/overview').set('Authorization', bearer(admin.token));
    expect(res.body.coinsInCirculation).toBe(0);
  });
});
