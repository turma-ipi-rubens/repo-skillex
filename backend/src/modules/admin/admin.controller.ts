import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth';
import * as adminService from './admin.service';
import { recordAudit, auditContext, listAuditLogs, getAuditMeta } from '../audit/audit.service';
import {
  listUsersSchema,
  setUserStatusSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  skillCreateSchema,
  skillUpdateSchema,
  mergeSkillsSchema,
  listAuditSchema,
} from './admin.schemas';

export async function listUsers(req: AuthRequest, res: Response): Promise<Response> {
  const filters = listUsersSchema.parse(req.query);
  return res.json(await adminService.listUsers(filters));
}

export async function setUserStatus(req: AuthRequest, res: Response): Promise<Response> {
  const { isActive } = setUserStatusSchema.parse(req.body);
  const result = await adminService.setUserStatus(req.userId!, req.params.id, isActive);
  await recordAudit({
    ...auditContext(req),
    action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    category: 'ADMIN',
    entityType: 'User',
    entityId: result.user.id,
    summary: `${isActive ? 'Reativou' : 'Desativou'} a conta de ${result.user.name}`,
    metadata: { email: result.user.email, isActive },
  });
  return res.json(result);
}

export async function createCategory(req: AuthRequest, res: Response): Promise<Response> {
  const data = categoryCreateSchema.parse(req.body);
  const result = await adminService.createCategory(data);
  await recordAudit({
    ...auditContext(req),
    action: 'CATEGORY_CREATED',
    category: 'ADMIN',
    entityType: 'Category',
    entityId: result.category.id,
    summary: `Criou a categoria "${result.category.name}"`,
  });
  return res.status(201).json(result);
}

export async function updateCategory(req: AuthRequest, res: Response): Promise<Response> {
  const data = categoryUpdateSchema.parse(req.body);
  const result = await adminService.updateCategory(req.params.id, data);
  await recordAudit({
    ...auditContext(req),
    action: 'CATEGORY_UPDATED',
    category: 'ADMIN',
    entityType: 'Category',
    entityId: result.category.id,
    summary: `Editou a categoria "${result.category.name}"`,
    metadata: { changes: data },
  });
  return res.json(result);
}

export async function deleteCategory(req: AuthRequest, res: Response): Promise<Response> {
  const result = await adminService.deleteCategory(req.params.id);
  await recordAudit({
    ...auditContext(req),
    action: 'CATEGORY_DELETED',
    category: 'ADMIN',
    entityType: 'Category',
    entityId: req.params.id,
    summary: `Excluiu uma categoria (${req.params.id})`,
  });
  return res.json(result);
}

export async function createSkill(req: AuthRequest, res: Response): Promise<Response> {
  const data = skillCreateSchema.parse(req.body);
  const result = await adminService.createSkill(data);
  await recordAudit({
    ...auditContext(req),
    action: 'SKILL_CREATED',
    category: 'ADMIN',
    entityType: 'Skill',
    entityId: result.skill.id,
    summary: `Criou a habilidade "${result.skill.name}"`,
  });
  return res.status(201).json(result);
}

export async function updateSkill(req: AuthRequest, res: Response): Promise<Response> {
  const data = skillUpdateSchema.parse(req.body);
  const result = await adminService.updateSkill(req.params.id, data);
  await recordAudit({
    ...auditContext(req),
    action: 'SKILL_UPDATED',
    category: 'ADMIN',
    entityType: 'Skill',
    entityId: result.skill.id,
    summary: `Editou a habilidade "${result.skill.name}"`,
    metadata: { changes: data },
  });
  return res.json(result);
}

export async function deleteSkill(req: AuthRequest, res: Response): Promise<Response> {
  const result = await adminService.deleteSkill(req.params.id);
  await recordAudit({
    ...auditContext(req),
    action: 'SKILL_DELETED',
    category: 'ADMIN',
    entityType: 'Skill',
    entityId: req.params.id,
    summary: `Excluiu uma habilidade (${req.params.id})`,
  });
  return res.json(result);
}

export async function mergeSkills(req: AuthRequest, res: Response): Promise<Response> {
  const data = mergeSkillsSchema.parse(req.body);
  const result = await adminService.mergeSkills(data);
  await recordAudit({
    ...auditContext(req),
    action: 'SKILLS_MERGED',
    category: 'ADMIN',
    entityType: 'Skill',
    entityId: result.into.id,
    summary: `Mesclou a habilidade "${result.from.name}" em "${result.into.name}"`,
    metadata: { from: result.from, into: result.into, moved: result.moved },
  });
  return res.json(result);
}

export async function listDuplicateSkills(_req: AuthRequest, res: Response): Promise<Response> {
  return res.json(await adminService.findDuplicateSkillGroups());
}

export async function listAudit(req: AuthRequest, res: Response): Promise<Response> {
  const filters = listAuditSchema.parse(req.query);
  return res.json(await listAuditLogs(filters));
}

export async function auditMeta(_req: AuthRequest, res: Response): Promise<Response> {
  return res.json(await getAuditMeta());
}
