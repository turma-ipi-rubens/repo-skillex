import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { AuthRequest } from '../../middlewares/auth';

/**
 * ============================================================================
 *  AUDITORIA (AUDIT LOGS)
 * ----------------------------------------------------------------------------
 *  Trilha de ações relevantes da plataforma, dividida em três categorias:
 *    • ADMIN    — ações do painel administrativo
 *    • SECURITY — eventos de segurança (login, reset de senha, exclusão)
 *    • CONTENT  — ações de conteúdo dos usuários (solicitações, avaliações...)
 *
 *  Princípio: registrar NUNCA pode quebrar a ação principal. Por isso o
 *  `recordAudit` engole erros (apenas loga no console) — uma falha ao auditar
 *  não deve impedir um login, uma troca ou uma moderação de acontecer.
 * ============================================================================
 */

export type AuditCategory = 'ADMIN' | 'SECURITY' | 'CONTENT';

export interface AuditContext {
  actorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface RecordAuditInput extends AuditContext {
  action: string;
  category: AuditCategory;
  entityType?: string | null;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Nome/e-mail do ator quando ele ainda não está autenticado (ex.: login). */
  actorName?: string | null;
  actorEmail?: string | null;
}

/** Extrai o contexto de auditoria (ator + origem) de uma requisição. */
export function auditContext(req: AuthRequest | Request): AuditContext {
  const authReq = req as AuthRequest;
  return {
    actorId: authReq.userId ?? null,
    ip: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

/**
 * Registra um evento de auditoria. Resiliente: se algo falhar (banco fora do
 * ar, etc.), apenas loga e segue — a ação principal não é afetada.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    let actorName = input.actorName ?? null;
    let actorEmail = input.actorEmail ?? null;

    // Fotografa nome/e-mail do ator autenticado (sobrevive à exclusão da conta).
    if (input.actorId && !actorName && !actorEmail) {
      const actor = await prisma.user.findUnique({
        where: { id: input.actorId },
        select: { name: true, email: true },
      });
      if (actor) {
        actorName = actor.name;
        actorEmail = actor.email;
      }
    }

    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorName,
        actorEmail,
        action: input.action,
        category: input.category,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    // Nunca propaga: auditoria é "best effort".
    console.error('[audit] falha ao registrar evento', input.action, err);
  }
}

export interface ListAuditInput {
  q?: string;
  action?: string;
  category?: string;
  actorId?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

/** Lista registros de auditoria com filtros e paginação (mais recentes 1º). */
export async function listAuditLogs(f: ListAuditInput) {
  const where: any = {};

  if (f.action) where.action = f.action;
  if (f.category) where.category = f.category;
  if (f.actorId) where.actorId = f.actorId;

  if (f.from || f.to) {
    where.createdAt = {};
    if (f.from) where.createdAt.gte = new Date(f.from);
    if (f.to) where.createdAt.lte = new Date(f.to);
  }

  if (f.q) {
    where.OR = [
      { summary: { contains: f.q } },
      { actorName: { contains: f.q } },
      { actorEmail: { contains: f.q } },
      { action: { contains: f.q } },
      { entityId: { contains: f.q } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (f.page - 1) * f.limit,
      take: f.limit,
    }),
  ]);

  return {
    items: items.map((log) => ({
      ...log,
      metadata: log.metadata ? safeParse(log.metadata) : null,
    })),
    total,
    page: f.page,
    limit: f.limit,
    hasMore: f.page * f.limit < total,
  };
}

/** Converte o JSON de metadata; em caso de valor inválido, devolve o texto. */
function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Listas distintas de ações/categorias presentes — para popular filtros. */
export async function getAuditMeta() {
  const [actions, categories] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
    prisma.auditLog.findMany({ distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } }),
  ]);
  return {
    actions: actions.map((a) => a.action),
    categories: categories.map((c) => c.category),
  };
}
