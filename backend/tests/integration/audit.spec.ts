import { describe, it, expect } from 'vitest';
import { api, bearer } from '../helpers/app';
import { makeUser, makeCategory, makeSkill, addTeaching, addLearning } from '../helpers/factories';
import { prisma } from '../../src/config/prisma';

async function makeAdmin() {
  return makeUser({ role: 'ADMIN' });
}

describe('Auditoria — proteção das rotas', () => {
  it('exige autenticação (401) e papel ADMIN (403)', async () => {
    expect((await api.get('/api/admin/audit-logs')).status).toBe(401);
    const { token } = await makeUser();
    const res = await api.get('/api/admin/audit-logs').set('Authorization', bearer(token));
    expect(res.status).toBe(403);
  });
});

describe('Auditoria — registro de eventos', () => {
  it('registra um evento de SEGURANÇA no login bem-sucedido', async () => {
    const { user } = await makeUser({ email: 'login-ok@test.com', password: 'senha123' });
    await api.post('/api/auth/login').send({ email: user.email, password: 'senha123' });

    const log = await prisma.auditLog.findFirst({ where: { action: 'AUTH_LOGIN', actorId: user.id } });
    expect(log).not.toBeNull();
    expect(log!.category).toBe('SECURITY');
    expect(log!.actorEmail).toBe(user.email);
  });

  it('registra tentativa de login malsucedida (sem ator)', async () => {
    const { user } = await makeUser({ email: 'login-fail@test.com', password: 'senha123' });
    await api.post('/api/auth/login').send({ email: user.email, password: 'errada' });

    const log = await prisma.auditLog.findFirst({ where: { action: 'AUTH_LOGIN_FAILED' } });
    expect(log).not.toBeNull();
    expect(log!.actorId).toBeNull();
    expect(log!.actorEmail).toBe(user.email);
  });

  it('registra ação ADMIN ao desativar uma conta', async () => {
    const admin = await makeAdmin();
    const alvo = await makeUser();

    await api
      .patch(`/api/admin/users/${alvo.user.id}/status`)
      .set('Authorization', bearer(admin.token))
      .send({ isActive: false });

    const log = await prisma.auditLog.findFirst({ where: { action: 'USER_DEACTIVATED' } });
    expect(log).not.toBeNull();
    expect(log!.category).toBe('ADMIN');
    expect(log!.actorId).toBe(admin.user.id);
    expect(log!.entityId).toBe(alvo.user.id);
  });

  it('registra ação de CONTEÚDO ao criar uma denúncia', async () => {
    const { user, token } = await makeUser();
    const alvo = await makeUser();
    await api
      .post('/api/reports')
      .set('Authorization', bearer(token))
      .send({ targetId: alvo.user.id, type: 'SPAM', description: 'Mensagens repetidas e indesejadas.' });

    const log = await prisma.auditLog.findFirst({ where: { action: 'REPORT_CREATED', actorId: user.id } });
    expect(log).not.toBeNull();
    expect(log!.category).toBe('CONTENT');
  });
});

describe('GET /api/admin/audit-logs', () => {
  it('lista, filtra por categoria/ação/busca e pagina', async () => {
    const admin = await makeAdmin();
    const alvo = await makeUser({ name: 'Alvo Auditado' });

    await api
      .patch(`/api/admin/users/${alvo.user.id}/status`)
      .set('Authorization', bearer(admin.token))
      .send({ isActive: false });

    const all = await api.get('/api/admin/audit-logs').set('Authorization', bearer(admin.token));
    expect(all.status).toBe(200);
    expect(all.body.total).toBeGreaterThanOrEqual(1);
    expect(all.body.items[0]).toHaveProperty('action');

    const byCategory = await api
      .get('/api/admin/audit-logs?category=ADMIN')
      .set('Authorization', bearer(admin.token));
    expect(byCategory.body.items.every((l: any) => l.category === 'ADMIN')).toBe(true);

    const byAction = await api
      .get('/api/admin/audit-logs?action=USER_DEACTIVATED')
      .set('Authorization', bearer(admin.token));
    expect(byAction.body.items.every((l: any) => l.action === 'USER_DEACTIVATED')).toBe(true);

    const byQuery = await api
      .get('/api/admin/audit-logs?q=Alvo Auditado')
      .set('Authorization', bearer(admin.token));
    expect(byQuery.body.items.length).toBeGreaterThanOrEqual(1);

    const paged = await api
      .get('/api/admin/audit-logs?page=1&limit=1')
      .set('Authorization', bearer(admin.token));
    expect(paged.body.items).toHaveLength(1);
  });

  it('filtra por intervalo de datas e por ator', async () => {
    const admin = await makeAdmin();
    const alvo = await makeUser();
    await api
      .patch(`/api/admin/users/${alvo.user.id}/status`)
      .set('Authorization', bearer(admin.token))
      .send({ isActive: false });

    const future = new Date(Date.now() + 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();

    const inWindow = await api
      .get(`/api/admin/audit-logs?from=${past}&to=${future}&actorId=${admin.user.id}`)
      .set('Authorization', bearer(admin.token));
    expect(inWindow.body.total).toBeGreaterThanOrEqual(1);

    const empty = await api
      .get(`/api/admin/audit-logs?from=${future}`)
      .set('Authorization', bearer(admin.token));
    expect(empty.body.total).toBe(0);
  });

  it('expõe metadados (ações e categorias distintas) para os filtros', async () => {
    const admin = await makeAdmin();
    const alvo = await makeUser();
    await api
      .patch(`/api/admin/users/${alvo.user.id}/status`)
      .set('Authorization', bearer(admin.token))
      .send({ isActive: false });

    const meta = await api.get('/api/admin/audit-logs/meta').set('Authorization', bearer(admin.token));
    expect(meta.status).toBe(200);
    expect(meta.body.actions).toContain('USER_DEACTIVATED');
    expect(meta.body.categories).toContain('ADMIN');
  });
});

describe('POST /api/admin/skills/merge', () => {
  it('mescla habilidades movendo todos os vínculos e removendo a duplicata', async () => {
    const admin = await makeAdmin();
    const cat = await makeCategory('Tecnologia');
    const from = await makeSkill('Programação JavaScript', cat.id);
    const into = await makeSkill('JavaScript', cat.id);

    const teacher = await makeUser();
    const learner = await makeUser();
    await addTeaching(teacher.user.id, from.id);
    await addLearning(learner.user.id, from.id);

    const res = await api
      .post('/api/admin/skills/merge')
      .set('Authorization', bearer(admin.token))
      .send({ fromId: from.id, intoId: into.id });

    expect(res.status).toBe(200);
    expect(res.body.moved.teaching).toBe(1);
    expect(res.body.moved.learning).toBe(1);

    // A origem foi removida e os vínculos apontam para o destino.
    expect(await prisma.skill.findUnique({ where: { id: from.id } })).toBeNull();
    expect(
      await prisma.userTeachingSkill.findFirst({ where: { userId: teacher.user.id, skillId: into.id } }),
    ).not.toBeNull();

    // Auditoria registrada.
    const log = await prisma.auditLog.findFirst({ where: { action: 'SKILLS_MERGED' } });
    expect(log).not.toBeNull();
  });

  it('resolve colisões (ensina, aprende e bookmark) quando o usuário já possui ambas', async () => {
    const admin = await makeAdmin();
    const cat = await makeCategory('Idiomas');
    const from = await makeSkill('Ingles', cat.id);
    const into = await makeSkill('Inglês', cat.id);
    const user = await makeUser();
    // O usuário já tem AS DUAS habilidades em cada vínculo com restrição única.
    await addTeaching(user.user.id, from.id);
    await addTeaching(user.user.id, into.id);
    await addLearning(user.user.id, from.id);
    await addLearning(user.user.id, into.id);
    await prisma.savedSkill.create({ data: { userId: user.user.id, skillId: from.id } });
    await prisma.savedSkill.create({ data: { userId: user.user.id, skillId: into.id } });

    const res = await api
      .post('/api/admin/skills/merge')
      .set('Authorization', bearer(admin.token))
      .send({ fromId: from.id, intoId: into.id });
    expect(res.status).toBe(200);

    // Cada vínculo resta exatamente uma vez (os duplicados foram descartados).
    expect(await prisma.userTeachingSkill.count({ where: { userId: user.user.id } })).toBe(1);
    expect(await prisma.userLearningSkill.count({ where: { userId: user.user.id } })).toBe(1);
    expect(await prisma.savedSkill.count({ where: { userId: user.user.id } })).toBe(1);
  });

  it('rejeita mesclar uma habilidade nela mesma (400)', async () => {
    const admin = await makeAdmin();
    const skill = await makeSkill('Única');
    const res = await api
      .post('/api/admin/skills/merge')
      .set('Authorization', bearer(admin.token))
      .send({ fromId: skill.id, intoId: skill.id });
    expect(res.status).toBe(400);
  });

  it('responde 404 quando origem ou destino não existem', async () => {
    const admin = await makeAdmin();
    const skill = await makeSkill('Existe');

    const noFrom = await api
      .post('/api/admin/skills/merge')
      .set('Authorization', bearer(admin.token))
      .send({ fromId: 'nao-existe', intoId: skill.id });
    expect(noFrom.status).toBe(404);

    const noInto = await api
      .post('/api/admin/skills/merge')
      .set('Authorization', bearer(admin.token))
      .send({ fromId: skill.id, intoId: 'nao-existe' });
    expect(noInto.status).toBe(404);
  });
});

describe('GET /api/admin/skills/duplicates', () => {
  it('agrupa habilidades com nomes muito parecidos', async () => {
    const admin = await makeAdmin();
    const cat = await makeCategory('Programação');
    await makeSkill('JavaScript', cat.id);
    await makeSkill('Javascript', cat.id); // erro de digitação
    await makeSkill('Violino', cat.id); // distinta

    const res = await api.get('/api/admin/skills/duplicates').set('Authorization', bearer(admin.token));
    expect(res.status).toBe(200);
    const flat = res.body.groups.flat().map((s: any) => s.name);
    expect(flat).toContain('JavaScript');
    expect(flat).toContain('Javascript');
    expect(flat).not.toContain('Violino');
  });

  it('agrupa variantes separadas alfabeticamente por uma habilidade distinta', async () => {
    const admin = await makeAdmin();
    const cat = await makeCategory('Variados');
    // Ordenadas: "Aulas de Inglês", "Direção", "Inglês" — a distinta no meio
    // exercita o salto de uma habilidade já agrupada durante a varredura.
    await makeSkill('Aulas de Inglês', cat.id);
    await makeSkill('Direção', cat.id);
    await makeSkill('Inglês', cat.id);

    const res = await api.get('/api/admin/skills/duplicates').set('Authorization', bearer(admin.token));
    const flat = res.body.groups.flat().map((s: any) => s.name);
    expect(flat).toContain('Aulas de Inglês');
    expect(flat).toContain('Inglês');
    expect(flat).not.toContain('Direção');
  });
});
