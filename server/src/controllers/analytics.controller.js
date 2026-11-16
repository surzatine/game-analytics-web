const M = require('../models');

// ---------- helpers ----------
const wrap = (fn) => async (req, res, next) => {
  try { res.json({ success: true, data: await fn(req) }); } catch (e) { next(e); }
};

/** ?from=2026-01-01&to=2026-01-31 (default: last 30 days) -> {$gte,$lte} */
const range = (q) => {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * 864e5);
  if (q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to)) to.setUTCHours(23, 59, 59, 999);
  return { $gte: from, $lte: to };
};
const between = (field, q) => ({ [field]: range(q) });
const day = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: `$${field}` } });
const cnt = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
const eq = (f, v) => ({ $eq: [`$${f}`, v] });
const round = (n, d = 2) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);
const pct = (a, b) => (b ? round((a / b) * 100) : 0);
const limit = (q, def = 20) => Math.min(parseInt(q.limit) || def, 200);

// ---------- 1. Overview ----------
exports.overview = wrap(async (req) => {
  const q = req.query;
  const [totalUsers, newUsers, activeUsers, sess, games, iap, ads] = await Promise.all([
    M.User.countDocuments(),
    M.User.countDocuments(between('account_created_at', q)),
    M.AppSession.distinct('user_id', between('session_start', q)),
    M.AppSession.aggregate([{ $match: between('session_start', q) }, { $group: { _id: null, total: { $sum: 1 }, avgDuration: { $avg: '$session_duration_ms' } } }]),
    M.GameSession.aggregate([{ $match: between('game_start_time', q) }, { $group: {
      _id: null, total: { $sum: 1 }, avgDuration: { $avg: '$elapsed_time_ms' },
      wins: cnt(eq('game_outcome', 'Win')), deaths: { $sum: '$death_count' }, rageQuits: cnt({ $eq: ['$rage_quit', true] }),
    } }]),
    M.IapTransaction.aggregate([{ $match: { ...between('event_timestamp_utc', q), purchase_status: 'Success' } }, { $group: { _id: '$price_currency', revenue: { $sum: '$price' }, count: { $sum: 1 }, payers: { $addToSet: '$user_id' } } }]),
    M.AdEvent.aggregate([{ $match: between('event_timestamp_utc', q) }, { $group: { _id: '$revenue_currency', revenue: { $sum: '$ad_revenue' } } }]),
  ]);
  const s = sess[0] || {}, g = games[0] || {};
  return {
    totalUsers, newUsers, activeUsers: activeUsers.length,
    sessions: s.total || 0, avgSessionDurationMs: round(s.avgDuration),
    gameSessions: g.total || 0, avgGameDurationMs: round(g.avgDuration),
    winRate: pct(g.wins, g.total), totalDeaths: g.deaths || 0, rageQuitRate: pct(g.rageQuits, g.total),
    iapRevenue: iap.map((r) => ({ currency: r._id, revenue: round(r.revenue), transactions: r.count, payers: r.payers.length })),
    adRevenue: ads.map((r) => ({ currency: r._id, revenue: round(r.revenue, 4) })),
  };
});

// ---------- 2. Players ----------
exports.players = wrap(async (req) => {
  const q = req.query;
  const [newPerDay, dau, byCountry, byPlatform, topEvents] = await Promise.all([
    M.User.aggregate([{ $match: between('account_created_at', q) }, { $group: { _id: day('account_created_at'), newUsers: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    M.AppSession.aggregate([{ $match: between('session_start', q) }, { $group: { _id: day('session_start'), users: { $addToSet: '$user_id' } } }, { $project: { dau: { $size: '$users' } } }, { $sort: { _id: 1 } }]),
    M.User.aggregate([{ $group: { _id: '$country', users: { $sum: 1 } } }, { $sort: { users: -1 } }, { $limit: limit(q) }]),
    M.User.aggregate([{ $group: { _id: '$platform', users: { $sum: 1 } } }, { $sort: { users: -1 } }]),
    M.Event.aggregate([{ $match: between('event_timestamp_utc', q) }, { $group: { _id: '$event_name', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: limit(q) }]),
  ]);
  return { newUsersPerDay: newPerDay, dailyActiveUsers: dau, byCountry, byPlatform, topEvents };
});

// ---------- 3. Sessions ----------
exports.sessions = wrap(async (req) => {
  const q = req.query, match = { $match: between('session_start', q) };
  const grp = (id) => M.AppSession.aggregate([match, { $group: { _id: id, sessions: { $sum: 1 } } }, { $sort: { sessions: -1 } }]);
  const [perDay, status, network, device, os, version, gamesPerApp, loading] = await Promise.all([
    M.AppSession.aggregate([match, { $group: { _id: day('session_start'), sessions: { $sum: 1 }, avgDurationMs: { $avg: '$session_duration_ms' } } }, { $sort: { _id: 1 } }]),
    grp('$session_status'), grp('$network_type'),
    M.AppSession.aggregate([match, { $group: { _id: '$device_name', sessions: { $sum: 1 } } }, { $sort: { sessions: -1 } }, { $limit: limit(q) }]),
    grp('$device_os'), grp('$app_version'),
    M.GameSession.aggregate([{ $match: between('game_start_time', q) }, { $group: { _id: '$app_session_id', games: { $sum: 1 } } }, { $group: { _id: null, avgGamesPerSession: { $avg: '$games' } } }]),
    M.AppSession.aggregate([match, { $match: { loading_start: { $ne: null }, loading_complete: { $ne: null } } },
      { $group: { _id: null, avgLoadingMs: { $avg: { $subtract: ['$loading_complete', '$loading_start'] } } } }]),
  ]);
  return {
    perDay, byStatus: status, byNetwork: network, byDevice: device, byOS: os, byAppVersion: version,
    avgGamesPerAppSession: round(gamesPerApp[0]?.avgGamesPerSession), avgLoadingMs: round(loading[0]?.avgLoadingMs),
  };
});

// ---------- 4. Buttons ----------
exports.buttons = wrap(async (req) => {
  const q = req.query;
  const match = { $match: { ...between('event_timestamp_utc', q), event_name: 'button_click' } };
  const [buttons, screens] = await Promise.all([
    M.Event.aggregate([match, { $group: { _id: { button: '$properties.button_name', screen: '$screen_name' }, clicks: { $sum: 1 }, users: { $addToSet: '$user_id' } } },
      { $project: { _id: 0, button: '$_id.button', screen: '$_id.screen', clicks: 1, uniqueUsers: { $size: '$users' } } }, { $sort: { clicks: -1 } }, { $limit: limit(q, 50) }]),
    M.Event.aggregate([{ $match: { ...between('event_timestamp_utc', q), event_name: { $in: ['screen_view', 'screen_exit'] } } },
      { $group: { _id: '$screen_name', views: cnt({ $eq: ['$event_name', 'screen_view'] }), avgTimeOnScreenMs: { $avg: { $cond: [{ $eq: ['$event_name', 'screen_exit'] }, '$properties.duration_ms', null] } } } }, { $sort: { views: -1 } }]),
  ]);
  return { buttons, screens };
});

// ---------- 5. Gameplay ----------
exports.gameplay = wrap(async (req) => {
  const q = req.query, match = { $match: between('game_start_time', q) };
  const stat = (id) => M.GameSession.aggregate([match, { $group: { _id: id, sessions: { $sum: 1 }, wins: cnt(eq('game_outcome', 'Win')),
    avgDurationMs: { $avg: '$elapsed_time_ms' }, avgDeaths: { $avg: '$death_count' } } },
    { $addFields: { winRate: { $round: [{ $multiply: [{ $divide: ['$wins', '$sessions'] }, 100] }, 2] } } }, { $sort: { sessions: -1 } }]);
  const simple = (id) => M.GameSession.aggregate([match, { $group: { _id: id, sessions: { $sum: 1 } } }, { $sort: { sessions: -1 } }]);
  const [perDay, byMode, byDifficulty, byMap, byCharacter, outcomes, endReasons, rage] = await Promise.all([
    M.GameSession.aggregate([match, { $group: { _id: day('game_start_time'), sessions: { $sum: 1 }, avgDurationMs: { $avg: '$elapsed_time_ms' } } }, { $sort: { _id: 1 } }]),
    stat('$game_mode_id'), stat('$difficulty'), stat('$map_id'), stat('$character_id'),
    simple('$game_outcome'), simple('$game_end_reason'),
    M.GameSession.aggregate([match, { $group: { _id: null, total: { $sum: 1 }, rageQuits: cnt({ $eq: ['$rage_quit', true] }) } }]),
  ]);
  return { perDay, byMode, byDifficulty, byMap, byCharacter, outcomes, endReasons, rageQuitRate: pct(rage[0]?.rageQuits, rage[0]?.total) };
});

// ---------- 6/7. Deaths & Respawns ----------
const deathRespawn = (field, eventName) => wrap(async (req) => {
  const q = req.query, match = { $match: between('game_start_time', q) };
  const [totals, byLevel, byMap, byDifficulty, perDay, hotspots] = await Promise.all([
    M.GameSession.aggregate([match, { $group: { _id: null, total: { $sum: `$${field}` }, avgPerGame: { $avg: `$${field}` }, games: { $sum: 1 } } }]),
    M.GameSession.aggregate([match, { $group: { _id: '$level_id', total: { $sum: `$${field}` }, avgPerGame: { $avg: `$${field}` } } }, { $sort: { total: -1 } }, { $limit: limit(q) }]),
    M.GameSession.aggregate([match, { $group: { _id: '$map_id', total: { $sum: `$${field}` } } }, { $sort: { total: -1 } }, { $limit: limit(q) }]),
    M.GameSession.aggregate([match, { $group: { _id: '$difficulty', total: { $sum: `$${field}` }, avgPerGame: { $avg: `$${field}` } } }, { $sort: { total: -1 } }]),
    M.GameSession.aggregate([match, { $group: { _id: day('game_start_time'), total: { $sum: `$${field}` } } }, { $sort: { _id: 1 } }]),
    // event-level detail: Unity sends properties.{cause, x, y, z, level_id}
    M.Event.aggregate([{ $match: { ...between('event_timestamp_utc', q), event_name: eventName } },
      { $group: { _id: { level: '$properties.level_id', cause: '$properties.cause', checkpoint: '$properties.checkpoint_id' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: limit(q) }]),
  ]);
  return { total: totals[0]?.total || 0, avgPerGame: round(totals[0]?.avgPerGame), byLevel, byMap, byDifficulty, perDay, eventBreakdown: hotspots };
});
exports.deaths = deathRespawn('death_count', 'player_death');
exports.respawns = deathRespawn('respawn_count', 'player_respawn');

// ---------- 8. Levels ----------
exports.levels = wrap(async (req) => {
  const q = req.query;
  const rows = await M.LevelEvent.aggregate([
    { $match: between('event_timestamp_utc', q) },
    { $group: { _id: '$level_id', starts: cnt(eq('event_type', 'Start')), completes: cnt(eq('event_type', 'Complete')), fails: cnt(eq('event_type', 'Fail')),
      restarts: cnt(eq('event_type', 'Restart')), players: { $addToSet: '$user_id' }, avgAttempts: { $avg: '$attempt_number' }, avgDeaths: { $avg: '$death_count' },
      avgCompleteMs: { $avg: { $cond: [eq('event_type', 'Complete'), '$time_to_complete_ms', null] } } } },
    { $project: { level_id: '$_id', _id: 0, starts: 1, completes: 1, fails: 1, restarts: 1, uniquePlayers: { $size: '$players' }, avgAttempts: { $round: ['$avgAttempts', 2] },
      avgDeaths: { $round: ['$avgDeaths', 2] }, avgCompleteMs: { $round: ['$avgCompleteMs', 0] },
      completionRate: { $round: [{ $multiply: [{ $cond: [{ $gt: ['$starts', 0] }, { $divide: ['$completes', '$starts'] }, 0] }, 100] }, 2] },
      failRate: { $round: [{ $multiply: [{ $cond: [{ $gt: ['$starts', 0] }, { $divide: ['$fails', '$starts'] }, 0] }, 100] }, 2] } } },
    { $sort: { level_id: 1 } },
  ]);
  const checkpoints = await M.LevelEvent.aggregate([
    { $match: { ...between('event_timestamp_utc', q), checkpoint_id: { $ne: null }, event_type: 'Fail' } },
    { $group: { _id: { level: '$level_id', checkpoint: '$checkpoint_id' }, fails: { $sum: 1 } } }, { $sort: { fails: -1 } }, { $limit: limit(q) },
  ]);
  return { levels: rows, hardestCheckpoints: checkpoints };
});

// ---------- 9. Inventory ----------
exports.inventory = wrap(async (req) => {
  const q = req.query, match = { $match: between('event_timestamp_utc', q) };
  const [items, byCategory, byRarity, actions] = await Promise.all([
    M.InventoryEvent.aggregate([match, { $group: { _id: '$item_id', category: { $first: '$item_category' }, rarity: { $first: '$item_rarity' },
      views: cnt(eq('action_type', 'View')), favourites: cnt(eq('action_type', 'Favourite')), equips: cnt(eq('action_type', 'Equip')),
      viewers: { $addToSet: '$user_id' }, ownedEvents: cnt({ $eq: ['$item_owned', true] }), total: { $sum: 1 } } },
      { $project: { item_id: '$_id', _id: 0, category: 1, rarity: 1, views: 1, favourites: 1, equips: 1, uniqueViewers: { $size: '$viewers' }, ownedEvents: 1, total: 1 } },
      { $sort: { total: -1 } }, { $limit: limit(q, 50) }]),
    M.InventoryEvent.aggregate([match, { $group: { _id: '$item_category', events: { $sum: 1 } } }, { $sort: { events: -1 } }]),
    M.InventoryEvent.aggregate([match, { $group: { _id: '$item_rarity', events: { $sum: 1 } } }, { $sort: { events: -1 } }]),
    M.InventoryEvent.aggregate([match, { $group: { _id: '$action_type', events: { $sum: 1 } } }, { $sort: { events: -1 } }]),
  ]);
  return { topItems: items, byCategory, byRarity, byAction: actions };
});

// ---------- 10. Item purchases ----------
exports.purchases = wrap(async (req) => {
  const q = req.query, match = { $match: between('purchase_timestamp', q) }, ok = { $match: { ...between('purchase_timestamp', q), purchase_status: 'Success' } };
  const [status, topItems, spend, bySource, perDay, decision] = await Promise.all([
    M.ItemPurchase.aggregate([match, { $group: { _id: '$purchase_status', count: { $sum: 1 } } }]),
    M.ItemPurchase.aggregate([ok, { $group: { _id: '$item_id', category: { $first: '$item_category' }, purchases: { $sum: 1 }, spent: { $sum: '$cost' }, buyers: { $addToSet: '$user_id' } } },
      { $project: { item_id: '$_id', _id: 0, category: 1, purchases: 1, spent: 1, uniqueBuyers: { $size: '$buyers' } } }, { $sort: { purchases: -1 } }, { $limit: limit(q) }]),
    M.ItemPurchase.aggregate([ok, { $group: { _id: '$currency_type', spent: { $sum: '$cost' }, purchases: { $sum: 1 } } }]),
    M.ItemPurchase.aggregate([ok, { $group: { _id: '$purchase_source', purchases: { $sum: 1 } } }, { $sort: { purchases: -1 } }]),
    M.ItemPurchase.aggregate([ok, { $group: { _id: day('purchase_timestamp'), purchases: { $sum: 1 }, spent: { $sum: '$cost' } } }, { $sort: { _id: 1 } }]),
    M.ItemPurchase.aggregate([ok, { $match: { decision_time_ms: { $ne: null } } }, { $group: { _id: '$item_category', avgDecisionMs: { $avg: '$decision_time_ms' } } }]),
  ]);
  const total = status.reduce((s, r) => s + r.count, 0), success = status.find((s) => s._id === 'Success')?.count || 0;
  return { successRate: pct(success, total), byStatus: status, topItems, spendByCurrency: spend, bySource, perDay, avgDecisionTimeByCategory: decision };
});

// ---------- 11. Currency ----------
exports.currency = wrap(async (req) => {
  const q = req.query, match = { $match: between('event_timestamp_utc', q) };
  const [flow, bySource, perDay, balances] = await Promise.all([
    M.CurrencyTransaction.aggregate([match, { $group: { _id: { currency: '$currency_type', type: '$transaction_type' }, total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { '_id.currency': 1 } }]),
    M.CurrencyTransaction.aggregate([match, { $group: { _id: { currency: '$currency_type', type: '$transaction_type', source: '$transaction_source' }, total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 100 }]),
    M.CurrencyTransaction.aggregate([match, { $group: { _id: { day: day('event_timestamp_utc'), currency: '$currency_type' },
      earned: { $sum: { $cond: [eq('transaction_type', 'Earn'), '$amount', 0] } }, spent: { $sum: { $cond: [eq('transaction_type', 'Spend'), '$amount', 0] } } } }, { $sort: { '_id.day': 1 } }]),
    // latest balance per user & currency -> average
    M.CurrencyTransaction.aggregate([match, { $sort: { event_timestamp_utc: -1 } }, { $group: { _id: { user: '$user_id', currency: '$currency_type' }, balance: { $first: '$balance_after' } } },
      { $group: { _id: '$_id.currency', avgBalance: { $avg: '$balance' }, maxBalance: { $max: '$balance' }, players: { $sum: 1 } } }]),
  ]);
  return { flow, bySource, perDay, balances };
});

// ---------- 12. IAP ----------
exports.iap = wrap(async (req) => {
  const q = req.query, base = between('event_timestamp_utc', q), ok = { $match: { ...base, purchase_status: 'Success' } };
  const [status, byProduct, perDay, bySource, byStore, payers, activeUsers] = await Promise.all([
    M.IapTransaction.aggregate([{ $match: base }, { $group: { _id: '$purchase_status', count: { $sum: 1 } } }]),
    M.IapTransaction.aggregate([ok, { $group: { _id: { id: '$product_id', currency: '$price_currency' }, name: { $first: '$product_name' }, category: { $first: '$product_category' }, purchases: { $sum: 1 }, revenue: { $sum: '$price' } } }, { $sort: { revenue: -1 } }]),
    M.IapTransaction.aggregate([ok, { $group: { _id: { day: day('event_timestamp_utc'), currency: '$price_currency' }, revenue: { $sum: '$price' }, purchases: { $sum: 1 } } }, { $sort: { '_id.day': 1 } }]),
    M.IapTransaction.aggregate([ok, { $group: { _id: '$purchase_source', revenue: { $sum: '$price' }, purchases: { $sum: 1 } } }, { $sort: { revenue: -1 } }]),
    M.IapTransaction.aggregate([ok, { $group: { _id: '$store_platform', revenue: { $sum: '$price' }, purchases: { $sum: 1 } } }]),
    M.IapTransaction.aggregate([ok, { $group: { _id: { user: '$user_id', currency: '$price_currency' }, spend: { $sum: '$price' } } }, { $group: { _id: '$_id.currency', payers: { $sum: 1 }, revenue: { $sum: '$spend' } } }]),
    M.AppSession.distinct('user_id', between('session_start', q)),
  ]);
  const total = status.reduce((s, r) => s + r.count, 0), success = status.find((s) => s._id === 'Success')?.count || 0;
  return {
    successRate: pct(success, total), byStatus: status, byProduct, perDay, bySource, byStore,
    // ARPU = revenue / active users, ARPPU = revenue / paying users, conversion = payers / active users
    monetization: payers.map((p) => ({ currency: p._id, revenue: round(p.revenue), payers: p.payers,
      arpu: activeUsers.length ? round(p.revenue / activeUsers.length) : 0, arppu: round(p.revenue / p.payers),
      conversionRate: pct(p.payers, activeUsers.length) })),
  };
});

// ---------- 13. Ads ----------
exports.ads = wrap(async (req) => {
  const q = req.query, match = { $match: between('event_timestamp_utc', q) };
  const metrics = {
    requests: { $sum: 1 }, loaded: cnt(eq('ad_load_status', 'Loaded')), impressions: cnt({ $eq: ['$ad_impression', true] }),
    clicks: cnt({ $eq: ['$ad_clicked', true] }), rewards: cnt({ $eq: ['$reward_granted', true] }), forceClosed: cnt({ $eq: ['$force_close', true] }),
    revenue: { $sum: '$ad_revenue' }, avgDurationMs: { $avg: '$ad_duration_ms' },
  };
  const derived = { $addFields: {
    fillRate: { $round: [{ $multiply: [{ $cond: [{ $gt: ['$requests', 0] }, { $divide: ['$loaded', '$requests'] }, 0] }, 100] }, 2] },
    ctr: { $round: [{ $multiply: [{ $cond: [{ $gt: ['$impressions', 0] }, { $divide: ['$clicks', '$impressions'] }, 0] }, 100] }, 2] },
    ecpm: { $round: [{ $cond: [{ $gt: ['$impressions', 0] }, { $multiply: [{ $divide: ['$revenue', '$impressions'] }, 1000] }, 0] }, 4] },
  } };
  const group = (id) => M.AdEvent.aggregate([match, { $group: { _id: id, ...metrics } }, derived, { $sort: { revenue: -1 } }]);
  const [overall, byNetwork, byType, byPlacement, perDay, closeTypes] = await Promise.all([
    group(null), group('$ad_network'), group('$ad_type'), group('$ad_placement'),
    M.AdEvent.aggregate([match, { $group: { _id: day('event_timestamp_utc'), ...metrics } }, derived, { $sort: { _id: 1 } }]),
    M.AdEvent.aggregate([match, { $group: { _id: { type: '$close_type', reason: '$close_reason' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
  ]);
  return { overall: overall[0] || {}, byNetwork, byType, byPlacement, perDay, closeTypes };
});

// ---------- 14. Retention (classic N-day, cohort = account_created_at day) ----------
exports.retention = wrap(async (req) => {
  const q = req.query;
  const days = (q.days ? String(q.days).split(',') : [1, 3, 7, 14, 30]).map(Number).filter((n) => n > 0);
  const users = await M.User.find(between('account_created_at', q), 'user_id account_created_at').lean();
  if (!users.length) return { cohorts: [], overall: days.map((d) => ({ day: d, retained: 0, cohortSize: 0, rate: 0 })) };

  const startOfDay = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const joined = new Map(users.map((u) => [u.user_id, startOfDay(u.account_created_at)]));
  const sess = await M.AppSession.find({ user_id: { $in: [...joined.keys()] } }, 'user_id session_start').lean();

  const active = new Map(); // user -> Set(day offsets)
  for (const s of sess) {
    if (!s.session_start) continue;
    const off = Math.round((startOfDay(s.session_start) - joined.get(s.user_id)) / 864e5);
    if (off < 0) continue;
    if (!active.has(s.user_id)) active.set(s.user_id, new Set());
    active.get(s.user_id).add(off);
  }

  const cohortMap = new Map();
  for (const [uid, t] of joined) {
    const key = new Date(t).toISOString().slice(0, 10);
    if (!cohortMap.has(key)) cohortMap.set(key, []);
    cohortMap.get(key).push(uid);
  }
  const calc = (uids) => days.map((d) => {
    const retained = uids.filter((u) => active.get(u)?.has(d)).length;
    return { day: d, retained, cohortSize: uids.length, rate: pct(retained, uids.length) };
  });
  return {
    overall: calc([...joined.keys()]),
    cohorts: [...cohortMap].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, uids]) => ({ date, size: uids.length, retention: calc(uids) })),
  };
});

// ---------- 15. Performance ----------
exports.performance = wrap(async (req) => {
  const q = req.query, match = { $match: between('event_timestamp_utc', q) };
  const [byDevice, byGraphics, errors, crashes, network, perDay] = await Promise.all([
    M.PerformanceEvent.aggregate([match, { $match: { fps_average: { $ne: null } } }, { $group: { _id: '$device_name', samples: { $sum: 1 }, avgFps: { $avg: '$fps_average' }, minFps: { $min: '$fps_minimum' }, avgMemoryMb: { $avg: '$memory_usage_mb' } } },
      { $sort: { samples: -1 } }, { $limit: limit(q) }]),
    M.PerformanceEvent.aggregate([match, { $match: { fps_average: { $ne: null } } }, { $group: { _id: '$graphics_setting', avgFps: { $avg: '$fps_average' }, avgMemoryMb: { $avg: '$memory_usage_mb' }, samples: { $sum: 1 } } }]),
    M.PerformanceEvent.aggregate([match, { $match: { error_code: { $ne: null } } }, { $group: { _id: { code: '$error_code', message: '$error_message' }, count: { $sum: 1 }, devices: { $addToSet: '$device_name' } } },
      { $project: { count: 1, affectedDevices: { $size: '$devices' } } }, { $sort: { count: -1 } }, { $limit: limit(q) }]),
    M.PerformanceEvent.aggregate([match, { $match: { event_type: 'Crash' } }, { $group: { _id: '$device_name', crashes: { $sum: 1 } } }, { $sort: { crashes: -1 } }, { $limit: limit(q) }]),
    M.PerformanceEvent.aggregate([match, { $match: { network_latency_ms: { $ne: null } } }, { $group: { _id: null, avgLatencyMs: { $avg: '$network_latency_ms' }, maxLatencyMs: { $max: '$network_latency_ms' } } }]),
    M.PerformanceEvent.aggregate([match, { $group: { _id: day('event_timestamp_utc'), avgFps: { $avg: '$fps_average' }, crashes: cnt(eq('event_type', 'Crash')) } }, { $sort: { _id: 1 } }]),
  ]);
  return { byDevice, byGraphics, topErrors: errors, crashesByDevice: crashes, network: network[0] || {}, perDay };
});

// ---------- 16. A/B testing ----------
exports.experiments = wrap(async () => M.Experiment.find().sort({ createdAt: -1 }).lean());

exports.experimentResults = wrap(async (req) => {
  const id = req.params.id;
  const exp = await M.Experiment.findOne({ experiment_id: id }).lean();
  if (!exp) throw Object.assign(new Error('Experiment not found'), { status: 404 });

  const assigns = await M.ExperimentAssignment.find({ experiment_id: id }, 'user_id variant_id').lean();
  const userVariant = new Map(assigns.map((a) => [a.user_id, a.variant_id]));
  const ids = [...userVariant.keys()];

  const [sessions, iap, games] = await Promise.all([
    M.AppSession.aggregate([{ $match: { user_id: { $in: ids } } }, { $group: { _id: '$user_id', sessions: { $sum: 1 }, avgDuration: { $avg: '$session_duration_ms' } } }]),
    M.IapTransaction.aggregate([{ $match: { user_id: { $in: ids }, purchase_status: 'Success' } }, { $group: { _id: '$user_id', revenue: { $sum: '$price' } } }]),
    M.GameSession.aggregate([{ $match: { user_id: { $in: ids } } }, { $group: { _id: '$user_id', games: { $sum: 1 }, wins: cnt(eq('game_outcome', 'Win')) } }]),
  ]);
  const sMap = new Map(sessions.map((s) => [s._id, s])), iMap = new Map(iap.map((s) => [s._id, s])), gMap = new Map(games.map((s) => [s._id, s]));

  const variants = {};
  for (const v of exp.variants || []) variants[v.variant_id] = { variant_id: v.variant_id, name: v.name, users: 0, payers: 0, revenue: 0, sessions: 0, durSum: 0, durN: 0, games: 0, wins: 0 };
  for (const [uid, vid] of userVariant) {
    const v = (variants[vid] ||= { variant_id: vid, users: 0, payers: 0, revenue: 0, sessions: 0, durSum: 0, durN: 0, games: 0, wins: 0 });
    v.users++;
    const s = sMap.get(uid); if (s) { v.sessions += s.sessions; if (s.avgDuration != null) { v.durSum += s.avgDuration; v.durN++; } }
    const i = iMap.get(uid); if (i) { v.payers++; v.revenue += i.revenue; }
    const g = gMap.get(uid); if (g) { v.games += g.games; v.wins += g.wins; }
  }
  return {
    experiment: exp,
    variants: Object.values(variants).map((v) => ({
      variant_id: v.variant_id, name: v.name, users: v.users,
      conversionRate: pct(v.payers, v.users), revenue: round(v.revenue), arpu: v.users ? round(v.revenue / v.users) : 0,
      avgSessionsPerUser: v.users ? round(v.sessions / v.users) : 0, avgSessionDurationMs: v.durN ? round(v.durSum / v.durN) : null,
      winRate: pct(v.wins, v.games),
    })),
    note: 'Descriptive metrics only; run a significance test before declaring a winner.',
  };
});

// ---------- 0. Collections overview (document counts) ----------
const COLS = [
  ['users', M.User, 'Player accounts & profiles'], ['app_sessions', M.AppSession, 'Application sessions & device info'],
  ['game_sessions', M.GameSession, 'Individual gameplay runs'], ['events', M.Event, 'General application & interaction events'],
  ['inventory_events', M.InventoryEvent, 'Inventory & item interactions'], ['item_purchases', M.ItemPurchase, 'Virtual item purchases'],
  ['currency_transactions', M.CurrencyTransaction, 'Virtual currency earn / spend / refund'], ['iap_transactions', M.IapTransaction, 'Real-money purchases'],
  ['ad_events', M.AdEvent, 'Ad requests, impressions, clicks & rewards'], ['level_events', M.LevelEvent, 'Level starts, fails & completions'],
  ['progression_events', M.ProgressionEvent, 'XP, missions & achievements'], ['performance_events', M.PerformanceEvent, 'FPS, crashes, memory & latency'],
  ['experiments', M.Experiment, 'A/B test configurations'], ['experiment_assignments', M.ExperimentAssignment, 'Player variant assignments'],
];
exports.collections = wrap(() => Promise.all(COLS.map(async ([name, m, purpose]) => ({ name, purpose, count: await m.estimatedDocumentCount() }))));
