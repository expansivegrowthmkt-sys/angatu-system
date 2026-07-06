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
  const data = await fetchTC('/api/Autenticacao/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login:          process.env.TABLETCLOUD_LOGIN,
      senha:          process.env.TABLETCLOUD_SENHA,
      cod_empresa:    process.env.TABLETCLOUD_COD_EMPRESA,
      senha_empresa:  process.env.TABLETCLOUD_SENHA_EMPRESA,
    }),
  });

  _token    = data.token || data.Token || data.access_token;
  _tokenExp = Date.now() + 55 * 60 * 1000;
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
