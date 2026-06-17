/**
 * Utilitários de exportação usados pelo painel administrativo.
 *
 *  - downloadCSV: gera e baixa um CSV a partir de uma matriz de objetos.
 *  - printReport: abre uma janela com layout para impressão / "Salvar em PDF"
 *    do navegador (sem dependências externas).
 */

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function downloadCSV(filename: string, rows: Array<Record<string, unknown>>, columns?: string[]): void {
  if (!rows.length) return;
  const cols = columns ?? Object.keys(rows[0]);
  const header = cols.map(escapeCSV).join(';');
  const body = rows.map((r) => cols.map((c) => escapeCSV(r[c])).join(';')).join('\n');
  // Prefixo BOM faz o Excel reconhecer UTF-8.
  const blob = new Blob(['﻿' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type ReportSection = {
  title: string;
  rows: Array<Record<string, unknown>>;
  columns?: Array<{ key: string; label: string; align?: 'left' | 'right' | 'center' }>;
};

export function printReport({
  title,
  subtitle,
  sections,
  kpis,
}: {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
  kpis?: Array<{ label: string; value: string | number }>;
}): void {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('O navegador bloqueou a janela de impressão. Permita pop-ups para gerar o PDF.');
    return;
  }

  const esc = (s: unknown) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  type Col = { key: string; label: string; align?: 'left' | 'right' | 'center' };
  const tableHtml = (section: ReportSection) => {
    if (!section.rows.length) {
      return `<p class="muted">Sem dados.</p>`;
    }
    const cols: Col[] =
      section.columns ??
      Object.keys(section.rows[0]).map((k) => ({ key: k, label: k }));
    const head = `<tr>${cols.map((c) => `<th style="text-align:${c.align ?? 'left'}">${esc(c.label)}</th>`).join('')}</tr>`;
    const body = section.rows
      .map(
        (r) =>
          `<tr>${cols
            .map((c) => `<td style="text-align:${c.align ?? 'left'}">${esc(r[c.key])}</td>`)
            .join('')}</tr>`,
      )
      .join('');
    return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
  };

  const now = new Date().toLocaleString('pt-BR');

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1f2937; margin: 24px; line-height: 1.4;
  }
  h1 { margin: 0 0 4px; font-size: 22px; color: #f97316; }
  h2 { margin: 28px 0 10px; font-size: 16px; padding-bottom: 4px; border-bottom: 2px solid #f97316; }
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 18px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
  .kpi .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; }
  .kpi .value { font-size: 20px; font-weight: 700; margin-top: 4px; color: #111827; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  th { background: #f9fafb; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: .4px; color: #374151; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .muted { color: #6b7280; font-size: 12px; }
  .footer { margin-top: 28px; font-size: 10px; color: #9ca3af; text-align: center; }
  @media print {
    body { margin: 16mm; }
    h2 { page-break-after: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
  }
</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  ${subtitle ? `<div class="meta">${esc(subtitle)}</div>` : ''}
  <div class="meta">Gerado em ${esc(now)}</div>

  ${
    kpis && kpis.length
      ? `<div class="kpis">${kpis
          .map((k) => `<div class="kpi"><div class="label">${esc(k.label)}</div><div class="value">${esc(k.value)}</div></div>`)
          .join('')}</div>`
      : ''
  }

  ${sections.map((s) => `<h2>${esc(s.title)}</h2>${tableHtml(s)}`).join('')}

  <div class="footer">SkillEx — Relatório administrativo</div>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}
