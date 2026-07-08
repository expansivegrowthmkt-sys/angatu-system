const express   = require('express');
const router    = express.Router();
const tc        = require('../services/tabletcloud');
const reportana = require('../services/reportana');
const { salvarCheckin, buscarClientePorTelefone } = require('../database/db');
const { checkinLimiter } = require('../middleware/rateLimit');

router.use(checkinLimiter);

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, '').trim();
}

function validatePhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11 ? digits : null;
}

// POST /api/checkin/buscar
router.post('/buscar', (req, res) => {
  const phone = validatePhone(req.body.telefone);
  if (!phone) return res.status(400).json({ error: 'Telefone inválido.' });

  const cliente = buscarClientePorTelefone(phone);
  if (!cliente) return res.json({ encontrado: false });

  return res.json({
    encontrado:   true,
    nome:         cliente.nome,
    totalVisitas: cliente.totalVisitas,
    clienteId:    cliente.clienteId,
  });
});

// POST /api/checkin/novo
router.post('/novo', async (req, res) => {
  const phone = validatePhone(req.body.telefone);
  if (!phone) return res.status(400).json({ error: 'Telefone inválido.' });

  const nome = sanitize(req.body.nome);
  if (nome.length < 2) return res.status(400).json({ error: 'Nome muito curto.' });

  const email          = sanitize(req.body.email || '');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'E-mail obrigatório.' });

  const dataNascimento = sanitize(req.body.dataNascimento || '');
  if (!dataNascimento)
    return res.status(400).json({ error: 'Data de nascimento obrigatória.' });

  const origemDeclarada = sanitize(req.body.origemDeclarada || '');
  const utmSource      = sanitize(req.body.utmSource || '');
  const utmCampaign    = sanitize(req.body.utmCampaign || '');

  let clienteId = null;
  let sucessoTC = false;

  try {
    const criado = await tc.createClient({
      nome, telefone: phone, email, dataNascimento,
      origemCampanha: origemDeclarada || utmSource,
    });
    clienteId = criado.Id;
    sucessoTC = true;
  } catch (err) {
    console.error('createClient:', err.message);
  }

  const dbPayload = {
    clienteId, telefone: phone, nome, email, tipo: 'novo',
    utmSource, utmCampaign, origemDeclarada, totalVisitas: 1,
    sucessoTabletcloud: sucessoTC, sucessoN8n: false,
  };

  salvarCheckin(dbPayload);

  reportana.sendLead({ nome, telefone: phone, email }).catch(() => {});

  return res.json({
    success:  true,
    clienteId,
    mensagem: `Bem-vindo(a), ${nome}! Check-in realizado com sucesso. 🌿`,
  });
});

// POST /api/checkin/recorrente
router.post('/recorrente', async (req, res) => {
  const phone     = validatePhone(req.body.telefone);
  if (!phone) return res.status(400).json({ error: 'Telefone inválido.' });

  const clienteId   = sanitize(req.body.clienteId || '') || null;
  const utmSource   = sanitize(req.body.utmSource  || '');
  const utmCampaign = sanitize(req.body.utmCampaign || '');

  // Conta visitas pelo SQLite (fonte confiável independente do Tablet Cloud)
  const clienteLocal = buscarClientePorTelefone(phone);
  const totalVisitas = (clienteLocal?.totalVisitas || 0) + 1;

  let sucessoTC = false;

  if (clienteId) {
    try {
      await tc.updateClientVisit(clienteId, totalVisitas);
      sucessoTC = true;
    } catch (err) {
      console.error('recorrente TC:', err.message);
    }
  }

  const dbPayload = {
    clienteId, telefone: phone, nome: null, tipo: 'recorrente',
    utmSource, utmCampaign, origemDeclarada: null, totalVisitas,
    sucessoTabletcloud: sucessoTC, sucessoN8n: false,
  };

  salvarCheckin(dbPayload);

  reportana.sendLead({
    nome:     clienteLocal?.nome    || null,
    email:    clienteLocal?.email   || null,
    telefone: phone,
  }).catch(() => {});

  return res.json({
    success:      true,
    totalVisitas,
    mensagem:     `Visita nº ${totalVisitas} registrada!`,
  });
});

module.exports = router;
