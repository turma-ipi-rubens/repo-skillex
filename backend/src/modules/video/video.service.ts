import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  AppError,
} from '../../utils/errors';
import { emitToRequest } from '../../realtime/realtime';

const TOKEN_TTL_SECONDS = 2 * 60 * 60;

export interface VideoTokenResponse {
  token: string;
  domain: string;
  room: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export async function generateJitsiToken(
  userId: string,
  requestId: string,
): Promise<VideoTokenResponse> {
  if (!env.jitsiAppSecret) {
    throw new AppError('Vídeo chamada indisponível: servidor não configurado', 503);
  }

  const r = await prisma.exchangeRequest.findUnique({
    where: { id: requestId },
    select: { id: true, requesterId: true, recipientId: true, status: true },
  });
  if (!r) throw new NotFoundError('Solicitação não encontrada');
  if (r.requesterId !== userId && r.recipientId !== userId) {
    throw new ForbiddenError('Você não participa desta solicitação');
  }
  if (r.status !== 'ACCEPTED') {
    throw new ConflictError('Sala disponível apenas com troca aceita');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  /* v8 ignore next -- usuário autenticado sempre existe */
  if (!user) throw new NotFoundError('Usuário não encontrado');

  const room = `troca-${r.id}`;
  const now = Math.floor(Date.now() / 1000);

  const token = jwt.sign(
    {
      aud: env.jitsiAppId,
      iss: env.jitsiAppId,
      sub: env.jitsiDomain.split(':')[0],
      room,
      exp: now + TOKEN_TTL_SECONDS,
      nbf: now - 5,
      context: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatarUrl ?? undefined,
          moderator: 'true',
        },
      },
    },
    env.jitsiAppSecret,
    { algorithm: 'HS256' },
  );

  emitToRequest(requestId, 'request:call-started', {
    requestId,
    startedBy: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
  });

  return {
    token,
    domain: env.jitsiDomain,
    room,
    displayName: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  };
}
