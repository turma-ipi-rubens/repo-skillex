import { z } from 'zod';

export const WHITEBOARD_TOOLS = ['PEN', 'ERASER', 'LINE', 'RECT', 'ELLIPSE', 'TEXT'] as const;

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Cor inválida (use hexadecimal)');

const pointTuple = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);

export const addStrokeSchema = z
  .object({
    tool: z.enum(WHITEBOARD_TOOLS),
    color: hexColor,
    size: z.number().int().min(1).max(64),
    points: z.array(pointTuple).min(1).max(2000),
    text: z.string().max(200).optional(),
    pageIndex: z.number().int().min(0).max(50).default(0),
  })
  .refine((d) => d.tool !== 'TEXT' || (d.text && d.text.length > 0), {
    message: 'Texto é obrigatório para a ferramenta TEXT',
    path: ['text'],
  });

export type AddStrokeInput = z.infer<typeof addStrokeSchema>;
