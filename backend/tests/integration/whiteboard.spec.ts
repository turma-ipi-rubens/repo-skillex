import { describe, it, expect } from 'vitest';
import { api, bearer } from '../helpers/app';
import { makeUser, makeSkill, addTeaching } from '../helpers/factories';
import { prisma } from '../../src/config/prisma';
import * as requestService from '../../src/modules/requests/request.service';
import * as whiteboardService from '../../src/modules/whiteboard/whiteboard.service';

/**
 * Cenário base: cria uma solicitação ACEITA entre dois usuários, retornando os
 * tokens e o id da solicitação. O quadro só fica disponível neste status.
 */
async function setupAccepted() {
  const requester = await makeUser({ balance: 100 });
  const recipient = await makeUser();
  const requested = await makeSkill('Pedida WB ' + Math.random());
  const offered = await makeSkill('Oferecida WB ' + Math.random());
  await addTeaching(recipient.user.id, requested.id);
  await addTeaching(requester.user.id, offered.id);

  const created = await requestService.createRequest(requester.user.id, {
    recipientId: recipient.user.id,
    requestedSkillId: requested.id,
    offeredSkillId: offered.id,
    type: 'EXCHANGE',
  });
  await requestService.acceptRequest(recipient.user.id, created.id);

  return { requester, recipient, requestId: created.id };
}

async function setupPending() {
  const requester = await makeUser({ balance: 100 });
  const recipient = await makeUser();
  const requested = await makeSkill('Pedida P ' + Math.random());
  const offered = await makeSkill('Oferecida P ' + Math.random());
  await addTeaching(recipient.user.id, requested.id);
  await addTeaching(requester.user.id, offered.id);

  const created = await requestService.createRequest(requester.user.id, {
    recipientId: recipient.user.id,
    requestedSkillId: requested.id,
    offeredSkillId: offered.id,
    type: 'EXCHANGE',
  });
  return { requester, recipient, requestId: created.id };
}

const validStroke = {
  tool: 'PEN',
  color: '#f97316',
  size: 6,
  points: [
    [0.1, 0.2],
    [0.3, 0.5],
    [0.6, 0.7],
  ],
};

describe('GET /api/requests/:id/whiteboard/strokes', () => {
  it('retorna lista vazia quando não há traços', async () => {
    const { requester, requestId } = await setupAccepted();
    const res = await api
      .get(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(requester.token));
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('lista traços em ordem cronológica', async () => {
    const { requester, recipient, requestId } = await setupAccepted();
    await api
      .post(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(requester.token))
      .send(validStroke);
    await api
      .post(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(recipient.token))
      .send({ ...validStroke, color: '#22c55e' });

    const res = await api
      .get(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(requester.token));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].color).toBe('#f97316');
    expect(res.body.items[1].color).toBe('#22c55e');
    expect(res.body.items[0].points).toEqual(validStroke.points);
  });

  it('rejeita não participante (403)', async () => {
    const { requestId } = await setupAccepted();
    const outsider = await makeUser();
    const res = await api
      .get(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(outsider.token));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/requests/:id/whiteboard/strokes', () => {
  it('persiste traço e retorna 201', async () => {
    const { requester, requestId } = await setupAccepted();
    const res = await api
      .post(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(requester.token))
      .send(validStroke);

    expect(res.status).toBe(201);
    expect(res.body.stroke.id).toBeTruthy();
    expect(res.body.stroke.points).toEqual(validStroke.points);
    const count = await prisma.whiteboardStroke.count({ where: { requestId } });
    expect(count).toBe(1);
  });

  it('aceita ferramenta TEXT com texto', async () => {
    const { requester, requestId } = await setupAccepted();
    const res = await api
      .post(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(requester.token))
      .send({
        tool: 'TEXT',
        color: '#0b0f14',
        size: 16,
        points: [[0.5, 0.5]],
        text: 'Olá mundo',
      });
    expect(res.status).toBe(201);
    expect(res.body.stroke.text).toBe('Olá mundo');
  });

  it('rejeita TEXT sem texto (422)', async () => {
    const { requester, requestId } = await setupAccepted();
    const res = await api
      .post(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(requester.token))
      .send({ tool: 'TEXT', color: '#000000', size: 12, points: [[0.5, 0.5]] });
    expect(res.status).toBe(422);
  });

  it('serviço: TEXT sem texto persiste com text nulo (fallback defensivo)', async () => {
    // O schema HTTP exige texto para TEXT; chamamos o service direto para
    // exercitar o fallback `data.text ?? null`.
    const { requester, requestId } = await setupAccepted();
    const stroke = await whiteboardService.addStroke(requester.user.id, requestId, {
      tool: 'TEXT',
      color: '#000000',
      size: 12,
      points: [[0.5, 0.5]],
      text: undefined,
      pageIndex: 0,
    });
    expect(stroke.text).toBeNull();
  });

  it('rejeita cor inválida (422)', async () => {
    const { requester, requestId } = await setupAccepted();
    const res = await api
      .post(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(requester.token))
      .send({ ...validStroke, color: 'red' });
    expect(res.status).toBe(422);
  });

  it('rejeita ferramenta inválida (422)', async () => {
    const { requester, requestId } = await setupAccepted();
    const res = await api
      .post(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(requester.token))
      .send({ ...validStroke, tool: 'HEART' });
    expect(res.status).toBe(422);
  });

  it('rejeita tamanho fora do range (422)', async () => {
    const { requester, requestId } = await setupAccepted();
    const res = await api
      .post(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(requester.token))
      .send({ ...validStroke, size: 200 });
    expect(res.status).toBe(422);
  });

  it('rejeita quando solicitação ainda está PENDING (400)', async () => {
    const { requester, requestId } = await setupPending();
    const res = await api
      .post(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(requester.token))
      .send(validStroke);
    expect(res.status).toBe(400);
  });

  it('rejeita não participante (403)', async () => {
    const { requestId } = await setupAccepted();
    const outsider = await makeUser();
    const res = await api
      .post(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(outsider.token))
      .send(validStroke);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/requests/:id/whiteboard/strokes/last', () => {
  it('desfaz apenas o próprio último traço', async () => {
    const { requester, recipient, requestId } = await setupAccepted();
    // Recipient desenha primeiro, depois requester desenha. Requester desfaz:
    // só o traço do requester deve ser removido.
    const r1 = await api
      .post(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(recipient.token))
      .send({ ...validStroke, color: '#22c55e' });
    const r2 = await api
      .post(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(requester.token))
      .send({ ...validStroke, color: '#f97316' });

    const undo = await api
      .delete(`/api/requests/${requestId}/whiteboard/strokes/last`)
      .set('Authorization', bearer(requester.token));
    expect(undo.status).toBe(200);
    expect(undo.body.strokeId).toBe(r2.body.stroke.id);

    const remaining = await prisma.whiteboardStroke.findMany({ where: { requestId } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(r1.body.stroke.id);
  });

  it('retorna 404 quando não há traço do autor', async () => {
    const { requester, requestId } = await setupAccepted();
    const res = await api
      .delete(`/api/requests/${requestId}/whiteboard/strokes/last`)
      .set('Authorization', bearer(requester.token));
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/requests/:id/whiteboard/strokes', () => {
  it('limpa todos os traços do quadro', async () => {
    const { requester, recipient, requestId } = await setupAccepted();
    await api
      .post(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(requester.token))
      .send(validStroke);
    await api
      .post(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(recipient.token))
      .send(validStroke);

    const res = await api
      .delete(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(requester.token));
    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(2);

    const count = await prisma.whiteboardStroke.count({ where: { requestId } });
    expect(count).toBe(0);
  });

  it('rejeita não participante (403)', async () => {
    const { requestId } = await setupAccepted();
    const outsider = await makeUser();
    const res = await api
      .delete(`/api/requests/${requestId}/whiteboard/strokes`)
      .set('Authorization', bearer(outsider.token));
    expect(res.status).toBe(403);
  });
});
