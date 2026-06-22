/**
 * Analytics avançadas para o painel administrativo.
 *
 * Cada função devolve dados já prontos para o front renderizar em gráficos
 * (séries temporais, distribuições, top-N) e tabelas exportáveis.
 */
import { prisma } from '../../config/prisma';

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDayBuckets(days: number): Map<string, number> {
  const buckets = new Map<string, number>();
  const today = startOfDay(new Date());
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.set(isoDay(d), 0);
  }
  return buckets;
}

function bucketize<T extends { createdAt: Date }>(rows: T[], days: number): Array<{ date: string; value: number }> {
  const buckets = buildDayBuckets(days);
  for (const r of rows) {
    const key = isoDay(startOfDay(r.createdAt));
    /* v8 ignore next -- as consultas já filtram pelo range; a chave sempre existe */
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets, ([date, value]) => ({ date, value }));
}

// ---------------------------------------------------------------------------
//  Séries temporais (últimos N dias)
// ---------------------------------------------------------------------------

export async function getTimeSeries(days = 30) {
  const since = startOfDay(new Date());
  since.setDate(since.getDate() - (days - 1));

  const [users, requests, completed, reviews, reports] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.exchangeRequest.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.exchangeRequest.findMany({
      where: { status: 'COMPLETED', updatedAt: { gte: since } },
      select: { updatedAt: true },
    }),
    prisma.review.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.report.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
  ]);

  return {
    days,
    newUsers: bucketize(users, days),
    newRequests: bucketize(requests, days),
    completedExchanges: bucketize(
      completed.map((r) => ({ createdAt: r.updatedAt })),
      days,
    ),
    newReviews: bucketize(reviews, days),
    newReports: bucketize(reports, days),
  };
}

// ---------------------------------------------------------------------------
//  Distribuições (donut / barras)
// ---------------------------------------------------------------------------

export async function getDistributions() {
  const [
    usersByRole,
    usersByStatus,
    usersByOnboarding,
    requestsByStatus,
    requestsByType,
    reviewsByRating,
    reportsByStatus,
    reportsByType,
    transactionsByType,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.groupBy({ by: ['isActive'], _count: { _all: true } }),
    prisma.user.groupBy({ by: ['onboardingCompleted'], _count: { _all: true } }),
    prisma.exchangeRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.exchangeRequest.groupBy({ by: ['type'], _count: { _all: true } }),
    prisma.review.groupBy({ by: ['rating'], _count: { _all: true } }),
    prisma.report.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.report.groupBy({ by: ['type'], _count: { _all: true } }),
    prisma.coinTransaction.groupBy({ by: ['type'], _count: { _all: true }, _sum: { amount: true } }),
  ]);

  const map = <T extends { _count: { _all: number } }>(rows: T[], key: keyof T): Array<{ label: string; value: number }> =>
    rows.map((r) => ({ label: String(r[key]), value: r._count._all })).sort((a, b) => b.value - a.value);

  return {
    usersByRole: map(usersByRole, 'role'),
    usersByStatus: usersByStatus.map((r) => ({
      label: r.isActive ? 'Ativos' : 'Desativados',
      value: r._count._all,
    })),
    usersByOnboarding: usersByOnboarding.map((r) => ({
      label: r.onboardingCompleted ? 'Onboarding completo' : 'Onboarding pendente',
      value: r._count._all,
    })),
    requestsByStatus: map(requestsByStatus, 'status'),
    requestsByType: map(requestsByType, 'type'),
    reviewsByRating: reviewsByRating
      .map((r) => ({ label: `${r.rating} estrela${r.rating > 1 ? 's' : ''}`, value: r._count._all, rating: r.rating }))
      .sort((a, b) => a.rating - b.rating),
    reportsByStatus: map(reportsByStatus, 'status'),
    reportsByType: map(reportsByType, 'type'),
    transactionsByType: transactionsByType.map((r) => ({
      label: r.type,
      value: r._count._all,
      /* v8 ignore next -- grupo sempre tem linhas com amount não-nulo → soma nunca é null */
      total: r._sum.amount ?? 0,
    })),
  };
}

// ---------------------------------------------------------------------------
//  Top listas
// ---------------------------------------------------------------------------

export async function getTopLists(limit = 10) {
  const [categories, skillsTeaching, skillsLearning, topReviewed, topRequested, mostActive] = await Promise.all([
    prisma.category.findMany({
      include: { _count: { select: { skills: true } } },
    }),
    prisma.skill.findMany({
      include: { category: true, _count: { select: { teachingLinks: true } } },
      orderBy: { teachingLinks: { _count: 'desc' } },
      take: limit,
    }),
    prisma.skill.findMany({
      include: { category: true, _count: { select: { learningLinks: true } } },
      orderBy: { learningLinks: { _count: 'desc' } },
      take: limit,
    }),
    prisma.skill.findMany({
      include: { category: true, _count: { select: { reviews: true } } },
      orderBy: { reviews: { _count: 'desc' } },
      take: limit,
    }),
    prisma.skill.findMany({
      include: { category: true, _count: { select: { requestedIn: true } } },
      orderBy: { requestedIn: { _count: 'desc' } },
      take: limit,
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { lastActiveAt: 'desc' },
      select: { id: true, name: true, email: true, avatarUrl: true, lastActiveAt: true, city: true, state: true },
      take: limit,
    }),
  ]);

  return {
    topCategories: categories
      .map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, skills: c._count.skills }))
      .sort((a, b) => b.skills - a.skills)
      .slice(0, limit),
    topTeachingSkills: skillsTeaching
      .filter((s) => s._count.teachingLinks > 0)
      .map((s) => ({ id: s.id, name: s.name, category: s.category.name, count: s._count.teachingLinks })),
    topLearningSkills: skillsLearning
      .filter((s) => s._count.learningLinks > 0)
      .map((s) => ({ id: s.id, name: s.name, category: s.category.name, count: s._count.learningLinks })),
    topReviewedSkills: topReviewed
      .filter((s) => s._count.reviews > 0)
      .map((s) => ({ id: s.id, name: s.name, category: s.category.name, count: s._count.reviews })),
    topRequestedSkills: topRequested
      .filter((s) => s._count.requestedIn > 0)
      .map((s) => ({ id: s.id, name: s.name, category: s.category.name, count: s._count.requestedIn })),
    mostActiveUsers: mostActive,
  };
}

// ---------------------------------------------------------------------------
//  Carteira / economia interna
// ---------------------------------------------------------------------------

export async function getWalletStats() {
  const [wallets, transactions, last30dTxs] = await Promise.all([
    prisma.wallet.aggregate({
      _sum: { balance: true, lockedBalance: true },
      _avg: { balance: true },
      _count: true,
    }),
    prisma.coinTransaction.count(),
    prisma.coinTransaction.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
      select: { amount: true, type: true, createdAt: true },
    }),
  ]);

  const credited = last30dTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const debited = last30dTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return {
    totalWallets: wallets._count,
    totalAvailable: wallets._sum.balance ?? 0,
    totalLocked: wallets._sum.lockedBalance ?? 0,
    inCirculation: (wallets._sum.balance ?? 0) + (wallets._sum.lockedBalance ?? 0),
    averageBalance: Math.round(wallets._avg.balance ?? 0),
    totalTransactions: transactions,
    last30Days: {
      credited,
      debited,
      net: credited - debited,
      count: last30dTxs.length,
    },
  };
}

// ---------------------------------------------------------------------------
//  Saúde do sistema (atalhos de moderação)
// ---------------------------------------------------------------------------

export async function getSystemHealth() {
  const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [
    pendingReports,
    underReviewReports,
    pendingRequests,
    inactiveUsers,
    activeUsersLast24h,
    activeUsersLast7d,
    newUsersLast7d,
    newRequestsLast7d,
    completedLast7d,
    pendingPasswordResets,
    onboardingPending,
  ] = await Promise.all([
    prisma.report.count({ where: { status: 'PENDING' } }),
    prisma.report.count({ where: { status: 'UNDER_REVIEW' } }),
    prisma.exchangeRequest.count({ where: { status: 'PENDING' } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.user.count({ where: { lastActiveAt: { gte: oneDayAgo } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.exchangeRequest.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.exchangeRequest.count({ where: { status: 'COMPLETED', updatedAt: { gte: sevenDaysAgo } } }),
    prisma.passwordResetToken.count({ where: { usedAt: null, expiresAt: { gte: new Date() } } }),
    prisma.user.count({ where: { onboardingCompleted: false, createdAt: { lte: thirtyDaysAgo } } }),
  ]);

  return {
    pendingReports,
    underReviewReports,
    pendingRequests,
    inactiveUsers,
    activeUsersLast24h,
    activeUsersLast7d,
    newUsersLast7d,
    newRequestsLast7d,
    completedLast7d,
    pendingPasswordResets,
    onboardingPending,
  };
}

// ---------------------------------------------------------------------------
//  Geo (distribuição por estado)
// ---------------------------------------------------------------------------

export async function getGeoDistribution() {
  const byState = await prisma.user.groupBy({
    by: ['state'],
    where: { state: { not: null }, isActive: true },
    _count: { _all: true },
  });
  return {
    states: byState
      .filter((s) => s.state)
      .map((s) => ({ label: String(s.state), value: s._count._all }))
      .sort((a, b) => b.value - a.value),
  };
}
