/* Interface e fluxo da partida: desenha a mesa, trata os cliques e o mouse do jogador
   e conduz os turnos do bot. Toda regra fica no motor (motor.js). */
window.SS = window.SS || {};
(function (SS) {
  'use strict';
  const M = SS.Motor, Bot = SS.Bot, C = SS.Cartas;
  const $ = s => document.querySelector(s);
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const SIMB = M.SIMBOLO;
  const NOME_NIVEL = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
  const NOME_NAIPE = { copas: 'Copas', ouros: 'Ouros', paus: 'Paus', espadas: 'Espadas' };
  const PODER_FIGURA = {
    J: 'Valete — Ímpeto: ataca no mesmo turno em que entra. Só equipa números de 2 a 5.',
    Q: 'Rainha — Atropelar: se matar quem bloqueou, o dano que sobra (dano − ataque do bloqueador) vai para o PV do oponente. Para entrar: 2 ações e o sacrifício de 1 Senhor(a) seu que já estava em campo antes deste turno.',
    K: 'Rei — Guardião: pode bloquear até 2 atacantes por turno. Só equipa números de 2 a 7.',
  };
  const PODER_NAIPADO = {
    paus: 'Aguenta 3 hits (4 se estiver ao lado de um Ás de Paus).',
    espadas: '+1 de ataque fixo.',
    copas: 'Ferida: depois que ele(a) causa dano no PV do oponente, o oponente não pode curar acima do PV que ficou, enquanto ele(a) viver.',
    ouros: 'Ataca 2 vezes por turno.',
  };
  const PODER_AS = {
    paus: 'Senhores vizinhos ganham +1 de resistência (passam a aguentar 3 hits).',
    espadas: 'Senhores vizinhos ganham +1 de ataque fixo.',
    ouros: 'Vale 1 carta de Ouros extra por turno (comprar, reviver ou dado extra).',
    copas: 'Vampiro: quando um Senhor(a) vizinho causa dano ao PV do oponente, você cura 1 PV.',
  };
  const EFEITO_NUMERO = {
    copas: c => `Usada sozinha (1 ação): cura ${M.curaDe(c)} PV (pode passar de ${M.PV_INICIAL}).`,
    espadas: c => `Usada sozinha (1 ação): +1 de ataque a um Senhor(a) seu neste turno. Se o dado do ataque der 6, o bônus vira +${Math.floor(M.valor(c) / 2)} (crítico).`,
    paus: () => 'Usada sozinha (1 ação): um Senhor(a) ferido(a) entra em berserk e volta à vertical até o fim do próximo turno do oponente. Se levar 1 hit nesse período, morre quando o efeito acabar.',
    ouros: () => 'Usada sozinha (1 ação): descarte 1 Ouros para comprar 1 carta (do baralho que escolher), ou 2 Ouros para recuperar 1 carta do cemitério. No ataque, cada Ouros dá +1 dado (vale o maior).',
  };
  const NOME_POSTURA = {
    vertical: 'saudável (vertical)',
    diagonal: 'ferido(a), mas ainda aguenta mais de 1 hit (diagonal)',
    horizontal: 'ferido(a): o próximo hit mata (horizontal)',
  };
  const ANGULO = { vertical: 0, diagonal: 45, horizontal: 90 };
  // Parâmetros que o jogador escolhe clicando na mesa, em ordem, para cada tipo de ação.
  const PASSOS = { sumonar: ['sacrificio', 'slot'], invocarAs: ['slot'], espadas: ['alvo'], paus: ['alvo'], reviver: ['escolha'], curar: [], comprar: [] };

  const NOME_COR = { vermelho: 'Vermelho', azul: 'Azul' };

  const cfg = { cor: 'vermelho', nivel: 'medio', modo: 'bot', deck: 'padrao' };
  let jogo = null, ui = null, partida = 0, escala = 1;
  let posturaAnterior = {};
  const DURACAO_ANIM = 700;
  let cores = ['vermelho', 'azul']; // cor de cada jogador (0 = você, embaixo)
  const corDe = p => cores[p];

  const novoUi = () => ({
    sel: [], pend: null, ataques: [], atacanteSel: null, bloqueios: {}, bloqSel: null,
    ocupado: false, foco: null, aoConfirmarBloqueio: null, aoContinuar: null, mira: null, mouse: null,
  });
  const controle = p => (cfg.modo === 'bots' || p === 1 ? 'bot' : 'humano');
  const escapar = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  // ---------- Seleção e ações da fase principal ----------

  function chaveCartas(a) {
    switch (a.tipo) {
      case 'sumonar': return [a.figura, a.numero];
      case 'invocarAs': return [a.as, a.custo];
      case 'reviver': return a.cartas.slice();
      default: return [a.carta];
    }
  }

  function candidatosSelecao() {
    if (!jogo || jogo.fase !== 'principal' || !ui.sel.length) return [];
    const sel = ui.sel.map(s => (s.startsWith('TOKEN') ? 'TOKEN' : s)).sort().join('|');
    return M.acoesLegais(jogo).filter(a => a.tipo !== 'atacar' && chaveCartas(a).slice().sort().join('|') === sel);
  }

  function candidatosPendentes() {
    const pd = ui.pend;
    return pd.cands.filter(a => Object.keys(pd.esc).every(k => a[k] === pd.esc[k]));
  }

  const passoAtual = () => (ui.pend ? ui.pend.passos[ui.pend.k] : null);

  // Ações de compra têm um botão por baralho: a chave é "tipo/baralho".
  const chaveAcao = a => a.tipo + (a.baralho ? '/' + a.baralho : '');

  function iniciarPendente(chave) {
    const tipo = chave.split('/')[0];
    const cands = candidatosSelecao().filter(a => chaveAcao(a) === chave);
    if (!cands.length) return;
    ui.pend = { tipo, cands, passos: PASSOS[tipo].filter(ps => cands.some(a => a[ps] != null)), k: 0, esc: {} };
    avancarPendente();
  }

  function avancarPendente() {
    const pd = ui.pend;
    if (pd.k < pd.passos.length) {
      if (pd.passos[pd.k] === 'escolha') return escolherDoCemiterio();
      return render();
    }
    const acao = candidatosPendentes()[0];
    ui.sel = [];
    ui.pend = null;
    M.aplicarAcao(jogo, acao);
    render();
    if (jogo.vencedor != null) fimDeJogo();
  }

  function escolherParametro(v) {
    const pd = ui.pend;
    pd.esc[pd.passos[pd.k]] = v;
    pd.k++;
    avancarPendente();
  }

  function rotuloTipo(tipo, a) {
    const j = jogo.jogadores[jogo.vez];
    switch (tipo) {
      case 'sumonar': return a.sacrificio != null ? `♛ Sumonar Rainha (sacrifício · ${M.CUSTO_RAINHA} ações)` : '⚔ Sumonar';
      case 'invocarAs': return '✦ Invocar Ás';
      case 'curar': return `♥ Curar ${M.curaDe(j.mao.find(c => c.id === a.carta))} PV`;
      case 'espadas': return '♠ +1 de ataque';
      case 'paus': return '♣ Berserk';
      case 'comprar': return `♦ Comprar ${a.baralho === 'letras' ? 'uma Letra' : 'um Número'}`;
      case 'reviver': return '♦♦ Reviver do cemitério';
    }
    return tipo;
  }

  function dicaSelecao() {
    const j = jogo.jogadores[jogo.vez];
    const cartas = ui.sel.filter(id => !id.startsWith('TOKEN')).map(id => j.mao.find(c => c.id === id)).filter(Boolean);
    const fig = cartas.find(M.ehFigura), num = cartas.find(M.ehNumero), as = cartas.find(M.ehAs);
    if (jogo.acoes <= 0) return 'Suas ações deste turno acabaram.';
    if (fig && num && M.valor(num) > M.LIMITE_FIGURA[fig.rank]) return `${M.nomeCarta(fig)} só pode ser equipado(a) com cartas de 2 a ${M.LIMITE_FIGURA[fig.rank]}.`;
    if (fig && num && fig.rank === 'Q') {
      if (jogo.acoes < M.CUSTO_RAINHA) return `A Rainha custa ${M.CUSTO_RAINHA} ações e você só tem ${jogo.acoes}.`;
      return 'A Rainha precisa sacrificar um Senhor(a) seu que já estava em campo antes deste turno.';
    }
    if (fig && num && !j.campo.includes(null)) return 'Sua fileira está cheia.';
    if (as && num && as.naipe !== num.naipe) return 'Para invocar o Ás, sacrifique uma carta numérica do mesmo naipe.';
    if (cartas.length === 1 && fig) return 'Selecione também uma carta numérica (2 a 10) para sumonar.';
    if (cartas.length === 1 && as) return 'Selecione também uma carta numérica do mesmo naipe para invocar o Ás.';
    return 'Nenhuma ação com essa seleção.';
  }

  function textoPasso() {
    const passo = passoAtual();
    if (passo === 'slot') return 'Clique num espaço livre da sua fileira.';
    if (passo === 'sacrificio') return 'Clique no Senhor(a) que será sacrificado(a) para a Rainha.';
    if (passo === 'alvo') return ui.pend.tipo === 'espadas' ? 'Clique no Senhor(a) que recebe +1 de ataque neste turno.' : 'Clique no Senhor(a) ferido(a) que entra em berserk.';
    return '';
  }

  // ---------- Ataque e bloqueio do jogador ----------

  function atacantesRestantes() {
    return M.atacantesAptos(jogo).filter(uid => ui.ataques.filter(a => a.atacante === uid).length < M.localizar(jogo, uid).u.ataques);
  }

  const usosBloqueio = uid => Object.values(ui.bloqueios).filter(l => l.includes(uid)).length;

  function bloqueadoresComCapacidade() {
    return M.bloqueadoresAptos(jogo).filter(uid => usosBloqueio(uid) < M.capacidadeBloqueio(M.localizar(jogo, uid).u));
  }

  function ourosLivres() {
    const livres = M.ourosDisponiveis(jogo, jogo.vez).slice();
    for (const a of ui.ataques) {
      for (const o of a.ouros) {
        const k = livres.indexOf(o);
        if (k >= 0) livres.splice(k, 1);
      }
    }
    return livres;
  }

  // Declara todos os ataques que o Senhor(a) ainda tem (o Naipado de Ouros já entra com os 2).
  function adicionarAtaque(uid, alvo) {
    const u = M.localizar(jogo, uid).u;
    const faltam = u.ataques - ui.ataques.filter(a => a.atacante === uid).length;
    for (let k = 0; k < faltam; k++) ui.ataques.push({ atacante: uid, alvo, ouros: [] });
    ui.atacanteSel = null;
    render();
  }

  function removerAtaquesDe(uid) {
    ui.ataques = ui.ataques.filter(a => a.atacante !== uid);
  }

  function atribuirBloqueio(n) {
    const lista = ui.bloqueios[n] || (ui.bloqueios[n] = []);
    const k = lista.indexOf(ui.bloqSel);
    if (k >= 0) lista.splice(k, 1);
    else if (bloqueadoresComCapacidade().includes(ui.bloqSel)) lista.push(ui.bloqSel);
    ui.bloqSel = null;
    render();
  }

  const humanoAtaca = () => jogo && !ui.ocupado && jogo.fase === 'ataque' && controle(jogo.vez) === 'humano';
  const humanoBloqueia = () => jogo && !ui.ocupado && jogo.fase === 'bloqueio' && controle(1 - jogo.vez) === 'humano';

  function unidadeEm(el) {
    const slot = el && el.closest('[data-slot]');
    if (!slot) return null;
    const [p, i] = slot.dataset.slot.split(':').map(Number);
    const u = jogo.jogadores[p].campo[i];
    return u ? { p, i, u } : null;
  }

  // Para onde a seta de ataque foi solta: no retrato do oponente ou num Ás dele.
  function alvoDeAtaqueEm(el) {
    if (!el) return null;
    const d = 1 - jogo.vez;
    const retrato = el.closest('[data-alvo]');
    if (retrato && retrato.dataset.alvo === 'jogador:' + d) return 'jogador';
    const loc = unidadeEm(el);
    if (loc && loc.p === d && loc.u.tipo === 'as') return loc.u.uid;
    return null;
  }

  // Qual ataque a seta de bloqueio aponta: o chip do ataque ou a carta atacante.
  function ataqueEm(el) {
    if (!el) return null;
    const chip = el.closest('[data-ataque]');
    if (chip) return Number(chip.dataset.ataque);
    const loc = unidadeEm(el);
    if (!loc || loc.p !== jogo.vez) return null;
    const ats = jogo.combate.ataques.filter(a => a.atacante === loc.u.uid);
    const at = ats.find(a => !(ui.bloqueios[a.n] || []).includes(ui.bloqSel)) || ats[0];
    return at ? at.n : null;
  }

  // ---------- Mouse: cliques, setas e dicas ----------

  function alvosClicaveis() {
    const s = new Set();
    if (!jogo || ui.ocupado || jogo.vencedor != null) return s;
    const p = jogo.vez, d = 1 - p;
    if (jogo.fase === 'principal' && controle(p) === 'humano' && ui.pend) {
      const passo = passoAtual();
      for (const a of candidatosPendentes()) {
        if (passo === 'slot') s.add(`slot:${p}:${a.slot}`);
        else if (passo === 'sacrificio' || passo === 'alvo') s.add('uid:' + a[passo]);
      }
    } else if (humanoAtaca()) {
      if (ui.atacanteSel == null) for (const uid of atacantesRestantes()) s.add('uid:' + uid);
      else for (const alvo of M.alvosPossiveis(jogo)) s.add(alvo === 'jogador' ? 'jogador:' + d : 'uid:' + alvo);
    } else if (humanoBloqueia()) {
      if (ui.bloqSel == null) for (const uid of bloqueadoresComCapacidade()) s.add('uid:' + uid);
      else for (const at of jogo.combate.ataques) s.add('uid:' + at.atacante);
    }
    return s;
  }

  function aoClicar(ev) {
    if (ev.target.closest('[data-continuar]')) {
      if (ui && ui.aoContinuar) ui.aoContinuar();
      return;
    }
    if (ev.target.closest('#modal')) return;
    const el = ev.target.closest('[data-acao],[data-mao],[data-token],[data-slot],[data-alvo],[data-ataque],[data-cemiterio],[data-pilha]');
    if (!el) return;
    const ds = el.dataset;
    if (ds.acao === 'menu') return confirmarMenu();
    if (ds.acao === 'desistir') return confirmarDesistir();
    if (ds.acao === 'reiniciar') return confirmarReiniciar();
    if (!jogo) return;
    if (ds.pilha && ui.aoComprar) {
      const [p, b] = ds.pilha.split(':');
      if (Number(p) === jogo.vez && jogo.jogadores[jogo.vez][b].length) {
        const r = ui.aoComprar;
        ui.aoComprar = null;
        r(b);
      }
      return;
    }
    if (ds.cemiterio !== undefined) return verCemiterio(Number(ds.cemiterio));
    if (ui.ocupado || jogo.vencedor != null) return;
    if (ds.acao) return clicarBotao(ds.acao);
    if (ds.mao) return clicarMao(ds.mao);
    if (ds.token !== undefined) return clicarMao('TOKEN#' + ds.token);
    // No ataque e no bloqueio, cartas e alvos são tratados pelo mouse (setas).
    if (jogo.fase !== 'principal') return;
    if (ds.slot) {
      const [p, i] = ds.slot.split(':').map(Number);
      return clicarEspaco(p, i);
    }
  }

  function aoPressionar(ev) {
    if (ev.button !== 0 || !jogo || ev.target.closest('#modal')) return;
    const loc = unidadeEm(ev.target);
    if (!loc) return;
    const declarado = ui.ataques.some(a => a.atacante === loc.u.uid);
    if (humanoAtaca() && loc.p === jogo.vez && (declarado || atacantesRestantes().includes(loc.u.uid))) {
      ui.mira = { uid: loc.u.uid, x: ev.clientX, y: ev.clientY, moveu: false };
      ui.atacanteSel = loc.u.uid;
    } else if (humanoBloqueia() && loc.p === 1 - jogo.vez && loc.u.tipo === 'senhor') {
      if (bloqueadoresComCapacidade().includes(loc.u.uid) || ui.bloqSel === loc.u.uid) {
        ui.mira = { uid: loc.u.uid, x: ev.clientX, y: ev.clientY, jaSelecionado: ui.bloqSel === loc.u.uid };
        ui.bloqSel = loc.u.uid;
      } else if (usosBloqueio(loc.u.uid)) {
        // Já está bloqueando no limite: clicar de novo desfaz os bloqueios dele.
        for (const k in ui.bloqueios) ui.bloqueios[k] = ui.bloqueios[k].filter(x => x !== loc.u.uid);
      }
    } else return;
    ev.preventDefault();
    ui.mouse = pontoNoApp(ev.clientX, ev.clientY);
    render();
  }

  function aoSoltar(ev) {
    if (!jogo || ev.button !== 0) return;
    const mira = ui.mira;
    ui.mira = null;
    if (!humanoAtaca() && !humanoBloqueia()) return;
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const moveu = mira && Math.hypot(ev.clientX - mira.x, ev.clientY - mira.y) > 8;
    const naOrigem = mira && unidadeEm(el) && unidadeEm(el).u.uid === mira.uid;
    if (humanoAtaca() && ui.atacanteSel != null) {
      const uid = ui.atacanteSel;
      ui.atacanteSel = null;
      if (moveu) {
        // Arrastou: o alvo é onde soltou (um Ás inimigo ou o retrato do oponente).
        const alvo = alvoDeAtaqueEm(el);
        if (alvo != null) {
          removerAtaquesDe(uid);
          return adicionarAtaque(uid, alvo);
        }
        return render();
      }
      // Clique simples: liga/desliga o ataque direto ao oponente.
      if (ui.ataques.some(a => a.atacante === uid)) removerAtaquesDe(uid);
      else return adicionarAtaque(uid, 'jogador');
      return render();
    }
    if (humanoBloqueia() && ui.bloqSel != null) {
      const n = ataqueEm(el);
      if (n != null) return atribuirBloqueio(n);
      if (naOrigem && !moveu && mira.jaSelecionado) ui.bloqSel = null;
      else if (moveu && !naOrigem) ui.bloqSel = null;
      return render();
    }
  }

  function aoMover(ev) {
    if (ui && ui.mira && !ui.mira.moveu && Math.hypot(ev.clientX - ui.mira.x, ev.clientY - ui.mira.y) > 8) ui.mira.moveu = true;
    if (jogo && ((ui.atacanteSel != null && ui.mira && ui.mira.moveu) || ui.bloqSel != null)) {
      ui.mouse = pontoNoApp(ev.clientX, ev.clientY);
      desenharSetas();
    }
    atualizarDica(ev);
  }

  function aoTeclar(ev) {
    if ((ev.key === 'Enter' || ev.key === ' ') && ui && ui.aoContinuar) {
      ev.preventDefault();
      return ui.aoContinuar();
    }
    if (ev.key !== 'Escape' || !jogo) return;
    ui.sel = []; ui.pend = null; ui.atacanteSel = null; ui.bloqSel = null; ui.mira = null;
    render();
  }

  function clicarMao(id) {
    if (jogo.fase !== 'principal' || controle(jogo.vez) !== 'humano') return;
    ui.pend = null;
    const k = ui.sel.indexOf(id);
    if (k >= 0) ui.sel.splice(k, 1);
    else ui.sel.push(id);
    render();
  }

  function clicarBotao(acao) {
    const [nome, arg, arg2] = acao.split(':');
    switch (nome) {
      case 'cancelar':
        ui.sel = []; ui.pend = null; ui.atacanteSel = null; ui.bloqSel = null;
        return render();
      case 'tipo':
        return iniciarPendente(arg);
      case 'ir-ataque':
        ui.sel = []; ui.pend = null; ui.ataques = [];
        M.aplicarAcao(jogo, { tipo: 'atacar' });
        return render();
      case 'mais-dado': {
        const livres = ourosLivres();
        if (livres.length) ui.ataques[Number(arg)].ouros.push(livres[0]);
        return render();
      }
      case 'menos-dado':
        ui.ataques[Number(arg)].ouros.pop();
        return render();
      case 'mover': {
        const k = Number(arg), dest = k + Number(arg2);
        if (dest < 0 || dest >= ui.ataques.length) return;
        [ui.ataques[k], ui.ataques[dest]] = [ui.ataques[dest], ui.ataques[k]];
        return render();
      }
      case 'remover-ataque':
        ui.ataques.splice(Number(arg), 1);
        return render();
      case 'confirmar-ataques':
      case 'sem-ataque': {
        const lista = nome === 'sem-ataque' ? [] : ui.ataques;
        ui.ataques = []; ui.atacanteSel = null;
        M.declararAtaques(jogo, lista);
        return fluxoCombate(partida);
      }
      case 'confirmar-bloqueios': {
        const mapa = ui.bloqueios;
        ui.bloqueios = {}; ui.bloqSel = null;
        M.definirBloqueios(jogo, mapa);
        const continuar = ui.aoConfirmarBloqueio;
        ui.aoConfirmarBloqueio = null;
        if (continuar) continuar();
        return;
      }
      case 'limpar-bloqueios':
        ui.bloqueios = {}; ui.bloqSel = null;
        return render();
    }
  }

  function clicarEspaco(p, i) {
    const u = jogo.jogadores[p].campo[i], alvos = alvosClicaveis();
    if (!ui.pend) return;
    const passo = passoAtual();
    if (passo === 'slot' && alvos.has(`slot:${p}:${i}`)) return escolherParametro(i);
    if ((passo === 'sacrificio' || passo === 'alvo') && u && alvos.has('uid:' + u.uid)) return escolherParametro(u.uid);
  }

  // ---------- Setas ----------

  function pontoNoApp(x, y) {
    const r = $('#app').getBoundingClientRect();
    return { x: (x - r.left) / escala, y: (y - r.top) / escala };
  }

  function centroDe(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return pontoNoApp(r.left + r.width / 2, r.top + r.height / 2);
  }

  function elUnidade(uid) {
    const loc = M.localizar(jogo, uid);
    return loc ? document.querySelector(`[data-slot="${loc.p}:${loc.i}"]`) : null;
  }

  const elRetrato = p => document.querySelector(`#info-${p} .retrato`);

  function caminhoSeta(a, b, encurtar) {
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1;
    const curva = Math.min(80, dist * 0.18);
    const c = { x: (a.x + b.x) / 2 - (dy / dist) * curva, y: (a.y + b.y) / 2 + (dx / dist) * curva };
    let fim = b;
    if (encurtar) {
      const tx = b.x - c.x, ty = b.y - c.y, tl = Math.hypot(tx, ty) || 1;
      fim = { x: b.x - (tx / tl) * encurtar, y: b.y - (ty / tl) * encurtar };
    }
    const meio = { x: 0.25 * a.x + 0.5 * c.x + 0.25 * fim.x, y: 0.25 * a.y + 0.5 * c.y + 0.25 * fim.y };
    return { d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${fim.x.toFixed(1)} ${fim.y.toFixed(1)}`, meio };
  }

  function desenharSetas() {
    const svg = $('#setas');
    if (!jogo) {
      svg.innerHTML = '';
      return;
    }
    const setas = [];
    const ataques = ataquesVisiveis();
    for (const at of ataques) {
      const de = centroDe(elUnidade(at.atacante));
      const para = centroDe(at.alvo === 'jogador' ? elRetrato(1 - jogo.vez) : elUnidade(at.alvo));
      const bl = jogo.fase === 'bloqueio' ? ui.bloqueios[at.n] || [] : at.bloqueadores;
      const resolvido = !!at.resultado;
      if (de && para) setas.push({ de, para, cor: 'ataque', rotulo: at.n, tenue: bl.length > 0 || resolvido, foco: ui.foco === at.n });
      for (const b of bl) {
        const db = centroDe(elUnidade(b));
        if (db && de) setas.push({ de: db, para: de, cor: 'bloqueio', tenue: resolvido, foco: ui.foco === at.n });
      }
    }
    if (ui.mouse && ((ui.atacanteSel != null && ui.mira && ui.mira.moveu) || ui.bloqSel != null)) {
      const de = centroDe(elUnidade(ui.atacanteSel != null ? ui.atacanteSel : ui.bloqSel));
      if (de) setas.push({ de, para: ui.mouse, cor: ui.atacanteSel != null ? 'mira-ataque' : 'mira-bloqueio', viva: true });
    }
    svg.innerHTML = `<defs>
        <marker id="ponta-ataque" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#ff4b4b"/></marker>
        <marker id="ponta-bloqueio" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#5aa7ff"/></marker>
        <marker id="ponta-mira-ataque" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#ffd166"/></marker>
        <marker id="ponta-mira-bloqueio" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#9fd0ff"/></marker>
      </defs>` + setas.map(s => {
      const { d, meio } = caminhoSeta(s.de, s.para, s.viva ? 0 : 34);
      const cls = `seta ${s.cor}${s.tenue ? ' tenue' : ''}${s.foco ? ' foco' : ''}${s.viva ? ' viva' : ''}`;
      const rot = s.rotulo != null ? `<g class="rotulo-seta"><circle cx="${meio.x}" cy="${meio.y}" r="15"/><text x="${meio.x}" y="${meio.y}">${s.rotulo}</text></g>` : '';
      return `<g class="${cls}"><path class="sombra" d="${d}"/><path class="linha" d="${d}" marker-end="url(#ponta-${s.cor})"/>${rot}</g>`;
    }).join('');
  }

  // ---------- Caixa de dica (mouse em cima da carta) ----------

  function acharCarta(id) {
    for (const j of jogo ? jogo.jogadores : []) {
      for (const lista of [j.mao, j.cemiterio, j.letras, j.numeros]) {
        const c = lista.find(x => x.id === id);
        if (c) return c;
      }
    }
    return null;
  }

  function dicaCarta(c) {
    const nome = M.nomeCarta(c);
    if (M.ehFigura(c)) {
      return {
        titulo: nome, sub: 'Figura',
        linhas: ['Junte com 1 carta numérica para sumonar um Senhor(a). O número define o ataque.', PODER_FIGURA[c.rank],
          `Com um número de ${NOME_NAIPE[c.naipe]}, vira Naipado(a) de ${NOME_NAIPE[c.naipe]}: ${PODER_NAIPADO[c.naipe]}`],
      };
    }
    if (M.ehAs(c)) {
      return {
        titulo: nome, sub: 'Totem de suporte',
        linhas: [PODER_AS[c.naipe], `Para invocar (1 ação): sacrifique 1 carta numérica de ${NOME_NAIPE[c.naipe]}.`, 'Ocupa um espaço da fileira, não ataca, não bloqueia e morre com 1 golpe.'],
      };
    }
    return { titulo: nome, sub: `Carta numérica de ${NOME_NAIPE[c.naipe]}`, linhas: [`Equipada numa figura: ataque ${M.valor(c)}.`, EFEITO_NUMERO[c.naipe](c)] };
  }

  function dicaUnidade(p, i, u) {
    if (u.tipo === 'as') {
      return {
        titulo: M.nomeCarta(u.carta), sub: 'Totem de suporte',
        linhas: [PODER_AS[u.naipe], 'Não ataca, não bloqueia e morre com 1 golpe.', 'Pode ser alvo de ataques; um Senhor(a) do dono pode bloquear para protegê-lo.'],
      };
    }
    const nai = M.naipado(u), atk = M.ataque(jogo, p, i), res = M.resistencia(jogo, p, i), post = M.postura(jogo, p, i);
    const vizinhos = [i - 1, i + 1].map(k => jogo.jogadores[p].campo[k]).filter(w => w && w.tipo === 'as').map(w => w.naipe);
    const partes = [`número ${M.valor(u.numero)}`];
    if (nai === 'espadas') partes.push('+1 Naipado de Espadas');
    if (vizinhos.includes('espadas')) partes.push('+1 Ás de Espadas vizinho');
    if (u.bonus.length) partes.push(`+${u.bonus.length} Espadas neste turno (no 6: +${u.bonus.reduce((s, v) => s + Math.floor(v / 2), 0)})`);
    const fontesRes = [];
    if (nai === 'paus') fontesRes.push('Naipado de Paus');
    if (vizinhos.includes('paus')) fontesRes.push('Ás de Paus vizinho');
    const linhas = [
      `<b>Ataque ${atk}</b>: ${partes.join(' · ')}.`,
      u.berserk
        ? `<b>Berserk</b>: está na vertical até o fim do turno do oponente. ${u.berserk.hits ? 'Já levou 1 hit: morre quando o efeito acabar.' : 'Se levar 1 hit nesse período, morre quando o efeito acabar.'}`
        : `<b>Vida</b>: ${res - u.hits} de ${res} hits${fontesRes.length ? ` (${fontesRes.join(' + ')})` : ''}. Estado: ${NOME_POSTURA[post]}.`,
      PODER_FIGURA[u.figura.rank],
    ];
    if (nai) linhas.push(`<b>Naipado de ${NOME_NAIPE[nai]}</b>: ${PODER_NAIPADO[nai]}`);
    if (vizinhos.includes('copas')) linhas.push('Ás de Copas vizinho: se causar dano ao PV do oponente, o dono cura 1 PV.');
    if (u.atacou) linhas.push('Já atacou neste turno: vira para baixo no fim do turno.');
    if (!u.ativo) linhas.push('<b>Desativado</b> (virado): atacou e não pode bloquear até o próximo turno do dono.');
    else if (jogo.vez === p && M.podeAtacar(jogo, p, i)) linhas.push(`Pronto para atacar${u.ataques > 1 ? ` (${u.ataques} vezes)` : ''}.`);
    else if (jogo.vez === p && u.entrou === jogo.turno && u.figura.rank !== 'J') linhas.push('Entrou neste turno: só ataca no próximo.');
    linhas.push('<span class="dica-regra">Ao bloquear: dano menor que metade do ataque dele é ignorado; dano maior que o ataque dele mata na hora.</span>');
    return { titulo: M.nomeUnidade(u), sub: nai ? `Senhor(a) Naipado(a) de ${NOME_NAIPE[nai]}` : 'Senhor(a)', linhas };
  }

  function dicaPara(el) {
    if (!el || el.closest('#modal .acoes-menu')) return null;
    const mCarta = el.closest('[data-m-carta],[data-carta]');
    if (mCarta) {
      const c = acharCarta(mCarta.dataset.mCarta || mCarta.dataset.carta);
      return c ? dicaCarta(c) : null;
    }
    if (!jogo || el.closest('#modal')) return null;
    const mao = el.closest('[data-mao]');
    if (mao) {
      const c = acharCarta(mao.dataset.mao);
      return c ? dicaCarta(c) : null;
    }
    const loc = unidadeEm(el);
    if (loc) return dicaUnidade(loc.p, loc.i, loc.u);
    if (el.closest('[data-token]')) return { titulo: 'Ouros extra', sub: 'Ás de Ouros', linhas: ['Vale 1 carta de Ouros neste turno: selecione junto com outras cartas para comprar, reviver ou dar +1 dado num ataque.'] };
    const ret = el.closest('[data-alvo]');
    if (ret) {
      const p = Number(ret.dataset.alvo.split(':')[1]), j = jogo.jogadores[p], teto = M.tetoCura(j);
      return {
        titulo: j.nome, sub: `${j.pv} PV`,
        linhas: [`Mão: ${j.mao.length} cartas · Letras: ${j.letras.length} · Números: ${j.numeros.length} · Cemitério: ${j.cemiterio.length}.`,
          isFinite(teto) ? `Ferida de Copas: só pode curar até ${teto} PV enquanto o Naipado de Copas inimigo viver.` : `Começou com ${M.PV_INICIAL} PV. Sem feridas: Copas pode curar sem limite.`],
      };
    }
    const pilha = el.closest('[data-pilha]');
    if (pilha) {
      const [p, b] = pilha.dataset.pilha.split(':');
      const n = jogo.jogadores[Number(p)][b].length;
      return { titulo: `Baralho de ${M.NOME_BARALHO[b]}`, linhas: [`${n} carta${n === 1 ? '' : 's'} restante${n === 1 ? '' : 's'}.`, b === 'letras' ? 'Só figuras: Valete, Rainha e Rei.' : 'Só números: Ás a 10.'] };
    }
    const cem = el.closest('[data-cemiterio]');
    if (cem) return { titulo: 'Cemitério', linhas: [`${jogo.jogadores[Number(cem.dataset.cemiterio)].cemiterio.length} cartas. Clique para ver todas.`] };
    return null;
  }

  function atualizarDica(ev) {
    const caixa = $('#dica');
    const d = dicaPara(ev.target);
    if (!d) {
      caixa.hidden = true;
      return;
    }
    caixa.innerHTML = `<div class="dica-titulo">${escapar(d.titulo)}</div>${d.sub ? `<div class="dica-sub">${escapar(d.sub)}</div>` : ''}${d.linhas.filter(Boolean).map(l => `<p>${l}</p>`).join('')}`;
    caixa.hidden = false;
    const w = caixa.offsetWidth, h = caixa.offsetHeight;
    let x = ev.clientX + 18, y = ev.clientY + 18;
    if (x + w > innerWidth - 8) x = ev.clientX - w - 18;
    if (y + h > innerHeight - 8) y = Math.max(8, innerHeight - h - 8);
    caixa.style.left = Math.max(8, x) + 'px';
    caixa.style.top = y + 'px';
  }

  // ---------- Desenho da mesa ----------

  function render() {
    if (!jogo) return renderVazio();
    const alvos = alvosClicaveis();
    for (const p of [0, 1]) {
      renderJogador(p, alvos);
      renderCampo(p, alvos);
    }
    renderFaixa();
    renderLog();
    desenharSetas();
    animarEntradas();
  }

  // ---------- Cartas voando do baralho (ou do cemitério) para a mão ----------

  let maoVista = [null, null], cemVisto = [new Set(), new Set()];
  const voando = new Set();

  function animarEntradas() {
    for (const p of [0, 1]) {
      const j = jogo.jogadores[p];
      const atual = j.mao.map(c => c.id);
      if (maoVista[p]) {
        const novas = j.mao.filter(c => !maoVista[p].has(c.id));
        novas.forEach((c, k) => voarParaMao(p, c, cemVisto[p].has(c.id) ? 'cemiterio' : M.ehFigura(c) ? 'letras' : 'numeros', k));
      }
      maoVista[p] = new Set(atual);
      cemVisto[p] = new Set(j.cemiterio.map(c => c.id));
    }
  }

  function voarParaMao(p, c, origem, ordem) {
    const alvo0 = document.querySelector(`#mao-${p} [data-voo="${c.id}"]`);
    const fonte = document.querySelector(origem === 'cemiterio' ? `#pilhas-${p} [data-cemiterio] .carta` : `#pilhas-${p} [data-pilha="${p}:${origem}"] .carta`);
    if (!alvo0 || !fonte) return;
    voando.add(c.id);
    alvo0.style.visibility = 'hidden';
    const visivel = p === 0 || cfg.modo === 'bots';
    const de = fonte.getBoundingClientRect(), para = alvo0.getBoundingClientRect();
    const voo = document.createElement('div');
    voo.className = `carta-voando dorso ${corDe(p)}`;
    Object.assign(voo.style, { left: de.left + 'px', top: de.top + 'px', width: de.width + 'px', height: de.height + 'px', opacity: '0' });
    document.body.appendChild(voo);
    const dx = para.left - de.left, dy = para.top - de.top, sx = para.width / de.width, sy = para.height / de.height;
    const atraso = ordem * 140, dur = 560;
    voo.animate([
      { transform: 'translate(0, 0) scale(1) rotateY(0deg)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(${(1 + sx) / 2 * 1.08}, ${(1 + sy) / 2 * 1.08}) rotateY(${visivel ? 90 : 0}deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotateY(0deg)`, opacity: 1 },
    ], { duration: dur, delay: atraso, easing: 'ease-in-out', fill: 'both' });
    // No meio do voo a carta vira e mostra a frente (só nas mãos visíveis).
    if (visivel) {
      setTimeout(() => {
        voo.classList.remove('dorso', corDe(p));
        voo.innerHTML = C.frente(c);
        voo.style.background = '#fdfbf3';
      }, atraso + dur / 2);
    }
    setTimeout(() => {
      voo.remove();
      voando.delete(c.id);
      const alvo = document.querySelector(`#mao-${p} [data-voo="${c.id}"]`);
      if (alvo) alvo.style.visibility = '';
    }, atraso + dur + 30);
  }

  function renderVazio() {
    for (const p of [0, 1]) {
      $('#info-' + p).innerHTML = '';
      $('#mao-' + p).innerHTML = '';
      $('#pilhas-' + p).innerHTML = '';
      $('#campo-' + p).innerHTML = Array.from({ length: M.ESPACOS }, (_, i) => `<div class="espaco"><span class="num-espaco">${i + 1}</span></div>`).join('');
    }
    for (const id of ['#fase', '#instrucao', '#chips', '#botoes', '#log', '#setas']) $(id).innerHTML = '';
    $('#acoes').hidden = true;
    esconderAnuncio();
  }

  function renderJogador(p, alvos) {
    const j = jogo.jogadores[p], cor = corDe(p), teto = M.tetoCura(j);
    const quem = controle(p) === 'humano' ? 'você' : `bot · ${NOME_NIVEL[cfg.nivel]}`;
    const podeJogar = controle(p) === 'humano' && jogo.vez === p && jogo.fase === 'principal' && !ui.ocupado;
    let tokens = '';
    for (let k = 0; k < j.tokens; k++) {
      tokens += `<button class="token${ui.sel.includes('TOKEN#' + k) ? ' selecionada' : ''}" data-token="${k}"${podeJogar ? '' : ' disabled'}>♦ extra</button>`;
    }
    $('#info-' + p).innerHTML = `
      <div class="retrato cor-${cor}${alvos.has('jogador:' + p) ? ' clicavel' : ''}${jogo.vez === p ? ' da-vez' : ''}" data-alvo="jogador:${p}">
        <div class="nome">${escapar(j.nome)} <small>${quem}</small></div>
        <div class="pv"><span class="coracao">♥</span>${j.pv}</div>
        <div class="teto">${isFinite(teto) ? `ferida: cura até ${teto}` : 'pontos de vida'}</div>
      </div>
      <div class="tokens">${tokens}</div>`;
    const visivel = p === 0 || cfg.modo === 'bots';
    const oculta = id => (voando.has(id) ? ' style="visibility:hidden"' : '');
    $('#mao-' + p).innerHTML = j.mao.map(c => (visivel
      ? `<div class="carta${ui.sel.includes(c.id) ? ' selecionada' : ''}${podeJogar ? ' jogavel' : ''}"${podeJogar ? ` data-mao="${c.id}"` : ` data-carta="${c.id}"`} data-voo="${c.id}"${oculta(c.id)}>${C.frente(c)}</div>`
      : `<div class="carta dorso ${cor}" data-voo="${c.id}"${oculta(c.id)}></div>`)).join('');
    const topo = j.cemiterio[j.cemiterio.length - 1];
    $('#pilhas-' + p).innerHTML = `
      ${M.BARALHOS.map(b => {
        const pulsa = ui.aoComprar && jogo.vez === p && j[b].length ? ' pulsando' : '';
        return `<div class="pilha${pulsa}" data-pilha="${p}:${b}">${pulsa ? '<span class="seta-compra">▼</span>' : ''}<div class="carta${j[b].length ? ' dorso ' + cor : ' vazia'}"><span class="marca-pilha">${b === 'letras' ? 'J Q K' : 'A–10'}</span></div><span class="cont">${j[b].length}</span><label>${M.NOME_BARALHO[b]}</label></div>`;
      }).join('')}
      <div class="pilha" data-cemiterio="${p}">${topo ? `<div class="carta">${C.frente(topo)}</div>` : '<div class="carta vazia"></div>'}<span class="cont">${j.cemiterio.length}</span><label>Cemitério</label></div>`;
  }

  function renderCampo(p, alvos) {
    const j = jogo.jogadores[p];
    let h = '';
    for (let i = 0; i < M.ESPACOS; i++) {
      const u = j.campo[i];
      const clicavel = alvos.has(`slot:${p}:${i}`) || (u && alvos.has('uid:' + u.uid));
      const sel = u && (ui.atacanteSel === u.uid || ui.bloqSel === u.uid);
      h += `<div class="espaco${clicavel ? ' clicavel' : ''}${sel ? ' selecionado' : ''}" data-slot="${p}:${i}">${u ? htmlUnidade(p, i, u) : `<span class="num-espaco">${i + 1}</span>`}</div>`;
    }
    const fileira = $('#campo-' + p);
    fileira.style.setProperty('--dorso', `var(--dorso-${corDe(p)})`);
    fileira.innerHTML = h;
  }

  function ataquesVisiveis() {
    if (jogo.combate) return jogo.combate.ataques;
    if (jogo.fase === 'ataque') return ui.ataques.map((a, k) => ({ n: k + 1, atacante: a.atacante, alvo: a.alvo, bloqueadores: [] }));
    return [];
  }

  function emFoco(u) {
    if (ui.foco == null || !jogo.combate) return false;
    const at = jogo.combate.ataques.find(a => a.n === ui.foco);
    return !!at && (at.atacante === u.uid || at.alvo === u.uid || at.bloqueadores.includes(u.uid));
  }

  function tagsUnidade(u) {
    let t = '';
    for (const at of ataquesVisiveis()) {
      if (at.atacante === u.uid) t += `<span class="tag tag-ataque">${at.n}º ataque</span>`;
      const bl = jogo.fase === 'bloqueio' ? ui.bloqueios[at.n] || [] : at.bloqueadores;
      if (bl.includes(u.uid)) t += `<span class="tag tag-bloq">bloqueia ${at.n}º</span>`;
    }
    return t ? `<div class="tags">${t}</div>` : '';
  }

  // Gira a carta com animação quando o estado (vertical/diagonal/horizontal) muda.
  function estiloGiro(u, post) {
    const reg = posturaAnterior[u.uid], t = performance.now();
    if (!reg) {
      posturaAnterior[u.uid] = { post, de: post, desde: -Infinity };
      return '';
    }
    if (reg.post !== post) posturaAnterior[u.uid] = { post, de: reg.post, desde: t };
    const r = posturaAnterior[u.uid], passou = t - r.desde;
    if (passou >= DURACAO_ANIM) return '';
    return ` girando" style="--de:${ANGULO[r.de]}deg;--de-escala:${r.de === 'vertical' ? 1 : 0.92};animation-delay:${-passou.toFixed(0)}ms`;
  }

  // Anima a carta virando para baixo (fim do turno) ou desvirando (reativação).
  // A mesa é redesenhada com frequência; o atraso negativo faz a animação continuar de onde estava.
  let viradoAnterior = {};
  function classeVirada(u) {
    const agora = !u.ativo, reg = viradoAnterior[u.uid], t = performance.now();
    if (!reg) {
      viradoAnterior[u.uid] = { agora, desde: -Infinity };
      return null;
    }
    if (reg.agora !== agora) viradoAnterior[u.uid] = { agora, desde: t };
    const passou = t - viradoAnterior[u.uid].desde;
    if (passou >= DURACAO_ANIM) return null;
    return { cls: agora ? 'virando' : 'desvirando', atraso: -passou };
  }

  function htmlUnidade(p, i, u) {
    const foco = emFoco(u) ? ' foco' : '';
    if (u.tipo === 'as') {
      return `<div class="unidade as${foco}">
        <div class="pilha-senhor"><div class="carta">${C.frente(u.carta)}</div></div>
        <div class="selo-totem">Totem ${SIMB[u.naipe]}</div>${tagsUnidade(u)}</div>`;
    }
    const atk = M.ataque(jogo, p, i), base = M.ataqueBase(jogo, p, i), res = M.resistencia(jogo, p, i), post = M.postura(jogo, p, i);
    const nai = M.naipado(u);
    const apto = humanoAtaca() && p === jogo.vez && atacantesRestantes().includes(u.uid);
    const cls = ['unidade', 'senhor', 'postura-' + post];
    if (!u.ativo) cls.push('desativado');
    const virada = classeVirada(u);
    if (virada) cls.push(virada.cls);
    if (nai) cls.push('naipado');
    if (u.berserk) cls.push('em-berserk');
    if (apto) cls.push('apto');
    const vida = u.berserk
      ? `<span class="berserk">BERSERK${u.berserk.hits ? ' ✖' : ''}</span>`
      : '●'.repeat(Math.max(0, res - u.hits)) + '<i>' + '○'.repeat(Math.min(u.hits, res)) + '</i>';
    return `<div class="${cls.join(' ')}${foco}"${virada ? ` style="--atraso:${virada.atraso.toFixed(0)}ms"` : ''}>
      <div class="pilha-senhor${estiloGiro(u, post)}"><div class="carta numero">${C.frente(u.numero)}</div><div class="carta figura">${C.frente(u.figura)}</div></div>
      <div class="selo-vida">${vida}</div>
      <div class="selo-atk">⚔ ${atk}${atk > base ? `<small>+${atk - base}</small>` : ''}</div>
      ${nai ? `<div class="selo-naipado">${SIMB[nai]}</div>` : ''}${tagsUnidade(u)}</div>`;
  }

  function nomeAlvo(at) {
    if (at.alvo === 'jogador') return escapar(jogo.jogadores[1 - jogo.vez].nome);
    const l = M.localizar(jogo, at.alvo);
    return l ? M.nomeUnidade(l.u) : 'Ás';
  }

  function chipAtaque(at, clicavel) {
    const loc = M.localizar(jogo, at.atacante);
    const nome = loc ? M.nomeUnidade(loc.u) : '(fora de campo)';
    const atk = loc ? M.ataque(jogo, loc.p, loc.i) : '–';
    const bl = (jogo.fase === 'bloqueio' ? ui.bloqueios[at.n] || [] : at.bloqueadores)
      .map(uid => { const l = M.localizar(jogo, uid); return l ? M.nomeUnidade(l.u) : '✖'; });
    const res = at.resultado ? ` · dado ${at.resultado.rolagens.join(',')} → ${at.resultado.dano} de dano` : '';
    return `<button class="chip${clicavel ? ' clicavel' : ''}${ui.foco === at.n ? ' foco' : ''}" data-ataque="${at.n}">
      <b>${at.n}º</b> ${nome} ⚔${atk} → ${nomeAlvo(at)}${at.dados > 1 ? ` · ${at.dados} dados` : ''}${bl.length ? ` · ⛨ ${bl.join(' + ')}` : ''}${res}</button>`;
  }

  function chipDeclaracao(a, k) {
    const loc = M.localizar(jogo, a.atacante);
    const temOuros = ourosLivres().length > 0;
    const n = ui.ataques.length;
    return `<span class="chip ordem"><b>${k + 1}º</b>
      ${k > 0 ? `<button class="mini" data-acao="mover:${k}:-1" title="Atacar antes">◀</button>` : ''}
      ${M.nomeUnidade(loc.u)} ⚔${M.ataque(jogo, loc.p, loc.i)} → ${nomeAlvo(a)}
      ${k < n - 1 ? `<button class="mini" data-acao="mover:${k}:1" title="Atacar depois">▶</button>` : ''}
      ${a.ouros.length ? `<span class="dados-extra">${1 + a.ouros.length} dados <button class="mini" data-acao="menos-dado:${k}" title="Devolver o Ouros">−</button></span>` : ''}
      ${temOuros ? `<button class="mini" data-acao="mais-dado:${k}" title="Gastar 1 Ouros: +1 dado (vale o maior)">+ dado</button>` : ''}
      <button class="mini" data-acao="remover-ataque:${k}" title="Cancelar este ataque">✕</button></span>`;
  }

  function renderFaixa() {
    const p = jogo.vez, j = jogo.jogadores[p], d = 1 - p;
    const btn = (acao, rotulo, extra) => `<button class="btn ${extra || ''}" data-acao="${acao}">${rotulo}</button>`;
    let fase = `Turno ${jogo.turno} · vez de ${escapar(j.nome)}`, texto = '', chips = '', botoes = '';
    const humanoNaVez = controle(p) === 'humano' && !ui.ocupado;

    if (jogo.vencedor != null) {
      fase = 'Fim de jogo';
      texto = `${escapar(jogo.jogadores[jogo.vencedor].nome)} venceu!`;
    } else if (jogo.fase === 'abertura') {
      fase = 'Abertura';
      texto = 'Escolhendo as mãos iniciais…';
    } else if (jogo.fase === 'compra') {
      fase += ' · Compra';
      if (humanoNaVez) {
        const figs = j.mao.filter(M.ehFigura).length, nums = j.mao.filter(M.ehNumero).length;
        texto = `<b>Compre 1 carta:</b> clique num dos seus baralhos pulsando (embaixo, à direita). Letras traz figuras, Números traz Ás a 10. Na mão: ${figs} figura${figs === 1 ? '' : 's'} e ${nums} número${nums === 1 ? '' : 's'}.`;
      } else texto = `${escapar(j.nome)} está escolhendo de qual baralho comprar…`;
    } else if (jogo.fase === 'principal') {
      if (!humanoNaVez) texto = `${escapar(j.nome)} está jogando…`;
      else if (ui.pend) {
        texto = textoPasso();
        botoes = btn('cancelar', 'Cancelar');
      } else {
        if (ui.sel.length) {
          const cands = candidatosSelecao();
          const chaves = [...new Set(cands.map(chaveAcao))];
          botoes = chaves.map(k => {
            const a = cands.find(x => chaveAcao(x) === k);
            return btn('tipo:' + k, rotuloTipo(a.tipo, a), 'acao');
          }).join('') + btn('cancelar', 'Cancelar seleção');
          texto = chaves.length ? 'Escolha o que fazer com a seleção.' : dicaSelecao();
        } else {
          texto = jogo.acoes > 0
            ? 'Clique nas cartas da mão: 1 figura + 1 número para sumonar, ou 1 número para usar o efeito do naipe. Passe o mouse para ver o que cada carta faz.'
            : 'Suas ações acabaram. Vá para o ataque.';
        }
        botoes += btn('ir-ataque', '⚔ Ir para o ataque', 'principal');
      }
    } else if (jogo.fase === 'ataque') {
      fase += ' · Ataque';
      if (humanoNaVez) {
        const temAs = M.alvosPossiveis(jogo).length > 1;
        if (!M.atacantesAptos(jogo).length) texto = jogo.turno === 1 ? 'Quem começa não ataca no primeiro turno.' : 'Nenhum Senhor(a) apto(a) a atacar.';
        else texto = atacantesRestantes().length
          ? `Clique nos Senhores brilhando para atacar o oponente (clique de novo para desfazer)${temAs ? '. Para atacar um Ás, arraste até ele' : ''}. A ordem abaixo é a ordem dos ataques (◀ ▶ muda).`
          : 'Ataques declarados. Ajuste a ordem e confirme.';
        chips = ui.ataques.map(chipDeclaracao).join('');
        if (ui.ataques.length) botoes += btn('confirmar-ataques', `Confirmar ${ui.ataques.length} ataque${ui.ataques.length > 1 ? 's' : ''}`, 'principal');
        botoes += btn('sem-ataque', ui.ataques.length ? 'Encerrar sem atacar' : 'Encerrar turno');
      } else texto = `${escapar(j.nome)} está declarando ataques…`;
    } else if (jogo.fase === 'bloqueio') {
      fase += ' · Bloqueio';
      const humanoDefende = controle(d) === 'humano' && !ui.ocupado;
      chips = jogo.combate.ataques.map(at => chipAtaque(at, humanoDefende && ui.bloqSel != null)).join('');
      if (humanoDefende) {
        texto = ui.bloqSel != null
          ? 'Arraste a seta até o atacante que ele(a) vai bloquear e solte. Esc cancela.'
          : 'Arraste de um Senhor(a) seu ativo até um atacante para bloquear. Ataque sem bloqueio vai direto no seu PV.';
        botoes = btn('confirmar-bloqueios', 'Confirmar bloqueios', 'principal') + btn('limpar-bloqueios', 'Limpar');
      } else texto = `${escapar(jogo.jogadores[d].nome)} está decidindo os bloqueios…`;
    } else if (jogo.fase === 'resolucao' || jogo.fase === 'fimCombate') {
      fase += ' · Combate';
      if (jogo.combate) chips = jogo.combate.ataques.map(at => chipAtaque(at, false)).join('');
    } else if (jogo.fase === 'descarte') {
      texto = 'Limite de 7 cartas na mão: descarte o excesso.';
    }
    renderAcoes();
    $('#fase').innerHTML = fase;
    $('#instrucao').innerHTML = texto;
    $('#chips').innerHTML = chips;
    $('#botoes').innerHTML = botoes;
  }

  // Caixa com as ações passivas restantes, na cor de quem está jogando.
  function renderAcoes() {
    const caixa = $('#acoes');
    if (jogo.vencedor != null || jogo.fase === 'abertura') {
      caixa.hidden = true;
      return;
    }
    const total = M.ACOES_POR_TURNO;
    const restantes = jogo.acoes;
    const pips = Array.from({ length: total }, (_, k) => `<i class="${k < restantes ? 'cheio' : ''}"></i>`).join('');
    caixa.className = 'cor-' + corDe(jogo.vez);
    caixa.innerHTML = `<div class="acoes-rotulo">Ações passivas</div><div class="acoes-num"><b>${restantes}</b>/${total}</div><div class="acoes-pips">${pips}</div>
      <div class="acoes-vez">vez de ${escapar(jogo.jogadores[jogo.vez].nome)}</div>`;
    caixa.hidden = false;
  }

  function renderLog() {
    const el = $('#log');
    el.innerHTML = jogo.log.slice(-150).map(l => `<p${l.startsWith('—') ? ' class="turno"' : ''}>${escapar(l)}</p>`).join('');
    el.scrollTop = el.scrollHeight;
  }

  // ---------- Pop-up de ataque ----------

  function cartaUnidadeHTML(u, p, i) {
    if (u.tipo === 'as') {
      return `<div class="anuncio-carta"><div class="pilha-grande as"><div class="carta">${C.frente(u.carta)}</div></div><span>${M.nomeCarta(u.carta)}</span></div>`;
    }
    const nai = M.naipado(u);
    return `<div class="anuncio-carta${nai ? ' naipado' : ''}">
      <div class="pilha-grande postura-${M.postura(jogo, p, i)}"><div class="carta numero">${C.frente(u.numero)}</div><div class="carta figura">${C.frente(u.figura)}</div></div>
      <span>${M.nomeUnidade(u)}</span><b>⚔ ${M.ataque(jogo, p, i)}</b></div>`;
  }

  // "Foto" das cartas do duelo antes do golpe: quem morrer some da mesa, mas continua no pop-up.
  function fotoUnidade(uid) {
    const l = M.localizar(jogo, uid);
    if (!l) return null;
    return {
      uid, u: JSON.parse(JSON.stringify(l.u)), atk: l.u.tipo === 'senhor' ? M.ataque(jogo, l.p, l.i) : null,
      postura: M.postura(jogo, l.p, l.i), hits: l.u.hits || 0, bhits: l.u.berserk ? l.u.berserk.hits : 0,
    };
  }

  function capturarDuelo(at) {
    const d = 1 - jogo.vez;
    return {
      n: at.n, dados: at.dados, defensor: d, pvAntes: jogo.jogadores[d].pv,
      atacante: fotoUnidade(at.atacante),
      bloqueadores: at.bloqueadores.map(fotoUnidade).filter(Boolean),
      alvoAs: at.alvo !== 'jogador' ? fotoUnidade(at.alvo) : null,
    };
  }

  function efeitoDe(f) {
    const l = M.localizar(jogo, f.uid);
    if (!l) return 'morreu';
    const bh = l.u.berserk ? l.u.berserk.hits : 0;
    return l.u.hits > f.hits || bh > f.bhits ? 'hit' : 'ileso';
  }

  const SELO_EFEITO = { morreu: '✖ morreu', hit: '+1 hit', ileso: 'sem dano' };

  function cartaFotoHTML(f, efeito, papel) {
    const u = f.u;
    const vivo = efeito && efeito !== 'morreu' ? M.localizar(jogo, f.uid) : null;
    const postura = vivo ? M.postura(jogo, vivo.p, vivo.i) : f.postura;
    const mostrarSelo = efeito && !(efeito === 'ileso' && papel === 'atacante');
    const selo = mostrarSelo ? `<div class="efeito efeito-${efeito}">${SELO_EFEITO[efeito]}${efeito === 'hit' && papel === 'atacante' ? ' (contra-ataque)' : ''}</div>` : '';
    const morta = efeito === 'morreu' ? ' morta' : '';
    if (u.tipo === 'as') {
      return `<div class="anuncio-carta${morta}">${selo}<div class="pilha-grande as"><div class="carta">${C.frente(u.carta)}</div></div><span>${M.nomeCarta(u.carta)}</span></div>`;
    }
    const nai = M.naipado(u);
    return `<div class="anuncio-carta${nai ? ' naipado' : ''}${morta}">${selo}
      <div class="pilha-grande postura-${postura}"><div class="carta numero">${C.frente(u.numero)}</div><div class="carta figura">${C.frente(u.figura)}</div></div>
      <span>${M.nomeUnidade(u)}</span><b>⚔ ${f.atk}</b></div>`;
  }

  function jogadorFotoHTML(p, antes, depois, rotulo) {
    const j = jogo.jogadores[p], perdeu = antes - depois;
    return `<div class="anuncio-carta"><div class="anuncio-jogador cor-${corDe(p)}${perdeu > 0 ? ' tomou-dano' : ''}" data-pv-de="${antes}" data-pv-para="${depois}">
        <div class="nome">${escapar(j.nome)}</div><div class="pv"><span class="coracao">♥</span><span class="pv-num">${antes}</span></div>
        ${perdeu > 0 ? `<div class="dano-flutuante">−${perdeu}</div>` : ''}</div><span>${rotulo}</span></div>`;
  }

  // depois = false: antes do dado; true: mostra o resultado (selos e PV animado).
  function dueloHTML(s, total, depois) {
    if (!s.atacante) return '';
    const ef = f => (depois ? efeitoDe(f) : null);
    const atacante = cartaFotoHTML(s.atacante, ef(s.atacante), 'atacante');
    const pvDepois = depois ? jogo.jogadores[s.defensor].pv : s.pvAntes;
    let defesa;
    if (s.bloqueadores.length) {
      defesa = `<div class="anuncio-grupo"><div class="anuncio-rotulo bloq">⛨ bloqueado por</div><div class="anuncio-linha">${s.bloqueadores.map(f => cartaFotoHTML(f, ef(f), 'bloqueador')).join('')}</div></div>`;
      if (pvDepois < s.pvAntes) defesa += `<div class="duelo-seta pequena">➜</div>${jogadorFotoHTML(s.defensor, s.pvAntes, pvDepois, 'Atropelar!')}`;
    } else if (s.alvoAs) {
      defesa = `<div class="anuncio-grupo"><div class="anuncio-rotulo">◎ alvo</div>${cartaFotoHTML(s.alvoAs, ef(s.alvoAs), 'alvo')}</div>`;
    } else defesa = jogadorFotoHTML(s.defensor, s.pvAntes, pvDepois, 'Ataque direto');
    return `<div class="anuncio-topo">${s.n}º ataque de ${total}${s.dados > 1 ? ` · ${s.dados} dados (vale o maior)` : ''}</div>
      <div class="duelo">${atacante}<div class="duelo-seta">⚔</div>${defesa}</div>`;
  }

  // Conta o PV para baixo dentro do pop-up, depois do "tremor" de dano.
  function animarPV() {
    const caixa = $('#anuncio [data-pv-de]');
    if (!caixa) return;
    const de = Number(caixa.dataset.pvDe), para = Number(caixa.dataset.pvPara);
    if (para >= de) return;
    const num = caixa.querySelector('.pv-num');
    const inicio = performance.now() + 250, dur = 700;
    const passo = t => {
      if (!num.isConnected) return;
      const k = Math.min(1, Math.max(0, (t - inicio) / dur));
      num.textContent = Math.round(de - (de - para) * k);
      if (k < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  const botaoContinuar = () => '<div class="anuncio-acoes"><button class="btn principal" data-continuar>Continuar ▸</button><span>ou Enter</span></div>';

  // Espera o jogador clicar em Continuar. Assistindo bot × bot, segue sozinho.
  function esperarContinuar(msAuto) {
    return new Promise(r => {
      ui.aoContinuar = () => {
        ui.aoContinuar = null;
        r();
      };
      if (cfg.modo === 'bots') setTimeout(() => { if (ui.aoContinuar) ui.aoContinuar(); }, msAuto || 2600);
    });
  }

  function mostrarAnuncio(html, classe) {
    const a = $('#anuncio');
    a.className = classe || '';
    a.innerHTML = html;
    a.hidden = false;
    void a.offsetWidth;
    a.classList.add('visivel');
  }

  function esconderAnuncio() {
    const a = $('#anuncio');
    a.hidden = true;
    a.className = '';
    a.innerHTML = '';
  }

  function anuncioDeclaracao(ataques, nome) {
    const itens = ataques.map(at => {
      const l = M.localizar(jogo, at.atacante);
      return `<div class="fila-item"><div class="fila-num">${at.n}º</div>${cartaUnidadeHTML(l.u, l.p, l.i)}<div class="fila-alvo">→ ${nomeAlvo(at)}</div></div>`;
    }).join('');
    return `<div class="anuncio-topo">${escapar(nome)} vai atacar ${ataques.length > 1 ? `com ${ataques.length} ataques, nesta ordem` : ''}</div><div class="fila">${itens}</div>${botaoContinuar()}`;
  }

  // ---------- Janelas ----------

  function modal(html, aoClicarModal) {
    const m = $('#modal');
    m.innerHTML = `<div class="caixa">${html}</div>`;
    m.hidden = false;
    m.onclick = aoClicarModal || null;
  }

  function fecharModal() {
    const m = $('#modal');
    m.hidden = true;
    m.innerHTML = '';
    m.onclick = null;
    $('#dica').hidden = true;
  }

  const gradeCartas = (cartas, escolhidas, clicavel) => `<div class="grade-cartas">${cartas.map(c =>
    `<div class="carta grande${escolhidas && escolhidas.includes(c.id) ? ' selecionada' : ''}${clicavel ? '' : ' estatica'}" data-m-carta="${c.id}"${clicavel ? ' data-clicavel="1"' : ''}>${C.frente(c)}</div>`).join('')}</div>`;

  const cartaClicada = ev => {
    const c = ev.target.closest('[data-m-carta][data-clicavel]');
    return c ? c.dataset.mCarta : null;
  };

  function aberturaHumana() {
    return new Promise(resolver => {
      const figs = M.figurasNoBaralho(jogo, 0), qtd = Math.min(3, figs.length), esc = [];
      const tela1 = () => modal(`<h2>Escolha ${qtd} figuras para a sua mão inicial</h2>
          <p class="nota">Passe o mouse em cima de uma carta para ver o que ela faz. Depois você compra 4 cartas do baralho de Números.</p>
          ${gradeCartas(figs, esc, true)}
          <div class="acoes-menu"><button class="btn principal" data-m="ok"${esc.length === qtd ? '' : ' disabled'}>Confirmar (${esc.length}/${qtd})</button></div>`,
        ev => {
          const id = cartaClicada(ev);
          if (id) {
            const k = esc.indexOf(id);
            if (k >= 0) esc.splice(k, 1);
            else if (esc.length < qtd) esc.push(id);
            return tela1();
          }
          if (ev.target.closest('[data-m="ok"]') && esc.length === qtd) {
            M.escolherFiguras(jogo, 0, esc);
            render();
            tela2();
          }
        });
      const tela2 = () => modal(`<h2>Sua mão inicial</h2>
          ${gradeCartas(jogo.jogadores[0].mao, null, false)}
          <p class="nota">Mulligan (uma vez): devolve as 4 cartas compradas, embaralha e compra 3. As figuras escolhidas ficam.</p>
          <div class="acoes-menu"><button class="btn principal" data-m="manter">Manter mão</button><button class="btn" data-m="mulligan">Mulligan</button></div>`,
        ev => {
          const b = ev.target.closest('[data-m]');
          if (!b) return;
          if (b.dataset.m === 'manter') M.confirmarAbertura(jogo, 0);
          else M.mulligan(jogo, 0);
          fecharModal();
          resolver();
        });
      tela1();
    });
  }

  function escolherDescarte() {
    return new Promise(resolver => {
      const j = jogo.jogadores[jogo.vez], n = j.mao.length - M.LIMITE_MAO, esc = [];
      const tela = () => modal(`<h2>Limite de mão: descarte ${n} carta${n > 1 ? 's' : ''}</h2>
          ${gradeCartas(j.mao, esc, true)}
          <div class="acoes-menu"><button class="btn principal" data-m="ok"${esc.length === n ? '' : ' disabled'}>Descartar (${esc.length}/${n})</button></div>`,
        ev => {
          const id = cartaClicada(ev);
          if (id) {
            const k = esc.indexOf(id);
            if (k >= 0) esc.splice(k, 1);
            else if (esc.length < n) esc.push(id);
            return tela();
          }
          if (ev.target.closest('[data-m="ok"]') && esc.length === n) {
            fecharModal();
            resolver(esc.slice());
          }
        });
      tela();
    });
  }

  function escolherDoCemiterio() {
    const j = jogo.jogadores[jogo.vez];
    const ids = new Set(candidatosPendentes().map(a => a.escolha));
    modal(`<h2>Reviver: escolha uma carta do cemitério</h2>
      ${gradeCartas(j.cemiterio.filter(c => ids.has(c.id)), null, true)}
      <div class="acoes-menu"><button class="btn" data-m="cancelar">Cancelar</button></div>`,
    ev => {
      const id = cartaClicada(ev);
      if (id) {
        fecharModal();
        return escolherParametro(id);
      }
      if (ev.target.closest('[data-m="cancelar"]')) {
        fecharModal();
        ui.pend = null;
        render();
      }
    });
  }

  function verCemiterio(p) {
    const j = jogo.jogadores[p];
    modal(`<h2>Cemitério de ${escapar(j.nome)}</h2>
      ${j.cemiterio.length ? gradeCartas(j.cemiterio.slice().reverse(), null, false) : '<p class="nota">Vazio.</p>'}
      <div class="acoes-menu"><button class="btn" data-m="fechar">Fechar</button></div>`,
    ev => { if (ev.target.closest('[data-m="fechar"]')) fecharModal(); });
  }

  // ---------- Fluxo da partida ----------

  async function iniciarPartida(modo) {
    cfg.modo = modo;
    partida++;
    const id = partida;
    fecharModal();
    esconderAnuncio();
    SS.Dados.cancelar();
    posturaAnterior = {};
    viradoAnterior = {};
    maoVista = [null, null];
    cemVisto = [new Set(), new Set()];
    // Você fica sempre embaixo. O Vermelho é a Senhora e sempre começa.
    const minhaCor = modo === 'bots' ? 'vermelho' : cfg.cor;
    cores = [minhaCor, minhaCor === 'vermelho' ? 'azul' : 'vermelho'];
    const primeiro = cores.indexOf('vermelho');
    const nomes = cores.map(c => NOME_COR[c]);
    // Você joga com o deck escolhido no menu; o bot usa sempre o deck padrão.
    const decks = [
      M.cartasDoDeck(modo === 'bots' ? M.contagemPadrao() : SS.Decks.contagemPara(cfg.deck), 0),
      M.cartasDoDeck(M.contagemPadrao(), 1),
    ];
    jogo = M.criarJogo({ nomes, primeiro, decks });
    ui = novoUi();
    M.registrar(jogo, `${nomes[primeiro]} (a Senhora) começa.`);
    render();
    for (const p of [1, 0]) {
      if (controle(p) !== 'bot') continue;
      M.escolherFiguras(jogo, p, Bot.escolherFiguras(jogo, p, cfg.nivel));
      if (Bot.querMulligan(jogo, p, cfg.nivel)) M.mulligan(jogo, p);
      else M.confirmarAbertura(jogo, p);
    }
    if (controle(0) === 'humano') {
      await aberturaHumana();
      if (id !== partida) return;
    }
    proximoTurno(id);
  }

  async function proximoTurno(id) {
    if (id !== partida) return;
    if (jogo.vencedor != null) return fimDeJogo();
    render();
    if (jogo.fase === 'compra') {
      const p = jogo.vez;
      if (controle(p) === 'bot') {
        await esperar(500);
        if (id !== partida) return;
        M.comprarDoTurno(jogo, Bot.escolherBaralho(jogo, p, cfg.nivel));
      } else {
        // Os dois baralhos pulsam na mesa; o jogador clica no que quer comprar.
        const origem = await new Promise(r => { ui.aoComprar = r; render(); });
        if (id !== partida) return;
        M.comprarDoTurno(jogo, origem);
      }
      if (jogo.vencedor != null) return fimDeJogo();
      render();
    }
    if (controle(jogo.vez) === 'bot') turnoBot(id);
  }

  async function turnoBot(id) {
    const p = jogo.vez;
    ui.ocupado = true;
    render();
    await esperar(800);
    if (id !== partida) return;
    for (let g = 0; g < 12 && jogo.fase === 'principal'; g++) {
      const a = Bot.proximaAcao(jogo, p, cfg.nivel);
      M.aplicarAcao(jogo, a);
      render();
      if (jogo.vencedor != null) return fimDeJogo();
      await esperar(a.tipo === 'atacar' ? 300 : 900);
      if (id !== partida) return;
    }
    if (jogo.fase === 'principal') M.aplicarAcao(jogo, { tipo: 'atacar' });
    const lista = Bot.declararAtaques(jogo, p, cfg.nivel);
    M.declararAtaques(jogo, lista);
    render();
    if (lista.length) {
      mostrarAnuncio(anuncioDeclaracao(jogo.combate.ataques, jogo.jogadores[p].nome));
      await esperarContinuar(2200);
      if (id !== partida) return;
      esconderAnuncio();
    } else await esperar(400);
    if (id !== partida) return;
    fluxoCombate(id);
  }

  async function fluxoCombate(id) {
    ui.ocupado = true;
    render();
    if (jogo.fase === 'bloqueio') {
      const d = 1 - jogo.vez;
      if (controle(d) === 'bot') {
        await esperar(500);
        if (id !== partida) return;
        M.definirBloqueios(jogo, Bot.bloquear(jogo, d, cfg.nivel));
      } else if (!M.bloqueadoresAptos(jogo).length) {
        M.registrar(jogo, `${jogo.jogadores[d].nome} não tem Senhores ativos para bloquear.`);
        M.definirBloqueios(jogo, {});
      } else {
        ui.ocupado = false;
        ui.bloqueios = {};
        ui.bloqSel = null;
        render();
        await new Promise(r => { ui.aoConfirmarBloqueio = r; });
        if (id !== partida) return;
        ui.ocupado = true;
      }
      render();
      await esperar(600);
      if (id !== partida) return;
    }
    const total = jogo.combate ? jogo.combate.ataques.length : 0;
    while (jogo.fase === 'resolucao') {
      const at = jogo.combate.ataques[jogo.combate.indice];
      ui.foco = at.n;
      render();
      const foto = capturarDuelo(at);
      const temPopup = !!foto.atacante;
      if (temPopup) {
        mostrarAnuncio(dueloHTML(foto, total, false));
        await esperar(1300);
        if (id !== partida) return;
        $('#anuncio').classList.add('recuado');
      }
      // Quando é você atacando, você mesmo joga o dado (pegar e soltar na mesa).
      const rolagens = controle(jogo.vez) === 'humano'
        ? await SS.Dados.jogar(at.dados, corDe(jogo.vez))
        : await SS.Dados.rolar(at.dados, corDe(jogo.vez), jogo.vez === 1);
      if (id !== partida) return;
      await esperar(800); // tempo para ver a face do dado
      if (id !== partida) return;
      SS.Dados.sumir();
      const antes = jogo.log.length;
      M.resolverProximo(jogo, rolagens);
      const linhas = jogo.log.slice(antes);
      render();
      if (temPopup) {
        const destaque = linhas.shift() || '';
        mostrarAnuncio(`${dueloHTML(foto, total, true)}
          <div class="anuncio-resultado"><p class="principal">${escapar(destaque.replace(/^Ataque \d+: /, ''))}</p>${linhas.map(l => `<p>${escapar(l)}</p>`).join('')}</div>
          ${botaoContinuar()}`, 'resultado');
        animarPV();
        await esperarContinuar();
      } else await esperar(1200);
      if (id !== partida) return;
      esconderAnuncio();
    }
    ui.foco = null;
    if (jogo.vencedor != null) return fimDeJogo();
    M.encerrarTurno(jogo);
    if (jogo.fase === 'descarte') {
      if (controle(jogo.vez) === 'bot') M.descartar(jogo, Bot.descartar(jogo, jogo.vez));
      else {
        ui.ocupado = false;
        render();
        const ids = await escolherDescarte();
        if (id !== partida) return;
        M.descartar(jogo, ids);
      }
    }
    ui.ocupado = false;
    proximoTurno(id);
  }

  function fimDeJogo() {
    ui.ocupado = false;
    esconderAnuncio();
    render();
    const v = jogo.vencedor;
    const venceu = cfg.modo === 'bot' ? v === 0 : null;
    const titulo = cfg.modo === 'bots' ? `${escapar(jogo.jogadores[v].nome)} venceu!` : venceu ? 'Vitória!' : 'Derrota';
    modal(`<h2 class="titulo-fim${venceu === false ? ' derrota' : ''}">${titulo}</h2>
      <p>Partida encerrada no turno ${jogo.turno}.</p>
      <div class="acoes-menu"><button class="btn principal" data-m="denovo">Jogar de novo</button><button class="btn" data-m="ver">Ver a mesa</button><button class="btn" data-m="menu">Menu</button></div>`,
    ev => {
      const b = ev.target.closest('[data-m]');
      if (!b) return;
      if (b.dataset.m === 'denovo') iniciarPartida(cfg.modo);
      else if (b.dataset.m === 'ver') fecharModal();
      else menu();
    });
  }

  function confirmarDesistir() {
    if (!jogo || jogo.vencedor != null) return;
    const assistindo = cfg.modo === 'bots';
    modal(`<h2>${assistindo ? 'Encerrar esta partida?' : 'Desistir da partida?'}</h2>
      <p class="nota">${assistindo ? 'A partida entre os bots termina agora.' : 'O oponente vence e a partida termina agora.'}</p>
      <div class="acoes-menu"><button class="btn principal" data-m="sim">${assistindo ? 'Encerrar' : 'Desistir'}</button><button class="btn" data-m="nao">Continuar jogando</button></div>`,
    ev => {
      const b = ev.target.closest('[data-m]');
      if (!b) return;
      if (b.dataset.m === 'nao') return fecharModal();
      if (assistindo) return menu();
      partida++; // interrompe o turno em andamento
      SS.Dados.cancelar();
      M.desistir(jogo, 0);
      fimDeJogo();
    });
  }

  function confirmarReiniciar() {
    if (!jogo) return;
    modal(`<h2>Reiniciar a partida?</h2><p class="nota">Começa uma partida nova com as mesmas opções.</p>
      <div class="acoes-menu"><button class="btn principal" data-m="sim">Reiniciar</button><button class="btn" data-m="nao">Continuar jogando</button></div>`,
    ev => {
      const b = ev.target.closest('[data-m]');
      if (!b) return;
      if (b.dataset.m === 'sim') iniciarPartida(cfg.modo);
      else fecharModal();
    });
  }

  function confirmarMenu() {
    if (!jogo || jogo.vencedor != null) return menu();
    modal(`<h2>Abandonar a partida?</h2><div class="acoes-menu"><button class="btn principal" data-m="sim">Ir para o menu</button><button class="btn" data-m="nao">Continuar jogando</button></div>`,
      ev => {
        const b = ev.target.closest('[data-m]');
        if (!b) return;
        if (b.dataset.m === 'sim') menu();
        else fecharModal();
      });
  }

  function menu() {
    partida++;
    SS.Dados.cancelar();
    jogo = null;
    ui = novoUi();
    renderVazio();
    const grupo = (nome, opcoes, desativado) => `<div class="grupo" data-grupo="${nome}">${opcoes.map(([v, r]) =>
      `<button data-v="${v}" class="${cfg[nome] === v ? 'ativo' : ''}"${desativado ? ' disabled' : ''}>${r}</button>`).join('')}</div>`;
    const tela = () => {
      const decks = SS.Decks.opcoes();
      if (!decks.some(d => d.id === cfg.deck)) cfg.deck = 'padrao';
      modal(`<h1 class="titulo">Senhora <span>e</span> Senhores</h1>
        <p class="sub">Protótipo · Regras v2</p>
        <div class="opcao"><label>Sua cor</label>${grupo('cor', [['vermelho', '♥ Vermelho · Senhora'], ['azul', '♠ Azul · Senhor']])}
          <p class="nota">O Vermelho é a Senhora e sempre começa a partida.</p></div>
        <div class="opcao"><label>Dificuldade do bot</label>${grupo('nivel', [['facil', 'Fácil'], ['medio', 'Médio'], ['dificil', 'Difícil']])}</div>
        <div class="opcao"><label>Seu deck</label>${grupo('deck', decks.map(d => [d.id, escapar(d.nome)]))}
          ${decks.length === 1 ? '<p class="nota">Monte seus decks em "Montar decks" para escolher aqui.</p>' : ''}</div>
        <div class="acoes-menu">
          <button class="btn principal" data-m="jogar">Jogar contra o bot</button>
          <button class="btn" data-m="assistir">Assistir bot × bot</button>
        </div>
        <div class="acoes-menu secundario">
          <button class="btn" data-m="decks">🂠 Montar decks</button>
          <button class="btn" data-m="regras">📖 Regras do jogo</button>
          <button class="btn" data-m="simular">Simular partidas</button>
        </div>`,
      ev => {
        const g = ev.target.closest('[data-grupo] [data-v]');
        if (g && !g.disabled) {
          cfg[g.parentElement.dataset.grupo] = g.dataset.v;
          return tela();
        }
        const b = ev.target.closest('[data-m]');
        if (!b) return;
        if (b.dataset.m === 'jogar') iniciarPartida('bot');
        else if (b.dataset.m === 'assistir') iniciarPartida('bots');
        else if (b.dataset.m === 'decks') {
          fecharModal();
          SS.Decks.abrir(tela);
        } else if (b.dataset.m === 'regras') {
          fecharModal();
          SS.Regras.abrir(tela);
        } else simulacao(tela);
      });
    };
    tela();
  }

  // ---------- Simulação em massa (teste de equilíbrio) ----------

  function simulacao(voltar) {
    const s = { n: 100, a: 'medio', b: 'medio', rodando: false, feitos: 0, r: null, id: 0 };
    const grupo = (chave, opcoes) => `<div class="grupo" data-s="${chave}">${opcoes.map(([v, r]) =>
      `<button data-v="${v}" class="${String(s[chave]) === String(v) ? 'ativo' : ''}"${s.rodando ? ' disabled' : ''}>${r}</button>`).join('')}</div>`;
    const niveis = [['facil', 'Fácil'], ['medio', 'Médio'], ['dificil', 'Difícil']];
    const pct = (x, t) => (t ? Math.round((100 * x) / t) + '%' : '–');
    const resultado = () => {
      const r = s.r;
      if (!r) return '';
      const total = r.vit[0] + r.vit[1];
      return `<table class="tabela">
        <tr><td>Partidas</td><td>${s.feitos}</td></tr>
        <tr><td>Vitórias do Bot A (${NOME_NIVEL[s.a]})</td><td>${r.vit[0]} (${pct(r.vit[0], total)})</td></tr>
        <tr><td>Vitórias do Bot B (${NOME_NIVEL[s.b]})</td><td>${r.vit[1]} (${pct(r.vit[1], total)})</td></tr>
        <tr><td>Quem começou venceu</td><td>${pct(r.primeiroVenceu, total)}</td></tr>
        <tr><td>Média de turnos</td><td>${total ? (r.turnos / total).toFixed(1) : '–'}</td></tr>
        <tr><td>Sem vencedor (limite de 200 turnos)</td><td>${r.empates}</td></tr>
        ${r.erros ? `<tr><td>Partidas com erro</td><td>${r.erros}</td></tr>` : ''}
      </table>`;
    };
    const tela = () => modal(`<h2>Simular partidas (bot × bot)</h2>
        <p class="nota">Roda partidas completas sem animação para testar o equilíbrio das regras.<br>Quem começa alterna a cada partida. O nível Difícil é bem mais lento.</p>
        <div class="opcao"><label>Partidas</label>${grupo('n', [[50, '50'], [100, '100'], [200, '200'], [500, '500']])}</div>
        <div class="opcao"><label>Bot A</label>${grupo('a', niveis)}</div>
        <div class="opcao"><label>Bot B</label>${grupo('b', niveis)}</div>
        <div id="sim-res">${s.rodando ? `<p>Rodando… ${s.feitos}/${s.n}</p>` : ''}${resultado()}</div>
        <div class="acoes-menu"><button class="btn principal" data-m="rodar"${s.rodando ? ' disabled' : ''}>Rodar</button><button class="btn" data-m="voltar">Voltar</button></div>`,
    ev => {
      const g = ev.target.closest('[data-s] [data-v]');
      if (g && !s.rodando) {
        const chave = g.parentElement.dataset.s;
        s[chave] = chave === 'n' ? Number(g.dataset.v) : g.dataset.v;
        return tela();
      }
      const b = ev.target.closest('[data-m]');
      if (!b) return;
      if (b.dataset.m === 'voltar') {
        s.id++;
        return voltar();
      }
      if (b.dataset.m === 'rodar' && !s.rodando) rodar();
    });
    const rodar = () => {
      s.rodando = true;
      s.feitos = 0;
      s.r = { vit: [0, 0], primeiroVenceu: 0, turnos: 0, empates: 0, erros: 0 };
      const id = ++s.id;
      const lote = () => {
        if (id !== s.id) return;
        const fim = performance.now() + 120;
        while (s.feitos < s.n && performance.now() < fim) {
          try {
            const r = Bot.partidaAutomatica([s.a, s.b], s.feitos % 2);
            if (r.vencedor == null) s.r.empates++;
            else {
              s.r.vit[r.vencedor]++;
              s.r.turnos += r.turnos;
              if (r.vencedor === r.primeiro) s.r.primeiroVenceu++;
            }
          } catch (err) {
            console.error(err);
            s.r.erros++;
          }
          s.feitos++;
        }
        if (s.feitos >= s.n) s.rodando = false;
        tela();
        if (s.rodando) setTimeout(lote, 0);
      };
      tela();
      setTimeout(lote, 0);
    };
    tela();
  }

  // ---------- Início ----------

  function ajustarEscala() {
    const app = $('#app');
    escala = Math.min(innerWidth / app.offsetWidth, innerHeight / app.offsetHeight);
    app.style.transform = `translate(-50%, -50%) scale(${escala})`;
    if (jogo) desenharSetas();
  }

  C.aplicarTexturas();
  ajustarEscala();
  addEventListener('resize', ajustarEscala);
  document.addEventListener('click', aoClicar);
  document.addEventListener('mousedown', aoPressionar);
  document.addEventListener('mouseup', aoSoltar);
  document.addEventListener('mousemove', aoMover);
  document.addEventListener('keydown', aoTeclar);
  SS.Dados.iniciar();
  menu();

  // Acesso para depuração pelo console do navegador.
  SS.depurar = {
    estado: () => jogo, cfg, render, ui: () => ui,
    foto: at => capturarDuelo(at),
    duelo: (foto, total, depois) => { mostrarAnuncio(dueloHTML(foto, total, depois) + (depois ? botaoContinuar() : '')); if (depois) animarPV(); },
    fila: ataques => mostrarAnuncio(anuncioDeclaracao(ataques, jogo.jogadores[jogo.vez].nome)),
  };
})(window.SS);
