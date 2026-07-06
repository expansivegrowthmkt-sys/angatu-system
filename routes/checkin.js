const express = require('express');
const router  = express.Router();
const tc      = require('../services/tabletcloud');
const n8n     = require('../services/n8n');
const { salvarCheckin } = require('../database/db');
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
router.post('/buscar', async (req, res) => {
  const phone = validatePhone(req.body.telefone);
  if (!phone) return res.status(400).json({ error: 'Telefone inválido.' });

  try {
    const result = await tc.findClientByPhone(phone);
    if (!result.encontrado) return res.json({ encontrado: false });
    return res.json({
      encontrado:   true,
      nome:         result.cliente.Nome,
      totalVisitas: result.cliente.TotalCompras,
      clienteId:    result.cliente.Id,
    });
  } catch (err) {
    console.error('buscar:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar cliente. Tente novamente.' });
  }
});

// POST /api/checkin/novo
router.post('/novo', async (req, res) => {
  const phone = validatePhone(req.body.telefone);
  if (!phone) return res.status(400).json({ error: 'Telefone inválido.' });

  const nome = sanitize(req.body.nome);
  if (nome.length < 2) return res.status(400).json({ error: 'Nome muito curto.' });

  const email          = sanitize(req.body.email || '');
  const dataNascimento = sanitize(req.body.dataNascimento || '');
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
    clienteId, telefone: phone, nome, tipo: 'novo',
    utmSource, utmCampaign, origemDeclarada, totalVisitas: 1,
    sucessoTabletcloud: sucessoTC, sucessoN8n: false,
  };

  salvarCheckin(dbPayload);

  const n8nOk = await n8n.sendCheckin({
    ...dbPayload, clienteId, email, totalVisitas: 1,
  });

  return res.json({
    success:  true,
    clienteId,
    mensagem: `Bem-vindo(a), ${nome}! Check-in realizado com sucesso. 🌿`,
  });
});

// POST /api/checkin/recorrente
router.post('/recorrente', async (req, res) => {
  const phone     = validatePhone(req.body.telefone);
  const clienteId = sanitize(req.body.clienteId || '');
  if (!phone || !clienteId) return res.status(400).json({ error: 'Dados inválidos.' });

  const utmSource   = sanitize(req.body.utmSource  || '');
  const utmCampaign = sanitize(req.body.utmCampaign || '');

  let totalVisitas  = 1;
  let sucessoTC     = false;

  try {
    const visitas = await tc.getClientVisits(clienteId);
    totalVisitas = (visitas.length || 0) + 1;
    await tc.updateClientVisit(clienteId, totalVisitas);
    sucessoTC = true;
  } catch (err) {
    console.error('recorrente:', err.message);
  }

  const dbPayload = {
    clienteId, telefone: phone, nome: null, tipo: 'recorrente',
    utmSource, utmCampaign, origemDeclarada: null, totalVisitas,
    sucessoTabletcloud: sucessoTC, sucessoN8n: false,
  };

  salvarCheckin(dbPayload);

  await n8n.sendCheckin(dbPayload);

  return res.json({
    success:      true,
    totalVisitas,
    mensagem:     `Visita nº ${totalVisitas} registrada!`,
  });
});

module.exports = router;
