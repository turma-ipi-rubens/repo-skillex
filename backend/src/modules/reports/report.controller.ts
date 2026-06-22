import { Response } from 'express';
import * as reportService from './report.service';
import { AuthRequest } from '../../middlewares/auth';
import { recordAudit, auditContext } from '../audit/audit.service';
import { createReportSchema, resolveReportSchema } from './report.schemas';

export async function create(req: AuthRequest, res: Response): Promise<Response> {
  const data = createReportSchema.parse(req.body);
  const report = await reportService.createReport(req.userId!, data);
  await recordAudit({
    ...auditContext(req),
    action: 'REPORT_CREATED',
    category: 'CONTENT',
    entityType: 'Report',
    entityId: report.id,
    summary: `Registrou uma denúncia (${data.type})`,
    metadata: { type: data.type, targetId: data.targetId, requestId: data.requestId },
  });
  return res.status(201).json({ report });
}

export async function listAdmin(req: AuthRequest, res: Response): Promise<Response> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));
  const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
  return res.json(await reportService.listReports({ status, page, limit }));
}

export async function resolve(req: AuthRequest, res: Response): Promise<Response> {
  const data = resolveReportSchema.parse(req.body);
  const report = await reportService.resolveReport(req.params.id, req.userId!, data);
  await recordAudit({
    ...auditContext(req),
    action: 'REPORT_MODERATED',
    category: 'ADMIN',
    entityType: 'Report',
    entityId: report.id,
    summary: `Atualizou uma denúncia para "${report.status}"`,
    metadata: { status: report.status, adminNote: data.adminNote },
  });
  return res.json({ report });
}

export async function listMine(req: AuthRequest, res: Response): Promise<Response> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  return res.json(await reportService.getUserReports(req.userId!, page, limit));
}
