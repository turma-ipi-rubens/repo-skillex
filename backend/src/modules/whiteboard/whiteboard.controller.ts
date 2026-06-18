import { Response } from 'express';
import * as whiteboardService from './whiteboard.service';
import { AuthRequest } from '../../middlewares/auth';
import { addStrokeSchema } from './whiteboard.schemas';

export async function list(req: AuthRequest, res: Response): Promise<Response> {
  return res.json(await whiteboardService.listStrokes(req.userId!, req.params.id));
}

export async function add(req: AuthRequest, res: Response): Promise<Response> {
  const data = addStrokeSchema.parse(req.body);
  return res
    .status(201)
    .json({ stroke: await whiteboardService.addStroke(req.userId!, req.params.id, data) });
}

export async function undo(req: AuthRequest, res: Response): Promise<Response> {
  return res.json(await whiteboardService.undoLast(req.userId!, req.params.id));
}

export async function clear(req: AuthRequest, res: Response): Promise<Response> {
  return res.json(await whiteboardService.clear(req.userId!, req.params.id));
}
