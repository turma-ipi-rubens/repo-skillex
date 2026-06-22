import { Request, Response } from 'express';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schemas';
import * as authService from './auth.service';
import { AuthRequest } from '../../middlewares/auth';
import { recordAudit, auditContext } from '../audit/audit.service';

export async function register(req: Request, res: Response): Promise<Response> {
  const data = registerSchema.parse(req.body);
  const result = await authService.register(data);
  await recordAudit({
    ...auditContext(req),
    actorId: result.user.id,
    action: 'AUTH_REGISTER',
    category: 'SECURITY',
    entityType: 'Auth',
    entityId: result.user.id,
    summary: `Nova conta criada (${result.user.email})`,
  });
  return res.status(201).json(result);
}

export async function login(req: Request, res: Response): Promise<Response> {
  const data = loginSchema.parse(req.body);
  try {
    const result = await authService.login(data);
    await recordAudit({
      ...auditContext(req),
      actorId: result.user.id,
      action: 'AUTH_LOGIN',
      category: 'SECURITY',
      entityType: 'Auth',
      entityId: result.user.id,
      summary: `Login realizado (${result.user.email})`,
    });
    return res.json(result);
  } catch (err) {
    await recordAudit({
      ...auditContext(req),
      actorEmail: data.email,
      action: 'AUTH_LOGIN_FAILED',
      category: 'SECURITY',
      entityType: 'Auth',
      summary: `Tentativa de login malsucedida (${data.email})`,
    });
    throw err;
  }
}

export async function me(req: AuthRequest, res: Response): Promise<Response> {
  const user = await authService.getMe(req.userId!);
  return res.json({ user });
}

export async function changePassword(req: AuthRequest, res: Response): Promise<Response> {
  const data = changePasswordSchema.parse(req.body);
  const result = await authService.changePassword(req.userId!, data);
  await recordAudit({
    ...auditContext(req),
    action: 'PASSWORD_CHANGED',
    category: 'SECURITY',
    entityType: 'Auth',
    entityId: req.userId,
    summary: 'Senha alterada pelo próprio usuário',
  });
  return res.json(result);
}

export async function forgotPassword(req: Request, res: Response): Promise<Response> {
  const data = forgotPasswordSchema.parse(req.body);
  const result = await authService.forgotPassword(data);
  await recordAudit({
    ...auditContext(req),
    actorEmail: data.email,
    action: 'PASSWORD_RESET_REQUESTED',
    category: 'SECURITY',
    entityType: 'Auth',
    summary: `Recuperação de senha solicitada (${data.email})`,
  });
  return res.json(result);
}

export async function resetPassword(req: Request, res: Response): Promise<Response> {
  const data = resetPasswordSchema.parse(req.body);
  const result = await authService.resetPassword(data);
  await recordAudit({
    ...auditContext(req),
    actorId: result.userId,
    actorEmail: result.email,
    action: 'PASSWORD_RESET_COMPLETED',
    category: 'SECURITY',
    entityType: 'Auth',
    entityId: result.userId,
    summary: `Senha redefinida via link de recuperação (${result.email})`,
  });
  return res.json({ success: result.success });
}
