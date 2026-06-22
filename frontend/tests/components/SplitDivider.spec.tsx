import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SplitDivider } from '../../src/components/SplitDivider';

beforeAll(() => {
  // jsdom não implementa pointer capture
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
});

function renderDivider() {
  const onChange = vi.fn();
  const utils = render(<SplitDivider value={0.5} onChange={onChange} />);
  const sep = utils.getByRole('separator');
  return { onChange, sep, ...utils };
}

describe('SplitDivider', () => {
  it('arrastar atualiza a proporção (com clamp em min e max)', () => {
    const { onChange, sep } = renderDivider();
    fireEvent.pointerDown(sep, { pointerId: 1 });
    expect(sep.className).toContain('split-divider--active');

    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 500 }); // 0.5
    expect(onChange).toHaveBeenLastCalledWith(0.5);

    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 50 }); // 0.05 → clamp 0.2
    expect(onChange).toHaveBeenLastCalledWith(0.2);

    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 950 }); // 0.95 → clamp 0.8
    expect(onChange).toHaveBeenLastCalledWith(0.8);

    fireEvent.pointerUp(sep, { pointerId: 1 });
    expect(sep.className).not.toContain('split-divider--active');
  });

  it('mover sem arrastar não altera nada', () => {
    const { onChange, sep } = renderDivider();
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 300 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('pointerCancel encerra o arraste e tolera releasePointerCapture lançando', () => {
    const { sep } = renderDivider();
    fireEvent.pointerDown(sep, { pointerId: 2 });
    (Element.prototype.releasePointerCapture as any).mockImplementationOnce(() => {
      throw new Error('já liberado');
    });
    fireEvent.pointerCancel(sep, { pointerId: 2 });
    expect(sep.className).not.toContain('split-divider--active');
  });
});
