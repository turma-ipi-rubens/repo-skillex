import { Router } from 'express';
import * as requestController from './request.controller';
import * as videoController from '../video/video.controller';
import * as whiteboardController from '../whiteboard/whiteboard.controller';
import { asyncHandler } from '../../utils/async-handler';
import { authenticate } from '../../middlewares/auth';

export const requestRoutes = Router();

requestRoutes.use(authenticate);

requestRoutes.post('/', asyncHandler(requestController.create));
requestRoutes.get('/', asyncHandler(requestController.list));
requestRoutes.get('/:id', asyncHandler(requestController.detail));
requestRoutes.post('/:id/accept', asyncHandler(requestController.accept));
requestRoutes.post('/:id/reject', asyncHandler(requestController.reject));
requestRoutes.post('/:id/cancel', asyncHandler(requestController.cancel));
requestRoutes.post('/:id/complete', asyncHandler(requestController.complete));

requestRoutes.get('/:id/messages', asyncHandler(requestController.listMessages));
requestRoutes.post('/:id/messages', asyncHandler(requestController.sendMessage));

requestRoutes.get('/:id/video-token', asyncHandler(videoController.getToken));

requestRoutes.get('/:id/whiteboard/strokes', asyncHandler(whiteboardController.list));
requestRoutes.post('/:id/whiteboard/strokes', asyncHandler(whiteboardController.add));
requestRoutes.delete('/:id/whiteboard/strokes/last', asyncHandler(whiteboardController.undo));
requestRoutes.delete('/:id/whiteboard/strokes', asyncHandler(whiteboardController.clear));
