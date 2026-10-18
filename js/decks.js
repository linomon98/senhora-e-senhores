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
  const NOME_NAIPE = { copas: 'Copas', ouros: 'Ouros', paus: 'Paus', espadas: 'Espadas' };
  const FIGURAS = ['J', 'Q', 'K'];
  const NUMEROS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const NOME_FIG = { J: 'Valetes', Q: 'Rainhas', K: 'Reis' };

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
    const r = [{ id: 'padrao', nome: 'Deck padrão' }];
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
    avisoSalvo = salvar(slots) ? 'Salvo automaticamente' : 'Não foi possível salvar neste navegador';
  }

  function celula(rank, naipe, cont) {
    const chave = `${rank}-${naipe}`, n = cont[chave] || 0;
    const vermelho = naipe === 'copas' || naipe === 'ouros';
    return `<div class="celula${n ? ' tem' : ''}" data-carta-deck="${chave}" title="${M.nomeCarta({ rank, naipe })} · clique: +1 · botão direito: −1">
      <div class="mini-carta">${C.frente({ rank, naipe })}</div>
      <div class="celula-naipe${vermelho ? ' vermelho' : ''}">${SIMB[naipe]} ${NOME_NAIPE[naipe]}</div>
      <div class="celula-controles"><button data-menos="${chave}">−</button><b>${n}</b><button data-mais="${chave}">+</button></div></div>`;
  }

  function linhaRegra(ok, texto) {
    return `<li class="${ok ? 'ok' : 'falha'}"><span>${ok ? '✓' : '✗'}</span>${texto}</li>`;
  }

  function painelRegras(cont) {
    const R = M.REGRAS_DECK, r = M.resumoDeck(cont);
    const copiasFigOk = Object.keys(cont).every(k => !FIGURAS.includes(k.split('-')[0]) || cont[k] <= R.copiasFigura);
    const copiasNumOk = Object.keys(cont).every(k => FIGURAS.includes(k.split('-')[0]) || cont[k] <= R.copiasNumero);
    const porFigOk = FIGURAS.every(f => r.porFigura[f] <= R.porFigura[f]);
    const figNaipeOk = NAIPES.every(n => r.figurasNaipe[n] <= R.figurasMesmoNaipe);
    const numNaipeOk = NAIPES.every(n => r.numerosNaipe[n] <= R.numerosMesmoNaipe);
    return `<h3>Regras de limite</h3>
      <ul class="regras-deck">
        ${linhaRegra(r.letras === R.letras, `Letras: exatamente <b>${R.letras}</b> figuras <em>(${r.letras})</em>`)}
        ${linhaRegra(r.numeros === R.numeros, `Números: exatamente <b>${R.numeros}</b> cartas <em>(${r.numeros})</em>`)}
        ${linhaRegra(r.soma <= R.orcamento, `Orçamento de poder: a soma dos números (Ás = 1) vai até <b>${R.orcamento}</b> <em>(${r.soma})</em>`)}
        ${linhaRegra(porFigOk, `No máximo <b>${R.porFigura.J}</b> Valetes, <b>${R.porFigura.Q}</b> Rainhas e <b>${R.porFigura.K}</b> Reis <em>(${r.porFigura.J} · ${r.porFigura.Q} · ${r.porFigura.K})</em>`)}
        ${linhaRegra(copiasFigOk, `Até <b>${R.copiasFigura}</b> cópias da mesma figura e naipe`)}
        ${linhaRegra(copiasNumOk, `Até <b>${R.copiasNumero}</b> cópias do mesmo número e naipe`)}
        ${linhaRegra(r.ases <= R.ases, `No máximo <b>${R.ases}</b> Ases <em>(${r.ases})</em>`)}
        ${linhaRegra(figNaipeOk, `No máximo <b>${R.figurasMesmoNaipe}</b> figuras de um mesmo naipe`)}
        ${linhaRegra(numNaipeOk, `No máximo <b>${R.numerosMesmoNaipe}</b> números de um mesmo naipe`)}
      </ul>
      <div class="por-que">
        <h4>Por que esses limites?</h4>
        <p><b>Orçamento de poder:</b> sem ele, o melhor deck seria só de 9 e 10. Com 220 (a soma de um baralho comum), cada carta forte custa uma fraca.</p>
        <p><b>Rainhas:</b> são as figuras mais fortes (equipam até 10 e atropelam), então têm limite menor.</p>
        <p><b>Naipe:</b> deck de um naipe só faria quase todo Senhor virar Naipado. O limite deixa esse plano possível, mas não garantido.</p>
        <p><b>Ases:</b> totens fortes demais em massa travariam a fileira.</p>
      </div>`;
  }

  function desenhar() {
    const el = tela();
    const s = slotAtual();
    const lista = slots.map((x, k) => {
      const st = !x ? 'vazio' : valido(x) ? 'pronto para jogar' : 'incompleto';
      return `<button class="slot${k === atual ? ' atual' : ''}${x && valido(x) ? ' valido' : ''}" data-slot-deck="${k}">
        <b>${x ? escapar(x.nome || `Deck ${k + 1}`) : `Espaço ${k + 1}`}</b><small>${st}</small></button>`;
    }).join('');
    let editor;
    if (!s) {
      editor = `<div class="vazio-deck"><h3>Espaço ${atual + 1} vazio</h3>
        <p class="nota">Comece pelo deck padrão (um baralho comum) e vá trocando as cartas, ou monte do zero.</p>
        <div class="acoes-menu"><button class="btn principal" data-cmd="auto">Auto-build: deck padrão</button><button class="btn" data-cmd="novo">Começar do zero</button></div></div>`;
    } else {
      const r = M.resumoDeck(s.cont), erros = M.validarDeck(s.cont);
      const linhasFig = FIGURAS.map(f => `<div class="linha-cartas"><span class="rot">${NOME_FIG[f]}</span>${NAIPES.map(n => celula(f, n, s.cont)).join('')}</div>`).join('');
      const linhasNum = NAIPES.map(n => `<div class="linha-cartas"><span class="rot" style="color:${n === 'copas' || n === 'ouros' ? '#ff7b7b' : '#ddd'}">${SIMB[n]} ${NOME_NAIPE[n]}</span>${NUMEROS.map(v => celula(v, n, s.cont)).join('')}</div>`).join('');
      editor = `<div class="editor-topo">
          <input class="nome-deck" value="${escapar(s.nome || '')}" placeholder="Nome do deck" maxlength="24">
          <button class="btn" data-cmd="auto" title="Volta ao baralho comum: uma de cada carta">Auto-build (padrão)</button>
          <button class="btn" data-cmd="limpar">Limpar</button>
          <button class="btn" data-cmd="apagar">Apagar espaço</button>
          <span class="status-deck ${erros.length ? 'falha' : 'ok'}">${erros.length ? `${erros.length} problema${erros.length > 1 ? 's' : ''}` : '✓ Pronto para jogar'}</span>
          <span class="salvo">${avisoSalvo}</span>
        </div>
        <div class="editor-corpo">
          <div class="editor-cartas">
            <h3>Baralho de Letras <em>${r.letras}/${M.REGRAS_DECK.letras}</em></h3>
            <div class="grade-deck">${linhasFig}</div>
            <h3>Baralho de Números <em>${r.numeros}/${M.REGRAS_DECK.numeros} · soma ${r.soma}/${M.REGRAS_DECK.orcamento}</em></h3>
            <div class="grade-deck">${linhasNum}</div>
          </div>
          <aside class="editor-regras">${painelRegras(s.cont)}</aside>
        </div>`;
    }
    el.innerHTML = `<div class="tela-caixa">
      <div class="tela-cabecalho"><h1>Montar decks</h1><span class="nota">Clique numa carta para adicionar, botão direito para tirar. O deck do bot é sempre o padrão.</span>
        <button class="btn principal" data-cmd="voltar">Voltar ao menu</button></div>
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
