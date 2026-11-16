const keyCheck = (envName, headerReader) => (req, res, next) => {
  const expected = process.env[envName];
  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ success: false, message: `${envName} not configured` });
    }
    return next(); // open in dev only
  }
  if (headerReader(req) !== expected) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

exports.gameKey = keyCheck('GAME_API_KEY', (req) => req.header('x-api-key'));
exports.dashboardKey = keyCheck('DASHBOARD_API_KEY', (req) =>
  (req.header('authorization') || '').replace(/^Bearer\s+/i, '')
);
