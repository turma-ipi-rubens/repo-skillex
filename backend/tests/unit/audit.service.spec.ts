import { describe, it, expect, vi, afterEach } from 'vitest';
import { prisma } from '../../src/config/prisma';
import {
  recordAudit,
  listAuditLogs,
  auditContext,
} from '../../src/modules/audit/audit.service';

afterEach(() => vi.restoreAllMocks());

describe('recordAudit', () => {
  it('engole erros sem propagar (auditoria é best effort)', async () => {
    vi.spyOn(prisma.auditLog, 'create').mockRejectedValueOnce(new Error('boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      recordAudit({ action: 'X', category: 'ADMIN' }),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
  });

  it('usa actorName/actorEmail informados sem consultar o banco', async () => {
    const user = await prisma.user.create({
      data: { name: 'Verdadeiro', email: 'verdadeiro@test.com', passwordHash: 'x' },
    });
    const findSpy = vi.spyOn(prisma.user, 'findUnique');
    await recordAudit({
      action: 'AUTH_LOGIN',
      category: 'SECURITY',
      actorId: user.id,
      actorName: 'Nome Fixo',
      actorEmail: 'fixo@test.com',
    });
    expect(findSpy).not.toHaveBeenCalled();
    const log = await prisma.auditLog.findFirst({ where: { action: 'AUTH_LOGIN' } });
    expect(log?.actorName).toBe('Nome Fixo'); // valor informado, não o do banco
  });

  it('não quebra quando o ator informado não existe (snapshot vazio)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // actorId inexistente: a consulta retorna null e a criação falha por FK,
    // mas recordAudit engole o erro silenciosamente.
    await expect(
      recordAudit({ action: 'GHOST', category: 'ADMIN', actorId: 'inexistente' }),
    ).resolves.toBeUndefined();
    expect(await prisma.auditLog.findFirst({ where: { action: 'GHOST' } })).toBeNull();
  });

  it('fotografa nome/e-mail do ator autenticado a partir do banco', async () => {
    const user = await prisma.user.create({
      data: { name: 'Ator', email: 'ator@test.com', passwordHash: 'x' },
    });
    await recordAudit({ action: 'USER_DEACTIVATED', category: 'ADMIN', actorId: user.id });
    const log = await prisma.auditLog.findFirst({ where: { action: 'USER_DEACTIVATED' } });
    expect(log?.actorName).toBe('Ator');
    expect(log?.actorEmail).toBe('ator@test.com');
  });
});

describe('listAuditLogs', () => {
  it('devolve o metadata bruto quando não é JSON válido', async () => {
    await prisma.auditLog.create({
      data: { action: 'RAW', category: 'ADMIN', metadata: 'nao-e-json{' },
    });
    const res = await listAuditLogs({ page: 1, limit: 10 });
    expect(res.items[0].metadata).toBe('nao-e-json{');
  });

  it('mantém metadata nula quando ausente', async () => {
    await prisma.auditLog.create({ data: { action: 'SEM_META', category: 'ADMIN' } });
    const res = await listAuditLogs({ page: 1, limit: 10 });
    expect(res.items[0].metadata).toBeNull();
  });

  it('filtra por "to" (limite superior de data) isoladamente', async () => {
    await prisma.auditLog.create({ data: { action: 'A', category: 'ADMIN' } });
    const past = new Date(Date.now() - 86400000).toISOString();
    const res = await listAuditLogs({ page: 1, limit: 10, to: past });
    expect(res.total).toBe(0);
  });
});

describe('auditContext', () => {
  it('extrai ator e origem da requisição', () => {
    const ctx = auditContext({
      userId: 'u1',
      ip: '1.2.3.4',
      headers: { 'user-agent': 'vitest' },
    } as any);
    expect(ctx).toEqual({ actorId: 'u1', ip: '1.2.3.4', userAgent: 'vitest' });
  });

  it('usa null quando faltam dados', () => {
    const ctx = auditContext({ headers: {} } as any);
    expect(ctx).toEqual({ actorId: null, ip: null, userAgent: null });
  });
});
