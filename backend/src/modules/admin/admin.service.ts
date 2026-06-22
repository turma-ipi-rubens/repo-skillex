import { prisma } from '../../config/prisma';
import { slugify } from '../../utils/slug';
import { rankByFuzzy, similarity } from '../../utils/fuzzy';
import { FUZZY_SEARCH_THRESHOLD, FUZZY_DUPLICATE_THRESHOLD } from '../../utils/constants';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors';
import {
  ListUsersInput,
  CategoryCreateInput,
  CategoryUpdateInput,
  SkillCreateInput,
  SkillUpdateInput,
  MergeSkillsInput,
} from './admin.schemas';

// ---------------------------------------------------------------------------
//  Usuários
// ---------------------------------------------------------------------------

const ADMIN_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  city: true,
  state: true,
  avatarUrl: true,
  isActive: true,
  onboardingCompleted: true,
  createdAt: true,
} as const;

/** Lista usuários da plataforma com busca por nome/e-mail e paginação. */
export async function listUsers(f: ListUsersInput) {
  const term = f.q?.trim();

  // Sem busca: paginação eficiente direto no banco.
  if (!term) {
    const [total, users] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        select: ADMIN_USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (f.page - 1) * f.limit,
        take: f.limit,
      }),
    ]);
    return { items: users, total, page: f.page, limit: f.limit, hasMore: f.page * f.limit < total };
  }

  // Com busca: correspondência aproximada (fuzzy) sobre nome + e-mail, em
  // memória, tolerando acento/caixa/erro de digitação. Pagina o ranking.
  const pool = await prisma.user.findMany({
    select: ADMIN_USER_SELECT,
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  const ranked = rankByFuzzy(pool, term, (u) => `${u.name} ${u.email}`, {
    threshold: FUZZY_SEARCH_THRESHOLD,
  }).map((r) => r.item);

  const total = ranked.length;
  const start = (f.page - 1) * f.limit;
  const items = ranked.slice(start, start + f.limit);
  return { items, total, page: f.page, limit: f.limit, hasMore: start + f.limit < total };
}

/** Ativa/desativa a conta de um usuário (admin não pode se autodesativar). */
export async function setUserStatus(adminId: string, targetId: string, isActive: boolean) {
  if (adminId === targetId) {
    throw new BadRequestError('Você não pode desativar a própria conta de administrador');
  }
  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) throw new NotFoundError('Usuário não encontrado');

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { isActive },
    select: { id: true, name: true, email: true, isActive: true },
  });
  return { user: updated };
}

// ---------------------------------------------------------------------------
//  Categorias
// ---------------------------------------------------------------------------

async function ensureCategoryNameFree(name: string, exceptId?: string) {
  const slug = slugify(name);
  const existing = await prisma.category.findFirst({
    where: { OR: [{ name }, { slug }], NOT: exceptId ? { id: exceptId } : undefined },
  });
  if (existing) throw new ConflictError('Já existe uma categoria com este nome');
  return slug;
}

export async function createCategory(input: CategoryCreateInput) {
  const slug = await ensureCategoryNameFree(input.name);
  const category = await prisma.category.create({
    data: { name: input.name, slug, icon: input.icon, color: input.color },
  });
  return { category };
}

export async function updateCategory(id: string, input: CategoryUpdateInput) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new NotFoundError('Categoria não encontrada');

  let slug: string | undefined;
  if (input.name && input.name !== category.name) {
    slug = await ensureCategoryNameFree(input.name, id);
  }

  const updated = await prisma.category.update({
    where: { id },
    data: { name: input.name, slug, icon: input.icon, color: input.color },
  });
  return { category: updated };
}

export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { skills: true } } },
  });
  if (!category) throw new NotFoundError('Categoria não encontrada');
  if (category._count.skills > 0) {
    throw new ConflictError(
      `A categoria possui ${category._count.skills} habilidade(s). Remova-as ou mova-as antes de excluir.`,
    );
  }
  await prisma.category.delete({ where: { id } });
  return { success: true };
}

// ---------------------------------------------------------------------------
//  Habilidades (catálogo)
// ---------------------------------------------------------------------------

async function ensureSkillNameFree(name: string, exceptId?: string) {
  const slug = slugify(name);
  const existing = await prisma.skill.findFirst({
    where: { OR: [{ name }, { slug }], NOT: exceptId ? { id: exceptId } : undefined },
  });
  if (existing) throw new ConflictError('Já existe uma habilidade com este nome');
  return slug;
}

export async function createSkill(input: SkillCreateInput) {
  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new NotFoundError('Categoria não encontrada');

  const slug = await ensureSkillNameFree(input.name);
  const skill = await prisma.skill.create({
    data: { name: input.name, slug, categoryId: input.categoryId },
    include: { category: true },
  });
  return { skill };
}

export async function updateSkill(id: string, input: SkillUpdateInput) {
  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) throw new NotFoundError('Habilidade não encontrada');

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new NotFoundError('Categoria não encontrada');
  }

  let slug: string | undefined;
  if (input.name && input.name !== skill.name) {
    slug = await ensureSkillNameFree(input.name, id);
  }

  const updated = await prisma.skill.update({
    where: { id },
    data: { name: input.name, slug, categoryId: input.categoryId },
    include: { category: true },
  });
  return { skill: updated };
}

export async function deleteSkill(id: string) {
  const skill = await prisma.skill.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          teachingLinks: true,
          learningLinks: true,
          requestedIn: true,
          offeredIn: true,
          reviews: true,
        },
      },
    },
  });
  if (!skill) throw new NotFoundError('Habilidade não encontrada');

  const c = skill._count;
  const inUse = c.teachingLinks + c.learningLinks + c.requestedIn + c.offeredIn + c.reviews;
  if (inUse > 0) {
    throw new ConflictError(
      'Esta habilidade está em uso (perfis, solicitações ou avaliações) e não pode ser excluída.',
    );
  }

  // savedBy tem onDelete: Cascade no schema — bookmarks caem junto.
  await prisma.skill.delete({ where: { id } });
  return { success: true };
}

/**
 * Mescla a habilidade `fromId` na `intoId`: move todos os vínculos (ensina,
 * aprende, solicitações, avaliações, bookmarks) para a de destino e remove a
 * duplicata. Resolve a unificação de habilidades quase-iguais ("Programação
 * JavaScript" → "JavaScript") que o cadastro livre cria. Colisões de unicidade
 * (o usuário já tinha as duas) são resolvidas descartando o vínculo redundante.
 */
export async function mergeSkills(input: MergeSkillsInput) {
  if (input.fromId === input.intoId) {
    throw new BadRequestError('Selecione duas habilidades diferentes para mesclar');
  }

  const [from, into] = await Promise.all([
    prisma.skill.findUnique({ where: { id: input.fromId } }),
    prisma.skill.findUnique({ where: { id: input.intoId } }),
  ]);
  if (!from) throw new NotFoundError('Habilidade de origem não encontrada');
  if (!into) throw new NotFoundError('Habilidade de destino não encontrada');

  const moved = await prisma.$transaction(async (tx) => {
    // Ensina/aprende/bookmark têm @@unique([userId, skillId]): remove o vínculo
    // da origem quando o usuário JÁ possui o de destino, depois reaponta o resto.
    const teachDup = await tx.userTeachingSkill.findMany({
      where: { skillId: from.id, user: { teachingSkills: { some: { skillId: into.id } } } },
      select: { id: true },
    });
    if (teachDup.length) {
      await tx.userTeachingSkill.deleteMany({ where: { id: { in: teachDup.map((d) => d.id) } } });
    }
    const teaching = await tx.userTeachingSkill.updateMany({
      where: { skillId: from.id },
      data: { skillId: into.id },
    });

    const learnDup = await tx.userLearningSkill.findMany({
      where: { skillId: from.id, user: { learningSkills: { some: { skillId: into.id } } } },
      select: { id: true },
    });
    if (learnDup.length) {
      await tx.userLearningSkill.deleteMany({ where: { id: { in: learnDup.map((d) => d.id) } } });
    }
    const learning = await tx.userLearningSkill.updateMany({
      where: { skillId: from.id },
      data: { skillId: into.id },
    });

    const savedDup = await tx.savedSkill.findMany({
      where: { skillId: from.id, user: { savedSkills: { some: { skillId: into.id } } } },
      select: { id: true },
    });
    if (savedDup.length) {
      await tx.savedSkill.deleteMany({ where: { id: { in: savedDup.map((d) => d.id) } } });
    }
    const saved = await tx.savedSkill.updateMany({
      where: { skillId: from.id },
      data: { skillId: into.id },
    });

    // Solicitações e avaliações não têm restrição de unicidade por skill.
    const requested = await tx.exchangeRequest.updateMany({
      where: { requestedSkillId: from.id },
      data: { requestedSkillId: into.id },
    });
    const offered = await tx.exchangeRequest.updateMany({
      where: { offeredSkillId: from.id },
      data: { offeredSkillId: into.id },
    });
    const reviews = await tx.review.updateMany({
      where: { skillId: from.id },
      data: { skillId: into.id },
    });

    await tx.skill.delete({ where: { id: from.id } });

    return {
      teaching: teaching.count,
      learning: learning.count,
      saved: saved.count,
      requested: requested.count,
      offered: offered.count,
      reviews: reviews.count,
    };
  });

  return {
    from: { id: from.id, name: from.name },
    into: { id: into.id, name: into.name },
    moved,
  };
}

/**
 * Agrupa habilidades do catálogo com nomes muito parecidos (acento, caixa,
 * digitação ou variações), sugerindo candidatas a mesclagem. Cada item do
 * grupo traz a demanda (oferta + procura) para ajudar a escolher a canônica.
 */
export async function findDuplicateSkillGroups() {
  const skills = await prisma.skill.findMany({
    include: {
      category: true,
      _count: { select: { teachingLinks: true, learningLinks: true } },
    },
    orderBy: { name: 'asc' },
  });

  const present = (s: (typeof skills)[number]) => ({
    id: s.id,
    name: s.name,
    category: s.category.name, // relação obrigatória → sempre presente
    teachersCount: s._count.teachingLinks,
    learnersCount: s._count.learningLinks,
  });

  const used = new Set<string>();
  const groups: ReturnType<typeof present>[][] = [];

  for (let i = 0; i < skills.length; i++) {
    if (used.has(skills[i].id)) continue;
    const group = [skills[i]];
    for (let j = i + 1; j < skills.length; j++) {
      if (used.has(skills[j].id)) continue;
      if (similarity(skills[i].name, skills[j].name) >= FUZZY_DUPLICATE_THRESHOLD) {
        group.push(skills[j]);
        used.add(skills[j].id);
      }
    }
    if (group.length > 1) {
      used.add(skills[i].id);
      groups.push(group.map(present));
    }
  }

  return { groups };
}
