import { fmt } from './ui';
// Each page: k=route, t=title, i=icon, p=API path, b=builder(data) -> { stats, charts, tables }
const N = (a = [], k, v = k) => a.map((r) => ({ name: typeof r._id === 'object' && r._id ? Object.values(r._id).join(' / ') : r._id ?? '—', [v]: r[k] }));
const sum = (a = [], k) => a.reduce((s, r) => s + (r[k] || 0), 0);
const max = (a = [], k) => Math.max(0, ...a.map((r) => r[k] || 0));
const money = (a = [], k = 'revenue') => a.map((r) => `${fmt(r[k])} ${r.currency || r._id || ''}`).join(', ') || 0;
const deathBuild = (d) => ({
  stats: [['Total', d.total], ['Avg per game', d.avgPerGame]],
  charts: [{ title: 'Per day', data: N(d.perDay, 'total') }, { title: 'By level', type: 'bar', data: N(d.byLevel, 'total') }, { title: 'By difficulty', type: 'bar', data: N(d.byDifficulty, 'total') }, { title: 'By map', type: 'bar', data: N(d.byMap, 'total') }],
  tables: [{ title: 'Event breakdown (level / cause / checkpoint)', rows: d.eventBreakdown }],
});

export const PAGES = [
  { k: '', t: 'Overview', i: 'grid_view', p: 'overview', b: (d) => ({
    stats: [['Total Users', d.totalUsers], ['New Users', d.newUsers], ['Active Users', d.activeUsers], ['App Sessions', d.sessions], ['Avg Session', fmt(d.avgSessionDurationMs, 'ms')],
      ['Game Sessions', d.gameSessions], ['Win Rate', d.winRate + '%'], ['Deaths', d.totalDeaths], ['IAP Revenue', money(d.iapRevenue)], ['Ad Revenue', money(d.adRevenue)]],
    tables: [{ title: 'IAP revenue', rows: d.iapRevenue }, { title: 'Ad revenue', rows: d.adRevenue }] }) },
  { k: 'players', t: 'Player Analytics', i: 'group', p: 'players', b: (d) => ({
    stats: [['New users', sum(d.newUsersPerDay, 'newUsers')], ['Peak DAU', max(d.dailyActiveUsers, 'dau')]],
    charts: [{ title: 'New users / day', data: N(d.newUsersPerDay, 'newUsers') }, { title: 'Daily active users', data: N(d.dailyActiveUsers, 'dau') }, { title: 'By country', type: 'bar', data: N(d.byCountry, 'users') }, { title: 'By platform', type: 'bar', data: N(d.byPlatform, 'users') }],
    tables: [{ title: 'Top events', rows: d.topEvents }] }) },
  { k: 'sessions', t: 'Session Analytics', i: 'timer', p: 'sessions', b: (d) => ({
    stats: [['Games / app session', d.avgGamesPerAppSession], ['Avg loading', fmt(d.avgLoadingMs, 'ms')]],
    charts: [{ title: 'Sessions / day', data: N(d.perDay, 'sessions') }, { title: 'By status', type: 'bar', data: N(d.byStatus, 'sessions') }, { title: 'By network', type: 'bar', data: N(d.byNetwork, 'sessions') }, { title: 'By device', type: 'bar', data: N(d.byDevice, 'sessions') }],
    tables: [{ title: 'By OS', rows: d.byOS }, { title: 'By app version', rows: d.byAppVersion }] }) },
  { k: 'buttons', t: 'Button Analytics', i: 'touch_app', p: 'buttons', b: (d) => ({
    charts: [{ title: 'Top buttons', type: 'bar', data: (d.buttons || []).slice(0, 12).map((r) => ({ name: r.button, clicks: r.clicks })) }],
    tables: [{ title: 'Button clicks', rows: d.buttons }, { title: 'Screens', rows: d.screens }] }) },
  { k: 'gameplay', t: 'Gameplay Analytics', i: 'sports_esports', p: 'gameplay', b: (d) => ({
    stats: [['Rage quit rate', d.rageQuitRate + '%']],
    charts: [{ title: 'Games / day', data: N(d.perDay, 'sessions') }, { title: 'Outcomes', type: 'bar', data: N(d.outcomes, 'sessions') }, { title: 'End reasons', type: 'bar', data: N(d.endReasons, 'sessions') }],
    tables: [{ title: 'By mode', rows: d.byMode }, { title: 'By difficulty', rows: d.byDifficulty }, { title: 'By map', rows: d.byMap }, { title: 'By character', rows: d.byCharacter }] }) },
  { k: 'deaths', t: 'Death Analytics', i: 'skull', p: 'deaths', b: deathBuild },
  { k: 'respawns', t: 'Respawn Analytics', i: 'restart_alt', p: 'respawns', b: deathBuild },
  { k: 'levels', t: 'Level Analytics', i: 'flag', p: 'levels', b: (d) => ({
    charts: [{ title: 'Completion / fail rate % by level', type: 'bar', data: (d.levels || []).map((l) => ({ name: l.level_id, completionRate: l.completionRate, failRate: l.failRate })) }],
    tables: [{ title: 'Levels', rows: d.levels }, { title: 'Hardest checkpoints', rows: d.hardestCheckpoints }] }) },
  { k: 'inventory', t: 'Inventory Analytics', i: 'inventory_2', p: 'inventory', b: (d) => ({
    charts: [{ title: 'Top items', type: 'bar', data: (d.topItems || []).slice(0, 10).map((r) => ({ name: r.item_id, events: r.total })) }, { title: 'By category', type: 'bar', data: N(d.byCategory, 'events') }, { title: 'By rarity', type: 'bar', data: N(d.byRarity, 'events') }, { title: 'By action', type: 'bar', data: N(d.byAction, 'events') }],
    tables: [{ title: 'Items', rows: d.topItems }] }) },
  { k: 'purchases', t: 'Purchase Analytics', i: 'shopping_cart', p: 'purchases', b: (d) => ({
    stats: [['Success rate', d.successRate + '%']],
    charts: [{ title: 'Purchases / day', data: N(d.perDay, 'purchases') }, { title: 'Spend by currency', type: 'bar', data: N(d.spendByCurrency, 'spent') }],
    tables: [{ title: 'Top items', rows: d.topItems }, { title: 'By source', rows: d.bySource }, { title: 'Avg decision time', rows: d.avgDecisionTimeByCategory }] }) },
  { k: 'currency', t: 'Currency Analytics', i: 'paid', p: 'currency', b: (d) => ({
    charts: [{ title: 'Flow by currency / type', type: 'bar', data: (d.flow || []).map((r) => ({ name: `${r._id.currency} ${r._id.type}`, total: r.total })) },
      { title: 'Earned vs spent / day', data: (d.perDay || []).map((r) => ({ name: r._id.day.slice(5) + ' ' + r._id.currency, earned: r.earned, spent: r.spent })) }],
    tables: [{ title: 'By source', rows: d.bySource }, { title: 'Balances', rows: d.balances }] }) },
  { k: 'iap', t: 'IAP Analytics', i: 'payments', p: 'iap', b: (d) => { const m = (d.monetization || [])[0] || {}; return {
    stats: [['Success rate', d.successRate + '%'], ['Revenue', money(d.monetization)], ['ARPU', m.arpu], ['ARPPU', m.arppu], ['Conversion', (m.conversionRate ?? 0) + '%']],
    charts: [{ title: 'Revenue / day', data: (d.perDay || []).map((r) => ({ name: r._id.day.slice(5) + ' ' + r._id.currency, revenue: r.revenue })) }, { title: 'Revenue by product', type: 'bar', data: (d.byProduct || []).map((r) => ({ name: r._id.id, revenue: r.revenue })) }],
    tables: [{ title: 'Monetization', rows: d.monetization }, { title: 'Products', rows: d.byProduct }, { title: 'By source', rows: d.bySource }, { title: 'By store', rows: d.byStore }] }; } },
  { k: 'ads', t: 'Advertisement Analytics', i: 'ads_click', p: 'ads', b: (d) => { const o = d.overall || {}; return {
    stats: [['Impressions', o.impressions], ['Fill rate', (o.fillRate ?? 0) + '%'], ['CTR', (o.ctr ?? 0) + '%'], ['eCPM', o.ecpm], ['Revenue', o.revenue]],
    charts: [{ title: 'Impressions & clicks / day', data: (d.perDay || []).map((r) => ({ name: r._id, impressions: r.impressions, clicks: r.clicks })) }, { title: 'Revenue by network', type: 'bar', data: N(d.byNetwork, 'revenue') }, { title: 'Revenue by placement', type: 'bar', data: N(d.byPlacement, 'revenue') }],
    tables: [{ title: 'By network', rows: d.byNetwork }, { title: 'By type', rows: d.byType }, { title: 'By placement', rows: d.byPlacement }, { title: 'Close types', rows: d.closeTypes }] }; } },
  { k: 'retention', t: 'Retention', i: 'filter_alt', p: 'retention', b: (d) => ({
    stats: (d.overall || []).map((r) => [`Day ${r.day}`, r.rate + '%']),
    charts: [{ title: 'Retention % by day', data: (d.overall || []).map((r) => ({ name: 'D' + r.day, rate: r.rate })) }],
    tables: [{ title: 'Cohorts', rows: (d.cohorts || []).map((c) => ({ date: c.date, size: c.size, ...Object.fromEntries(c.retention.map((r) => ['D' + r.day, r.rate + '%'])) })) }] }) },
  { k: 'performance', t: 'Performance', i: 'speed', p: 'performance', b: (d) => ({
    stats: [['Avg latency', fmt(d.network?.avgLatencyMs, 'ms')], ['Max latency', fmt(d.network?.maxLatencyMs, 'ms')]],
    charts: [{ title: 'Avg FPS by device', type: 'bar', data: N(d.byDevice, 'avgFps') }, { title: 'Avg FPS / day', data: N(d.perDay, 'avgFps') }, { title: 'Crashes / day', data: N(d.perDay, 'crashes') }, { title: 'Crashes by device', type: 'bar', data: N(d.crashesByDevice, 'crashes') }],
    tables: [{ title: 'Devices', rows: d.byDevice }, { title: 'Top errors', rows: d.topErrors }, { title: 'By graphics setting', rows: d.byGraphics }] }) },
  { k: 'experiments', t: 'A/B Testing', i: 'science', special: 'experiments' },
];
