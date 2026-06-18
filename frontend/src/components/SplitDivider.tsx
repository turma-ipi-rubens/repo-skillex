/**
 * Barra divisória redimensionável usada quando a videochamada e o quadro
 * compartilham o viewport. O usuário arrasta para mudar a proporção; a
 * posição é controlada via CSS custom property `--split-ratio` aplicada no
 * <html> pelo pai (RequestDetail).
 */
import { useCallback, useState } from 'react';
import { Icon } from './ui/Icon';

type Props = {
  value: number;
  onChange: (ratio: number) => void;
  min?: number;
  max?: number;
};

export function SplitDivider({ value, onChange, min = 0.2, max = 0.8 }: Props) {
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    document.body.classList.add('body--resizing');
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const ratio = e.clientX / window.innerWidth;
      onChange(Math.max(min, Math.min(max, ratio)));
    },
    [dragging, max, min, onChange],
  );

  const stopDragging = useCallback((e: React.PointerEvent) => {
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* nada — o pointer pode já ter sido liberado */
    }
    setDragging(false);
    document.body.classList.remove('body--resizing');
  }, []);

  return (
    <div
      className={`split-divider${dragging ? ' split-divider--active' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar divisão entre vídeo e quadro"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={Math.round(min * 100)}
      aria-valuemax={Math.round(max * 100)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
    >
      <div className="split-divider__handle" aria-hidden>
        <Icon name="grip-vertical" />
      </div>
    </div>
  );
}
