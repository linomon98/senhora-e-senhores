/* Deckbuilder: 4 baralhos salvos neste navegador (cada um com a sua caixinha personalizada: nome, ícone e cores),
   os baralhos prontos dos Palhaços e a checagem das regras de limite (as regras ficam no motor: SS.Motor.REGRAS_DECK).
   Em cima fica o baralho sendo montado (duas vistas: por naipes ou corrida); embaixo, todas as cartas em abas de naipe. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';
  const M = SS.Motor, C = SS.Cartas;
  const CHAVE = 'senhora-e-senhores:decks';
  const CHAVE_VISTA = 'senhora-e-senhores:deck-vista';
  const ESPACOS = 4;
  const NAIPES = ['paus', 'copas', 'espadas', 'ouros']; // (ordem das abas e das fileiras, como no desenho)
  const tr = (k, p) => SS.Idioma.t(k, p);
  const FIGURAS = ['J', 'Q', 'K'];
  const NUMEROS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  // ---------- Caixinhas: cores e ícones ----------

  const CORES = {
    verde: '#2e9e3a', azul: '#2a5fd6', vermelho: '#d42a2a', amarelo: '#f3b51b',
    roxo: '#7b3fc4', rosa: '#ee5fa8', laranja: '#f17a1a', marrom: '#7a4a26',
  };
  const COR_ICONE = CORES;
  const ICONES = ['cavaleiro', 'porta', 'joker', 'espada', 'adaga', 'bainha', 'escudo', 'cura', 'dados', 'ases', 'cemiterio', 'espelho', 'maorei', 'maooito', 'zoio',
    'naipe-paus', 'naipe-copas', 'naipe-espadas', 'naipe-ouros'];
  const srcIcone = ic => (ic.startsWith('naipe-') ? `arte/naipes/${ic.slice(6)}.webp` : `arte/icones/deck/${ic}.webp`);
  const COR_NAIPE = { paus: 'verde', copas: 'vermelho', espadas: 'azul', ouros: 'amarelo' };
  const VISUAL_INICIAL = [
    { tampa: 'verde', icone: 'cavaleiro', corIcone: 'preto' }, { tampa: 'vermelho', icone: 'porta', corIcone: 'preto' },
    { tampa: 'amarelo', icone: 'joker', corIcone: 'preto' }, { tampa: 'azul', icone: 'espada', corIcone: 'preto' },
  ];
  const visualDe = (s, k) => Object.assign({}, VISUAL_INICIAL[k % VISUAL_INICIAL.length], s && s.visual);

  // A caixinha de cigarro do baralho: corpo branco com o ícone e o nome (os dois na perspectiva da frente da caixa),
  // a tampa pintada na cor escolhida e, por dentro, três cartas que sobem quando a tampa abre (mouse em cima).
  const MAX_NOME = 12;
  // O nome encolhe conforme o tamanho, para caber na frente da caixa.
  const tamanhoNome = nome => Math.min(22, 84 / (Math.max(1, String(nome).length) * 0.5)).toFixed(1);
  function caixa(v, nome) {
    const cor = COR_ICONE[v.corIcone];
    const icone = `<span class="cx-icone${cor ? ' pintado' : ''}" style="--m:url('${srcIcone(v.icone)}'); --cor:${cor || '#fff'}">
      <img src="${srcIcone(v.icone)}" alt="" draggable="false"></span>`;
    return `<span class="maco cx" style="--tampa:${CORES[v.tampa] || CORES.verde}">
      <span class="maco-cartas"><i class="carta dorso vermelho"></i><i class="carta dorso azul"></i><i class="carta dorso verde"></i></span>
      <img class="maco-baixo" src="arte/menu/caixa-baixo.webp" alt="" draggable="false">
      ${icone}${nome != null ? `<span class="maco-nome" style="font-size:calc(${tamanhoNome(nome)} * var(--u))">${escapar(nome)}</span>` : ''}
      <span class="maco-tampa cx-tampa"><img src="arte/menu/tampa-pb.webp" alt="" draggable="false"></span></span>`;
  }
  // Caixinha de um deck pelo id usado na escolha antes da partida ('palhaco', 'padrao' ou o número do espaço).
  function caixaDe(id, palhaco) {
    if (id === 'palhaco') {
      const p = palhaco && SS.Palhacos.get(palhaco);
      return caixa(p ? { tampa: COR_NAIPE[p.naipe], icone: 'naipe-' + p.naipe, corIcone: 'original' } : { tampa: 'roxo', icone: 'joker', corIcone: 'original' }, null);
    }
    if (id === 'padrao') return caixa({ tampa: 'marrom', icone: 'ases', corIcone: 'original' }, null);
    const k = Number(id), s = carregar()[k];
    return caixa(visualDe(s, k), null);
  }

  // ---------- Armazenamento ----------

  function carregar() {
    try {
      const v = JSON.parse(localStorage.getItem(CHAVE));
      if (Array.isArray(v)) return Array.from({ length: ESPACOS }, (_, k) => v[k] || null);
    } catch (err) { /* sem armazenamento: começa vazio */ }
    return Array.from({ length: ESPACOS }, () => null);
  }

  function salvar(lista) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(lista));
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

  // atual: número (um dos seus baralhos) ou id de um baralho pronto (só para ver). aba: naipe embaixo.
  // pedido: ação que pede um segundo clique para confirmar (apagar, copiar por cima de um baralho).
  // animar: 'aba' / 'vista' quando a troca acabou de acontecer (as cartas entram pulando só nessa hora).
  let slots = null, atual = 0, aba = 'paus', vista = 1, editando = false, aoVoltar = null, avisoSalvo = '', pedido = null, extras = {}, animar = null;
  try { vista = localStorage.getItem(CHAVE_VISTA) === '2' ? 2 : 1; } catch (err) { /* fica na vista 1 */ }

  function tela() {
    let el = document.getElementById('tela-decks');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tela-decks';
      el.className = 'tela tela-deck';
      document.body.appendChild(el);
      el.addEventListener('click', aoClicar);
      el.addEventListener('contextmenu', aoClicarDireito);
      el.addEventListener('input', aoDigitar);
      window.addEventListener('resize', encaixar);
    }
    return el;
  }

  // O palco tem 1600×900 "pixels do desenho" e encolhe junto para caber na janela.
  function encaixar() {
    const p = document.querySelector('#tela-decks .deck-palco');
    if (!p) return;
    const s = Math.min(innerWidth / 1600, innerHeight / 900);
    p.style.transform = `translate(${(innerWidth - 1600 * s) / 2}px, ${(innerHeight - 900 * s) / 2}px) scale(${s})`;
  }

  // extras.opcoes(volta): abre as opções do jogo e chama volta() ao fechar.
  function abrir(voltar, mais) {
    aoVoltar = voltar;
    extras = mais || {};
    slots = carregar();
    atual = 0;
    editando = false;
    desenhar();
    tela().hidden = false;
  }

  function fechar() {
    tela().hidden = true;
    tela().innerHTML = '';
    if (aoVoltar) aoVoltar();
  }

  const slotAtual = () => (typeof atual === 'number' ? slots[atual] : null);

  function guardar() {
    avisoSalvo = salvar(slots) ? 'salvo' : 'naoSalvo';
  }

  // Decks prontos (só leitura): o deck temático de cada Palhaço, na caixinha da cor dele.
  function prontos() {
    return SS.Palhacos.LISTA.map(p => ({ id: p.id, nome: tr('dk.deckDe', { p: p.nome }), curto: p.nome, sub: p.plano, cont: p.deck,
      visual: { tampa: COR_NAIPE[p.naipe], icone: 'naipe-' + p.naipe, corIcone: 'original' } }));
  }
  const prontoAtual = () => (typeof atual === 'string' ? prontos().find(p => p.id === atual) : null);
  // O que está aberto em cima: { nome, cont, visual, leitura }.
  function aberto() {
    const pr = prontoAtual();
    if (pr) return { nome: pr.nome, cont: pr.cont, visual: pr.visual, leitura: true, sub: pr.sub };
    const s = slotAtual();
    return s ? { nome: s.nome || `Deck ${atual + 1}`, cont: s.cont, visual: visualDe(s, atual), leitura: false } : null;
  }

  // ---------- Cartas ----------

  const chaveDe = (rank, naipe) => `${rank}-${naipe}`;
  const vermelha = naipe => naipe === 'copas' || naipe === 'ouros';
  const face = (rank, naipe) => `<span class="db-face">${C.frente({ rank, naipe })}</span>`;
  const nomeCarta = (rank, naipe) => M.nomeCarta({ rank, naipe });

  // Vista 1: uma fileira por naipe, com as Letras (J Q K) e os Números (Ás a 10) em leque; o que falta fica em branco.
  function vistaNaipes(d) {
    const pilha = (rank, naipe) => {
      const n = d.cont[chaveDe(rank, naipe)] || 0;
      return n ? `<span class="db-mini tem" data-tirar="${chaveDe(rank, naipe)}" title="${nomeCarta(rank, naipe)}">${face(rank, naipe)}${n > 1 ? `<b class="db-copias">${n}</b>` : ''}</span>`
        : '<span class="db-mini fantasma"></span>';
    };
    return `<div class="db-naipes">${NAIPES.map(naipe => `<div class="db-fileira">
      <img class="db-fileira-naipe" src="arte/naipes/${naipe}.webp" alt="" draggable="false">
      <span class="db-leque letras">${FIGURAS.map(r => pilha(r, naipe)).join('')}</span>
      <span class="db-leque numeros">${NUMEROS.map(r => pilha(r, naipe)).join('')}</span></div>`).join('')}</div>`;
  }

  // Vista 2: as cartas corridas. Com pouca variedade é uma linha só de cartas grandes; quanto mais cartas
  // diferentes, mais linhas e cartas menores. As cópias aparecem num número em cima da carta.
  const AREA_CORRIDA = { w: 560, h: 316 }, PASSO = 0.62, PROPORCAO = 1.4;
  function vistaCorrida(d) {
    const cartas = [];
    for (const naipe of NAIPES) for (const rank of FIGURAS.concat(NUMEROS)) {
      const n = d.cont[chaveDe(rank, naipe)] || 0;
      if (n) cartas.push({ rank, naipe, n });
    }
    if (!cartas.length) return `<div class="db-corrida vazia"><p>${tr('db.vazio')}</p></div>`;
    // Escolhe quantas linhas deixam a carta maior: largura cabendo na área e altura cabendo nas linhas.
    let melhor = null;
    for (let linhas = 1; linhas <= 8; linhas++) {
      const porLinha = Math.ceil(cartas.length / linhas);
      const w = Math.min(130, AREA_CORRIDA.w / (1 + (porLinha - 1) * PASSO), (AREA_CORRIDA.h - (linhas - 1) * 8) / linhas / PROPORCAO);
      if (!melhor || w > melhor.w) melhor = { linhas, porLinha, w };
    }
    const { porLinha, w } = melhor, linhas = [];
    for (let k = 0; k < cartas.length; k += porLinha) linhas.push(cartas.slice(k, k + porLinha));
    return `<div class="db-corrida" style="--w:${w.toFixed(1)}px; --passo:${(w * PASSO).toFixed(1)}px">${linhas.map(l => `<div class="db-linha">${l.map(c =>
      `<span class="db-carta" data-tirar="${chaveDe(c.rank, c.naipe)}" title="${nomeCarta(c.rank, c.naipe)}">${face(c.rank, c.naipe)}${c.n > 1 ? `<b class="db-copias">${c.n}</b>` : ''}</span>`).join('')}</div>`).join('')}</div>`;
  }

  // Embaixo: todas as cartas do naipe da aba. Clique põe no baralho, botão direito tira.
  function colecao(d) {
    const R = M.REGRAS_DECK, r = M.resumoDeck(d ? d.cont : {});
    const cartas = FIGURAS.concat(NUMEROS).map(rank => {
      const chave = chaveDe(rank, aba), n = d ? d.cont[chave] || 0 : 0;
      const cheio = !(d && d.leitura) && (n >= R.copias || (FIGURAS.includes(rank) ? r.letras >= R.letras : r.numeros >= R.numeros));
      return `<span class="db-colecao-carta${n ? ' tem' : ''}${cheio ? ' cheia' : ''}${n >= R.copias ? ' max' : ''}" data-por="${chave}" title="${nomeCarta(rank, aba)}" style="--i:${FIGURAS.concat(NUMEROS).indexOf(rank)}">
        <b class="db-qtd">${n}/${R.copias}</b>${face(rank, aba)}</span>`;
    }).join('');
    return `<div class="db-abas">${NAIPES.map(n => `<button class="db-aba ${n}${n === aba ? ' ativa' + (animar === 'aba' ? ' pula' : '') : ''}" data-aba="${n}" title="${tr('naipe.' + n)}">
        <img src="arte/naipes/${n}.webp" alt="${tr('naipe.' + n)}" draggable="false"></button>`).join('')}</div>
      <div class="db-colecao ${aba}${d && d.leitura ? ' leitura' : ''}${animar === 'aba' ? ' entra' : ''}">
        <div class="db-colecao-cartas">${cartas}</div>
        <p class="db-dica">${tr(d && d.leitura ? 'db.dicaLeitura' : d ? 'db.dica' : 'db.dicaSem')}</p></div>`;
  }

  // ---------- Painéis ----------

  function painelLista() {
    const meus = slots.map((s, k) => (s
      ? `<button class="db-caixa${k === atual ? ' atual' : ''}${valido(s) ? '' : ' incompleto'}" data-slot-deck="${k}" title="${escapar(s.nome || `Deck ${k + 1}`)}">${caixa(visualDe(s, k), s.nome || `Deck ${k + 1}`)}</button>`
      : `<button class="db-caixa nova${k === atual ? ' atual' : ''}" data-slot-deck="${k}" title="${tr('db.novo')}"><span class="db-mais">+</span><small>${tr('db.novo')}</small></button>`)).join('');
    const prs = prontos().map(p => `<button class="db-caixa pronto${p.id === atual ? ' atual' : ''}" data-pronto="${p.id}" title="${escapar(p.nome)}">${caixa(p.visual, null)}</button>`).join('');
    return `<aside class="db-lista"><h2>${tr('db.meus')}</h2><div class="db-grade">${meus}</div><hr>
      <h2>${tr('db.prontos')}</h2><div class="db-grade">${prs}</div></aside>`;
  }

  function painelLimites(d) {
    const R = M.REGRAS_DECK, r = M.resumoDeck(d ? d.cont : {});
    const erros = d ? M.validarDeck(d.cont) : [];
    let acoes = '';
    if (d && d.leitura) {
      acoes = `<p class="db-rot">${tr('db.copiarPara')}</p><div class="db-copiar">${slots.map((s, k) =>
        `<button class="db-btn mini${pedido === 'copiar:' + k ? ' perigo' : ''}" data-copiar="${atual}:${k}" title="${s ? escapar(s.nome || `Deck ${k + 1}`) : tr('dk.espaco', { n: k + 1 })}">${k + 1}${s ? '' : ' ✦'}</button>`).join('')}</div>
        <p class="db-nota">${pedido && pedido.startsWith('copiar:') ? tr('db.substituir', { n: escapar(slots[Number(pedido.slice(7))].nome || '') }) : tr('db.copiarNota')}</p>`;
    } else if (d) {
      acoes = `<button class="db-btn" data-cmd="auto" title="${tr('dk.autoTitulo')}">${tr('db.padrao')}</button>
        <button class="db-btn" data-cmd="limpar">${tr('btn.limpar')}</button>
        <button class="db-btn perigo${pedido === 'apagar' ? ' confirmar' : ''}" data-cmd="apagar">${tr(pedido === 'apagar' ? 'db.certeza' : 'db.apagar')}</button>`;
    }
    return `<aside class="db-limites"><h2>${tr('db.limites')}</h2>
      <div class="db-limite${r.letras > R.letras ? ' passou' : ''}"><small>${tr('db.letras')}</small><b>${r.letras}/${R.letras}</b></div>
      <div class="db-limite${r.numeros > R.numeros ? ' passou' : ''}"><small>${tr('db.numeros')}</small><b>${r.numeros}/${R.numeros}</b></div>
      ${d ? `<p class="db-status ${erros.length ? 'falha' : 'ok'}" title="${escapar(erros.join(' '))}">${erros.length ? '✗ ' + tr('dk.problemas', { n: erros.length }) : '✓ ' + tr('dk.prontoBtn')}</p>` : ''}
      </aside><div class="db-acoes">${acoes}${avisoSalvo && d && !d.leitura ? `<small class="db-salvo">${tr('dk.' + avisoSalvo)}</small>` : ''}</div>`;
  }

  function painelDeck(d) {
    if (!d) {
      return `<section class="db-deck"><div class="db-vazio-espaco"><h3>${tr('dk.espacoVazio', { n: atual + 1 })}</h3>
        <p>${tr('db.comece')}</p>
        <div class="db-acoes-linha"><button class="db-btn principal" data-cmd="novo">${tr('db.criar')}</button>
        <button class="db-btn" data-cmd="novoPadrao">${tr('db.criarPadrao')}</button></div></div></section>`;
    }
    const corpo = vista === 2 ? vistaCorrida(d) : vistaNaipes(d);
    return `<section class="db-deck">
      <div class="db-deck-caixa">${caixa(d.visual, d.leitura ? null : d.nome)}
        ${d.leitura ? `<p class="db-deck-nome">${escapar(d.nome)}</p>` : `<button class="db-btn editar" data-cmd="editar">${tr('db.editar')}</button>`}</div>
      <div class="db-deck-cartas${d.leitura ? ' leitura' : ''}${animar === 'vista' ? ' entra' : ''}">${corpo}</div></section>`;
  }

  // Personalizar a caixinha: nome, ícone, cor do ícone e cor da tampa (a caixa ao lado mostra como fica).
  function painelEditar(d) {
    const v = d.visual;
    const amostras = (cores, campo, atualCor) => Object.entries(cores).map(([id, hex]) =>
      `<button class="db-cor${id === atualCor ? ' ativa' : ''}" data-${campo}="${id}" style="--c:${hex}" title="${tr('db.cor.' + id)}" aria-label="${tr('db.cor.' + id)}"></button>`).join('');
    return `<div class="db-editar-fundo" data-cmd="fecharEditar"></div>
      <div class="db-editar">
        <h2>${tr('db.personalizar')}</h2>
        <div class="db-editar-corpo">
          <div class="db-editar-previa">${caixa(v, d.nome)}</div>
          <div class="db-editar-campos">
            <label>${tr('db.nome')}</label>
            <input class="nome-deck" value="${escapar(slotAtual().nome || '')}" placeholder="${tr('dk.nome')}" maxlength="${MAX_NOME}">
            <label>${tr('db.corTampa')}</label><div class="db-cores">${amostras(CORES, 'tampa', v.tampa)}</div>
            <label>${tr('db.icone')}</label><div class="db-icones">${ICONES.map(ic => `<button class="db-icone${ic === v.icone ? ' ativa' : ''}" data-icone="${ic}">
              <img src="${srcIcone(ic)}" alt="" draggable="false"></button>`).join('')}</div>
            <label>${tr('db.corIcone')}</label><div class="db-cores">${amostras(Object.assign({ original: '#ffffff' }, COR_ICONE), 'cor-icone', COR_ICONE[v.corIcone] ? v.corIcone : 'original')}</div>
          </div>
        </div>
        <button class="db-btn principal" data-cmd="fecharEditar">${tr('db.pronto')}</button>
      </div>`;
  }

  function desenhar() {
    const el = tela(), d = aberto();
    el.innerHTML = `<div class="deck-palco">
      <button class="db-btn voltar" data-cmd="voltar">← ${tr('btn.voltarMenu')}</button>
      ${extras.opcoes ? `<button class="db-engrenagem" data-cmd="opcoes" title="${tr('menu.opcoes')}" aria-label="${tr('menu.opcoes')}">⚙&#xFE0E;</button>` : ''}
      <h1 class="db-titulo">${tr('db.titulo')}</h1>
      <div class="db-vistas">${[1, 2].map(n => `<button class="db-vista${vista === n ? ' ativa' : ''}" data-vista="${n}" title="${tr('db.vista' + n)}">${n}</button>`).join('')}</div>
      ${painelLista()}${painelDeck(d)}${painelLimites(d)}${colecao(d)}
      ${editando && d && !d.leitura ? painelEditar(d) : ''}
    </div>`;
    animar = null;
    encaixar();
  }

  // ---------- Cartas voando entre a coleção (embaixo) e o baralho (em cima) ----------
  const MOVIMENTO_REDUZIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const caixaDoEl = el => (el && el.isConnected ? el.getBoundingClientRect() : null);
  function voar(chave, de, para, entrando) {
    if (MOVIMENTO_REDUZIDO || !de || !para) return;
    const [rank, naipe] = chave.split('-');
    const el = document.createElement('div');
    el.className = 'db-voo';
    el.innerHTML = face(rank, naipe);
    Object.assign(el.style, { left: de.left + 'px', top: de.top + 'px', width: de.width + 'px', height: de.height + 'px' });
    document.body.appendChild(el);
    const dx = para.left - de.left, dy = para.top - de.top, s = para.width / de.width;
    const meio = `translate(${dx * .5}px, ${dy * .5 - 60}px) scale(${(1 + s) / 2 * 1.08}) rotate(${entrando ? -8 : 8}deg)`;
    el.animate([{ transform: 'translate(0, 0) scale(1)' }, { transform: meio, offset: .5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: entrando ? 1 : 0 }],
      { duration: 420, easing: 'cubic-bezier(.4, 0, .3, 1)', fill: 'forwards' }).onfinish = () => el.remove();
  }
  // A carta que chegou (ou que perdeu uma cópia) dá um pulinho no lugar dela.
  function pular(el, atraso) {
    if (MOVIMENTO_REDUZIDO || !el) return;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18) translateY(-6px)', offset: .45 }, { transform: 'scale(.95)', offset: .75 }, { transform: 'scale(1)' }],
      { duration: 380, delay: atraso, easing: 'ease-out', fill: 'backwards' });
  }

  function mudar(chave, delta, origem) {
    const s = slotAtual();
    if (!s) return;
    const naTela = c => tela().querySelector(`[data-tirar="${c}"]`);
    const antes = caixaDoEl(delta > 0 ? origem : naTela(chave) || origem);
    const R = M.REGRAS_DECK, r = M.resumoDeck(s.cont), n0 = s.cont[chave] || 0;
    if (delta > 0) {
      // Clique além do limite: não faz nada (a carta já aparece apagada).
      const fig = FIGURAS.includes(chave.split('-')[0]);
      if (n0 >= R.copias || (fig ? r.letras >= R.letras : r.numeros >= R.numeros)) return;
    }
    const n = Math.max(0, n0 + delta);
    if (n) s.cont[chave] = n;
    else delete s.cont[chave];
    guardar();
    desenhar();
    if (delta > 0) {
      // Entrando: voa da coleção até o lugar dela no baralho, que aparece quando a carta chega.
      const alvo = naTela(chave);
      voar(chave, antes, caixaDoEl(alvo), true);
      if (alvo && !MOVIMENTO_REDUZIDO) alvo.animate([{ opacity: 0 }, { opacity: 0, offset: .99 }, { opacity: 1 }], { duration: 400 });
      pular(alvo, 400);
    } else {
      // Saindo: volta para a coleção (ou para a aba do naipe, se ela estiver fechada).
      const naColecao = tela().querySelector(`[data-por="${chave}"]`) || tela().querySelector(`[data-aba="${chave.split('-')[1]}"]`);
      voar(chave, antes, caixaDoEl(naColecao), false);
      pular(naTela(chave), 0);
      pular(naColecao, 380);
    }
  }

  function aoClicar(ev) {
    const t = ev.target, antes = pedido;
    pedido = null;
    const ab = t.closest('[data-aba]');
    if (ab) {
      if (aba !== ab.dataset.aba) animar = 'aba';
      aba = ab.dataset.aba;
      return desenhar();
    }
    const vi = t.closest('[data-vista]');
    if (vi) {
      if (vista !== Number(vi.dataset.vista)) animar = 'vista';
      vista = Number(vi.dataset.vista);
      try { localStorage.setItem(CHAVE_VISTA, String(vista)); } catch (err) { /* ignora */ }
      return desenhar();
    }
    const cp = t.closest('[data-copiar]');
    if (cp) {
      const [id, k] = cp.dataset.copiar.split(':');
      const pr = prontos().find(p => p.id === id);
      if (slots[Number(k)] && antes !== 'copiar:' + k) { pedido = 'copiar:' + k; return desenhar(); }
      slots[Number(k)] = { nome: pr.curto, cont: Object.assign({}, pr.cont), visual: Object.assign({}, pr.visual) };
      atual = Number(k);
      guardar();
      return desenhar();
    }
    // Personalizar a caixinha
    const s = slotAtual();
    const cTampa = t.closest('[data-tampa]'), cIcone = t.closest('[data-icone]'), cCor = t.closest('[data-cor-icone]');
    if (s && (cTampa || cIcone || cCor)) {
      s.visual = visualDe(s, atual);
      if (cTampa) s.visual.tampa = cTampa.dataset.tampa;
      if (cIcone) s.visual.icone = cIcone.dataset.icone;
      if (cCor) s.visual.corIcone = cCor.dataset.corIcone;
      guardar();
      return desenhar();
    }
    const b = t.closest('[data-cmd]');
    if (b) {
      const cmd = b.dataset.cmd;
      if (cmd === 'voltar') return fechar();
      if (cmd === 'opcoes' && extras.opcoes) {
        tela().hidden = true;
        return extras.opcoes(() => { tela().hidden = false; desenhar(); });
      }
      if (cmd === 'editar') { editando = true; return desenhar(); }
      if (cmd === 'fecharEditar') { editando = false; return desenhar(); }
      if (typeof atual !== 'number') return;
      if (cmd === 'novo' || cmd === 'novoPadrao') {
        slots[atual] = { nome: `Deck ${atual + 1}`, cont: cmd === 'novoPadrao' ? M.contagemPadrao() : {}, visual: visualDe(null, atual) };
        editando = true;
      }
      if (cmd === 'auto' && s) s.cont = M.contagemPadrao();
      if (cmd === 'limpar' && s) s.cont = {};
      if (cmd === 'apagar' && s) {
        if (antes !== 'apagar') { pedido = 'apagar'; return desenhar(); }
        slots[atual] = null;
      }
      guardar();
      return desenhar();
    }
    const pr = t.closest('[data-pronto]');
    if (pr) {
      atual = pr.dataset.pronto;
      avisoSalvo = '';
      editando = false;
      return desenhar();
    }
    const sl = t.closest('[data-slot-deck]');
    if (sl) {
      atual = Number(sl.dataset.slotDeck);
      avisoSalvo = '';
      editando = false;
      return desenhar();
    }
    const por = t.closest('[data-por]'), tirar = t.closest('[data-tirar]');
    if (por) return mudar(por.dataset.por, 1, por);
    if (tirar) return mudar(tirar.dataset.tirar, -1, tirar);
  }

  function aoClicarDireito(ev) {
    const cel = ev.target.closest('[data-por], [data-tirar]');
    if (!cel) return;
    ev.preventDefault();
    mudar(cel.dataset.por || cel.dataset.tirar, -1, cel);
  }

  function aoDigitar(ev) {
    const s = slotAtual();
    if (!ev.target.classList.contains('nome-deck') || !s) return;
    s.nome = ev.target.value;
    guardar();
    // Atualiza só os nomes nas caixinhas, para não perder o foco do campo.
    const nome = ev.target.value || `Deck ${atual + 1}`;
    for (const el of tela().querySelectorAll(`[data-slot-deck="${atual}"] .maco-nome, .db-deck-caixa .maco-nome, .db-editar-previa .maco-nome`)) {
      el.textContent = nome;
      el.style.fontSize = `calc(${tamanhoNome(nome)} * var(--u))`;
    }
  }

  const escapar = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  SS.Decks = { abrir, opcoes, contagemPara, caixa, caixaDe };
})(window.SS);
