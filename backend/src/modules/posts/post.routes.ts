import { Router } from 'express';
import * as postController from './post.controller';
import { asyncHandler } from '../../utils/async-handler';
import { authenticate } from '../../middlewares/auth';
import { upload } from '../../middlewares/upload';

export const postRoutes = Router();

// Criação (texto + imagem opcional) e feed global de publicações
postRoutes.post('/', authenticate, upload.single('image'), asyncHandler(postController.createPost));
postRoutes.get('/', authenticate, asyncHandler(postController.listFeed));

// Ações sobre uma publicação específica
postRoutes.delete('/:id', authenticate, asyncHandler(postController.deletePost));
postRoutes.post('/:id/like', authenticate, asyncHandler(postController.likePost));
postRoutes.delete('/:id/like', authenticate, asyncHandler(postController.unlikePost));

// Comentários
postRoutes.get('/:id/comments', authenticate, asyncHandler(postController.listComments));
postRoutes.post('/:id/comments', authenticate, asyncHandler(postController.addComment));
postRoutes.delete(
  '/:id/comments/:commentId',
  authenticate,
  asyncHandler(postController.deleteComment),
);
