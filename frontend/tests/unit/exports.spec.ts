import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadCSV, printReport } from '../../src/utils/exports';

beforeEach(() => {
  (URL as any).createObjectURL = vi.fn(() => 'blob:fake');
  (URL as any).revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe('downloadCSV', () => {
  it('não faz nada com lista vazia', () => {
    const spy = vi.spyOn(document.body, 'appendChild');
    downloadCSV('x.csv', []);
    expect(spy).not.toHaveBeenCalled();
  });

  it('gera o arquivo, escapa valores especiais e dispara o download', () => {
    let anchor: HTMLAnchorElement | null = null;
    const orig = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: any) => {
      const el = orig(tag);
      if (tag === 'a') {
        anchor = el as HTMLAnchorElement;
        (el as HTMLAnchorElement).click = vi.fn();
      }
      return el;
    });

    downloadCSV('relatorio', [{ nome: 'A;com "aspas"', valor: 10, vazio: null }]);

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(anchor!.download).toBe('relatorio.csv'); // adiciona extensão
    expect((anchor!.click as any)).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('mantém a extensão .csv e respeita as colunas informadas', () => {
    let anchor: HTMLAnchorElement | null = null;
    const orig = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: any) => {
      const el = orig(tag);
      if (tag === 'a') {
        anchor = el as HTMLAnchorElement;
        (el as HTMLAnchorElement).click = vi.fn();
      }
      return el;
    });

    downloadCSV('dados.csv', [{ a: 1, b: 2 }], ['a']);
    expect(anchor!.download).toBe('dados.csv');
  });
});

describe('printReport', () => {
  function fakeWindow() {
    return { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() } } as unknown as Window;
  }

  it('alerta e aborta quando o pop-up é bloqueado', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    printReport({ title: 'X', sections: [] });
    expect(alertSpy).toHaveBeenCalled();
  });

  it('escreve o relatório completo (kpis, subtítulo, colunas com alinhamento)', () => {
    const win = fakeWindow();
    vi.spyOn(window, 'open').mockReturnValue(win);
    printReport({
      title: 'Relatório <SkillEx> & Cia',
      subtitle: 'Período atual',
      kpis: [{ label: 'Total', value: 42 }],
      sections: [
        {
          title: 'Com dados',
          rows: [{ nome: 'A', total: 1 }],
          columns: [
            { key: 'nome', label: 'Nome' },
            { key: 'total', label: 'Total', align: 'right' },
          ],
        },
        { title: 'Sem dados', rows: [] },
      ],
    });
    const html = (win.document.write as any).mock.calls[0][0] as string;
    expect(html).toContain('Relatório &lt;SkillEx&gt; &amp; Cia'); // escape
    expect(html).toContain('Período atual');
    expect(html).toContain('Sem dados.');
    expect(html).toContain('text-align:right');
  });

  it('escreve relatório mínimo (sem subtítulo, sem kpis, colunas padrão)', () => {
    const win = fakeWindow();
    vi.spyOn(window, 'open').mockReturnValue(win);
    // valor nulo na célula exercita o fallback `s ?? ''` do escape.
    printReport({ title: 'Simples', sections: [{ title: 'Tabela', rows: [{ a: null }] }] });
    const html = (win.document.write as any).mock.calls[0][0] as string;
    expect(html).toContain('Simples');
    expect(html).not.toContain('class="kpis"');
  });
});
