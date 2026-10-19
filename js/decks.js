/* Montagem de decks: 4 espaços salvos neste navegador, editor por contagem de cartas
   e checagem das regras de limite (as regras ficam no motor: SS.Motor.REGRAS_DECK). */
window.SS = window.SS || {};
(function (SS) {
  'use strict';
  const M = SS.Motor, C = SS.Cartas;
  const CHAVE = 'senhora-e-senhores:decks';
  const ESPACOS = 4;
  const NAIPES = M.NAIPES;
  const SIMB = M.SIMBOLO;
  const tr = (k, p) => SS.Idioma.t(k, p);
  const NOME_NAIPE = new Proxy({}, { get: (_, k) => tr('naipe.' + String(k)) });
  const FIGURAS = ['J', 'Q', 'K'];
  const NUMEROS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const NOME_FIG = new Proxy({}, { get: (_, k) => tr('carta.' + String(k) + '.pl') });

  // ---------- Armazenamento ----------

  function carregar() {
    try {
      const v = JSON.parse(localStorage.getItem(CHAVE));
      if (Array.isArray(v)) return Array.from({ length: ESPACOS }, (_, k) => v[k] || null);
    } catch (err) { /* sem armazenamento: começa vazio */ }
    return Array.from({ length: ESPACOS }, () => null);
  }

  function salvar(slots) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(slots));
      return true;
    } catch (err) {
      return false;
    }
  }

  const valido = s => !!s && M.validarDeck(s.cont).length === 0;

  // Decks que podem ser usados numa partida.
  function opcoes() {
    const r = [{ id: 'padrao', nome: tr('dk.padrao') }];
    carregar().forEach((s, k) => { if (valido(s)) r.push({ id: String(k), nome: s.nome || `Deck ${k + 1}` }); });
    return r;
  }

  // Contagem a usar na partida (deck padrão se o escolhido não existir ou for inválido).
  function contagemPara(id) {
    if (id !== 'padrao') {
      const s = carregar()[Number(id)];
      if (valido(s)) return s.cont;
    }
    return M.contagemPadrao();
  }

  // ---------- Tela ----------

  let slots = null, atual = 0, aoVoltar = null, avisoSalvo = '';

  function tela() {
    let el = document.getElementById('tela-decks');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tela-decks';
      el.className = 'tela';
      document.body.appendChild(el);
      el.addEventListener('click', aoClicar);
      el.addEventListener('contextmenu', aoClicarDireito);
      el.addEventListener('input', aoDigitar);
    }
    return el;
  }

  function abrir(voltar) {
    aoVoltar = voltar;
    slots = carregar();
    atual = 0;
    desenhar();
    tela().hidden = false;
  }

  function fechar() {
    tela().hidden = true;
    tela().innerHTML = '';
    if (aoVoltar) aoVoltar();
  }

  const slotAtual = () => slots[atual];

  function guardar() {
    avisoSalvo = salvar(slots) ? 'salvo' : 'naoSalvo';
  }

  function celula(rank, naipe, cont) {
    const chave = `${rank}-${naipe}`, n = cont[chave] || 0;
    const vermelho = naipe === 'copas' || naipe === 'ouros';
    return `<div class="celula${n ? ' tem' : ''}" data-carta-deck="${chave}" title="${M.nomeCarta({ rank, naipe })} · ${tr('dk.celula')}">
      <div class="mini-carta">${C.frente({ rank, naipe })}</div>
      <div class="celula-naipe${vermelho ? ' vermelho' : ''}">${SIMB[naipe]} ${NOME_NAIPE[naipe]}</div>
      <div class="celula-controles"><button data-menos="${chave}">−</button><b>${n}</b><button data-mais="${chave}">+</button></div></div>`;
  }

  function linhaRegra(ok, texto) {
    return `<li class="${ok ? 'ok' : 'falha'}"><span>${ok ? '✓' : '✗'}</span>${texto}</li>`;
  }

  function painelRegras(cont) {
    const R = M.REGRAS_DECK, r = M.resumoDeck(cont);
    return `<h3>${tr('dk.regrasLimite')}</h3>
      <ul class="regras-deck">
        ${linhaRegra(r.letras === R.letras, tr('dk.rLetras', { n: R.letras, v: r.letras }))}
        ${linhaRegra(r.numeros === R.numeros, tr('dk.rNumeros', { n: R.numeros, v: r.numeros }))}
      </ul>
      <p class="nota">${tr('dk.livre')}</p>`;
  }

  function desenhar() {
    const el = tela();
    const s = slotAtual();
    const lista = slots.map((x, k) => {
      const st = tr(!x ? 'dk.vazio' : valido(x) ? 'dk.pronto' : 'dk.incompleto');
      return `<button class="slot${k === atual ? ' atual' : ''}${x && valido(x) ? ' valido' : ''}" data-slot-deck="${k}">
        <b>${x ? escapar(x.nome || `Deck ${k + 1}`) : tr('dk.espaco', { n: k + 1 })}</b><small>${st}</small></button>`;
    }).join('');
    let editor;
    if (!s) {
      editor = `<div class="vazio-deck"><h3>${tr('dk.espacoVazio', { n: atual + 1 })}</h3>
        <p class="nota">${tr('dk.comece')}</p>
        <div class="acoes-menu"><button class="btn principal" data-cmd="auto">${tr('dk.autoPadrao')}</button><button class="btn" data-cmd="novo">${tr('dk.zero')}</button></div></div>`;
    } else {
      const r = M.resumoDeck(s.cont), erros = M.validarDeck(s.cont);
      const linhasFig = FIGURAS.map(f => `<div class="linha-cartas"><span class="rot">${NOME_FIG[f]}</span>${NAIPES.map(n => celula(f, n, s.cont)).join('')}</div>`).join('');
      const linhasNum = NAIPES.map(n => `<div class="linha-cartas"><span class="rot" style="color:${n === 'copas' || n === 'ouros' ? '#ff7b7b' : '#ddd'}">${SIMB[n]} ${NOME_NAIPE[n]}</span>${NUMEROS.map(v => celula(v, n, s.cont)).join('')}</div>`).join('');
      editor = `<div class="editor-topo">
          <input class="nome-deck" value="${escapar(s.nome || '')}" placeholder="${tr('dk.nome')}" maxlength="24">
          <button class="btn" data-cmd="auto" title="${tr('dk.autoTitulo')}">${tr('dk.auto')}</button>
          <button class="btn" data-cmd="limpar">${tr('btn.limpar')}</button>
          <button class="btn" data-cmd="apagar">${tr('dk.apagar')}</button>
          <span class="status-deck ${erros.length ? 'falha' : 'ok'}">${erros.length ? tr('dk.problemas', { n: erros.length }) : '✓ ' + tr('dk.prontoBtn')}</span>
          <span class="salvo">${avisoSalvo ? tr('dk.' + avisoSalvo) : ''}</span>
        </div>
        <div class="editor-corpo">
          <div class="editor-cartas">
            <h3>${tr('dk.baralhoLetras')} <em>${r.letras}/${M.REGRAS_DECK.letras}</em></h3>
            <div class="grade-deck">${linhasFig}</div>
            <h3>${tr('dk.baralhoNumeros')} <em>${r.numeros}/${M.REGRAS_DECK.numeros}</em></h3>
            <div class="grade-deck">${linhasNum}</div>
          </div>
          <aside class="editor-regras">${painelRegras(s.cont)}</aside>
        </div>`;
    }
    el.innerHTML = `<div class="tela-caixa">
      <div class="tela-cabecalho"><h1>${tr('menu.decks')}</h1><span class="nota">${tr('dk.ajuda')}</span>
        <button class="btn principal" data-cmd="voltar">${tr('btn.voltarMenu')}</button></div>
      <div class="deck-layout"><nav class="slots">${lista}</nav><section class="editor">${editor}</section></div></div>`;
  }

  function mudar(chave, delta) {
    const s = slotAtual();
    if (!s) return;
    const n = Math.max(0, (s.cont[chave] || 0) + delta);
    if (n) s.cont[chave] = n;
    else delete s.cont[chave];
    guardar();
    desenhar();
  }

  function aoClicar(ev) {
    const t = ev.target;
    const b = t.closest('[data-cmd]');
    if (b) {
      const cmd = b.dataset.cmd;
      if (cmd === 'voltar') return fechar();
      if (cmd === 'auto') slots[atual] = { nome: (slotAtual() && slotAtual().nome) || `Deck ${atual + 1}`, cont: M.contagemPadrao() };
      if (cmd === 'novo') slots[atual] = { nome: `Deck ${atual + 1}`, cont: {} };
      if (cmd === 'limpar' && slotAtual()) slotAtual().cont = {};
      if (cmd === 'apagar') slots[atual] = null;
      guardar();
      return desenhar();
    }
    const sl = t.closest('[data-slot-deck]');
    if (sl) {
      atual = Number(sl.dataset.slotDeck);
      avisoSalvo = '';
      return desenhar();
    }
    const mais = t.closest('[data-mais]'), menos = t.closest('[data-menos]');
    if (mais) return mudar(mais.dataset.mais, 1);
    if (menos) return mudar(menos.dataset.menos, -1);
    const cel = t.closest('[data-carta-deck]');
    if (cel) mudar(cel.dataset.cartaDeck, 1);
  }

  function aoClicarDireito(ev) {
    const cel = ev.target.closest('[data-carta-deck]');
    if (!cel) return;
    ev.preventDefault();
    mudar(cel.dataset.cartaDeck, -1);
  }

  function aoDigitar(ev) {
    if (!ev.target.classList.contains('nome-deck') || !slotAtual()) return;
    slotAtual().nome = ev.target.value;
    guardar();
    // Atualiza só a lista de espaços, para não perder o foco do campo de nome.
    const botao = tela().querySelector(`[data-slot-deck="${atual}"] b`);
    if (botao) botao.textContent = ev.target.value || `Deck ${atual + 1}`;
  }

  const escapar = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  SS.Decks = { abrir, opcoes, contagemPara };
})(window.SS);
