const crypto = require('crypto');
const { Experiment, ExperimentAssignment } = require('../models');

exports.create = async (req, res, next) => {
  try {
    const { experiment_id, experiment_name, variants } = req.body;
    if (!experiment_id || !experiment_name || !Array.isArray(variants) || variants.length < 2)
      return res.status(400).json({ success: false, message: 'experiment_id, experiment_name and >=2 variants required' });
    const doc = await Experiment.findOneAndUpdate({ experiment_id }, { $set: req.body }, { upsert: true, new: true });
    res.status(201).json({ success: true, data: doc });
  } catch (e) { next(e); }
};

exports.list = async (_req, res, next) => {
  try { res.json({ success: true, data: await Experiment.find().sort({ createdAt: -1 }).lean() }); }
  catch (e) { next(e); }
};

// Deterministic, weighted bucketing: same user always gets the same variant
function pickVariant(variants, seed) {
  const total = variants.reduce((s, v) => s + (v.weight ?? 1), 0);
  const n = parseInt(crypto.createHash('md5').update(seed).digest('hex').slice(0, 8), 16) / 0xffffffff;
  let acc = 0;
  for (const v of variants) { acc += (v.weight ?? 1) / total; if (n <= acc) return v; }
  return variants[variants.length - 1];
}

exports.assign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id required' });

    const exp = await Experiment.findOne({ experiment_id: id }).lean();
    if (!exp) return res.status(404).json({ success: false, message: 'Experiment not found' });
    if (exp.status !== 'Active') return res.status(409).json({ success: false, message: 'Experiment is not active' });

    const existing = await ExperimentAssignment.findOne({ experiment_id: id, user_id }).lean();
    if (existing) return res.json({ success: true, data: existing });

    const variant = pickVariant(exp.variants, `${id}:${user_id}`);
    try {
      const doc = await ExperimentAssignment.create({
        experiment_id: id, user_id, variant_id: variant.variant_id, assigned_at: new Date(),
      });
      res.status(201).json({ success: true, data: doc });
    } catch (err) {
      if (err.code === 11000) // race: parallel request created it first
        return res.json({ success: true, data: await ExperimentAssignment.findOne({ experiment_id: id, user_id }).lean() });
      throw err;
    }
  } catch (e) { next(e); }
};
