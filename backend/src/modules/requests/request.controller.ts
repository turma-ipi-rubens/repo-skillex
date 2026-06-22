import { Response } from 'express';
import * as requestService from './request.service';
import { AuthRequest } from '../../middlewares/auth';
import { recordAudit, auditContext } from '../audit/audit.service';
import { createRequestSchema, sendMessageSchema } from './request.schemas';

/** Registra na auditoria uma mudança de estado de solicitação (categoria CONTENT). */
function auditRequest(req: AuthRequest, request: { id: string }, action: string, label: string): Promise<void> {
  return recordAudit({
    ...auditContext(req),
    action,
    category: 'CONTENT',
    entityType: 'ExchangeRequest',
    entityId: request.id,
    summary: label,
  });
}

export async function create(req: AuthRequest, res: Response): Promise<Response> {
  const data = createRequestSchema.parse(req.body);
  const request = await requestService.createRequest(req.userId!, data);
  await auditRequest(req, request, 'REQUEST_CREATED', 'Criou uma solicitação de troca/aula');
  return res.status(201).json({ request });
}

export async function list(req: AuthRequest, res: Response): Promise<Response> {
  const box = (['sent', 'received', 'all'] as const).includes(req.query.box as any)
    ? (req.query.box as 'sent' | 'received' | 'all')
    : 'all';
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  return res.json(await requestService.listRequests(req.userId!, box, status));
}

export async function detail(req: AuthRequest, res: Response): Promise<Response> {
  return res.json({ request: await requestService.getRequestById(req.userId!, req.params.id) });
}

export async function accept(req: AuthRequest, res: Response): Promise<Response> {
  const request = await requestService.acceptRequest(req.userId!, req.params.id);
  await auditRequest(req, request, 'REQUEST_ACCEPTED', 'Aceitou uma solicitação');
  return res.json({ request });
}

export async function reject(req: AuthRequest, res: Response): Promise<Response> {
  const request = await requestService.rejectRequest(req.userId!, req.params.id);
  await auditRequest(req, request, 'REQUEST_REJECTED', 'Recusou uma solicitação');
  return res.json({ request });
}

export async function cancel(req: AuthRequest, res: Response): Promise<Response> {
  const request = await requestService.cancelRequest(req.userId!, req.params.id);
  await auditRequest(req, request, 'REQUEST_CANCELLED', 'Cancelou uma solicitação');
  return res.json({ request });
}

export async function complete(req: AuthRequest, res: Response): Promise<Response> {
  const request = await requestService.completeRequest(req.userId!, req.params.id);
  await auditRequest(req, request, 'REQUEST_COMPLETED', 'Concluiu uma solicitação');
  return res.json({ request });
}

export async function listMessages(req: AuthRequest, res: Response): Promise<Response> {
  return res.json(await requestService.listMessages(req.userId!, req.params.id));
}

export async function sendMessage(req: AuthRequest, res: Response): Promise<Response> {
  const { content } = sendMessageSchema.parse(req.body);
  return res
    .status(201)
    .json({ message: await requestService.sendMessage(req.userId!, req.params.id, content) });
}
