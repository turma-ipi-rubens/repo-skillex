import { z } from 'zod';

/** Validação dos dados de entrada do módulo de publicações (posts). */

export const createPostSchema = z.object({
  content: z.string().trim().min(1, 'Escreva algo na publicação').max(1000),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Escreva um comentário').max(500),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const listPostsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type ListPostsInput = z.infer<typeof listPostsSchema>;
