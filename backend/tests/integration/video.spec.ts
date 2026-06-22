import { describe, it, expect, afterEach } from 'vitest';
import { api, bearer } from '../helpers/app';
import { makeUser, makeSkill, addTeaching } from '../helpers/factories';
import { prisma } from '../../src/config/prisma';
import { env } from '../../src/config/env';

/** Cria dois usuários com uma solicitação ACEITA (sala de vídeo liberada). */
async function makeAcceptedRequest() {
  const teacher = await makeUser({ onboardingCompleted: true });
  const learner = await makeUser({ onboardingCompleted: true });
  const skill = await makeSkill(`Skill Video ${Date.now()}-${Math.random()}`);
  await addTeaching(teacher.user.id, skill.id);
  const request = await prisma.exchangeRequest.create({
    data: {
      requesterId: learner.user.id,
      recipientId: teacher.user.id,
      requestedSkillId: skill.id,
      type: 'COIN',
      status: 'ACCEPTED',
      coinAmount: 10,
    },
  });
  return { teacher, learner, request };
}

describe('GET /api/requests/:id/video-token', () => {
  const originalSecret = env.jitsiAppSecret;
  afterEach(() => {
    env.jitsiAppSecret = originalSecret;
  });

  it('responde 503 quando o Jitsi não está configurado', async () => {
    env.jitsiAppSecret = '';
    const { learner, request } = await makeAcceptedRequest();
    const res = await api
      .get(`/api/requests/${request.id}/video-token`)
      .set('Authorization', bearer(learner.token));
    expect(res.status).toBe(503);
  });

  it('emite token JWT para participante de troca aceita', async () => {
    env.jitsiAppSecret = 'segredo-de-teste';
    const { learner, request } = await makeAcceptedRequest();
    const res = await api
      .get(`/api/requests/${request.id}/video-token`)
      .set('Authorization', bearer(learner.token));
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.room).toBe(`troca-${request.id}`);
    expect(res.body).toHaveProperty('domain');
    expect(res.body).toHaveProperty('displayName');
    expect(res.body.avatarUrl).toBeNull(); // usuário sem foto
  });

  it('inclui o avatar no contexto quando o usuário tem foto', async () => {
    env.jitsiAppSecret = 'segredo-de-teste';
    const { teacher, request } = await makeAcceptedRequest();
    await prisma.user.update({
      where: { id: teacher.user.id },
      data: { avatarUrl: '/uploads/foto.png' },
    });
    const res = await api
      .get(`/api/requests/${request.id}/video-token`)
      .set('Authorization', bearer(teacher.token));
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBe('/uploads/foto.png');
  });

  it('responde 404 quando a solicitação não existe', async () => {
    env.jitsiAppSecret = 'segredo-de-teste';
    const { learner } = await makeAcceptedRequest();
    const res = await api
      .get('/api/requests/nao-existe/video-token')
      .set('Authorization', bearer(learner.token));
    expect(res.status).toBe(404);
  });

  it('responde 403 quando o usuário não participa da solicitação', async () => {
    env.jitsiAppSecret = 'segredo-de-teste';
    const { request } = await makeAcceptedRequest();
    const intruso = await makeUser({ onboardingCompleted: true });
    const res = await api
      .get(`/api/requests/${request.id}/video-token`)
      .set('Authorization', bearer(intruso.token));
    expect(res.status).toBe(403);
  });

  it('responde 409 quando a troca ainda não foi aceita', async () => {
    env.jitsiAppSecret = 'segredo-de-teste';
    const { learner, request } = await makeAcceptedRequest();
    await prisma.exchangeRequest.update({ where: { id: request.id }, data: { status: 'PENDING' } });
    const res = await api
      .get(`/api/requests/${request.id}/video-token`)
      .set('Authorization', bearer(learner.token));
    expect(res.status).toBe(409);
  });
});
