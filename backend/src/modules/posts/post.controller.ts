import { Response } from 'express';
import * as postService from './post.service';
import { AuthRequest } from '../../middlewares/auth';
import { createPostSchema, createCommentSchema, listPostsSchema } from './post.schemas';

export async function createPost(req: AuthRequest, res: Response): Promise<Response> {
  const { content } = createPostSchema.parse(req.body);
  const post = await postService.createPost(req.userId!, content, req.file?.filename);
  return res.status(201).json({ post });
}

export async function listFeed(req: AuthRequest, res: Response): Promise<Response> {
  const { page, limit } = listPostsSchema.parse(req.query);
  return res.json(await postService.listFeed(req.userId!, { page, limit }));
}

export async function listByUser(req: AuthRequest, res: Response): Promise<Response> {
  const { page, limit } = listPostsSchema.parse(req.query);
  return res.json(await postService.listByUser(req.userId!, req.params.id, { page, limit }));
}

export async function deletePost(req: AuthRequest, res: Response): Promise<Response> {
  return res.json(await postService.deletePost(req.userId!, req.userRole, req.params.id));
}

export async function likePost(req: AuthRequest, res: Response): Promise<Response> {
  return res.json(await postService.likePost(req.userId!, req.params.id));
}

export async function unlikePost(req: AuthRequest, res: Response): Promise<Response> {
  return res.json(await postService.unlikePost(req.userId!, req.params.id));
}

export async function listComments(req: AuthRequest, res: Response): Promise<Response> {
  return res.json(await postService.listComments(req.userId!, req.params.id));
}

export async function addComment(req: AuthRequest, res: Response): Promise<Response> {
  const { content } = createCommentSchema.parse(req.body);
  const comment = await postService.addComment(req.userId!, req.params.id, content);
  return res.status(201).json({ comment });
}

export async function deleteComment(req: AuthRequest, res: Response): Promise<Response> {
  return res.json(
    await postService.deleteComment(req.userId!, req.userRole, req.params.id, req.params.commentId),
  );
}
