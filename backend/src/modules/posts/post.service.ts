import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { presentPost, presentComment } from './post.presenter';

interface PageOptions {
  page: number;
  limit: number;
}

/**
 * Include padrão de um post: autor, contagem de curtidas/comentários e a
 * curtida do próprio viewer (filtrada para retornar 0 ou 1 registro).
 */
function postInclude(viewerId: string) {
  return {
    author: { select: { id: true, name: true, avatarUrl: true } },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId: viewerId }, select: { id: true } },
  };
}

const authorSelect = { author: { select: { id: true, name: true, avatarUrl: true } } };

/** Remove o arquivo físico da imagem de um post (falha não é crítica). */
async function removeImageFile(imageUrl: string | null) {
  if (!imageUrl) return;
  const file = path.resolve(process.cwd(), env.uploadDir, path.basename(imageUrl));
  await fs.promises.rm(file, { force: true }).catch(() => {});
}

export async function createPost(authorId: string, content: string, imageFilename?: string) {
  const post = await prisma.post.create({
    data: {
      authorId,
      content,
      imageUrl: imageFilename ? `/uploads/${imageFilename}` : null,
    },
    include: postInclude(authorId),
  });
  return presentPost(post, authorId);
}

export async function deletePost(userId: string, role: string | undefined, postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('Publicação não encontrada');
  if (post.authorId !== userId && role !== 'ADMIN') {
    throw new ForbiddenError('Você não pode excluir esta publicação');
  }
  await prisma.post.delete({ where: { id: postId } });
  await removeImageFile(post.imageUrl);
  return { success: true };
}

/** Feed global de publicações (mais recentes primeiro), apenas de contas ativas. */
export async function listFeed(viewerId: string, opts: PageOptions) {
  const where = { author: { isActive: true } };
  const [total, posts] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      include: postInclude(viewerId),
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
  ]);
  return {
    items: posts.map((p) => presentPost(p, viewerId)),
    page: opts.page,
    limit: opts.limit,
    total,
    hasMore: opts.page * opts.limit < total,
  };
}

/** Publicações de um usuário específico (perfil). */
export async function listByUser(viewerId: string, targetId: string, opts: PageOptions) {
  const where = { authorId: targetId };
  const [total, posts] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      include: postInclude(viewerId),
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
  ]);
  return {
    items: posts.map((p) => presentPost(p, viewerId)),
    page: opts.page,
    limit: opts.limit,
    total,
    hasMore: opts.page * opts.limit < total,
  };
}

export async function likePost(userId: string, postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('Publicação não encontrada');
  await prisma.postLike.upsert({
    where: { postId_userId: { postId, userId } },
    update: {},
    create: { postId, userId },
  });
  const likeCount = await prisma.postLike.count({ where: { postId } });
  return { success: true, liked: true, likeCount };
}

export async function unlikePost(userId: string, postId: string) {
  await prisma.postLike.deleteMany({ where: { postId, userId } });
  const likeCount = await prisma.postLike.count({ where: { postId } });
  return { success: true, liked: false, likeCount };
}

export async function listComments(viewerId: string, postId: string) {
  const comments = await prisma.postComment.findMany({
    where: { postId },
    include: authorSelect,
    orderBy: { createdAt: 'asc' },
  });
  return { items: comments.map((c) => presentComment(c, viewerId)) };
}

export async function addComment(authorId: string, postId: string, content: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('Publicação não encontrada');
  const comment = await prisma.postComment.create({
    data: { postId, authorId, content },
    include: authorSelect,
  });
  return presentComment(comment, authorId);
}

export async function deleteComment(
  userId: string,
  role: string | undefined,
  postId: string,
  commentId: string,
) {
  const comment = await prisma.postComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.postId !== postId) {
    throw new NotFoundError('Comentário não encontrado');
  }
  if (comment.authorId !== userId && role !== 'ADMIN') {
    throw new ForbiddenError('Você não pode excluir este comentário');
  }
  await prisma.postComment.delete({ where: { id: commentId } });
  return { success: true };
}
