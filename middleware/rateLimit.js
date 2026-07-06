const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' },
});

const checkinLimiter = rateLimit({
  windowMs: 60_000,
  max:      30,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Limite de check-ins atingido. Aguarde 1 minuto.' },
});

module.exports = { globalLimiter, checkinLimiter };
