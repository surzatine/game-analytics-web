const M = require('../models');

/**
 * type -> { model, key (unique id field), upsert }
 * Insert-only collections dedupe on their unique id (rule 11).
 * Session/user collections are upserted so Unity can send start + end updates.
 */
const TYPES = {
  users:                  { model: M.User,                 key: 'user_id',          upsert: true },
  'app-sessions':         { model: M.AppSession,           key: 'app_session_id',   upsert: true },
  'game-sessions':        { model: M.GameSession,          key: 'game_session_id',  upsert: true },
  events:                 { model: M.Event,                key: 'event_id' },
  inventory:              { model: M.InventoryEvent,       key: 'event_id' },
  purchases:              { model: M.ItemPurchase,         key: 'purchase_id' },
  currency:               { model: M.CurrencyTransaction,  key: 'transaction_id' },
  iap:                    { model: M.IapTransaction,       key: 'iap_id' },
  ads:                    { model: M.AdEvent,              key: 'ad_event_id' },
  levels:                 { model: M.LevelEvent,           key: 'event_id' },
  progression:            { model: M.ProgressionEvent,     key: 'event_id' },
  performance:            { model: M.PerformanceEvent,     key: 'event_id' },
};

const MAX_BATCH = 500;

// Strip Mongo operator / dotted keys from untrusted payloads
const clean = (obj) => {
  if (Array.isArray(obj)) return obj.map(clean);
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('$') || k.includes('.')) continue;
      out[k] = clean(v);
    }
    return out;
  }
  return obj;
};

exports.ingest = async (req, res, next) => {
  try {
    const cfg = TYPES[req.params.type];
    if (!cfg) return res.status(404).json({ success: false, message: `Unknown type "${req.params.type}"`, types: Object.keys(TYPES) });

    let docs = Array.isArray(req.body) ? req.body : req.body?.events || [req.body];
    docs = docs.filter((d) => d && typeof d === 'object').map(clean);
    if (!docs.length) return res.status(400).json({ success: false, message: 'Empty payload' });
    if (docs.length > MAX_BATCH) return res.status(413).json({ success: false, message: `Max batch size is ${MAX_BATCH}` });

    const missing = docs.findIndex((d) => !d[cfg.key]);
    if (missing !== -1) return res.status(400).json({ success: false, message: `Document at index ${missing} is missing "${cfg.key}"` });

    let inserted = 0, duplicates = 0, updated = 0, failed = 0, errors = [];

    if (cfg.upsert) {
      const ops = docs.map((d) => {
        const { _id, createdAt, ...rest } = d;
        return { updateOne: { filter: { [cfg.key]: d[cfg.key] }, update: { $set: rest }, upsert: true } };
      });
      const r = await cfg.model.bulkWrite(ops, { ordered: false });
      inserted = r.upsertedCount; updated = r.modifiedCount;
    } else {
      try {
        const r = await cfg.model.insertMany(docs, { ordered: false, rawResult: true });
        inserted = r.insertedCount;
      } catch (err) {
        // ordered:false -> keep valid docs, count duplicates (E11000) separately
        const writeErrors = err.writeErrors || err.results?.filter?.((x) => x instanceof Error) || [];
        inserted = err.result?.insertedCount ?? err.insertedDocs?.length ?? 0;
        for (const we of writeErrors) {
          const code = we.err?.code ?? we.code;
          if (code === 11000) duplicates++;
          else { failed++; errors.push(we.err?.errmsg || we.message); }
        }
        if (!writeErrors.length) throw err;
      }
    }

    if (!cfg.upsert) failed = Math.max(failed, docs.length - inserted - duplicates); // schema-invalid docs are skipped by Mongoose

    res.status(failed && !inserted ? 400 : 201).json({
      success: !failed || inserted > 0,
      received: docs.length, inserted, updated, duplicates, failed,
      ...(errors.length && { errors: errors.slice(0, 5) }),
    });
  } catch (err) { next(err); }
};

exports.types = (_req, res) => res.json({ types: Object.keys(TYPES) });
