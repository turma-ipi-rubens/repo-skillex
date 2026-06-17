import { Response } from 'express';
import * as videoService from './video.service';
import { AuthRequest } from '../../middlewares/auth';

export async function getToken(req: AuthRequest, res: Response): Promise<Response> {
  return res.json(await videoService.generateJitsiToken(req.userId!, req.params.id));
}
