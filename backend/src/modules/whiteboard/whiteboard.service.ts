import { prisma } from '../../config/prisma';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { emitToRequest } from '../../realtime/realtime';
import { ensureParticipant } from '../requests/request.service';
import { AddStrokeInput } from './whiteboard.schemas';

/**
 * Quadro colaborativo da troca aceita: persiste traços e ecoa para a room
 * `request:<id>` (atalho de tempo real já validado pelo `request:join`).
 *
 * Estratégia em duas camadas (documentada no plano da feature):
 * - `whiteboard:live` é um relay puro feito no socket-server (sem hit no banco),
 *   garante latência baixíssima enquanto a pessoa está desenhando.
 * - Estes endpoints persistem o resultado final e propagam o estado consolidado,
 *   permitindo F5 / reconexão sem perder o conteúdo.
 */

function presentStroke(s: {
  id: string;
  requestId: string;
  authorId: string;
  tool: string;
  color: string;
  size: number;
  points: string;
  text: string | null;
  pageIndex: number;
  createdAt: Date;
}) {
  return {
    id: s.id,
    requestId: s.requestId,
    authorId: s.authorId,
    tool: s.tool,
    color: s.color,
    size: s.size,
    points: JSON.parse(s.points) as Array<[number, number]>,
    text: s.text,
    pageIndex: s.pageIndex,
    createdAt: s.createdAt,
  };
}

function ensureBoardOpen(status: string) {
  if (status !== 'ACCEPTED' && status !== 'COMPLETED') {
    throw new BadRequestError(
      'O quadro colaborativo fica disponível após a solicitação ser aceita',
    );
  }
}

export async function listStrokes(userId: string, requestId: string) {
  await ensureParticipant(requestId, userId);
  const strokes = await prisma.whiteboardStroke.findMany({
    where: { requestId },
    orderBy: { createdAt: 'asc' },
  });
  return { items: strokes.map(presentStroke) };
}

export async function addStroke(
  userId: string,
  requestId: string,
  data: AddStrokeInput,
) {
  const r = await ensureParticipant(requestId, userId);
  ensureBoardOpen(r.status);

  const created = await prisma.whiteboardStroke.create({
    data: {
      requestId,
      authorId: userId,
      tool: data.tool,
      color: data.color,
      size: data.size,
      points: JSON.stringify(data.points),
      text: data.tool === 'TEXT' ? data.text ?? null : null,
      pageIndex: data.pageIndex,
    },
  });

  const stroke = presentStroke(created);
  emitToRequest(requestId, 'whiteboard:stroke', stroke);
  return stroke;
}

export async function undoLast(userId: string, requestId: string) {
  const r = await ensureParticipant(requestId, userId);
  ensureBoardOpen(r.status);

  const last = await prisma.whiteboardStroke.findFirst({
    where: { requestId, authorId: userId },
    orderBy: { createdAt: 'desc' },
  });
  if (!last) {
    throw new NotFoundError('Nada para desfazer');
  }
  await prisma.whiteboardStroke.delete({ where: { id: last.id } });

  const payload = { strokeId: last.id, authorId: userId };
  emitToRequest(requestId, 'whiteboard:undo', payload);
  return payload;
}

export async function clear(userId: string, requestId: string) {
  const r = await ensureParticipant(requestId, userId);
  ensureBoardOpen(r.status);

  const result = await prisma.whiteboardStroke.deleteMany({ where: { requestId } });
  const payload = { clearedBy: userId, removed: result.count };
  emitToRequest(requestId, 'whiteboard:clear', payload);
  return payload;
}
