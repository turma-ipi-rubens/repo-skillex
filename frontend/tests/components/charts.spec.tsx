import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  colorAt,
  Sparkline,
  LineChart,
  BarChart,
  DonutChart,
} from '../../src/components/ui/Charts';

afterEach(() => vi.restoreAllMocks());

describe('colorAt', () => {
  it('cicla a paleta com o módulo do índice', () => {
    expect(colorAt(0)).toBe(colorAt(10)); // 10 % 10 === 0
    expect(colorAt(1)).not.toBe(colorAt(0));
  });
});

describe('Sparkline', () => {
  it('renderiza polilinha com vários pontos', () => {
    const { container } = render(<Sparkline data={[1, 5, 2, 8]} />);
    expect(container.querySelector('polyline')).toBeTruthy();
  });
  it('lida com ponto único (step 0)', () => {
    const { container } = render(<Sparkline data={[3]} color="#000" height={20} />);
    expect(container.querySelector('polyline')).toBeTruthy();
  });
});

describe('BarChart', () => {
  it('mostra "Sem dados" para lista vazia', () => {
    render(<BarChart data={[]} />);
    expect(screen.getByText('Sem dados.')).toBeInTheDocument();
  });
  it('usa formatValue padrão (String) quando não informado', () => {
    render(<BarChart data={[{ label: 'A', value: 7 }]} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });
  it('renderiza barras com cor custom e formatValue', () => {
    render(
      <BarChart
        data={[
          { label: 'A', value: 10, color: '#f00' },
          { label: 'B', value: 5 },
        ]}
        formatValue={(v) => `${v} un`}
      />,
    );
    expect(screen.getByText('10 un')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});

describe('DonutChart', () => {
  it('mostra "Sem dados" quando o total é zero', () => {
    render(<DonutChart data={[{ label: 'X', value: 0 }]} />);
    expect(screen.getByText('Sem dados.')).toBeInTheDocument();
  });
  it('renderiza arcos (inclui fatia > 50% → arco grande) e percentuais', () => {
    const { container } = render(
      <DonutChart
        data={[
          { label: 'Maior', value: 80, color: '#0f0' }, // > 180° → large-arc
          { label: 'Menor', value: 20 },
        ]}
      />,
    );
    expect(container.querySelectorAll('path').length).toBe(2);
    expect(screen.getByText('100')).toBeInTheDocument(); // total
    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});

describe('LineChart', () => {
  const days = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ date: `2026-06-${String(i + 1).padStart(2, '0')}`, value: i }));

  it('mostra "Sem dados" quando não há séries', () => {
    render(<LineChart series={[]} />);
    expect(screen.getByText('Sem dados.')).toBeInTheDocument();
  });

  it('mostra "Sem dados" quando a série está vazia', () => {
    render(<LineChart series={[{ label: 'A', data: [] }]} />);
    expect(screen.getByText('Sem dados.')).toBeInTheDocument();
  });

  it('renderiza poucas datas (≤7) sem reduzir ticks', () => {
    const { container } = render(
      <LineChart series={[{ label: 'Usuários', color: '#f97316', data: days(5) }]} />,
    );
    expect(container.querySelectorAll('polyline').length).toBeGreaterThan(0);
  });

  it('reduz ticks do eixo X quando há muitas datas (>7)', () => {
    const { container } = render(
      <LineChart series={[{ label: 'Sem cor', data: days(12) }]} height={180} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('exibe tooltip ao passar o mouse e some ao sair', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 220,
      right: 600,
      bottom: 220,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const { container } = render(
      <LineChart series={[{ label: 'Série', data: days(5) }]} />,
    );
    const svg = container.querySelector('svg') as SVGSVGElement;
    fireEvent.mouseMove(svg, { clientX: 300 });
    // o cursor vertical e o ponto destacado aparecem
    expect(container.querySelector('circle')).toBeTruthy();

    // posições fora dos limites não alteram o índice (cobre os bounds do índice)
    fireEvent.mouseMove(svg, { clientX: 700 }); // idx ≥ N
    fireEvent.mouseMove(svg, { clientX: -100 }); // idx < 0
    expect(container.querySelector('circle')).toBeTruthy();

    fireEvent.mouseLeave(svg);
    expect(container.querySelector('circle')).toBeNull();
  });
});
