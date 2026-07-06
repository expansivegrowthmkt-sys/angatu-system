(function () {
  'use strict';

  // ── UTM capture ─────────────────────────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const utm = {
    source:   params.get('utm_source')   || '',
    campaign: params.get('utm_campaign') || '',
    medium:   params.get('utm_medium')   || '',
  };
  try { sessionStorage.setItem('angatu_utm', JSON.stringify(utm)); } catch (_) {}

  // ── State ───────────────────────────────────────────────────────────────────
  let _telefone  = '';
  let _clienteId = '';
  let _origemSel = '';

  // ── DOM helpers ─────────────────────────────────────────────────────────────
  function $(id)         { return document.getElementById(id); }
  function showTela(id)  {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    $(id).classList.add('ativa');
    window.scrollTo(0, 0);
  }
  function setLoading(on) {
    $('loading').style.display = on ? 'flex' : 'none';
  }
  function setErr(id, msg) {
    $(id).textContent = msg || '';
  }
  function setBtn(id, disabled) {
    $(id).disabled = disabled;
  }

  // ── Phone mask ───────────────────────────────────────────────────────────────
  $('input-tel').addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '');
    if (v.startsWith('55') && v.length > 11) v = v.slice(2);
    if (v.length <= 10) v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    else                v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    this.value = v;
  });

  // ── Origem grid ──────────────────────────────────────────────────────────────
  document.querySelectorAll('.origem-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.origem-btn').forEach(b => b.classList.remove('sel'));
      this.classList.add('sel');
      _origemSel = this.dataset.origem;
    });
  });

  // ── API call helper ──────────────────────────────────────────────────────────
  async function api(path, body) {
    const ctrl    = new AbortController();
    const timer   = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(path, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  ctrl.signal,
      });
      clearTimeout(timer);
      return res.json();
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error('Tempo esgotado. Verifique sua conexão.');
      throw err;
    }
  }

  // ── Passo 1: buscar telefone ─────────────────────────────────────────────────
  $('btn-buscar').addEventListener('click', async function () {
    const raw    = $('input-tel').value;
    const digits = raw.replace(/\D/g, '');
    setErr('erro-tel', '');

    if (digits.length < 10) {
      setErr('erro-tel', 'Digite um número válido com DDD.');
      return;
    }

    _telefone = digits;
    setBtn('btn-buscar', true);
    setLoading(true);

    try {
      const data = await api('/api/checkin/buscar', { telefone: digits });

      if (data.encontrado) {
        _clienteId = data.clienteId;
        $('rec-avatar').textContent = '😊';
        $('rec-nome').textContent   = data.nome;
        $('rec-visitas').textContent = `Sua ${data.totalVisitas}ª visita conosco! 🎉`;
        showTela('tela-recorrente');
      } else {
        showTela('tela-novo');
      }
    } catch (err) {
      setErr('erro-tel', err.message || 'Erro ao verificar. Tente novamente.');
    } finally {
      setBtn('btn-buscar', false);
      setLoading(false);
    }
  });

  // ── Passo 2a: novo cliente ────────────────────────────────────────────────────
  $('btn-novo').addEventListener('click', async function () {
    const nome  = $('input-nome').value.trim();
    const email = $('input-email').value.trim();
    const nasc  = $('input-nasc').value;
    setErr('erro-nome', '');
    setErr('erro-novo', '');

    if (nome.length < 2) {
      setErr('erro-nome', 'Informe seu nome completo.');
      return;
    }

    setBtn('btn-novo', true);
    setLoading(true);

    try {
      const utmStored = JSON.parse(sessionStorage.getItem('angatu_utm') || '{}');
      const data = await api('/api/checkin/novo', {
        telefone:        _telefone,
        nome,
        email,
        dataNascimento:  nasc,
        origemDeclarada: _origemSel,
        utmSource:       utmStored.source   || '',
        utmCampaign:     utmStored.campaign || '',
      });

      if (data.success) {
        $('ok-titulo').textContent = `Bem-vindo(a), ${nome}!`;
        $('ok-sub').textContent    = 'Seu check-in foi registrado com sucesso.';
        $('ok-badge').style.display = 'none';
        showTela('tela-ok');
      } else {
        setErr('erro-novo', data.error || 'Erro ao registrar. Tente novamente.');
      }
    } catch (err) {
      setErr('erro-novo', err.message || 'Erro ao registrar. Tente novamente.');
    } finally {
      setBtn('btn-novo', false);
      setLoading(false);
    }
  });

  // ── Passo 2b: recorrente ──────────────────────────────────────────────────────
  $('btn-recorrente').addEventListener('click', async function () {
    setBtn('btn-recorrente', true);
    setLoading(true);

    try {
      const utmStored = JSON.parse(sessionStorage.getItem('angatu_utm') || '{}');
      const data = await api('/api/checkin/recorrente', {
        telefone:    _telefone,
        clienteId:   _clienteId,
        utmSource:   utmStored.source   || '',
        utmCampaign: utmStored.campaign || '',
      });

      if (data.success) {
        const nome = $('rec-nome').textContent;
        $('ok-titulo').textContent = `Olá de novo, ${nome}!`;
        $('ok-sub').textContent    = `Visita nº ${data.totalVisitas} registrada.`;

        const badge = $('ok-badge');
        if (data.totalVisitas >= 5) {
          badge.textContent    = `⭐ ${data.totalVisitas} visitas — obrigado pela fidelidade!`;
          badge.style.display  = 'block';
        } else {
          badge.style.display = 'none';
        }
        showTela('tela-ok');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBtn('btn-recorrente', false);
      setLoading(false);
    }
  });

  // ── "Não sou eu" → voltar ao telefone ────────────────────────────────────────
  $('btn-nao-sou').addEventListener('click', function () {
    $('input-tel').value = '';
    _telefone  = '';
    _clienteId = '';
    showTela('tela-telefone');
  });

  // ── Enter no campo de telefone ────────────────────────────────────────────────
  $('input-tel').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('btn-buscar').click();
  });

})();
