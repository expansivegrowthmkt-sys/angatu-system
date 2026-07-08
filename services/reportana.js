require('dotenv').config();
const fetch = require('node-fetch');

const BASE          = 'https://api.reportana.com/2022-05';
const SEGMENT       = process.env.REPORTANA_SEGMENT_ID    || '89616';
const CLIENT_ID     = process.env.REPORTANA_CLIENT_ID;
const CLIENT_SECRET = process.env.REPORTANA_CLIENT_SECRET;
const TIMEOUT       = 8000;

function log(level, msg, data) {
  const entry = { timestamp: new Date().toISOString(), level, service: 'reportana', msg, ...data };
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
}

async function sendLead({ nome, telefone, email }) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    log('warn', 'REPORTANA_CLIENT_ID/SECRET não configurado — pulando');
    return false;
  }

  const phone = `+55${(telefone || '').replace(/\D/g, '')}`;
  const body  = { name: nome || 'Cliente', phone };
  if (email) body.email = email;

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(`${BASE}/segments/${SEGMENT}/customers`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text();
      log('warn', `Reportana HTTP ${res.status}`, { body: text.slice(0, 300) });
      return false;
    }

    log('info', 'Lead enviado ao Reportana', { telefone, tipo: email ? 'novo' : 'recorrente' });
    return true;
  } catch (err) {
    clearTimeout(timer);
    log('error', 'Falha ao enviar ao Reportana', { error: err.message });
    return false;
  }
}

module.exports = { sendLead };
