import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ items: [] }),
    post: vi.fn().mockResolvedValue({ stroke: {} }),
    del: vi.fn().mockResolvedValue({}),
  },
}));

import { api } from '../../src/services/api';
import { whiteboardService } from '../../src/services/whiteboard';

describe('whiteboardService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list chama GET no endpoint de strokes', async () => {
    await whiteboardService.list('r1');
    expect(api.get).toHaveBeenCalledWith('/requests/r1/whiteboard/strokes');
  });

  it('add chama POST com o payload do traço', async () => {
    const data = { tool: 'PEN' as const, color: '#000000', size: 4, points: [[0, 0]] as Array<[number, number]> };
    await whiteboardService.add('r1', data);
    expect(api.post).toHaveBeenCalledWith('/requests/r1/whiteboard/strokes', data);
  });

  it('undo chama DELETE no último traço', async () => {
    await whiteboardService.undo('r1');
    expect(api.del).toHaveBeenCalledWith('/requests/r1/whiteboard/strokes/last');
  });

  it('clear chama DELETE em todos os traços', async () => {
    await whiteboardService.clear('r1');
    expect(api.del).toHaveBeenCalledWith('/requests/r1/whiteboard/strokes');
  });
});
