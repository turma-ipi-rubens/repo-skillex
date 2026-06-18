/**
 * Quadro branco colaborativo da SkillEx.
 *
 * Sincronização em duas camadas:
 *  - `whiteboard:live` (efêmero): durante o desenho, pontos são emitidos via
 *    socket a cada frame; o outro lado renderiza o "fantasma" do traço.
 *  - `whiteboard:stroke` (persistente): no `pointerup`, o stroke completo vai
 *    via REST para o backend, que persiste e emite o evento autoritativo —
 *    o fantasma é substituído pelo definitivo.
 *
 * Coordenadas são normalizadas (0..1) para resistir a redimensionamento.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './ui/Icon';
import { Spinner } from './ui/Spinner';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useRealtime } from '../hooks/useRealtime';
import {
  emitWhiteboardCursor,
  emitWhiteboardLive,
} from '../services/realtime';
import { whiteboardService, type Stroke, type WhiteboardTool } from '../services/whiteboard';

type Props = {
  requestId: string;
  onClose: () => void;
  /** Quando true, o quadro divide o viewport com a videochamada. */
  split?: boolean;
};

type Point = [number, number]; // normalizado 0..1

type DraftStroke = {
  id?: string;
  tool: WhiteboardTool;
  color: string;
  size: number;
  points: Point[];
  text?: string | null;
  authorId: string;
};

const TOOLS: Array<{ id: WhiteboardTool; icon: string; label: string }> = [
  { id: 'PEN', icon: 'pencil', label: 'Caneta' },
  { id: 'ERASER', icon: 'eraser', label: 'Borracha' },
  { id: 'LINE', icon: 'slash-lg', label: 'Linha' },
  { id: 'RECT', icon: 'square', label: 'Retângulo' },
  { id: 'ELLIPSE', icon: 'circle', label: 'Elipse' },
  { id: 'TEXT', icon: 'type', label: 'Texto' },
];

const PALETTE = [
  '#0b0f14',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#facc15',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
];

const LIVE_EMIT_MS = 40;

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: { tool: WhiteboardTool; color: string; size: number; points: Point[]; text?: string | null },
  w: number,
  h: number,
) {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  if (stroke.tool === 'ERASER') {
    ctx.globalCompositeOperation = 'destination-out';
  }
  const pts = stroke.points.map<Point>(([x, y]) => [x * w, y * h]);
  switch (stroke.tool) {
    case 'PEN':
    case 'ERASER': {
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0][0], pts[0][1], stroke.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      }
      break;
    }
    case 'LINE': {
      const a = pts[0];
      const b = pts[pts.length - 1];
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      break;
    }
    case 'RECT': {
      const a = pts[0];
      const b = pts[pts.length - 1];
      ctx.strokeRect(
        Math.min(a[0], b[0]),
        Math.min(a[1], b[1]),
        Math.abs(b[0] - a[0]),
        Math.abs(b[1] - a[1]),
      );
      break;
    }
    case 'ELLIPSE': {
      const a = pts[0];
      const b = pts[pts.length - 1];
      const cx = (a[0] + b[0]) / 2;
      const cy = (a[1] + b[1]) / 2;
      const rx = Math.abs(b[0] - a[0]) / 2;
      const ry = Math.abs(b[1] - a[1]) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'TEXT': {
      if (stroke.text) {
        ctx.font = `${Math.max(12, stroke.size * 3)}px system-ui, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(stroke.text, pts[0][0], pts[0][1]);
      }
      break;
    }
  }
  ctx.restore();
}

export function Whiteboard({ requestId, onClose, split = false }: Props) {
  const { user } = useAuth();
  const { toast, confirm } = useToast();
  const myId = user?.id ?? '';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<WhiteboardTool>('PEN');
  const [color, setColor] = useState<string>('#0b0f14');
  const [size, setSize] = useState<number>(4);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  // Strokes de outros usuários em desenho (efêmero): keyed by fromUserId
  const [liveStrokes, setLiveStrokes] = useState<Map<string, DraftStroke>>(new Map());
  // Posição do cursor de outros usuários
  const [cursors, setCursors] = useState<Map<string, { x: number; y: number }>>(new Map());

  // Ref para o stroke próprio em construção — usamos ref para evitar re-render
  // a cada pointermove. O redraw é gatilhado por um pequeno tick state.
  const draftRef = useRef<DraftStroke | null>(null);
  const [tick, setTick] = useState(0);
  const forceRedraw = useCallback(() => setTick((t) => t + 1), []);

  // Throttle do live emit
  const lastEmitRef = useRef(0);

  // Carga inicial
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { items } = await whiteboardService.list(requestId);
        if (!cancelled) setStrokes(items);
      } catch (err: any) {
        if (!cancelled) toast(err?.message || 'Erro ao carregar quadro', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId, toast]);

  // Dimensionamento do canvas (DPR + ResizeObserver)
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      forceRedraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [forceRedraw]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const wPx = canvas.width;
    const hPx = canvas.height;
    const w = wPx / dpr;
    const h = hPx / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const s of strokes) drawStroke(ctx, s, w, h);
    for (const s of liveStrokes.values()) drawStroke(ctx, s, w, h);
    if (draftRef.current) drawStroke(ctx, draftRef.current, w, h);
  }, [strokes, liveStrokes, tick]);

  // Realtime listeners
  useRealtime('whiteboard:stroke', (s: Stroke) => {
    setStrokes((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]));
    // Stroke definitivo chegou: zera o fantasma daquele autor.
    setLiveStrokes((prev) => {
      if (!prev.has(s.authorId)) return prev;
      const next = new Map(prev);
      next.delete(s.authorId);
      return next;
    });
  });
  useRealtime('whiteboard:undo', (p: { strokeId: string }) => {
    setStrokes((prev) => prev.filter((s) => s.id !== p.strokeId));
  });
  useRealtime('whiteboard:clear', () => {
    setStrokes([]);
  });
  useRealtime('whiteboard:live', (p: any) => {
    if (!p || p.fromUserId === myId) return;
    const draft: DraftStroke = {
      tool: p.tool,
      color: p.color,
      size: p.size,
      points: p.points,
      authorId: p.fromUserId,
      text: p.text,
    };
    setLiveStrokes((prev) => {
      const next = new Map(prev);
      next.set(p.fromUserId, draft);
      return next;
    });
  });
  useRealtime('whiteboard:cursor', (p: any) => {
    if (!p || p.fromUserId === myId) return;
    setCursors((prev) => {
      const next = new Map(prev);
      next.set(p.fromUserId, { x: p.x, y: p.y });
      return next;
    });
  });

  // Helpers de coordenada
  const getNormalizedPoint = useCallback((evt: React.PointerEvent): Point => {
    const wrap = wrapRef.current;
    if (!wrap) return [0, 0];
    const rect = wrap.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (evt.clientY - rect.top) / rect.height));
    return [x, y];
  }, []);

  const emitLiveThrottled = useCallback(() => {
    const draft = draftRef.current;
    if (!draft) return;
    const now = performance.now();
    if (now - lastEmitRef.current < LIVE_EMIT_MS) return;
    lastEmitRef.current = now;
    emitWhiteboardLive({
      requestId,
      tool: draft.tool,
      color: draft.color,
      size: draft.size,
      points: draft.points,
      text: draft.text,
    });
  }, [requestId]);

  // Pointer handlers
  const onPointerDown = useCallback(
    async (evt: React.PointerEvent) => {
      if (evt.button !== 0 && evt.pointerType === 'mouse') return;
      (evt.currentTarget as HTMLCanvasElement).setPointerCapture(evt.pointerId);
      const p = getNormalizedPoint(evt);

      if (tool === 'TEXT') {
        const text = window.prompt('Texto:');
        if (!text) return;
        try {
          const { stroke } = await whiteboardService.add(requestId, {
            tool: 'TEXT',
            color,
            size,
            points: [p],
            text,
          });
          setStrokes((prev) => (prev.some((x) => x.id === stroke.id) ? prev : [...prev, stroke]));
        } catch (err: any) {
          toast(err?.message || 'Erro ao adicionar texto', 'error');
        }
        return;
      }

      draftRef.current = {
        tool,
        color,
        size,
        points: [p],
        authorId: myId,
      };
      forceRedraw();
    },
    [color, forceRedraw, getNormalizedPoint, myId, requestId, size, tool, toast],
  );

  const onPointerMove = useCallback(
    (evt: React.PointerEvent) => {
      const p = getNormalizedPoint(evt);
      // Cursor sempre vai (mesmo sem desenhar) — pacote pequeno, throttle leve.
      const now = performance.now();
      if (now - lastEmitRef.current >= LIVE_EMIT_MS) {
        emitWhiteboardCursor({ requestId, x: p[0], y: p[1] });
      }

      const draft = draftRef.current;
      if (!draft) return;

      if (draft.tool === 'PEN' || draft.tool === 'ERASER') {
        draft.points.push(p);
      } else {
        // Formas geométricas: mantém apenas início + fim.
        if (draft.points.length === 1) draft.points.push(p);
        else draft.points[draft.points.length - 1] = p;
      }
      emitLiveThrottled();
      forceRedraw();
    },
    [emitLiveThrottled, forceRedraw, getNormalizedPoint, requestId],
  );

  const onPointerUp = useCallback(
    async (evt: React.PointerEvent) => {
      (evt.currentTarget as HTMLCanvasElement).releasePointerCapture(evt.pointerId);
      const draft = draftRef.current;
      draftRef.current = null;
      if (!draft) return;
      // Para formas geométricas, garante 2 pontos.
      if (draft.tool !== 'PEN' && draft.tool !== 'ERASER' && draft.points.length < 2) {
        forceRedraw();
        return;
      }
      try {
        const { stroke } = await whiteboardService.add(requestId, {
          tool: draft.tool,
          color: draft.color,
          size: draft.size,
          points: draft.points,
        });
        setStrokes((prev) => (prev.some((x) => x.id === stroke.id) ? prev : [...prev, stroke]));
      } catch (err: any) {
        toast(err?.message || 'Erro ao salvar traço', 'error');
      } finally {
        forceRedraw();
      }
    },
    [forceRedraw, requestId, toast],
  );

  // Ações da toolbar
  const handleUndo = useCallback(async () => {
    try {
      const { strokeId } = await whiteboardService.undo(requestId);
      setStrokes((prev) => prev.filter((s) => s.id !== strokeId));
    } catch (err: any) {
      toast(err?.message || 'Nada para desfazer', 'info');
    }
  }, [requestId, toast]);

  const handleClear = useCallback(async () => {
    if (!(await confirm('Limpar o quadro inteiro? Esta ação não pode ser desfeita.'))) return;
    try {
      await whiteboardService.clear(requestId);
      setStrokes([]);
    } catch (err: any) {
      toast(err?.message || 'Erro ao limpar quadro', 'error');
    }
  }, [confirm, requestId, toast]);

  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Para garantir fundo branco no PNG, compomos numa cópia temporária.
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    const url = out.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `quadro-skillex-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    a.click();
  }, []);

  const cursorList = useMemo(() => Array.from(cursors.entries()), [cursors]);

  return (
    <div
      className={`whiteboard${split ? ' whiteboard--split' : ''}`}
      role="dialog"
      aria-label="Quadro colaborativo"
    >
      <div className="whiteboard__header">
        <span>
          <Icon name="easel2" /> Quadro colaborativo
        </span>
        <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Fechar quadro">
          <Icon name="x-lg" /> Fechar
        </button>
      </div>

      <div className="whiteboard__toolbar" role="toolbar" aria-label="Ferramentas do quadro">
        <div className="whiteboard__tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`whiteboard__tool-btn${tool === t.id ? ' whiteboard__tool-btn--active' : ''}`}
              onClick={() => setTool(t.id)}
              title={t.label}
              aria-label={t.label}
              aria-pressed={tool === t.id}
            >
              <Icon name={t.icon} />
            </button>
          ))}
        </div>

        <div className="whiteboard__palette" role="group" aria-label="Cores">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`whiteboard__color-swatch${color === c ? ' whiteboard__color-swatch--active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Cor ${c}`}
            />
          ))}
          <input
            type="color"
            className="whiteboard__color-picker"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Cor personalizada"
          />
        </div>

        <div className="whiteboard__size">
          <label className="muted" style={{ fontSize: '.78rem' }}>
            Espessura
          </label>
          <input
            type="range"
            min={1}
            max={32}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            aria-label="Espessura do traço"
          />
          <span className="whiteboard__size-value">{size}</span>
        </div>

        <div className="whiteboard__actions">
          <button className="btn btn--ghost btn--sm" onClick={handleUndo} title="Desfazer">
            <Icon name="arrow-counterclockwise" /> Desfazer
          </button>
          <button className="btn btn--ghost btn--sm" onClick={handleExport} title="Exportar PNG">
            <Icon name="download" /> PNG
          </button>
          <button className="btn btn--danger btn--sm" onClick={handleClear} title="Limpar quadro">
            <Icon name="trash" /> Limpar
          </button>
        </div>
      </div>

      <div className="whiteboard__canvas-wrap" ref={wrapRef}>
        {loading && (
          <div className="whiteboard__loading">
            <Spinner />
            <span>Carregando quadro…</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="whiteboard__canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {cursorList.map(([uid, pos]) => (
          <div
            key={uid}
            className="whiteboard__cursor-ghost"
            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
            aria-hidden
          >
            <Icon name="cursor-fill" />
          </div>
        ))}
      </div>
    </div>
  );
}
