const mongoose = require('mongoose');
const { Schema } = mongoose;

const T = { S: String, N: Number, D: Date, B: Boolean, M: Schema.Types.Mixed };

/**
 * Compact schema builder. Spec: 'S' string, 'N' number, 'D' date, 'B' boolean, 'M' mixed.
 * Flags after the type: '!' required, 'u' unique, 'i' indexed. e.g. 'S!u'
 */
function fields(spec) {
  const out = {};
  for (const [name, code] of Object.entries(spec)) {
    const def = { type: T[code[0]] };
    if (code.includes('!')) def.required = true;
    if (code.includes('u')) { def.unique = true; def.index = true; }
    else if (code.includes('i')) def.index = true;
    out[name] = def;
  }
  return out;
}

function make(name, collection, spec, opts = {}) {
  const schema = new Schema(fields(spec), {
    collection,
    versionKey: false,
    timestamps: opts.timestamps === false ? false : opts.timestamps || { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  });
  (opts.indexes || []).forEach(([keys, o]) => schema.index(keys, o));
  return mongoose.models[name] || mongoose.model(name, schema);
}

// createdAt only (append-only event docs)
const created = { createdAt: 'createdAt', updatedAt: false };

// Standard event properties (section 4)
const std = { platform: 'S', app_version: 'S', game_version: 'S' , duration_ms: 'N'};

exports.User = make('User', 'users', {
  user_id: 'S!u', username: 'S', email: 'S', platform: 'S', country: 'S',
  account_created_at: 'D', last_login_at: 'D', is_active: 'B',
}, { indexes: [[{ account_created_at: 1 }]] });

exports.AppSession = make('AppSession', 'app_sessions', {
  app_session_id: 'S!u', user_id: 'S!', username: 'S', device_name: 'S', device_os: 'S',
  os_version: 'S', app_version: 'S', ip_address_anonymized: 'S', available_storage_mb: 'N',
  graphics_setting: 'S', battery_percentage: 'N', charging_status: 'B', network_type: 'S',
  session_start: 'D', loading_start: 'D', loading_complete: 'D', session_end: 'D',
  session_duration_ms: 'N', session_status: 'S',
}, { indexes: [[{ user_id: 1, session_start: 1 }]] });

exports.GameSession = make('GameSession', 'game_sessions', {
  game_session_id: 'S!u', app_session_id: 'S!i', user_id: 'S!', game_id: 'S', game_mode_id: 'S',
  level_id: 'S', character_id: 'S', map_id: 'S', difficulty: 'S', graphics_setting: 'S',
  game_start_time: 'D', game_end_time: 'D', elapsed_time_ms: 'N', game_outcome: 'S',
  game_end_reason: 'S', death_count: 'N', respawn_count: 'N', rage_quit: 'B',
}, { indexes: [[{ user_id: 1, game_start_time: 1 }]] });

exports.Event = make('Event', 'events', {
  event_id: 'S!u', event_name: 'S!', user_id: 'S!', app_session_id: 'S!i', game_session_id: 'S',
  event_timestamp_utc: 'D!', elapsed_time_ms: 'N', event_sequence_number: 'N', screen_name: 'S',
  properties: 'M', ...std,
}, { timestamps: created, indexes: [
  [{ user_id: 1, event_timestamp_utc: 1 }],
  [{ event_name: 1, event_timestamp_utc: 1 }],
] });

exports.InventoryEvent = make('InventoryEvent', 'inventory_events', {
  event_id: 'S!u', user_id: 'S!', app_session_id: 'S', game_session_id: 'S', inventory_id: 'S',
  item_id: 'S!', item_category: 'S', item_rarity: 'S', action_type: 'S', item_owned: 'B',
  elapsed_time_ms: 'N', event_timestamp_utc: 'D!', ...std,
}, { timestamps: false, indexes: [[{ user_id: 1, item_id: 1 }]] });

exports.ItemPurchase = make('ItemPurchase', 'item_purchases', {
  purchase_id: 'S!u', user_id: 'S!', app_session_id: 'S', game_session_id: 'S', item_id: 'S!',
  item_category: 'S', cost: 'N', currency_type: 'S', purchase_source: 'S',
  previous_view_event_id: 'S', first_view_timestamp: 'D', purchase_timestamp: 'D!',
  decision_time_ms: 'N', purchase_status: 'S',
}, { timestamps: false, indexes: [[{ user_id: 1, purchase_timestamp: 1 }]] });

exports.CurrencyTransaction = make('CurrencyTransaction', 'currency_transactions', {
  transaction_id: 'S!u', user_id: 'S!', app_session_id: 'S', game_session_id: 'S',
  currency_type: 'S!', transaction_type: 'S!', amount: 'N!', balance_before: 'N', balance_after: 'N',
  transaction_source: 'S', related_item_id: 'S', event_timestamp_utc: 'D!',
}, { timestamps: false, indexes: [[{ user_id: 1, event_timestamp_utc: 1 }]] });

exports.IapTransaction = make('IapTransaction', 'iap_transactions', {
  iap_id: 'S!u', user_id: 'S!', app_session_id: 'S', product_id: 'S!', product_name: 'S',
  product_category: 'S', price: 'N', price_currency: 'S', store_platform: 'S',
  store_transaction_id: 'S', purchase_status: 'S', purchase_source: 'S', event_timestamp_utc: 'D!',
}, { timestamps: false, indexes: [
  // unique only when present (rule 5 of section 5)
  [{ store_transaction_id: 1 }, { unique: true, partialFilterExpression: { store_transaction_id: { $type: 'string' } } }],
  [{ user_id: 1, event_timestamp_utc: 1 }],
] });

exports.AdEvent = make('AdEvent', 'ad_events', {
  ad_event_id: 'S!u', user_id: 'S!', app_session_id: 'S', game_session_id: 'S', ad_id: 'S',
  ad_network: 'S', ad_unit_id: 'S', ad_type: 'S', ad_placement: 'S', ad_request_status: 'S',
  ad_load_status: 'S', ad_impression: 'B', ad_clicked: 'B', ad_opened_at: 'D', ad_closed_at: 'D',
  ad_duration_ms: 'N', close_type: 'S', force_close: 'B', close_reason: 'S', reward_type: 'S',
  reward_amount: 'N', reward_granted: 'B', ad_revenue: 'N', revenue_currency: 'S',
  event_timestamp_utc: 'D!',
}, { timestamps: false, indexes: [[{ user_id: 1, event_timestamp_utc: 1 }]] });

exports.LevelEvent = make('LevelEvent', 'level_events', {
  event_id: 'S!u', user_id: 'S!', app_session_id: 'S', game_session_id: 'S', level_id: 'S!',
  checkpoint_id: 'S', objective_id: 'S', event_type: 'S!', attempt_number: 'N',
  completion_status: 'S', death_count: 'N', time_to_complete_ms: 'N', difficulty: 'S',
  event_timestamp_utc: 'D!',
}, { timestamps: false, indexes: [[{ level_id: 1, event_type: 1 }]] });

exports.ProgressionEvent = make('ProgressionEvent', 'progression_events', {
  event_id: 'S!u', user_id: 'S!', app_session_id: 'S', game_session_id: 'S', event_type: 'S',
  progression_type: 'S', mission_id: 'S', achievement_id: 'S', character_id: 'S', xp_amount: 'N',
  previous_level: 'N', new_level: 'N', event_timestamp_utc: 'D!',
}, { timestamps: false });

exports.PerformanceEvent = make('PerformanceEvent', 'performance_events', {
  event_id: 'S!u', user_id: 'S!', app_session_id: 'S', game_session_id: 'S', event_type: 'S!',
  device_name: 'S', graphics_setting: 'S', fps_average: 'N', fps_minimum: 'N', memory_usage_mb: 'N',
  battery_percentage: 'N', charging_status: 'B', network_latency_ms: 'N', error_code: 'S',
  error_message: 'S', event_timestamp_utc: 'D!',
}, { timestamps: false, indexes: [[{ event_type: 1, event_timestamp_utc: 1 }]] });

exports.Experiment = make('Experiment', 'experiments', {
  experiment_id: 'S!u', experiment_name: 'S!', description: 'S', variants: 'M', status: 'S',
  start_date: 'D', end_date: 'D',
}, { timestamps: created });

exports.ExperimentAssignment = make('ExperimentAssignment', 'experiment_assignments', {
  experiment_id: 'S!', user_id: 'S!', variant_id: 'S!', assigned_at: 'D',
}, { timestamps: false, indexes: [[{ experiment_id: 1, user_id: 1 }, { unique: true }]] });
