/** Cliente da API do quadro colaborativo (strokes persistentes). */
import { api } from './api';

export type WhiteboardTool = 'PEN' | 'ERASER' | 'LINE' | 'RECT' | 'ELLIPSE' | 'TEXT';

export interface Stroke {
  id: string;
  requestId: string;
  authorId: string;
  tool: WhiteboardTool;
  color: string;
  size: number;
  points: Array<[number, number]>;
  text: string | null;
  pageIndex: number;
  createdAt: string;
}

export interface AddStrokePayload {
  tool: WhiteboardTool;
  color: string;
  size: number;
  points: Array<[number, number]>;
  text?: string;
  pageIndex?: number;
}

export const whiteboardService = {
  list: (requestId: string): Promise<{ items: Stroke[] }> =>
    api.get(`/requests/${requestId}/whiteboard/strokes`),
  add: (requestId: string, data: AddStrokePayload): Promise<{ stroke: Stroke }> =>
    api.post(`/requests/${requestId}/whiteboard/strokes`, data),
  undo: (
    requestId: string,
  ): Promise<{ strokeId: string; authorId: string }> =>
    api.del(`/requests/${requestId}/whiteboard/strokes/last`),
  clear: (requestId: string): Promise<{ clearedBy: string; removed: number }> =>
    api.del(`/requests/${requestId}/whiteboard/strokes`),
};
