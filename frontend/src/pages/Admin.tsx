/** Painel administrativo: dashboard, gestão e relatórios completos. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar } from '../components/ui/Avatar';
import { BarChart, DonutChart, LineChart, Sparkline, colorAt } from '../components/ui/Charts';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { Sheet } from '../components/ui/Sheet';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api, ApiError } from '../services/api';
import { downloadCSV, printReport } from '../utils/exports';

type Tab = 'dashboard' | 'users' | 'categories' | 'skills' | 'reports' | 'system';

// ---------------------------------------------------------------------------
//  Dicionários de tradução de status / tipos
// ---------------------------------------------------------------------------
const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  ACCEPTED: 'Aceita',
  REJECTED: 'Recusada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Concluída',
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  EXCHANGE: 'Troca',
  COIN: 'Moedas',
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  INAPPROPRIATE_CONTENT: 'Conteúdo inapropriado',
  HARASSMENT: 'Assédio ou abuso',
  SCAM: 'Golpe ou fraude',
  FAKE_PROFILE: 'Perfil falso',
  SPAM: 'Spam',
  OTHER: 'Outro',
};

const REPORT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  UNDER_REVIEW: 'Em análise',
  RESOLVED: 'Resolvida',
  DISMISSED: 'Encerrada',
};

const REPORT_STATUS_COLORS: Record<string, string> = {
  PENDING: 'var(--color-primary)',
  UNDER_REVIEW: '#f59e0b',
  RESOLVED: 'var(--success)',
  DISMISSED: 'var(--surface-3)',
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('pt-BR').format(n);
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

// ===========================================================================
//  Cartões de KPI
// ===========================================================================
function KpiCard({
  value,
  label,
  icon,
  trend,
  accent,
}: {
  value: string | number;
  label: string;
  icon: string;
  trend?: number[];
  accent?: string;
}) {
  const color = accent || 'var(--color-primary)';
  return (
    <div
      className="card"
      style={{
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--color-primary-tint)',
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
          }}
        >
          <Icon name={icon} />
        </span>
        <span className="muted" style={{ fontSize: '.78rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '1.55rem', fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      {trend && trend.length > 1 && (
        <div style={{ marginTop: -2 }}>
          <Sparkline data={trend} color={color} height={28} />
        </div>
      )}
    </div>
  );
}

// ===========================================================================
//  Card padronizado
// ===========================================================================
function SectionCard({
  title,
  icon,
  actions,
  children,
}: {
  title: string;
  icon?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 8,
        }}
      >
        <h3 style={{ margin: 0, fontSize: '.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon && <Icon name={icon} />} {title}
        </h3>
        {actions}
      </div>
      {children}
    </div>
  );
}

// ===========================================================================
//  Aba: Dashboard
// ===========================================================================

type Overview = {
  totalUsers: number;
  onboardedUsers: number;
  totalSkills: number;
  totalRequests: number;
  completedExchanges: number;
  totalReviews: number;
  averageRating: number;
  coinsInCirculation: number;
};

type TimeSeries = {
  days: number;
  newUsers: Array<{ date: string; value: number }>;
  newRequests: Array<{ date: string; value: number }>;
  completedExchanges: Array<{ date: string; value: number }>;
  newReviews: Array<{ date: string; value: number }>;
  newReports: Array<{ date: string; value: number }>;
};

type Distributions = {
  usersByRole: Array<{ label: string; value: number }>;
  usersByStatus: Array<{ label: string; value: number }>;
  usersByOnboarding: Array<{ label: string; value: number }>;
  requestsByStatus: Array<{ label: string; value: number }>;
  requestsByType: Array<{ label: string; value: number }>;
  reviewsByRating: Array<{ label: string; value: number; rating: number }>;
  reportsByStatus: Array<{ label: string; value: number }>;
  reportsByType: Array<{ label: string; value: number }>;
  transactionsByType: Array<{ label: string; value: number; total: number }>;
};

type TopLists = {
  topCategories: Array<{ id: string; name: string; icon: string | null; color: string | null; skills: number }>;
  topTeachingSkills: Array<{ id: string; name: string; category: string; count: number }>;
  topLearningSkills: Array<{ id: string; name: string; category: string; count: number }>;
  topReviewedSkills: Array<{ id: string; name: string; category: string; count: number }>;
  topRequestedSkills: Array<{ id: string; name: string; category: string; count: number }>;
  mostActiveUsers: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    lastActiveAt: string;
    city: string | null;
    state: string | null;
  }>;
};

type WalletStats = {
  totalWallets: number;
  totalAvailable: number;
  totalLocked: number;
  inCirculation: number;
  averageBalance: number;
  totalTransactions: number;
  last30Days: { credited: number; debited: number; net: number; count: number };
};

type SystemHealth = {
  pendingReports: number;
  underReviewReports: number;
  pendingRequests: number;
  inactiveUsers: number;
  activeUsersLast24h: number;
  activeUsersLast7d: number;
  newUsersLast7d: number;
  newRequestsLast7d: number;
  completedLast7d: number;
  pendingPasswordResets: number;
  onboardingPending: number;
};

type GeoStats = { states: Array<{ label: string; value: number }> };

function DashboardTab() {
  const { toast } = useToast();
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [series, setSeries] = useState<TimeSeries | null>(null);
  const [dist, setDist] = useState<Distributions | null>(null);
  const [top, setTop] = useState<TopLists | null>(null);
  const [wallet, setWallet] = useState<WalletStats | null>(null);
  const [geo, setGeo] = useState<GeoStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (range: number) => {
      setError(null);
      try {
        const [ov, ts, d, t, w, g] = await Promise.all([
          api.get('/stats/overview'),
          api.get(`/stats/timeseries?days=${range}`),
          api.get('/stats/distributions'),
          api.get('/stats/top?limit=10'),
          api.get('/stats/wallet'),
          api.get('/stats/geo'),
        ]);
        setOverview(ov);
        setSeries(ts);
        setDist(d);
        setTop(t);
        setWallet(w);
        setGeo(g);
      } catch (err) {
        setError(errorMessage(err, 'Erro ao carregar painel'));
      }
    },
    [],
  );

  useEffect(() => {
    reload(days);
  }, [reload, days]);

  const exportPDF = () => {
    if (!overview || !series || !dist || !top || !wallet) return;
    printReport({
      title: 'Painel administrativo — SkillEx',
      subtitle: `Relatório consolidado · últimos ${series.days} dias`,
      kpis: [
        { label: 'Usuários', value: formatNumber(overview.totalUsers) },
        { label: 'Trocas concluídas', value: formatNumber(overview.completedExchanges) },
        { label: 'Avaliações', value: formatNumber(overview.totalReviews) },
        { label: 'Nota média', value: overview.averageRating.toFixed(2) },
        { label: 'Habilidades', value: formatNumber(overview.totalSkills) },
        { label: 'Solicitações', value: formatNumber(overview.totalRequests) },
        { label: 'Moedas em circulação', value: formatNumber(overview.coinsInCirculation) },
        { label: 'Onboarding completo', value: formatNumber(overview.onboardedUsers) },
      ],
      sections: [
        {
          title: 'Novos usuários por dia',
          rows: series.newUsers,
          columns: [
            { key: 'date', label: 'Data' },
            { key: 'value', label: 'Novos', align: 'right' },
          ],
        },
        {
          title: 'Solicitações por status',
          rows: dist.requestsByStatus.map((r) => ({
            status: REQUEST_STATUS_LABELS[r.label] ?? r.label,
            total: r.value,
          })),
          columns: [
            { key: 'status', label: 'Status' },
            { key: 'total', label: 'Total', align: 'right' },
          ],
        },
        {
          title: 'Avaliações por nota',
          rows: dist.reviewsByRating.map((r) => ({ nota: r.rating, total: r.value })),
          columns: [
            { key: 'nota', label: 'Nota' },
            { key: 'total', label: 'Total', align: 'right' },
          ],
        },
        {
          title: 'Top categorias (por nº de habilidades)',
          rows: top.topCategories,
          columns: [
            { key: 'name', label: 'Categoria' },
            { key: 'skills', label: 'Habilidades', align: 'right' },
          ],
        },
        {
          title: 'Habilidades mais ensinadas',
          rows: top.topTeachingSkills,
          columns: [
            { key: 'name', label: 'Habilidade' },
            { key: 'category', label: 'Categoria' },
            { key: 'count', label: 'Professores', align: 'right' },
          ],
        },
        {
          title: 'Habilidades mais desejadas',
          rows: top.topLearningSkills,
          columns: [
            { key: 'name', label: 'Habilidade' },
            { key: 'category', label: 'Categoria' },
            { key: 'count', label: 'Interessados', align: 'right' },
          ],
        },
        {
          title: 'Economia interna (SkillCoins)',
          rows: [
            { item: 'Carteiras ativas', valor: wallet.totalWallets },
            { item: 'Saldo disponível total', valor: wallet.totalAvailable },
            { item: 'Saldo bloqueado total', valor: wallet.totalLocked },
            { item: 'Total em circulação', valor: wallet.inCirculation },
            { item: 'Saldo médio por carteira', valor: wallet.averageBalance },
            { item: 'Transações (30d)', valor: wallet.last30Days.count },
            { item: 'Creditado (30d)', valor: wallet.last30Days.credited },
            { item: 'Debitado (30d)', valor: wallet.last30Days.debited },
          ],
          columns: [
            { key: 'item', label: 'Indicador' },
            { key: 'valor', label: 'Valor', align: 'right' },
          ],
        },
      ],
    });
    toast('PDF gerado — use o diálogo de impressão para salvar', 'success');
  };

  const exportCSV = () => {
    if (!series) return;
    const merged = series.newUsers.map((u, i) => ({
      data: u.date,
      novos_usuarios: u.value,
      solicitacoes: series.newRequests[i]?.value ?? 0,
      trocas_concluidas: series.completedExchanges[i]?.value ?? 0,
      novas_avaliacoes: series.newReviews[i]?.value ?? 0,
      denuncias: series.newReports[i]?.value ?? 0,
    }));
    downloadCSV(`skillex-serie-${series.days}d.csv`, merged);
    toast('CSV exportado', 'success');
  };

  if (error) return <EmptyState icon="exclamation-triangle" title={error} subtitle="Tente novamente." />;
  if (!overview || !series || !dist || !top || !wallet || !geo) {
    return (
      <div className="row" style={{ justifyContent: 'center', padding: 20 }}>
        <Spinner />
      </div>
    );
  }

  const trendNew = series.newUsers.map((d) => d.value);
  const trendRequests = series.newRequests.map((d) => d.value);
  const trendCompleted = series.completedExchanges.map((d) => d.value);
  const trendReviews = series.newReviews.map((d) => d.value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Barra de ações */}
      <div className="card" style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <strong style={{ marginRight: 'auto', fontSize: '.9rem' }}>
          <Icon name="calendar3" /> Período:
        </strong>
        <div className="segmented" style={{ margin: 0, flex: '0 1 auto' }}>
          {[7, 30, 90, 180].map((d) => (
            <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
              {d}d
            </button>
          ))}
        </div>
        <button className="btn btn--secondary btn--sm" onClick={() => reload(days)}>
          <Icon name="arrow-clockwise" /> Atualizar
        </button>
        <button className="btn btn--secondary btn--sm" onClick={exportCSV}>
          <Icon name="filetype-csv" /> CSV
        </button>
        <button className="btn btn--primary btn--sm" onClick={exportPDF}>
          <Icon name="filetype-pdf" /> PDF
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <KpiCard value={formatNumber(overview.totalUsers)} label="Usuários totais" icon="people-fill" trend={trendNew} />
        <KpiCard
          value={formatNumber(overview.onboardedUsers)}
          label="Perfis completos"
          icon="check-circle-fill"
          accent="var(--success)"
        />
        <KpiCard
          value={formatNumber(overview.totalRequests)}
          label="Solicitações"
          icon="arrow-left-right"
          trend={trendRequests}
          accent="#0ea5e9"
        />
        <KpiCard
          value={formatNumber(overview.completedExchanges)}
          label="Trocas concluídas"
          icon="trophy-fill"
          trend={trendCompleted}
          accent="#22c55e"
        />
        <KpiCard
          value={overview.averageRating.toFixed(2)}
          label="Nota média"
          icon="star-fill"
          accent="#eab308"
        />
        <KpiCard
          value={formatNumber(overview.totalReviews)}
          label="Avaliações"
          icon="chat-quote-fill"
          trend={trendReviews}
          accent="#a855f7"
        />
        <KpiCard
          value={formatNumber(overview.totalSkills)}
          label="Habilidades"
          icon="tools"
          accent="#ec4899"
        />
        <KpiCard
          value={formatNumber(overview.coinsInCirculation)}
          label="Moedas em circulação"
          icon="coin"
          accent="#f97316"
        />
      </div>

      {/* Série temporal principal */}
      <SectionCard title={`Atividade nos últimos ${series.days} dias`} icon="graph-up-arrow">
        <LineChart
          height={240}
          series={[
            { label: 'Novos usuários', color: '#f97316', data: series.newUsers },
            { label: 'Solicitações', color: '#0ea5e9', data: series.newRequests },
            { label: 'Trocas concluídas', color: '#22c55e', data: series.completedExchanges },
            { label: 'Avaliações', color: '#a855f7', data: series.newReviews },
          ]}
        />
      </SectionCard>

      {/* Linha de donuts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <SectionCard title="Solicitações por status" icon="diagram-3">
          <DonutChart
            data={dist.requestsByStatus.map((r) => ({
              label: REQUEST_STATUS_LABELS[r.label] ?? r.label,
              value: r.value,
            }))}
          />
        </SectionCard>
        <SectionCard title="Tipos de solicitação" icon="arrow-left-right">
          <DonutChart
            data={dist.requestsByType.map((r) => ({
              label: REQUEST_TYPE_LABELS[r.label] ?? r.label,
              value: r.value,
            }))}
          />
        </SectionCard>
        <SectionCard title="Status dos usuários" icon="person-check">
          <DonutChart data={dist.usersByStatus} />
        </SectionCard>
      </div>

      {/* Distribuições de avaliação + denúncias */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <SectionCard title="Distribuição das notas" icon="star">
          <BarChart
            data={dist.reviewsByRating.map((r) => ({
              label: `${r.rating} ${r.rating === 1 ? 'estrela' : 'estrelas'}`,
              value: r.value,
              color: colorAt(5 - r.rating),
            }))}
          />
        </SectionCard>
        <SectionCard title="Denúncias por tipo" icon="flag">
          {dist.reportsByType.length ? (
            <BarChart
              data={dist.reportsByType.map((r) => ({
                label: REPORT_TYPE_LABELS[r.label] ?? r.label,
                value: r.value,
              }))}
            />
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: '.85rem' }}>Nenhuma denúncia registrada.</p>
          )}
        </SectionCard>
      </div>

      {/* Carteira */}
      <SectionCard title="Economia interna (SkillCoins)" icon="coin">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <KpiCard value={formatNumber(wallet.inCirculation)} label="Em circulação" icon="coin" />
          <KpiCard value={formatNumber(wallet.totalAvailable)} label="Disponível" icon="wallet2" accent="#22c55e" />
          <KpiCard value={formatNumber(wallet.totalLocked)} label="Bloqueado" icon="lock" accent="#f59e0b" />
          <KpiCard value={formatNumber(wallet.averageBalance)} label="Saldo médio" icon="bar-chart" accent="#0ea5e9" />
          <KpiCard
            value={formatNumber(wallet.last30Days.count)}
            label="Transações 30d"
            icon="receipt"
            accent="#a855f7"
          />
        </div>
        <BarChart
          data={dist.transactionsByType.map((t) => ({
            label: t.label,
            value: t.value,
          }))}
        />
      </SectionCard>

      {/* Top categorias / habilidades */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <SectionCard title="Top categorias" icon="tags">
          <BarChart
            data={top.topCategories.map((c, i) => ({
              label: `${c.icon ?? '🏷️'} ${c.name}`,
              value: c.skills,
              color: c.color || colorAt(i),
            }))}
            formatValue={(v) => `${v} hab.`}
          />
        </SectionCard>
        <SectionCard title="Habilidades mais ensinadas" icon="mortarboard">
          <BarChart data={top.topTeachingSkills.map((s) => ({ label: s.name, value: s.count }))} />
        </SectionCard>
        <SectionCard title="Habilidades mais desejadas" icon="search-heart">
          <BarChart data={top.topLearningSkills.map((s) => ({ label: s.name, value: s.count }))} />
        </SectionCard>
        <SectionCard title="Habilidades mais avaliadas" icon="chat-square-quote">
          <BarChart data={top.topReviewedSkills.map((s) => ({ label: s.name, value: s.count }))} />
        </SectionCard>
      </div>

      {/* Geo + usuários ativos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <SectionCard
          title="Usuários por estado"
          icon="geo-alt"
          actions={
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => downloadCSV('skillex-usuarios-por-estado.csv', geo.states.map((s) => ({ estado: s.label, total: s.value })))}
              title="Exportar CSV"
            >
              <Icon name="download" />
            </button>
          }
        >
          {geo.states.length ? (
            <BarChart data={geo.states} />
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: '.85rem' }}>
              Sem dados de localização cadastrados.
            </p>
          )}
        </SectionCard>
        <SectionCard title="Atividade recente" icon="lightning-charge">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {top.mostActiveUsers.slice(0, 6).map((u) => (
              <div key={u.id} className="row gap-8" style={{ alignItems: 'center' }}>
                <Avatar user={u} size="sm" />
                <div className="full" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '.9rem', fontWeight: 600 }}>{u.name}</div>
                  <div className="muted" style={{ fontSize: '.74rem' }}>
                    último acesso: {formatDateTime(u.lastActiveAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ===========================================================================
//  Aba: Usuários (com export e mais colunas)
// ===========================================================================
function UsersTab() {
  const { user: me } = useAuth();
  const { toast, confirm } = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string, p: number) => {
    setRes(null);
    setError(null);
    try {
      setRes(await api.get(`/admin/users?q=${encodeURIComponent(query)}&page=${p}&limit=20`));
    } catch (err) {
      setError(errorMessage(err, 'Erro ao carregar usuários'));
    }
  }, []);

  useEffect(() => {
    load(q, page);
  }, [load, q, page]);

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setQ(String(data.get('q') || '').trim());
    setPage(1);
  };

  const toggleUser = async (u: any) => {
    const ok = await confirm(
      u.isActive
        ? `Desativar a conta de ${u.name}? A pessoa não conseguirá mais entrar e sairá do feed e da busca.`
        : `Reativar a conta de ${u.name}?`,
      u.isActive ? 'Desativar' : 'Reativar',
    );
    if (!ok) return;
    try {
      await api.patch(`/admin/users/${u.id}/status`, { isActive: !u.isActive });
      toast(u.isActive ? 'Conta desativada' : 'Conta reativada', 'success');
      setPage(1);
      load(q, 1);
    } catch (err) {
      toast(errorMessage(err, 'Erro ao atualizar usuário'), 'error');
    }
  };

  const exportCSV = () => {
    if (!res?.items?.length) return;
    const rows = res.items.map((u: any) => ({
      nome: u.name,
      email: u.email,
      papel: u.role,
      status: u.isActive ? 'Ativo' : 'Desativado',
      onboarding: u.onboardingCompleted ? 'Sim' : 'Não',
      cidade: u.city ?? '',
      estado: u.state ?? '',
      criado_em: formatDate(u.createdAt),
    }));
    downloadCSV('skillex-usuarios.csv', rows);
    toast('CSV exportado', 'success');
  };

  const exportPDF = () => {
    if (!res?.items?.length) return;
    printReport({
      title: 'Usuários — SkillEx',
      subtitle: q ? `Filtro: "${q}"` : 'Página atual',
      kpis: [
        { label: 'Total na página', value: res.items.length },
        { label: 'Total geral', value: res.total },
        { label: 'Página', value: res.page },
      ],
      sections: [
        {
          title: 'Usuários',
          rows: res.items.map((u: any) => ({
            nome: u.name,
            email: u.email,
            papel: u.role,
            status: u.isActive ? 'Ativo' : 'Desativado',
            cidade: u.city ?? '',
            estado: u.state ?? '',
            criado_em: formatDate(u.createdAt),
          })),
          columns: [
            { key: 'nome', label: 'Nome' },
            { key: 'email', label: 'E-mail' },
            { key: 'papel', label: 'Papel' },
            { key: 'status', label: 'Status' },
            { key: 'cidade', label: 'Cidade' },
            { key: 'estado', label: 'UF' },
            { key: 'criado_em', label: 'Criado em' },
          ],
        },
      ],
    });
  };

  return (
    <>
      <div
        className="row gap-8"
        style={{ marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <form id="user-search" className="row gap-8 full" style={{ minWidth: 220 }} onSubmit={onSearch}>
          <input className="input full" name="q" placeholder="Buscar por nome ou e-mail" defaultValue={q} />
          <button className="btn btn--secondary" type="submit">
            <Icon name="search" />
          </button>
        </form>
        <button className="btn btn--secondary btn--sm" onClick={exportCSV} disabled={!res?.items?.length}>
          <Icon name="filetype-csv" /> CSV
        </button>
        <button className="btn btn--primary btn--sm" onClick={exportPDF} disabled={!res?.items?.length}>
          <Icon name="filetype-pdf" /> PDF
        </button>
      </div>

      {res && (
        <p className="muted" style={{ fontSize: '.78rem', marginBottom: 8 }}>
          Mostrando {res.items.length} de {formatNumber(res.total)} • página {res.page}
        </p>
      )}

      <div id="user-list">
        {error ? (
          <EmptyState icon="exclamation-triangle" title={error} subtitle="Tente novamente." />
        ) : !res ? (
          <Spinner />
        ) : !res.items.length ? (
          <EmptyState icon="people" title="Nenhum usuário encontrado" />
        ) : (
          <>
            {res.items.map((u: any) => (
              <div className="card row gap-8" style={{ alignItems: 'center' }} data-user={u.id} key={u.id}>
                <Avatar user={u} size="sm" />
                <div className="full" style={{ minWidth: 0 }}>
                  <strong>{u.name}</strong>
                  {u.role === 'ADMIN' && (
                    <span className="skill-badge">
                      <Icon name="shield-fill" /> Admin
                    </span>
                  )}
                  {!u.isActive && (
                    <span className="skill-badge" style={{ color: 'var(--danger)' }}>
                      <Icon name="slash-circle" /> Desativada
                    </span>
                  )}
                  {!u.onboardingCompleted && (
                    <span className="skill-badge" style={{ color: 'var(--warning)' }}>
                      <Icon name="hourglass-split" /> Onboarding pendente
                    </span>
                  )}
                  <div className="muted" style={{ fontSize: '.82rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.email} {u.city && `• ${u.city}`}{u.state && `/${u.state}`}
                  </div>
                  <div className="muted" style={{ fontSize: '.72rem' }}>
                    cadastro em {formatDate(u.createdAt)}
                  </div>
                </div>
                {u.id !== me?.id && (
                  <button className="btn btn--ghost" data-toggle onClick={() => toggleUser(u)}>
                    {u.isActive ? 'Desativar' : 'Reativar'}
                  </button>
                )}
              </div>
            ))}
            <div className="row gap-8" style={{ marginTop: 10, justifyContent: 'space-between' }}>
              <button
                className="btn btn--ghost btn--sm"
                disabled={res.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Icon name="chevron-left" /> Anterior
              </button>
              <button
                className="btn btn--ghost btn--sm"
                disabled={!res.hasMore}
                onClick={() => setPage(page + 1)}
              >
                Próxima <Icon name="chevron-right" />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ===========================================================================
//  Aba: Categorias
// ===========================================================================
function CategoryForm({
  values,
  onSubmit,
}: {
  values?: { name?: string; icon?: string; color?: string };
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form id="cat-form" onSubmit={onSubmit}>
      <div className="field">
        <label className="field__label">Nome</label>
        <input className="input" name="name" minLength={2} maxLength={40} defaultValue={values?.name ?? ''} required />
      </div>
      <div className="row gap-8">
        <div className="field full">
          <label className="field__label">Ícone (emoji)</label>
          <input className="input" name="icon" maxLength={8} defaultValue={values?.icon ?? ''} placeholder="🎻" />
        </div>
        <div className="field full">
          <label className="field__label">Cor (#RRGGBB)</label>
          <input
            className="input"
            name="color"
            pattern="^#[0-9A-Fa-f]{6}$"
            defaultValue={values?.color ?? ''}
            placeholder="#F97316"
          />
        </div>
      </div>
      <button className="btn btn--primary btn--block" type="submit">
        Salvar
      </button>
    </form>
  );
}

function CategoriesTab() {
  const { toast, confirm } = useToast();
  const [categories, setCategories] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<null | { id?: string; values?: any }>(null);

  const load = useCallback(async () => {
    setCategories(null);
    setError(null);
    try {
      setCategories((await api.get('/categories')).categories);
    } catch (err) {
      setError(errorMessage(err, 'Erro ao carregar categorias'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = { name: String(data.get('name')).trim() };
    const iconVal = String(data.get('icon') || '').trim();
    const colorVal = String(data.get('color') || '').trim();
    if (iconVal) payload.icon = iconVal;
    if (colorVal) payload.color = colorVal;
    try {
      if (editing?.id) await api.patch(`/admin/categories/${editing.id}`, payload);
      else await api.post('/admin/categories', payload);
      setEditing(null);
      toast('Categoria salva', 'success');
      load();
    } catch (err) {
      toast(errorMessage(err, 'Erro ao salvar categoria'), 'error');
    }
  };

  const deleteCategory = async (c: any) => {
    if (!(await confirm(`Excluir a categoria "${c.name}"?`, 'Excluir'))) return;
    try {
      await api.del(`/admin/categories/${c.id}`);
      toast('Categoria excluída', 'success');
      load();
    } catch (err) {
      toast(errorMessage(err, 'Erro ao excluir categoria'), 'error');
    }
  };

  const exportCSV = () => {
    if (!categories?.length) return;
    downloadCSV(
      'skillex-categorias.csv',
      categories.map((c) => ({
        nome: c.name,
        slug: c.slug,
        icone: c.icon ?? '',
        cor: c.color ?? '',
        habilidades: c.skillsCount ?? 0,
      })),
    );
    toast('CSV exportado', 'success');
  };

  return (
    <>
      <div className="row gap-8" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn--primary full" id="cat-new" onClick={() => setEditing({})}>
          <Icon name="plus-lg" /> Nova categoria
        </button>
        <button className="btn btn--secondary btn--sm" onClick={exportCSV} disabled={!categories?.length}>
          <Icon name="filetype-csv" /> CSV
        </button>
      </div>
      <div id="cat-list">
        {error ? (
          <EmptyState icon="exclamation-triangle" title={error} subtitle="Tente novamente." />
        ) : !categories ? (
          <Spinner />
        ) : !categories.length ? (
          <EmptyState icon="tags" title="Nenhuma categoria cadastrada" />
        ) : (
          categories.map((c: any) => (
            <div className="card row gap-8" style={{ alignItems: 'center' }} data-cat={c.id} key={c.id}>
              <span style={{ fontSize: '1.3rem' }}>{c.icon ?? '🏷️'}</span>
              <div className="full">
                <strong>{c.name}</strong>
                <div className="muted" style={{ fontSize: '.82rem' }}>
                  {c.skillsCount ?? 0} habilidade(s)
                </div>
              </div>
              <button className="icon-btn" data-edit title="Editar" onClick={() => setEditing({ id: c.id, values: c })}>
                <Icon name="pencil" />
              </button>
              <button className="icon-btn" data-del title="Excluir" onClick={() => deleteCategory(c)}>
                <Icon name="trash" />
              </button>
            </div>
          ))
        )}
      </div>
      {editing && (
        <Sheet title={editing.id ? 'Editar categoria' : 'Nova categoria'} onClose={() => setEditing(null)}>
          <CategoryForm values={editing.values} onSubmit={submitCategory} />
        </Sheet>
      )}
    </>
  );
}

// ===========================================================================
//  Aba: Habilidades
// ===========================================================================
function SkillForm({
  categories,
  values,
  onSubmit,
}: {
  categories: any[];
  values?: { name?: string; categoryId?: string };
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form id="skill-form" onSubmit={onSubmit}>
      <div className="field">
        <label className="field__label">Nome</label>
        <input className="input" name="name" minLength={2} maxLength={60} defaultValue={values?.name ?? ''} required />
      </div>
      <div className="field">
        <label className="field__label">Categoria</label>
        <select className="input" name="categoryId" defaultValue={values?.categoryId ?? categories[0]?.id} required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn--primary btn--block" type="submit">
        Salvar
      </button>
    </form>
  );
}

function SkillsTab() {
  const { toast, confirm } = useToast();
  const [q, setQ] = useState('');
  const [skills, setSkills] = useState<any[] | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<null | { id?: string; values?: any }>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const load = useCallback(async (query: string) => {
    setSkills(null);
    setError(null);
    try {
      const [{ skills: items }, { categories: cats }] = await Promise.all([
        api.get(`/skills?q=${encodeURIComponent(query)}`),
        api.get('/categories'),
      ]);
      setSkills(items);
      setCategories(cats);
    } catch (err) {
      setError(errorMessage(err, 'Erro ao carregar habilidades'));
    }
  }, []);

  useEffect(() => {
    load(q);
  }, [load, q]);

  const filtered = useMemo(() => {
    if (!skills) return null;
    if (!categoryFilter) return skills;
    return skills.filter((s) => s.category?.id === categoryFilter);
  }, [skills, categoryFilter]);

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setQ(String(data.get('q') || '').trim());
  };

  const newSkill = () => {
    if (!categories.length) {
      toast('Cadastre uma categoria antes', 'error');
      return;
    }
    setEditing({});
  };

  const submitSkill = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload = {
      name: String(data.get('name')).trim(),
      categoryId: String(data.get('categoryId')),
    };
    try {
      if (editing?.id) await api.patch(`/admin/skills/${editing.id}`, payload);
      else await api.post('/admin/skills', payload);
      setEditing(null);
      toast('Habilidade salva', 'success');
      load(q);
    } catch (err) {
      toast(errorMessage(err, 'Erro ao salvar habilidade'), 'error');
    }
  };

  const deleteSkill = async (s: any) => {
    if (!(await confirm(`Excluir a habilidade "${s.name}"?`, 'Excluir'))) return;
    try {
      await api.del(`/admin/skills/${s.id}`);
      toast('Habilidade excluída', 'success');
      load(q);
    } catch (err) {
      toast(errorMessage(err, 'Erro ao excluir habilidade'), 'error');
    }
  };

  const exportCSV = () => {
    if (!filtered?.length) return;
    downloadCSV(
      'skillex-habilidades.csv',
      filtered.map((s: any) => ({
        nome: s.name,
        slug: s.slug,
        categoria: s.category?.name ?? '',
      })),
    );
    toast('CSV exportado', 'success');
  };

  return (
    <>
      <form id="skill-search" className="row gap-8" style={{ marginBottom: 8 }} onSubmit={onSearch}>
        <input className="input full" name="q" placeholder="Buscar habilidade" defaultValue={q} />
        <button className="btn btn--secondary" type="submit">
          <Icon name="search" />
        </button>
      </form>
      <div className="row gap-8" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <select
          className="input full"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ minWidth: 160 }}
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          className="btn btn--primary"
          id="skill-new"
          disabled={!skills && !error}
          onClick={newSkill}
        >
          <Icon name="plus-lg" /> Nova
        </button>
        <button className="btn btn--secondary btn--sm" onClick={exportCSV} disabled={!filtered?.length}>
          <Icon name="filetype-csv" /> CSV
        </button>
      </div>
      <div id="skill-list">
        {error ? (
          <EmptyState icon="exclamation-triangle" title={error} subtitle="Tente novamente." />
        ) : !filtered ? (
          <Spinner />
        ) : !filtered.length ? (
          <EmptyState icon="tools" title="Nenhuma habilidade encontrada" />
        ) : (
          filtered.map((s: any) => (
            <div className="card row gap-8" style={{ alignItems: 'center' }} data-skill={s.id} key={s.id}>
              <div className="full">
                <strong>{s.name}</strong>
                <div className="muted" style={{ fontSize: '.82rem' }}>
                  {s.category?.name ?? 'Sem categoria'}
                </div>
              </div>
              <button
                className="icon-btn"
                data-edit
                title="Editar"
                onClick={() => setEditing({ id: s.id, values: { name: s.name, categoryId: s.category?.id } })}
              >
                <Icon name="pencil" />
              </button>
              <button className="icon-btn" data-del title="Excluir" onClick={() => deleteSkill(s)}>
                <Icon name="trash" />
              </button>
            </div>
          ))
        )}
      </div>
      {editing && (
        <Sheet title={editing.id ? 'Editar habilidade' : 'Nova habilidade'} onClose={() => setEditing(null)}>
          <SkillForm categories={categories} values={editing.values} onSubmit={submitSkill} />
        </Sheet>
      )}
    </>
  );
}

// ===========================================================================
//  Aba: Denúncias (com export)
// ===========================================================================

function ReportsTab() {
  const { toast, confirm } = useToast();
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<any>(null);
  const [adminNote, setAdminNote] = useState('');

  const load = useCallback(
    async (status: string, p: number) => {
      setRes(null);
      setError(null);
      try {
        const qs = status ? `status=${encodeURIComponent(status)}&` : '';
        setRes(await api.get(`/reports/admin?${qs}page=${p}&limit=15`));
      } catch (err) {
        setError(errorMessage(err, 'Erro ao carregar denúncias'));
      }
    },
    [],
  );

  useEffect(() => {
    load(statusFilter, page);
  }, [load, statusFilter, page]);

  const onFilterChange = (s: string) => {
    setStatusFilter(s);
    setPage(1);
  };

  const openResolve = (report: any) => {
    setResolving(report);
    setAdminNote('');
  };

  const submitResolve = async (newStatus: 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED') => {
    if (!resolving) return;
    const label = newStatus === 'UNDER_REVIEW' ? 'Em análise' : newStatus === 'RESOLVED' ? 'Resolver' : 'Encerrar';
    const ok = await confirm(
      `Marcar esta denúncia como "${REPORT_STATUS_LABELS[newStatus]}"?`,
      label,
    );
    if (!ok) return;
    try {
      await api.patch(`/reports/admin/${resolving.id}`, { status: newStatus, adminNote });
      toast('Denúncia atualizada', 'success');
      setResolving(null);
      load(statusFilter, page);
    } catch (err) {
      toast(errorMessage(err, 'Erro ao atualizar denúncia'), 'error');
    }
  };

  const exportPDF = () => {
    if (!res?.items?.length) return;
    printReport({
      title: 'Denúncias — SkillEx',
      subtitle: statusFilter ? `Filtro: ${REPORT_STATUS_LABELS[statusFilter]}` : 'Todas as denúncias',
      kpis: [
        { label: 'Itens na página', value: res.items.length },
        { label: 'Total', value: res.total ?? res.items.length },
      ],
      sections: [
        {
          title: 'Denúncias',
          rows: res.items.map((r: any) => ({
            data: formatDate(r.createdAt),
            tipo: REPORT_TYPE_LABELS[r.type] ?? r.type,
            status: REPORT_STATUS_LABELS[r.status] ?? r.status,
            denunciante: r.reporter?.name ?? '',
            denunciado: r.target?.name ?? '—',
            descricao: r.description,
            nota_admin: r.adminNote ?? '',
          })),
          columns: [
            { key: 'data', label: 'Data' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'status', label: 'Status' },
            { key: 'denunciante', label: 'Denunciante' },
            { key: 'denunciado', label: 'Denunciado' },
            { key: 'descricao', label: 'Descrição' },
            { key: 'nota_admin', label: 'Nota admin' },
          ],
        },
      ],
    });
  };

  const exportCSV = () => {
    if (!res?.items?.length) return;
    downloadCSV(
      'skillex-denuncias.csv',
      res.items.map((r: any) => ({
        data: formatDate(r.createdAt),
        tipo: REPORT_TYPE_LABELS[r.type] ?? r.type,
        status: REPORT_STATUS_LABELS[r.status] ?? r.status,
        denunciante: r.reporter?.name ?? '',
        denunciado: r.target?.name ?? '',
        descricao: r.description,
        nota_admin: r.adminNote ?? '',
      })),
    );
  };

  return (
    <>
      <div className="segmented" style={{ marginBottom: 12 }}>
        {['', 'PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'].map((s) => (
          <button
            key={s}
            className={statusFilter === s ? 'active' : ''}
            onClick={() => onFilterChange(s)}
          >
            {s ? REPORT_STATUS_LABELS[s] : 'Todas'}
          </button>
        ))}
      </div>

      <div className="row gap-8" style={{ marginBottom: 12 }}>
        <button className="btn btn--secondary btn--sm" onClick={exportCSV} disabled={!res?.items?.length}>
          <Icon name="filetype-csv" /> CSV
        </button>
        <button className="btn btn--primary btn--sm" onClick={exportPDF} disabled={!res?.items?.length}>
          <Icon name="filetype-pdf" /> PDF
        </button>
      </div>

      <div id="report-list">
        {error ? (
          <EmptyState icon="exclamation-triangle" title={error} subtitle="Tente novamente." />
        ) : !res ? (
          <Spinner />
        ) : !res.items.length ? (
          <EmptyState icon="flag" title="Nenhuma denúncia encontrada" />
        ) : (
          <>
            {res.items.map((r: any) => (
              <div className="card" data-report={r.id} key={r.id} style={{ marginBottom: 10 }}>
                <div className="row-between" style={{ marginBottom: 6 }}>
                  <span
                    className="skill-badge"
                    style={{ background: REPORT_STATUS_COLORS[r.status] + '22', color: REPORT_STATUS_COLORS[r.status] }}
                  >
                    {REPORT_STATUS_LABELS[r.status]}
                  </span>
                  <span className="muted" style={{ fontSize: '.78rem' }}>
                    {formatDate(r.createdAt)}
                  </span>
                </div>

                <div style={{ fontSize: '.88rem', marginBottom: 4 }}>
                  <strong>Tipo:</strong> {REPORT_TYPE_LABELS[r.type] ?? r.type}
                </div>

                {r.target && (
                  <div style={{ fontSize: '.88rem', marginBottom: 4 }}>
                    <strong>Denunciado:</strong>{' '}
                    <a href={`/profile/${r.target.id}`} style={{ color: 'var(--color-primary)' }}>
                      {r.target.name}
                    </a>
                  </div>
                )}
                {r.request && (
                  <div style={{ fontSize: '.88rem', marginBottom: 4 }}>
                    <strong>Solicitação:</strong> #{r.request.id.slice(-6)} ({r.request.type})
                  </div>
                )}
                <div style={{ fontSize: '.88rem', marginBottom: 4 }}>
                  <strong>Denunciante:</strong> {r.reporter?.name}
                </div>
                <p className="muted" style={{ fontSize: '.85rem', marginTop: 4 }}>
                  {r.description}
                </p>
                {r.adminNote && (
                  <div
                    style={{
                      fontSize: '.82rem',
                      marginTop: 6,
                      padding: '6px 10px',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    <Icon name="chat-left-text" /> <em>{r.adminNote}</em>
                  </div>
                )}

                {r.status !== 'RESOLVED' && r.status !== 'DISMISSED' && (
                  <button
                    className="btn btn--secondary btn--sm"
                    style={{ marginTop: 10 }}
                    onClick={() => openResolve(r)}
                  >
                    <Icon name="pencil-square" /> Gerenciar
                  </button>
                )}
              </div>
            ))}
            {res.hasMore && (
              <button
                className="btn btn--secondary btn--block"
                data-more
                onClick={() => setPage(page + 1)}
              >
                Carregar mais
              </button>
            )}
          </>
        )}
      </div>

      {resolving && (
        <Sheet title="Gerenciar denúncia" onClose={() => setResolving(null)}>
          <div style={{ fontSize: '.9rem', marginBottom: 12 }}>
            <strong>Tipo:</strong> {REPORT_TYPE_LABELS[resolving.type] ?? resolving.type}
            <br />
            <strong>Usuário denunciado:</strong> {resolving.target?.name ?? '—'}
            <br />
            <strong>Descrição:</strong>
            <p className="muted" style={{ marginTop: 4 }}>
              {resolving.description}
            </p>
          </div>
          <div className="field">
            <label className="field__label">Nota interna (opcional)</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Observações internas sobre esta denúncia..."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              maxLength={500}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div className="row gap-8" style={{ marginTop: 4 }}>
            {resolving.status === 'PENDING' && (
              <button className="btn btn--secondary full" onClick={() => submitResolve('UNDER_REVIEW')}>
                <Icon name="eye" /> Em análise
              </button>
            )}
            <button className="btn btn--primary full" onClick={() => submitResolve('RESOLVED')}>
              <Icon name="check-circle" /> Resolver
            </button>
            <button className="btn btn--ghost full" onClick={() => submitResolve('DISMISSED')}>
              <Icon name="x-circle" /> Encerrar
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

// ===========================================================================
//  Aba: Sistema — saúde e ações rápidas
// ===========================================================================

function SystemTab({ goTo }: { goTo: (t: Tab) => void }) {
  const { toast } = useToast();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setHealth(await api.get('/stats/health'));
    } catch (err) {
      setError(errorMessage(err, 'Erro ao carregar saúde do sistema'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState icon="exclamation-triangle" title={error} subtitle="Tente novamente." />;
  if (!health) {
    return (
      <div className="row" style={{ justifyContent: 'center', padding: 20 }}>
        <Spinner />
      </div>
    );
  }

  const ratio7d = health.activeUsersLast7d
    ? Math.round((health.activeUsersLast24h / health.activeUsersLast7d) * 100)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard title="Pulso da plataforma (últimos 7 dias)" icon="activity">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <KpiCard value={formatNumber(health.activeUsersLast24h)} label="Ativos 24h" icon="lightning" />
          <KpiCard value={formatNumber(health.activeUsersLast7d)} label="Ativos 7d" icon="people" accent="#0ea5e9" />
          <KpiCard value={formatNumber(health.newUsersLast7d)} label="Novos usuários" icon="person-plus" accent="#22c55e" />
          <KpiCard value={formatNumber(health.newRequestsLast7d)} label="Novas solicitações" icon="envelope-plus" accent="#a855f7" />
          <KpiCard value={formatNumber(health.completedLast7d)} label="Trocas concluídas" icon="trophy" accent="#eab308" />
          <KpiCard value={`${ratio7d}%`} label="Engajamento (24h/7d)" icon="speedometer" accent="#ec4899" />
        </div>
      </SectionCard>

      <SectionCard title="Atenção necessária" icon="exclamation-triangle">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: '.78rem' }}>Denúncias pendentes</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: health.pendingReports > 0 ? 'var(--danger)' : 'var(--text)' }}>
              {formatNumber(health.pendingReports)}
            </div>
            <button className="btn btn--secondary btn--sm" style={{ marginTop: 6 }} onClick={() => goTo('reports')}>
              <Icon name="arrow-right" /> Abrir lista
            </button>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: '.78rem' }}>Denúncias em análise</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--warning)' }}>
              {formatNumber(health.underReviewReports)}
            </div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: '.78rem' }}>Solicitações pendentes</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{formatNumber(health.pendingRequests)}</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: '.78rem' }}>Contas desativadas</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{formatNumber(health.inactiveUsers)}</div>
            <button className="btn btn--secondary btn--sm" style={{ marginTop: 6 }} onClick={() => goTo('users')}>
              <Icon name="arrow-right" /> Ver usuários
            </button>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: '.78rem' }}>Onboarding parado (30d+)</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{formatNumber(health.onboardingPending)}</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: '.78rem' }}>Tokens de reset ativos</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{formatNumber(health.pendingPasswordResets)}</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Ações rápidas" icon="lightning-charge">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          <button className="btn btn--secondary" onClick={() => goTo('dashboard')}>
            <Icon name="bar-chart-line" /> Voltar ao dashboard
          </button>
          <button className="btn btn--secondary" onClick={() => goTo('users')}>
            <Icon name="people-fill" /> Gestão de usuários
          </button>
          <button className="btn btn--secondary" onClick={() => goTo('categories')}>
            <Icon name="tags" /> Categorias
          </button>
          <button className="btn btn--secondary" onClick={() => goTo('skills')}>
            <Icon name="tools" /> Habilidades
          </button>
          <button className="btn btn--secondary" onClick={() => goTo('reports')}>
            <Icon name="flag" /> Moderar denúncias
          </button>
          <button className="btn btn--secondary" onClick={load}>
            <Icon name="arrow-clockwise" /> Recarregar saúde
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => {
              const root = document.documentElement;
              const cur = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
              root.setAttribute('data-theme', cur);
              try {
                localStorage.setItem('skillex_theme', cur);
              } catch {
                /* ignora — storage pode estar indisponível */
              }
              toast(`Tema alterado para ${cur === 'dark' ? 'escuro' : 'claro'}`, 'success');
            }}
          >
            <Icon name="palette" /> Alternar tema
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => {
              navigator.clipboard
                .writeText(JSON.stringify(health, null, 2))
                .then(() => toast('Diagnóstico copiado', 'success'))
                .catch(() => toast('Não foi possível copiar', 'error'));
            }}
          >
            <Icon name="clipboard-check" /> Copiar diagnóstico
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Informações do ambiente" icon="info-circle">
        <table style={{ width: '100%', fontSize: '.85rem' }}>
          <tbody>
            <tr>
              <td className="muted">Atualizado em</td>
              <td style={{ textAlign: 'right' }}><strong>{new Date().toLocaleString('pt-BR')}</strong></td>
            </tr>
            <tr>
              <td className="muted">User-agent</td>
              <td style={{ textAlign: 'right', wordBreak: 'break-all', fontSize: '.72rem' }}>
                {navigator.userAgent}
              </td>
            </tr>
            <tr>
              <td className="muted">Idioma do navegador</td>
              <td style={{ textAlign: 'right' }}><strong>{navigator.language}</strong></td>
            </tr>
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

// ===========================================================================
//  Página principal
// ===========================================================================

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'dashboard', label: 'Dashboard', icon: 'speedometer2' },
  { key: 'users', label: 'Usuários', icon: 'people-fill' },
  { key: 'categories', label: 'Categorias', icon: 'tags' },
  { key: 'skills', label: 'Habilidades', icon: 'tools' },
  { key: 'reports', label: 'Denúncias', icon: 'flag' },
  { key: 'system', label: 'Sistema', icon: 'gear' },
];

export function Admin() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');

  if (!isAdmin) {
    return <EmptyState icon="lock-fill" title="Acesso restrito" subtitle="Somente administradores." />;
  }

  return (
    <>
      <h1 className="page-title">Painel administrativo</h1>
      <p className="page-subtitle">Gestão completa da plataforma SkillEx</p>
      <div className="segmented" id="admin-tabs">
        {TABS.map((t) => (
          <button key={t.key} data-tab={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            <Icon name={t.icon} /> {t.label}
          </button>
        ))}
      </div>
      <div id="admin-content">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'skills' && <SkillsTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'system' && <SystemTab goTo={setTab} />}
      </div>
    </>
  );
}
