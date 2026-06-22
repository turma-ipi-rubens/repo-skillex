import { Request, Response } from 'express';
import * as reviewService from './review.service';
import { AuthRequest } from '../../middlewares/auth';
import { recordAudit, auditContext } from '../audit/audit.service';
import { createReviewSchema } from './review.schemas';

export async function create(req: AuthRequest, res: Response): Promise<Response> {
  const data = createReviewSchema.parse(req.body);
  const review = await reviewService.createReview(req.userId!, data);
  await recordAudit({
    ...auditContext(req),
    action: 'REVIEW_CREATED',
    category: 'CONTENT',
    entityType: 'Review',
    entityId: review.id,
    summary: `Avaliou uma troca/aula com ${data.rating} estrela(s)`,
    metadata: { rating: data.rating, requestId: data.requestId },
  });
  return res.status(201).json({ review });
}

export async function listForUser(req: Request, res: Response): Promise<Response> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  return res.json(await reviewService.listUserReviews(req.params.userId, page, limit));
}
