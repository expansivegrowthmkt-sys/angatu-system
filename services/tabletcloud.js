require('dotenv').config();
const fetch = require('node-fetch');

const BASE  = process.env.TABLETCLOUD_BASE_URL || 'https://api.tabletcloud.com.br';
const TIMEOUT = 5000;

let _token = null;
let _tokenExp = 0;

function log(level, msg, data) {
  const entry = { timestamp: new Date().toISOString(), level, service: 'tabletcloud', msg, ...data };
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
}

async function fetchTC(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE}${path}`, { ...options, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body}`);
    }
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function authenticate() {
  if (_token && Date.now() < _tokenExp) return _token;

  log('info', 'Autenticando no Tablet Cloud');

  // Auth via OAuth form-encoded — mesmo formato do cliente.html confirmado
  const params = new URLSearchParams({
    username:      process.env.TABLETCLOUD_USERNAME,
    password:      process.env.TABLETCLOUD_PASSWORD,
    grant_type:    'password',
    client_id:     process.env.TABLETCLOUD_CLIENT_ID,
    client_secret: process.env.TABLETCLOUD_CLIENT_SECRET,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  const res = await fetch(`${BASE}/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
    signal:  controller.signal,
  });
  clearTimeout(timer);
  if (!res.ok) throw new Error(`Auth HTTP ${res.status}`);
  const data = await res.json();

  _token    = data.access_token;
  _tokenExp = Date.now() + (data.expires_in - 60) * 1000;
  log('info', 'Token obtido');
  return _token;
}

async function authHeaders() {
  const token = await authenticate();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function withRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.message && err.message.includes('401')) {
      log('warn', 'Token expirado, renovando');
      _token = null;
      _tokenExp = 0;
      return fn();
    }
    throw err;
  }
}

async function findClientByPhone(phone) {
  const clean = phone.replace(/\D/g, '');
  return withRetry(async () => {
    const headers = await authHeaders();
    try {
      const data = await fetchTC(`/api/cliente/buscarapida/${clean}`, { headers });
      if (!data || !data.Id) return { encontrado: false };
      return {
        encontrado:    true,
        cliente: {
          Id:           data.Id,
          Nome:         data.Nome,
          Email:        data.Email,
          Telefone:     data.Telefone,
          TotalCompras: data.TotalCompras || 0,
        },
      };
    } catch (err) {
      if (err.message && err.message.includes('404')) return { encontrado: false };
      throw err;
    }
  });
}

async function createClient({ nome, telefone, email, dataNascimento, origemCampanha }) {
  return withRetry(async () => {
    const headers = await authHeaders();
    const data = await fetchTC('/api/cliente/save', {
      method:  'POST',
      headers,
      body: JSON.stringify({
        Nome:          nome,
        Telefone:      telefone.replace(/\D/g, ''),
        Email:         email || '',
        DataNascimento: dataNascimento || null,
        Observacao:    origemCampanha || '',
      }),
    });
    return { Id: data.Id || data.id, success: true };
  });
}

async function updateClientVisit(clienteId, novaVisita) {
  return withRetry(async () => {
    const headers = await authHeaders();
    await fetchTC('/api/cliente/update', {
      method:  'PUT',
      headers,
      body: JSON.stringify({ Id: clienteId, TotalCompras: novaVisita }),
    });
    return { success: true };
  });
}

async function getClientVisits(clienteId) {
  return withRetry(async () => {
    const headers = await authHeaders();
    const data = await fetchTC(`/api/cliente/get/vendas/${clienteId}`, { headers });
    return Array.isArray(data) ? data : [];
  });
}

module.exports = { findClientByPhone, createClient, updateClientVisit, getClientVisits };
