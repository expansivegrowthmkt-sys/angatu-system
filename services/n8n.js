require('dotenv').config();
const fetch = require('node-fetch');

const WEBHOOK_URL    = process.env.N8N_WEBHOOK_CHECKIN;
const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;

function log(level, msg, data) {
  const entry = { timestamp: new Date().toISOString(), level, service: 'n8n', msg, ...data };
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
}

async function sendCheckin(payload) {
  if (!WEBHOOK_URL) {
    log('warn', 'N8N_WEBHOOK_CHECKIN não configurado — pulando');
    return false;
  }

  const body = {
    evento:      'checkin',
    timestamp:   new Date().toISOString(),
    tipo:        payload.tipo,
    cliente: {
      id:           payload.clienteId   || null,
      nome:         payload.nome        || null,
      telefone:     payload.telefone,
      email:        payload.email       || null,
      totalVisitas: payload.totalVisitas || 0,
    },
    origem: {
      utmSource:        payload.utmSource        || '',
      utmCampaign:      payload.utmCampaign      || '',
      origemDeclarada:  payload.origemDeclarada  || '',
    },
    restaurante: 'angatu',
  };

  try {
    const res = await fetch(WEBHOOK_URL, {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'x-webhook-secret': WEBHOOK_SECRET || '',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      log('warn', `Webhook retornou ${res.status}`);
      return false;
    }
    log('info', 'Webhook enviado', { tipo: payload.tipo, telefone: payload.telefone });
    return true;
  } catch (err) {
    log('error', 'Falha ao enviar webhook', { error: err.message });
    return false;
  }
}

module.exports = { sendCheckin };
