/* Interface e fluxo da partida: desenha a mesa, trata os cliques e o mouse do jogador
   e conduz os turnos do bot. Toda regra fica no motor (motor.js). */
window.SS = window.SS || {};
(function (SS) {
  'use strict';
  const M = SS.Motor, Bot = SS.Bot, C = SS.Cartas;
  // Se rede.js não carregou, o resto do jogo funciona e o online só avisa que está indisponível.
  if (!SS.Rede) {
    const nada = () => {};
    SS.Rede = { disponivel: () => false, codigoDoLink: () => null, ao: nada, enviar: nada, sair: nada, limparFila: nada, conectado: () => false, gerador: () => Math.random, esperar: () => new Promise(nada) };
  }
  const $ = s => document.querySelector(s);
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const SIMB = M.SIMBOLO;
  const t = (k, p) => SS.t(k, p);
  // Tabelas de textos ligadas ao idioma atual: TABELA[x] devolve t(prefixo + x).
  const tabela = prefixo => new Proxy({}, { get: (_, k) => t(prefixo + String(k)) });
  const NOME_NIVEL = tabela('nivel.');
  const NIVEIS_BOT = ['facil', 'medio', 'dificil', 'profissional'];
  const NOME_NAIPE = tabela('naipe.');
  const PODER_FIGURA = tabela('fig.');
  const PODER_NAIPADO = tabela('naipado.');
  const PODER_AS = tabela('as.');
  const NOME_POSTURA = tabela('postura.');
  const EFEITO_NUMERO = new Proxy({}, {
    get: (_, naipe) => c => t('efeito.' + String(naipe), { cura: M.curaDe(c), pv: M.PV_INICIAL, crit: Math.floor(M.valor(c) / 2) }),
  });
  const ANGULO = { vertical: 0, diagonal: 45, horizontal: 90 };
  // Parâmetros que o jogador escolhe clicando na mesa, em ordem, para cada tipo de ação.
  // "sacrificios" é um passo de 2 cliques (a Rainha sacrifica 2 Senhores).
  // O espaço na fileira não é um passo: vale o lugar onde a carta foi solta (ou o centro, pelo botão).
  const PASSOS = { sumonar: ['sacrificios'], invocarAs: [], espadas: ['alvo'], paus: ['alvo'], reviver: ['escolha'], curar: [], comprar: [], poder: ['alvo'] };
  const CENTRO_FILEIRA = (M.ESPACOS - 1) / 2;

  // Entre as opções que só mudam de espaço, fica a mais perto de onde a carta foi solta.
  function maisPerto(cands, destino) {
    const alvo = destino == null ? CENTRO_FILEIRA : destino;
    const dist = a => (a.slot == null ? 0 : Math.abs(a.slot - alvo) + (a.slot > alvo ? 0.01 : 0));
    return cands.slice().sort((a, b) => dist(a) - dist(b))[0];
  }
  const P = SS.Palhacos;

  const cfg = { palhaco: 'lancalotte', rival: 'aleatorio', nivel: 'medio', modo: 'bot', deck: 'palhaco' };
  let jogo = null, ui = null, partida = 0, escala = 1;
  let posturaAnterior = {};
  const DURACAO_ANIM = 700;
  let palhacos = ['lancalotte', 'paumol']; // Palhaço de cada jogador (0 = você, embaixo)
  const palhacoDe = p => P.get(palhacos[p]);
  const corDe = p => palhacoDe(p).cor;

  const novoUi = () => ({
    sel: [], pend: null, ataques: [], atacanteSel: null, bloqueios: {}, bloqSel: null,
    ocupado: false, foco: null, aoConfirmarBloqueio: null, aoContinuar: null, mira: null, mouse: null,
    // Arrastar da mão: carta sendo arrastada, espaço onde uma figura/Ás espera o número,
    // e de onde a carta voa até o campo.
    arrasto: null, destino: null, vooDe: null, mostrarFila: false, duelo: false,
  });
  // eu: o jogador desta tela (0 contra o bot; no online, 0 para quem criou a sala e 1 para o amigo).
  let eu = 0, revanche = { minha: false, dele: false };
  // Quem joga cada lado: 'humano' (esta tela), 'bot' ou 'remoto' (o amigo, pela rede).
  const controle = p => {
    if (cfg.modo === 'bots') return 'bot';
    if (cfg.modo === 'online') return p === eu ? 'humano' : 'remoto';
    return p === 0 ? 'humano' : 'bot';
  };

  // Cada tela mostra o próprio jogador embaixo: troca os ids das áreas de cima e de baixo
  // (#info-N, #mao-N, #pilhas-N, #campo-N) conforme o jogador desta tela.
  function definirLados(local) {
    const cima = 1 - local;
    for (const [zona, p] of [['.zona-op', cima], ['.zona-eu', local]]) {
      const z = $(zona);
      z.querySelector('.info').id = 'info-' + p;
      z.querySelector('.mao').id = 'mao-' + p;
      z.querySelector('.pilhas').id = 'pilhas-' + p;
    }
    const fileiras = document.querySelectorAll('.fileira');
    fileiras[0].id = 'campo-' + cima;
    fileiras[1].id = 'campo-' + local;
  }
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
    return pd.cands.filter(a => Object.keys(pd.esc).every(k => {
      if (k === 'sacrificios') return pd.esc.sacrificios.every(uid => uid === a.sacrificio || uid === a.sacrificio2);
      return a[k] === pd.esc[k];
    }));
  }

  const passoAtual = () => (ui.pend ? ui.pend.passos[ui.pend.k] : null);

  // Ações de compra têm um botão por baralho: a chave é "tipo/baralho".
  const chaveAcao = a => a.tipo + (a.baralho ? '/' + a.baralho : '');

  function iniciarPendente(chave, destino) {
    const tipo = chave.split('/')[0];
    const cands = candidatosSelecao().filter(a => chaveAcao(a) === chave);
    if (!cands.length) return;
    const tem = (a, ps) => (ps === 'sacrificios' ? a.sacrificio != null : a[ps] != null);
    ui.destino = null;
    ui.pend = { tipo, cands, passos: PASSOS[tipo].filter(ps => cands.some(a => tem(a, ps))), k: 0, esc: {}, destino };
    avancarPendente();
  }

  // Poder do Palhaço: escolhe o alvo clicando na mesa.
  function iniciarPoder() {
    const cands = M.acoesLegais(jogo).filter(a => a.tipo === 'poder');
    if (!cands.length) return;
    ui.sel = [];
    // Poder sem alvo (Cobrança do Ourinhos): acontece direto, sem clicar na mesa.
    if (cands[0].alvo == null) return aplicarDoJogador(cands[0]);
    ui.pend = { tipo: 'poder', cands, passos: ['alvo'], k: 0, esc: {} };
    avancarPendente();
  }

  function avancarPendente() {
    const pd = ui.pend;
    if (pd.k < pd.passos.length) {
      if (pd.passos[pd.k] === 'escolha') return escolherDoCemiterio();
      return render();
    }
    const acao = maisPerto(candidatosPendentes(), pd.destino);
    aplicarDoJogador(acao);
  }

  // Jogada feita nesta tela (no online, vai também para a tela do amigo).
  function enviarJogada(m) {
    if (cfg.modo === 'online') SS.Rede.enviar(m);
  }

  function aplicarDoJogador(acao) {
    ui.sel = [];
    ui.pend = null;
    ui.destino = null;
    enviarJogada({ t: 'acao', a: acao });
    M.aplicarAcao(jogo, acao);
    render();
    ui.vooDe = null;
    if (jogo.vencedor != null) fimDeJogo();
  }

  function escolherParametro(v) {
    const pd = ui.pend, passo = pd.passos[pd.k];
    if (passo === 'sacrificios') {
      const lista = pd.esc.sacrificios || (pd.esc.sacrificios = []);
      const k = lista.indexOf(v);
      if (k >= 0) lista.splice(k, 1); // clicar de novo desmarca
      else lista.push(v);
      if (lista.length < M.SACRIFICIOS_RAINHA) return render();
    } else pd.esc[passo] = v;
    pd.k++;
    avancarPendente();
  }

  function rotuloTipo(tipo, a) {
    const j = jogo.jogadores[jogo.vez];
    switch (tipo) {
      case 'sumonar': return a.sacrificio != null ? t('acao.rainha', { n: M.SACRIFICIOS_RAINHA }) : t('acao.sumonar');
      case 'invocarAs': return t('acao.as');
      case 'curar': return t('acao.curar', { n: M.curaPara(j, j.mao.find(c => c.id === a.carta)) });
      case 'espadas': return t('acao.espadas');
      case 'paus': return t('acao.paus');
      case 'comprar': return t(a.baralho === 'letras' ? 'acao.comprarLetra' : 'acao.comprarNumero');
      case 'reviver': return t('acao.reviver');
    }
    return tipo;
  }

  function dicaSelecao() {
    const j = jogo.jogadores[jogo.vez];
    const cartas = ui.sel.filter(id => !id.startsWith('TOKEN')).map(id => j.mao.find(c => c.id === id)).filter(Boolean);
    const fig = cartas.find(M.ehFigura), num = cartas.find(M.ehNumero), as = cartas.find(M.ehAs);
    if (jogo.acoes <= 0) return t('dica.semAcoes');
    if (fig && jogo.sumonados >= M.SENHORES_POR_TURNO) return t('dica.umSenhor');
    if (as && jogo.asesTurno >= M.ASES_POR_TURNO) return t('dica.umAs');
    if (fig && num && M.valor(num) > M.LIMITE_FIGURA[fig.rank]) return t('dica.limiteFigura', { c: M.nomeCarta(fig), n: M.LIMITE_FIGURA[fig.rank] });
    if (fig && num && fig.rank === 'Q') return t('dica.rainhaSacrificio', { n: M.SACRIFICIOS_RAINHA });
    if (cartas.length === 1 && fig && fig.rank === 'Q' && !candidatosParceiros().size) return t('dica.rainhaSemSenhores', { n: M.SACRIFICIOS_RAINHA });
    if (fig && num && !j.campo.includes(null)) return t('dica.fileiraCheia');
    if (as && num && as.naipe !== num.naipe) return t('dica.asMesmoNaipe');
    if (cartas.length === 1 && fig) return t('dica.selecioneNumero');
    if (cartas.length === 1 && as) return t('dica.selecioneNumeroAs');
    return t('dica.nenhumaAcao');
  }

  function textoPasso() {
    const passo = passoAtual(), tipo = ui.pend.tipo;
    if (passo === 'slot') return t(tipo === 'invocarAs' ? 'passo.slotAs' : 'passo.slot');
    if (passo === 'sacrificios') {
      const n = (ui.pend.esc.sacrificios || []).length;
      return t('passo.sacrificios', { total: M.SACRIFICIOS_RAINHA, n });
    }
    if (passo === 'alvo') {
      if (tipo === 'espadas') return t('passo.espadas');
      if (tipo === 'paus') return t('passo.paus');
      const poder = palhacoDe(jogo.vez).poder;
      return t('passo.poder', { nome: poder.nome, texto: poder.texto });
    }
    return '';
  }

  // Com 1 figura ou 1 Ás selecionado: quais cartas da mão combinam com ele (para pulsar).
  function candidatosParceiros() {
    const r = new Set();
    if (!jogo || jogo.fase !== 'principal' || ui.sel.length !== 1 || ui.pend) return r;
    const id = ui.sel[0], c = jogo.jogadores[jogo.vez].mao.find(x => x.id === id);
    if (!c || !(M.ehFigura(c) || M.ehAs(c))) return r;
    for (const a of M.acoesLegais(jogo)) {
      if (a.tipo === 'sumonar' && a.figura === id) r.add(a.numero);
      if (a.tipo === 'invocarAs' && a.as === id) r.add(a.custo);
    }
    return r;
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

  // Para onde a seta de ataque foi solta: no Palhaço do oponente, num Ás dele
  // ou (só para o Rei) num Senhor(a) dele.
  function alvoDeAtaqueEm(el, atacante) {
    if (!el) return null;
    const d = 1 - jogo.vez;
    const retrato = el.closest('[data-alvo]');
    if (retrato && retrato.dataset.alvo === 'jogador:' + d) return 'jogador';
    const loc = unidadeEm(el);
    if (loc && loc.p === d && M.alvosPossiveis(jogo, atacante).includes(loc.u.uid)) return loc.u.uid;
    return null;
  }

  // O alvo do ataque do Rei já defende esse ataque: não entra nele como ajudante.
  const alvoDoRei = (at, uid) => M.ataqueDirecionado(jogo, at) && at.alvo === uid;

  // Qual ataque a seta de bloqueio aponta: o chip do ataque ou a carta atacante.
  function ataqueEm(el) {
    if (!el) return null;
    const chip = el.closest('[data-ataque]');
    if (chip) return Number(chip.dataset.ataque);
    const loc = unidadeEm(el);
    if (!loc || loc.p !== jogo.vez) return null;
    const ats = jogo.combate.ataques.filter(a => a.atacante === loc.u.uid && !alvoDoRei(a, ui.bloqSel));
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
        else if (passo === 'alvo') s.add('uid:' + a.alvo);
        else if (passo === 'sacrificios') {
          s.add('uid:' + a.sacrificio);
          s.add('uid:' + a.sacrificio2);
        }
      }
    } else if (humanoAtaca()) {
      if (ui.atacanteSel == null) for (const uid of atacantesRestantes()) s.add('uid:' + uid);
      else for (const alvo of M.alvosPossiveis(jogo, ui.atacanteSel)) s.add(alvo === 'jogador' ? 'jogador:' + d : 'uid:' + alvo);
    } else if (humanoBloqueia()) {
      if (ui.bloqSel == null) for (const uid of bloqueadoresComCapacidade()) s.add('uid:' + uid);
      else for (const at of jogo.combate.ataques) if (!alvoDoRei(at, ui.bloqSel)) s.add('uid:' + at.atacante);
    }
    return s;
  }

  function aoClicar(ev) {
    if (ev.target.closest('[data-continuar]')) {
      if (ui && ui.aoContinuar) ui.aoContinuar();
      return;
    }
    if (ev.target.closest('#modal') || (ui && ui.ignorarClique)) return;
    const el = ev.target.closest('[data-acao],[data-mao],[data-token],[data-slot],[data-alvo],[data-ataque],[data-cemiterio],[data-pilha]');
    if (!el) return;
    const ds = el.dataset;
    if (ds.acao === 'log' || ds.acao === 'fechar-log') return alternarLog(ds.acao === 'log');
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
    const naMao = ev.target.closest('[data-mao]');
    if (naMao && jogo.fase === 'principal' && controle(jogo.vez) === 'humano' && !ui.ocupado && !ui.pend) {
      ev.preventDefault();
      return iniciarArrasto(ev, naMao.dataset.mao);
    }
    const loc = unidadeEm(ev.target);
    if (!loc) return;
    const declarado = ui.ataques.some(a => a.atacante === loc.u.uid);
    if (humanoAtaca() && loc.p === jogo.vez && (declarado || atacantesRestantes().includes(loc.u.uid))) {
      ui.mira = { uid: loc.u.uid, x: ev.clientX, y: ev.clientY, moveu: false };
      ui.atacanteSel = loc.u.uid;
    } else if (humanoBloqueia() && loc.p === 1 - jogo.vez && loc.u.tipo === 'senhor') {
      if (loc.u.uid === jogo.desafio) return; // desafiado pelo Lançalotte: o bloqueio é obrigatório
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
    if (ui.arrasto) return soltarArrasto(ev);
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
        // Arrastou: o alvo é onde soltou (o Palhaço do oponente, um Ás, ou um Senhor se for o Rei).
        const alvo = alvoDeAtaqueEm(el, uid);
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
    if (ui && ui.arrasto && jogo) return moverArrasto(ev);
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
    ui.sel = []; ui.pend = null; ui.atacanteSel = null; ui.bloqSel = null; ui.mira = null; ui.destino = null;
    render();
  }

  function clicarMao(id) {
    if (jogo.fase !== 'principal' || controle(jogo.vez) !== 'humano') return;
    ui.pend = null;
    const k = ui.sel.indexOf(id);
    if (k >= 0) ui.sel.splice(k, 1);
    else ui.sel.push(id);
    if (!ui.sel.length) ui.destino = null;
    // Uma figura (ou Ás) já está esperando no campo: o número clicado completa a jogada.
    if (ui.destino != null && ui.sel.length === 2 && jogarNoDestino()) return;
    render();
  }

  // ---------- Arrastar cartas da mão para a mesa ----------

  const cartaDaMao = id => jogo.jogadores[jogo.vez].mao.find(c => c.id === id);
  const ehColocacao = a => a.tipo === 'sumonar' || a.tipo === 'invocarAs';

  // Onde a carta arrastada está em cima: um Senhor(a)/Ás seu, o seu Palhaço ou um lugar na fileira.
  function destinoEm(x, y) {
    const p = jogo.vez, el = document.elementFromPoint(x, y);
    if (!el) return null;
    const loc = unidadeEm(el);
    if (loc && loc.p === p) return { tipo: 'unidade', uid: loc.u.uid, i: loc.i };
    const ret = el.closest('[data-alvo]');
    if (ret && ret.dataset.alvo === 'jogador:' + p) return { tipo: 'heroi' };
    const fileira = $('#campo-' + p), r = fileira.getBoundingClientRect();
    const folga = 40 * escala;
    if (x < r.left - folga || x > r.right + folga || y < r.top - folga || y > r.bottom + folga) return null;
    let melhor = 0, dm = Infinity;
    fileira.querySelectorAll('.espaco').forEach((e, i) => {
      const q = e.getBoundingClientRect(), d = Math.abs(q.left + q.width / 2 - x);
      if (d < dm) { dm = d; melhor = i; }
    });
    return { tipo: 'campo', i: melhor };
  }

  // O que acontece se a carta for solta ali: a ação direta (Espadas, Paus, Copas) ou a colocação no campo.
  function efeitoDoDestino(id, dest) {
    if (!dest) return null;
    const legais = M.acoesLegais(jogo);
    if (dest.tipo === 'unidade') {
      const a = legais.find(x => (x.tipo === 'espadas' || x.tipo === 'paus') && x.carta === id && x.alvo === dest.uid);
      if (a) return { acao: a };
    }
    if (dest.tipo === 'heroi') {
      const a = legais.find(x => x.tipo === 'curar' && x.carta === id);
      return a ? { acao: a } : null;
    }
    const i = dest.i;
    if (i == null || !legais.some(a => ehColocacao(a) && chaveCartas(a).includes(id))) return null;
    return { campo: i };
  }

  function iniciarArrasto(ev, id) {
    ui.arrasto = { id, x0: ev.clientX, y0: ev.clientY, moveu: false, el: null, dest: null };
  }

  function moverArrasto(ev) {
    const a = ui.arrasto;
    if (!a.moveu) {
      if (Math.hypot(ev.clientX - a.x0, ev.clientY - a.y0) < 8) return;
      a.moveu = true;
      const origem = document.querySelector(`#mao-${jogo.vez} [data-mao="${a.id}"]`);
      const r = origem ? origem.getBoundingClientRect() : { width: 86 * escala, height: 120 * escala };
      a.el = document.createElement('div');
      a.el.className = 'carta-arrastada';
      a.el.innerHTML = C.frente(cartaDaMao(a.id));
      Object.assign(a.el.style, { width: r.width + 'px', height: r.height + 'px' });
      document.body.appendChild(a.el);
      if (origem) origem.classList.add('arrastando');
      $('#dica').hidden = true;
    }
    const dx = ev.clientX - (a.ux != null ? a.ux : ev.clientX);
    a.ux = ev.clientX;
    a.giro = Math.max(-14, Math.min(14, (a.giro || 0) * 0.7 + dx * 0.9));
    a.el.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px) translate(-50%, -50%) rotate(${a.giro.toFixed(1)}deg) scale(1.08)`;
    const dest = destinoEm(ev.clientX, ev.clientY);
    const ef = efeitoDoDestino(a.id, dest);
    a.dest = ef ? dest : null;
    marcarDestino(ef ? dest : null, !!ef && !!ef.acao);
  }

  // Mostra onde a carta vai cair: um brilho no lugar da fileira (os espaços não aparecem) ou no alvo.
  function marcarDestino(dest, ehAlvo) {
    document.querySelectorAll('.destino, .destino-alvo').forEach(e => e.classList.remove('destino', 'destino-alvo'));
    const fileira = $('#campo-' + jogo.vez);
    fileira.classList.toggle('soltando', !!ui.arrasto && ui.arrasto.moveu);
    if (!dest) return;
    if (dest.tipo === 'heroi') return elRetrato(jogo.vez).classList.add('destino-alvo');
    const e = fileira.querySelector(`[data-slot="${jogo.vez}:${dest.i}"]`);
    if (e) e.classList.add(ehAlvo ? 'destino-alvo' : 'destino');
  }

  function soltarArrasto(ev) {
    const a = ui.arrasto;
    ui.arrasto = null;
    if (!a.moveu) return false;
    ui.ignorarClique = true;
    setTimeout(() => { ui.ignorarClique = false; }, 0);
    const voo = a.el.getBoundingClientRect();
    a.el.remove();
    marcarDestino(null);
    $('#campo-' + jogo.vez).classList.remove('soltando');
    const ef = efeitoDoDestino(a.id, destinoEm(ev.clientX, ev.clientY));
    ui.vooDe = { x: voo.left + voo.width / 2, y: voo.top + voo.height / 2, w: voo.width };
    if (!ef) {
      ui.vooDe = null;
      render();
      return true;
    }
    if (ef.acao) {
      aplicarDoJogador(ef.acao);
      return true;
    }
    // Colocação: junta com o parceiro já selecionado (número, figura ou Ás), se houver.
    const id = a.id;
    const combos = M.acoesLegais(jogo).filter(x => ehColocacao(x) && chaveCartas(x).includes(id));
    const parceiro = ui.sel.find(s => s !== id && combos.some(x => chaveCartas(x).includes(s)));
    ui.sel = parceiro ? [id, parceiro] : [id];
    ui.destino = ef.campo;
    if (parceiro && jogarNoDestino()) return true;
    // Figura ou Ás sozinho: fica esperando no lugar; o número que combina pulsa na mão.
    const c = cartaDaMao(id);
    if (!(M.ehFigura(c) || M.ehAs(c))) {
      ui.sel = [];
      ui.destino = null;
      ui.vooDe = null;
    }
    render();
    return true;
  }

  // Seleção com figura + número (ou Ás + número) e um lugar escolhido: coloca no campo.
  function jogarNoDestino() {
    const cands = candidatosSelecao().filter(ehColocacao);
    if (!cands.length) return false;
    const destino = ui.destino;
    iniciarPendente(chaveAcao(cands[0]), destino);
    return true;
  }

  function clicarBotao(acao) {
    const [nome, arg, arg2] = acao.split(':');
    switch (nome) {
      case 'cancelar':
        ui.sel = []; ui.pend = null; ui.atacanteSel = null; ui.bloqSel = null; ui.destino = null;
        return render();
      case 'tipo':
        return iniciarPendente(arg);
      case 'ir-ataque':
        // No online o amigo só fica sabendo do ataque quando ele é confirmado (a mensagem "declarar"
        // já leva para a fase de ataque), então dá para voltar atrás sem desencontrar as duas telas.
        ui.sel = []; ui.pend = null; ui.ataques = [];
        M.aplicarAcao(jogo, { tipo: 'atacar' });
        return render();
      case 'voltar':
        // Clicou em Atacar sem querer (esqueceu de sumonar): volta para as ações passivas.
        ui.ataques = []; ui.atacanteSel = null; ui.mira = null;
        M.voltarAoPrincipal(jogo);
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
        enviarJogada({ t: 'declarar', lista });
        M.declararAtaques(jogo, lista);
        return fluxoCombate(partida);
      }
      case 'confirmar-bloqueios': {
        const mapa = ui.bloqueios;
        ui.bloqueios = {}; ui.bloqSel = null;
        enviarJogada({ t: 'bloqueios', mapa });
        M.definirBloqueios(jogo, mapa);
        const continuar = ui.aoConfirmarBloqueio;
        ui.aoConfirmarBloqueio = null;
        if (continuar) continuar();
        return;
      }
      case 'limpar-bloqueios':
        ui.bloqueios = bloqueiosIniciais();
        ui.bloqSel = null;
        return render();
      case 'poder':
        return iniciarPoder();
    }
  }

  // O Senhor(a) desafiado pelo Lançalotte já começa bloqueando o primeiro ataque possível.
  function bloqueiosIniciais() {
    const b = {};
    const l = jogo.desafio != null ? M.localizar(jogo, jogo.desafio) : null;
    if (l && l.p === 1 - jogo.vez && l.u.ativo) {
      const at = jogo.combate.ataques.find(a => !alvoDoRei(a, jogo.desafio));
      if (at) b[at.n] = [jogo.desafio];
    }
    return b;
  }

  function clicarEspaco(p, i) {
    const u = jogo.jogadores[p].campo[i], alvos = alvosClicaveis();
    if (!ui.pend) return;
    const passo = passoAtual();
    if (passo === 'slot' && alvos.has(`slot:${p}:${i}`)) return escolherParametro(i);
    if ((passo === 'sacrificios' || passo === 'alvo') && u && alvos.has('uid:' + u.uid)) return escolherParametro(u.uid);
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

  const elRetrato = p => document.querySelector(`#info-${p} .heroi`);

  // inicio: quanto a seta "sai" de dentro da carta de origem (começa na borda, não no meio da cara).
  function caminhoSeta(a0, b, encurtar, inicio) {
    const dx0 = b.x - a0.x, dy0 = b.y - a0.y, dist0 = Math.hypot(dx0, dy0) || 1;
    const curva = Math.min(80, dist0 * 0.18);
    const c = { x: (a0.x + b.x) / 2 - (dy0 / dist0) * curva, y: (a0.y + b.y) / 2 + (dx0 / dist0) * curva };
    let a = a0;
    if (inicio) {
      const sx = c.x - a0.x, sy = c.y - a0.y, sl = Math.hypot(sx, sy) || 1, k = Math.min(inicio, sl * 0.4);
      a = { x: a0.x + (sx / sl) * k, y: a0.y + (sy / sl) * k };
    }
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
    // Na resolução, só aparecem as setas do ataque em andamento (as outras poluíam a mesa).
    const resolvendo = jogo.fase === 'resolucao' || jogo.fase === 'fimCombate';
    const ataques = ataquesVisiveis().filter(at => !resolvendo || ui.foco == null || at.n === ui.foco);
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
      const { d, meio } = caminhoSeta(s.de, s.para, s.viva ? 0 : 46, 58);
      const cls = `seta ${s.cor}${s.tenue ? ' tenue' : ''}${s.foco ? ' foco' : ''}${s.viva ? ' viva' : ''}`;
      const rot = s.rotulo != null ? `<g class="rotulo-seta"><circle cx="${meio.x}" cy="${meio.y}" r="15"/><text x="${meio.x}" y="${meio.y}">${s.rotulo}</text></g>` : '';
      return `<g class="${cls}"><path class="brilho" d="${d}"/><path class="sombra" d="${d}"/><path class="linha" d="${d}" marker-end="url(#ponta-${s.cor})"/>${rot}</g>`;
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
        titulo: nome, sub: t('dc.figura'),
        linhas: [t('dc.figuraComo'), PODER_FIGURA[c.rank], t('dc.figuraNaipado', { n: NOME_NAIPE[c.naipe], poder: PODER_NAIPADO[c.naipe] })],
      };
    }
    if (M.ehAs(c)) {
      return { titulo: nome, sub: t('dc.totem'), linhas: [PODER_AS[c.naipe], t('dc.asInvocar', { n: NOME_NAIPE[c.naipe] }), t('dc.asOcupa')] };
    }
    return { titulo: nome, sub: t('dc.numero', { n: NOME_NAIPE[c.naipe] }), linhas: [t('dc.numeroAtaque', { v: M.valor(c) }), EFEITO_NUMERO[c.naipe](c)] };
  }

  function dicaUnidade(p, i, u) {
    if (u.tipo === 'as') {
      return { titulo: M.nomeCarta(u.carta), sub: t('dc.totem'), linhas: [PODER_AS[u.naipe], t('dc.asNaoAtaca'), t('dc.asAlvo')] };
    }
    const nai = M.naipado(u), atk = M.ataque(jogo, p, i), res = M.resistencia(jogo, p, i), post = M.postura(jogo, p, i);
    const vizinhos = [i - 1, i + 1].map(k => jogo.jogadores[p].campo[k]).filter(w => w && w.tipo === 'as').map(w => w.naipe);
    const partes = [t('du.numero', { v: M.valor(u.numero) })];
    if (nai === 'espadas') partes.push(t('du.naipadoEspadas'));
    if (vizinhos.includes('espadas')) partes.push(t('du.asEspadas'));
    if (u.bonus.length) partes.push(t('du.bonusEspadas', { n: u.bonus.length, crit: u.bonus.reduce((s, v) => s + Math.floor(v / 2), 0) }));
    const fontesRes = [];
    if (nai === 'paus') fontesRes.push(t('du.naipadoPaus'));
    if (vizinhos.includes('paus')) fontesRes.push(t('du.asPaus'));
    const linhas = [
      t('du.ataque', { a: atk, partes: partes.join(' · ') }),
      u.berserk
        ? t('du.berserk', { levou: u.berserk.hits > 0 })
        : t('du.vida', { v: res - u.hits, r: res, fontes: fontesRes.length ? ` (${fontesRes.join(' + ')})` : '', estado: NOME_POSTURA[post] }),
      PODER_FIGURA[u.figura.rank],
    ];
    if (nai) linhas.push(t('du.naipado', { n: NOME_NAIPE[nai], poder: PODER_NAIPADO[nai] }));
    if (vizinhos.includes('copas')) linhas.push(t('du.asCopas'));
    if (u.vigilia) linhas.push(t('du.vigilia'));
    if (jogo.desafio === u.uid) linhas.push(t('du.desafiado'));
    if (u.atacou && !u.vigilia) linhas.push(t('du.atacou'));
    if (!u.ativo) linhas.push(t('du.desativado'));
    else if (jogo.vez === p && M.podeAtacar(jogo, p, i)) linhas.push(t('du.pronto', { n: u.ataques }));
    else if (jogo.vez === p && u.entrou === jogo.turno && u.figura.rank !== 'J') linhas.push(t('du.entrou'));
    linhas.push(`<span class="dica-regra">${t('du.regraBloqueio')}</span>`);
    return { titulo: M.nomeUnidade(u), sub: nai ? t('du.subNaipado', { n: NOME_NAIPE[nai] }) : t('du.sub'), linhas };
  }

  function dicaPara(el) {
    if (!el || !el.closest || el.closest('#modal .acoes-menu')) return null;
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
    if (el.closest('[data-token]')) return { titulo: t('dp.tokenTitulo'), sub: t('dp.tokenSub'), linhas: [t('dp.token')] };
    const btnPoder = el.closest('[data-poder]');
    if (btnPoder) {
      const pal = palhacoDe(Number(btnPoder.dataset.poder));
      if (!pal.poder) return { titulo: pal.passiva.nome, sub: t('dp.passivaDe', { n: pal.nome }), linhas: [pal.passiva.texto, `<b>${pal.custo.nome}:</b> ${pal.custo.texto}`, t('dp.semPoder')] };
      return { titulo: pal.poder.nome, sub: t('dp.poderDe', { n: pal.nome }), linhas: [pal.poder.texto] };
    }
    const ret = el.closest('[data-alvo]');
    if (ret) {
      const p = Number(ret.dataset.alvo.split(':')[1]), j = jogo.jogadores[p], teto = M.tetoCura(j), pal = palhacoDe(p);
      const linhas = [t('dp.passiva', { nome: pal.passiva.nome, texto: pal.passiva.texto })];
      if (pal.poder) linhas.push(t('dp.poder', { nome: pal.poder.nome, texto: pal.poder.texto }));
      if (pal.custo) linhas.push(`<b>${pal.custo.nome}:</b> ${pal.custo.texto}`);
      linhas.push(t('dp.estado', { pv: j.pv, mao: j.mao.length, l: j.letras.length, n: j.numeros.length, c: j.cemiterio.length }));
      if (isFinite(teto)) linhas.push(t('dp.ferida', { n: teto }));
      return { titulo: t('dp.palhaco', { n: pal.nome }), sub: `${pal.titulo} · ${NOME_NAIPE[pal.naipe]}`, linhas };
    }
    const pilha = el.closest('[data-pilha]');
    if (pilha) {
      const [p, b] = pilha.dataset.pilha.split(':');
      const n = jogo.jogadores[Number(p)][b].length;
      return { titulo: t('dp.baralho', { b: M.NOME_BARALHO[b] }), linhas: [t('dp.restantes', { n }), t(b === 'letras' ? 'dp.soFiguras' : 'dp.soNumeros')] };
    }
    const cem = el.closest('[data-cemiterio]');
    if (cem) return { titulo: t('ui.cemiterio'), linhas: [t('dp.cemiterio', { n: jogo.jogadores[Number(cem.dataset.cemiterio)].cemiterio.length })] };
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

  let maoVista = [null, null], cemVisto = [new Set(), new Set()], campoVisto = [null, null];
  const voando = new Set(), voandoCampo = new Set();

  function animarEntradas() {
    const maosAntes = maoVista.slice(); // foto das mãos antes deste desenho (para detectar roubo)
    for (const p of [0, 1]) {
      const j = jogo.jogadores[p];
      // Senhores e Ases que acabaram de entrar voam da mão (ou de onde foram soltos) até o campo.
      const noCampo = j.campo.filter(Boolean);
      if (campoVisto[p]) noCampo.filter(u => !campoVisto[p].has(u.uid)).forEach(u => voarParaCampo(p, u.uid));
      campoVisto[p] = new Set(noCampo.map(u => u.uid));
      const atual = j.mao.map(c => c.id);
      if (maoVista[p]) {
        const novas = j.mao.filter(c => !maoVista[p].has(c.id));
        // De onde a carta veio: do cemitério, da mão do oponente (roubo do Ourinhos) ou do baralho.
        const deOnde = c => (cemVisto[p].has(c.id) ? 'cemiterio' : maosAntes[1 - p] && maosAntes[1 - p].has(c.id) ? 'roubo' : M.ehFigura(c) ? 'letras' : 'numeros');
        novas.forEach((c, k) => voarParaMao(p, c, deOnde(c), k));
      }
      maoVista[p] = new Set(atual);
      cemVisto[p] = new Set(j.cemiterio.map(c => c.id));
    }
  }

  function voarParaMao(p, c, origem, ordem) {
    const alvo0 = document.querySelector(`#mao-${p} [data-voo="${c.id}"]`);
    const fonte = origem === 'roubo' ? document.querySelector(`#mao-${1 - p} .carta`) || $(`#mao-${1 - p}`)
      : document.querySelector(origem === 'cemiterio' ? `#pilhas-${p} [data-cemiterio] .carta` : `#pilhas-${p} [data-pilha="${p}:${origem}"] .carta`);
    if (!alvo0 || !fonte) return;
    voando.add(c.id);
    alvo0.style.visibility = 'hidden';
    const visivel = p === eu || cfg.modo === 'bots';
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

  // A carta sai de onde o jogador soltou (ou da mão de quem jogou), sobe um pouco e "pousa" no lugar.
  function voarParaCampo(p, uid) {
    const loc = M.localizar(jogo, uid);
    const espaco = loc && document.querySelector(`[data-slot="${p}:${loc.i}"]`);
    const unidade = espaco && espaco.querySelector('.unidade');
    if (!unidade) return;
    const app = $('#app'), ra = app.getBoundingClientRect(), r = espaco.getBoundingClientRect();
    const w = r.width / escala, h = r.height / escala;
    const x = (r.left - ra.left) / escala, y = (r.top - ra.top) / escala;
    let de;
    if (ui.vooDe && controle(p) === 'humano') {
      const q = pontoNoApp(ui.vooDe.x, ui.vooDe.y);
      de = { x: q.x, y: q.y, s: Math.max(0.5, (ui.vooDe.w / escala) / 90) };
    } else {
      const m = $('#mao-' + p).getBoundingClientRect();
      const q = pontoNoApp(m.left + m.width * 0.75, m.top + m.height / 2);
      de = { x: q.x, y: q.y, s: 0.55 };
    }
    voandoCampo.add(uid);
    espaco.classList.add('voo-oculto');
    const voo = document.createElement('div');
    voo.className = 'unidade-voando';
    voo.innerHTML = unidade.outerHTML;
    Object.assign(voo.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    app.appendChild(voo);
    const dx = de.x - (x + w / 2), dy = de.y - (y + h / 2);
    const dur = 620;
    voo.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${de.s}) rotate(-8deg)`, filter: 'drop-shadow(0 10px 10px rgba(0,0,0,.5))' },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 46}px) scale(1.2) rotate(4deg)`, filter: 'drop-shadow(0 26px 18px rgba(0,0,0,.45))', offset: 0.6 },
      { transform: 'translate(0, 0) scale(1.1) rotate(0deg)', filter: 'drop-shadow(0 4px 4px rgba(0,0,0,.5))', offset: 0.86 },
      { transform: 'translate(0, 0) scale(1)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.4))' },
    ], { duration: dur, easing: 'cubic-bezier(.3, .7, .4, 1)', fill: 'both' });
    setTimeout(() => {
      voo.remove();
      voandoCampo.delete(uid);
      const l = M.localizar(jogo, uid);
      const e = l && document.querySelector(`[data-slot="${l.p}:${l.i}"]`);
      if (!e) return;
      e.classList.remove('voo-oculto');
      e.classList.add('pousou');
      setTimeout(() => e.classList.remove('pousou'), 500);
    }, dur);
  }

  // ---------- Ataque animado: a carta levanta, pega impulso para trás e bate no alvo ----------
  const MOVIMENTO_REDUZIDO = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IMPACTO_MS = 560, INVESTIDA_MS = 1000;

  // Foto da mesa ANTES de resolver: onde está cada carta (e o seu desenho) e quanto dano já tinha.
  function prepararInvestida(at) {
    const loc = M.localizar(jogo, at.atacante);
    const unidades = [];
    for (const j of jogo.jogadores) for (const u of j.campo) {
      if (!u) continue;
      const el = elUnidade(u.uid), dentro = el && el.querySelector('.unidade');
      unidades.push({ uid: u.uid, hits: u.hits, bhits: u.berserk ? u.berserk.hits : 0, el, caixa: el && el.getBoundingClientRect(), html: dentro ? dentro.outerHTML : '' });
    }
    let alvos;
    if (at.alvo !== 'jogador' && (M.ataqueDirecionado(jogo, at) || !at.bloqueadores.length)) alvos = [elUnidade(at.alvo)];
    else if (at.bloqueadores.length) alvos = at.bloqueadores.map(elUnidade);
    else alvos = [elRetrato(1 - jogo.vez)];
    const pontos = alvos.map(centroDe).filter(Boolean);
    const alvo = pontos.length ? { x: pontos.reduce((s, q) => s + q.x, 0) / pontos.length, y: pontos.reduce((s, q) => s + q.y, 0) / pontos.length } : null;
    return { atacante: at.atacante, forca: loc ? M.ataque(jogo, loc.p, loc.i) : 0, unidades, pv: jogo.jogadores.map(j => j.pv), alvo, de: centroDe(elUnidade(at.atacante)) };
  }

  // Quem levou dano no ataque (cartas com mais hits, cartas que morreram e Palhaços que perderam PV).
  function danosDesde(cena) {
    const r = [];
    for (const f of cena.unidades) {
      const l = M.localizar(jogo, f.uid), bh = l && l.u.berserk ? l.u.berserk.hits : 0;
      if (!l || l.u.hits > f.hits || bh > f.bhits) r.push({ f, morreu: !l });
    }
    for (const p of [0, 1]) if (jogo.jogadores[p].pv < cena.pv[p]) r.push({ heroi: p });
    return r;
  }

  // Cópia flutuante de uma carta do campo (a original some enquanto a cópia anima).
  function copiaFlutuante(f) {
    const app = $('#app'), ra = app.getBoundingClientRect(), c = f.caixa;
    const el = document.createElement('div');
    el.className = 'unidade-voando';
    el.innerHTML = f.html;
    Object.assign(el.style, { left: (c.left - ra.left) / escala + 'px', top: (c.top - ra.top) / escala + 'px', width: c.width / escala + 'px', height: c.height / escala + 'px' });
    app.appendChild(el);
    voandoCampo.add(f.uid);
    if (f.el && f.el.isConnected) f.el.classList.add('voo-oculto');
    return el;
  }

  function soltarCopia(f, el) {
    el.remove();
    voandoCampo.delete(f.uid);
    const e = elUnidade(f.uid);
    if (e) e.classList.remove('voo-oculto');
  }

  // Faíscas e onda de choque no ponto do impacto.
  function particulas(ponto, n, forte) {
    const app = $('#app');
    const onda = document.createElement('div');
    onda.className = 'onda-impacto';
    Object.assign(onda.style, { left: ponto.x + 'px', top: ponto.y + 'px' });
    app.appendChild(onda);
    onda.animate([{ transform: 'translate(-50%, -50%) scale(.2)', opacity: 1 }, { transform: `translate(-50%, -50%) scale(${forte ? 2 : 1.4})`, opacity: 0 }],
      { duration: 460, easing: 'cubic-bezier(.2, .8, .3, 1)' }).onfinish = () => onda.remove();
    for (let k = 0; k < n; k++) {
      const p = document.createElement('div');
      p.className = 'faisca' + (k % 3 === 0 ? ' brasa' : '');
      const ang = Math.random() * Math.PI * 2, dist = (28 + Math.random() * 62) * (forte ? 1.5 : 1), tam = 5 + Math.random() * 7;
      Object.assign(p.style, { left: ponto.x + 'px', top: ponto.y + 'px', width: tam + 'px', height: tam + 'px' });
      app.appendChild(p);
      p.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${(Math.cos(ang) * dist * 0.75).toFixed(1)}px), calc(-50% + ${(Math.sin(ang) * dist * 0.75).toFixed(1)}px)) scale(.8)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${(Math.cos(ang) * dist).toFixed(1)}px), calc(-50% + ${(Math.sin(ang) * dist + 16).toFixed(1)}px)) scale(.2)`, opacity: 0 },
      ], { duration: 520 + Math.random() * 420, easing: 'cubic-bezier(.15, .8, .3, 1)' }).onfinish = () => p.remove();
    }
  }

  // Tremor da tela: levinho (ataque 1–5), médio (6–8) e forte (9 ou mais).
  function tremor(forca) {
    if (MOVIMENTO_REDUZIDO) return;
    const amp = forca >= 9 ? 9 : forca >= 6 ? 4.5 : 1.6, dur = forca >= 9 ? 520 : forca >= 6 ? 400 : 240;
    const quadros = [];
    for (let k = 0; k < 8; k++) {
      const a = amp * (1 - k / 8);
      quadros.push({ transform: `translate(${((Math.random() * 2 - 1) * a).toFixed(1)}px, ${((Math.random() * 2 - 1) * a).toFixed(1)}px)` });
    }
    quadros.push({ transform: 'translate(0, 0)' });
    $('#palco').animate(quadros, { duration: dur, easing: 'linear' });
  }

  // Recuo de quem apanha: é empurrado na direção do golpe, pisca vermelho e volta (ou some, se morreu).
  function recuo(el, n, atraso, morreu) {
    const quadros = [
      { transform: 'translate(0, 0) rotate(0deg)', filter: 'none' },
      { transform: `translate(${(n.x * 16).toFixed(1)}px, ${(n.y * 16).toFixed(1)}px) rotate(${(n.x * 6).toFixed(1)}deg)`, filter: 'brightness(1.9) sepia(1) saturate(6) hue-rotate(-30deg)', offset: 0.18 },
      { transform: `translate(${(-n.x * 5).toFixed(1)}px, ${(-n.y * 5).toFixed(1)}px) rotate(${(-n.x * 2).toFixed(1)}deg)`, filter: 'brightness(1.2)', offset: 0.5 },
      morreu ? { transform: 'translate(0, 8px) scale(.82)', filter: 'grayscale(1) brightness(.6)', opacity: 0 } : { transform: 'translate(0, 0) rotate(0deg)', filter: 'none' },
    ];
    return el.animate(quadros, { duration: morreu ? 760 : 520, delay: atraso, easing: 'ease-out', fill: morreu ? 'forwards' : 'none' });
  }

  async function investida(cena, danos) {
    const fa = cena.unidades.find(f => f.uid === cena.atacante);
    if (!fa || !fa.caixa || !fa.html || !cena.alvo || !cena.de) return;
    const dx = cena.alvo.x - cena.de.x, dy = cena.alvo.y - cena.de.y, dist = Math.hypot(dx, dy) || 1;
    const n = { x: dx / dist, y: dy / dist }, k = Math.max(0, dist - 74);
    const setas = $('#setas');
    setas.style.opacity = '.2';
    const copia = copiaFlutuante(fa);
    const giro = (n.x >= 0 ? -1 : 1) * 7;
    copia.animate([
      { transform: 'translate(0, 0) scale(1) rotate(0deg)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.4))', easing: 'cubic-bezier(.3, .7, .4, 1)' },
      { transform: 'translate(0, -18px) scale(1.15) rotate(0deg)', filter: 'drop-shadow(0 18px 14px rgba(0,0,0,.45))', offset: 0.2, easing: 'ease-in-out' },
      { transform: `translate(${(-n.x * 38).toFixed(1)}px, ${(-n.y * 38 - 18).toFixed(1)}px) scale(1.18) rotate(${giro}deg)`, filter: 'drop-shadow(0 22px 16px rgba(0,0,0,.45))', offset: 0.42, easing: 'cubic-bezier(.6, 0, .9, .5)' },
      { transform: `translate(${(n.x * k).toFixed(1)}px, ${(n.y * k).toFixed(1)}px) scale(1.08) rotate(${-giro / 2}deg)`, filter: 'drop-shadow(0 4px 4px rgba(0,0,0,.5))', offset: IMPACTO_MS / INVESTIDA_MS, easing: 'ease-out' },
      { transform: `translate(${(n.x * (k - 18)).toFixed(1)}px, ${(n.y * (k - 18)).toFixed(1)}px) scale(1.06) rotate(0deg)`, filter: 'drop-shadow(0 8px 8px rgba(0,0,0,.45))', offset: 0.66, easing: 'cubic-bezier(.4, 0, .3, 1)' },
      { transform: 'translate(0, 0) scale(1) rotate(0deg)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.4))' },
    ], { duration: INVESTIDA_MS, fill: 'both' });
    // Quem vai apanhar: cópias prontas desde já (uma carta que morre continua visível até o fim do recuo).
    const alvos = [];
    let atacanteMorreu = false;
    for (const d of danos) {
      if (d.heroi != null) {
        const el = elRetrato(d.heroi);
        if (el) recuo(el, n, IMPACTO_MS, false);
        continue;
      }
      if (d.f.uid === cena.atacante) {
        atacanteMorreu = d.morreu;
        continue;
      }
      if (!d.f.caixa || !d.f.html) continue;
      const el = copiaFlutuante(d.f);
      recuo(el, n, IMPACTO_MS, d.morreu);
      alvos.push({ f: d.f, el, morreu: d.morreu });
    }
    await esperar(IMPACTO_MS);
    const contato = { x: cena.de.x + n.x * (k + 34), y: cena.de.y + n.y * (k + 34) };
    const forte = cena.forca >= 9;
    particulas(contato, forte ? 26 : cena.forca >= 6 ? 18 : 12, forte);
    for (const d of danos) {
      if (d.heroi != null) {
        const c = centroDe(elRetrato(d.heroi));
        if (c) particulas(c, 10, forte);
      } else if (d.f.caixa && d.f.uid !== cena.atacante) {
        const r = d.f.caixa, c = pontoNoApp(r.left + r.width / 2, r.top + r.height / 2);
        if (Math.hypot(c.x - contato.x, c.y - contato.y) > 40) particulas(c, 8, false);
      }
    }
    // Contra-ataque: o atacante também apanha (pisca vermelho no impacto).
    if (danos.some(d => d.f && d.f.uid === cena.atacante)) {
      copia.firstElementChild && copia.firstElementChild.animate([{ filter: 'none' }, { filter: 'brightness(1.9) sepia(1) saturate(6) hue-rotate(-30deg)' }, { filter: 'none' }], { duration: 380 });
    }
    tremor(cena.forca);
    await esperar(INVESTIDA_MS - IMPACTO_MS);
    if (atacanteMorreu) await copia.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(0, 8px) scale(.82)', filter: 'grayscale(1)' }], { duration: 320, fill: 'forwards' }).finished.catch(() => {});
    else await esperar(80);
    if (alvos.some(a => a.morreu)) await esperar(280);
    soltarCopia(fa, copia);
    for (const a of alvos) soltarCopia(a.f, a.el);
    setas.style.opacity = '';
  }

  // A mão fica ao lado do Palhaço: com muitas cartas, elas se sobrepõem mais para caber.
  function ajustarSobreposicao(mao) {
    const cartas = mao.children;
    if (!cartas.length) return;
    const n = cartas.length;
    // Leque: as cartas giram para fora e as das pontas descem um pouco (um arco suave).
    // O ângulo entra ANTES de medir a carta: medir antes fazia a carta nascer reta e
    // animar até o leque a cada redesenho da mesa (o "pisca-pisca").
    const meio = (n - 1) / 2, giroMax = Math.min(12, 3 + n * 1.3), descida = Math.min(16, 4 + n * 1.6);
    for (let k = 0; k < n; k++) {
      const d = meio ? (k - meio) / meio : 0;
      cartas[k].style.setProperty('--giro', (d * giroMax).toFixed(1) + 'deg');
      cartas[k].style.setProperty('--desce', (d * d * descida).toFixed(1) + 'px');
    }
    const largura = cartas[0].offsetWidth || 86, disponivel = mao.clientWidth || 400;
    const sobra = n > 1 ? Math.min(-8, (disponivel - largura) / (n - 1) - largura) : 0;
    for (let k = 0; k < n; k++) cartas[k].style.marginLeft = k ? `${sobra}px` : '0';
  }

  function renderVazio() {
    for (const p of [0, 1]) {
      $('#info-' + p).innerHTML = '';
      $('#mao-' + p).innerHTML = '';
      $('#pilhas-' + p).innerHTML = '';
      $('#campo-' + p).innerHTML = Array.from({ length: M.ESPACOS }, () => '<div class="espaco"></div>').join('');
    }
    for (const id of ['#fase', '#instrucao', '#chips', '#botoes', '#log', '#setas']) $(id).innerHTML = '';
    definirHTML($('#cartas-acao'), '');
    $('#painel').hidden = true;
    $('#acoes').hidden = true;
    $('#combate').hidden = true;
    $('#combate').innerHTML = '';
    esconderAnuncio();
  }

  // Chapéu de bobo da corte (arte provisória do Palhaço).
  function chapeu(cor) {
    const tons = { vermelho: ['#e0303b', '#8f0f18'], azul: ['#3d6fd6', '#1b3a85'], verde: ['#2fa45f', '#14522d'], dourado: ['#e6b630', '#8a6208'] }[cor];
    return `<svg viewBox="0 0 100 82" class="chapeu">
      <path d="M14 66 Q22 34 6 14 Q30 26 40 46 Z" fill="${tons[0]}"/>
      <path d="M40 46 Q44 20 50 6 Q56 20 60 46 Z" fill="${tons[1]}"/>
      <path d="M60 46 Q70 26 94 14 Q78 34 86 66 Z" fill="${tons[0]}"/>
      <path d="M14 66 Q50 40 86 66 L86 74 Q50 52 14 74 Z" fill="${tons[1]}"/>
      <rect x="12" y="66" width="76" height="10" rx="4" fill="#f4e7c3" stroke="#00000055"/>
      <circle cx="6" cy="14" r="6" fill="#ffd54a" stroke="#7a5806"/><circle cx="50" cy="6" r="6" fill="#ffd54a" stroke="#7a5806"/>
      <circle cx="94" cy="14" r="6" fill="#ffd54a" stroke="#7a5806"/></svg>`;
  }

  // Retrato do Palhaço (arte em arte/palhacos/); sem retrato, usa o chapéu desenhado.
  function arteHeroi(pal) {
    if (pal.retrato) return `<div class="heroi-retrato" style="background-image:url('${pal.retrato}')"></div><span class="heroi-naipe canto">${SIMB[pal.naipe]}</span>`;
    return `<div class="heroi-arte">${chapeu(pal.cor)}<span class="heroi-naipe">${SIMB[pal.naipe]}</span></div>`;
  }

  // Troca o conteúdo só quando ele muda (assim animações em andamento não recomeçam).
  function definirHTML(el, html) {
    if (el._html === html) return;
    el._html = html;
    el.innerHTML = html;
  }

  const COR_NAIPE = { espadas: '90, 140, 255', copas: '255, 77, 90', paus: '77, 220, 122', ouros: '255, 207, 77' };
  let poderAnimado = null;

  // Poder usado: o símbolo do naipe cresce e brilha na cor do naipe, e uma onda sai dele.
  function brilhoPoder(p, naipe) {
    requestAnimationFrame(() => {
      const el = $(`#info-${p} .poder-naipe`);
      if (!el || MOVIMENTO_REDUZIDO) return;
      const cor = COR_NAIPE[naipe];
      el.animate([
        { transform: 'scale(1)', filter: `drop-shadow(0 0 0 rgba(${cor}, 0))` },
        { transform: 'scale(1.3) rotate(-6deg)', filter: `drop-shadow(0 0 26px rgba(${cor}, 1)) brightness(1.35)`, offset: 0.3 },
        { transform: 'scale(1)', filter: `drop-shadow(0 0 0 rgba(${cor}, 0))` },
      ], { duration: 1000, easing: 'ease-out' });
      const c = centroDe(el);
      if (!c) return;
      for (const [atraso, escalaFinal] of [[0, 3.2], [160, 2.4]]) {
        const onda = document.createElement('div');
        onda.className = 'onda-poder';
        Object.assign(onda.style, { left: c.x + 'px', top: c.y + 'px', borderColor: `rgba(${cor}, .95)`, boxShadow: `0 0 26px rgba(${cor}, .9), inset 0 0 18px rgba(${cor}, .6)` });
        $('#app').appendChild(onda);
        onda.animate([{ transform: 'translate(-50%, -50%) scale(.3)', opacity: 1 }, { transform: `translate(-50%, -50%) scale(${escalaFinal})`, opacity: 0 }],
          { duration: 750, delay: atraso, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'backwards' }).onfinish = () => onda.remove();
      }
    });
  }

  function renderJogador(p, alvos) {
    const j = jogo.jogadores[p], cor = corDe(p), teto = M.tetoCura(j), pal = palhacoDe(p);
    const quem = controle(p) === 'humano' ? t('ui.voce') : controle(p) === 'remoto' ? t('ui.amigo') : `bot · ${NOME_NIVEL[cfg.nivel]}`;
    const podeJogar = controle(p) === 'humano' && jogo.vez === p && jogo.fase === 'principal' && !ui.ocupado;
    let tokens = '';
    for (let k = 0; k < j.tokens; k++) {
      tokens += `<button class="token${ui.sel.includes('TOKEN#' + k) ? ' selecionada' : ''}" data-token="${k}"${podeJogar ? '' : ' disabled'}>♦ extra</button>`;
    }
    // Botão do poder: o próprio símbolo do naipe do Palhaço (pulsa enquanto dá para usar).
    let poder;
    if (pal.poder) {
      const usado = jogo.vez === p && jogo.poderUsado;
      const pode = podeJogar && !ui.pend && M.acoesLegais(jogo).some(a => a.tipo === 'poder');
      const dica = `${t('menu.poder')} ${pal.poder.nome} ${pal.poder.texto} (${t(usado ? 'ui.usado' : 'ui.umaAcao')})`;
      poder = `<button class="poder-naipe naipe-${pal.naipe}${pode ? ' pronto' : ''}${usado ? ' usado' : ''}${ui.pend && ui.pend.tipo === 'poder' && jogo.vez === p ? ' ativo' : ''}"
        data-poder="${p}"${pode ? ' data-acao="poder"' : ' disabled'} title="${escapar(dica)}" aria-label="${escapar(pal.poder.nome)}">
        <img src="arte/naipes/${pal.naipe}.webp" alt="" draggable="false"></button>`;
    } else {
      poder = `<div class="poder-naipe naipe-${pal.naipe} passivo" data-poder="${p}" title="${escapar(pal.passiva.nome + ': ' + pal.passiva.texto)}"><img src="arte/naipes/${pal.naipe}.webp" alt="" draggable="false"></div>`;
    }
    // O Palhaço é um PNG solto que "respira": a peça é montada uma vez e só os detalhes mudam,
    // para a animação não recomeçar a cada vez que a mesa é redesenhada.
    const info = $('#info-' + p);
    let heroi = info.querySelector('.heroi');
    if (!heroi || heroi.dataset.pal !== pal.id) {
      info.innerHTML = `<div class="heroi heroi-livre" data-alvo="jogador:${p}" data-pal="${pal.id}">
          <img class="heroi-png" src="${pal.retrato}" alt="${escapar(pal.nome)}" draggable="false">
          <div class="heroi-pv" title="${t('ui.pontosVida')}"><span></span></div>
          <div class="heroi-ferida" title="${t('ui.feridaCopas')}" hidden></div>
        </div>
        <div class="lado-heroi"></div>`;
      heroi = info.querySelector('.heroi');
    }
    const classes = `heroi heroi-livre cor-${cor}${alvos.has('jogador:' + p) ? ' clicavel' : ''}${jogo.vez === p ? ' da-vez' : ''}`;
    for (const c of classes.split(' ')) heroi.classList.add(c);
    for (const c of ['clicavel', 'da-vez']) if (!classes.includes(c)) heroi.classList.remove(c);
    heroi.title = `${pal.nome} · ${quem}`;
    heroi.querySelector('.heroi-pv span').textContent = j.pv;
    const ferida = heroi.querySelector('.heroi-ferida');
    ferida.hidden = !isFinite(teto);
    if (isFinite(teto)) ferida.textContent = t('ui.curaAte', { n: teto });
    definirHTML(info.querySelector('.lado-heroi'), `${poder}<div class="tokens">${tokens}</div>`);
    // Brilho na cor do naipe quando o poder é usado (vale para os dois Palhaços).
    if (jogo.vez === p && jogo.poderUsado && poderAnimado !== `${partida}:${jogo.turno}`) {
      poderAnimado = `${partida}:${jogo.turno}`;
      brilhoPoder(p, pal.naipe);
    }
    const visivel = p === eu || cfg.modo === 'bots';
    const oculta = id => (voando.has(id) ? ' style="visibility:hidden"' : '');
    // Com 1 figura ou 1 Ás selecionado: o que combina pulsa, o resto escurece.
    const selUnica = podeJogar && !ui.pend && ui.sel.length === 1 ? j.mao.find(c => c.id === ui.sel[0]) : null;
    const filtrar = !!selUnica && (M.ehFigura(selUnica) || M.ehAs(selUnica));
    const parceiros = filtrar ? candidatosParceiros() : new Set();
    const estilo = c => {
      if (!filtrar || c.id === selUnica.id) return '';
      return parceiros.has(c.id) ? ' combina' : ' apagada';
    };
    $('#mao-' + p).innerHTML = j.mao.map(c => (visivel
      ? `<div class="carta${ui.sel.includes(c.id) ? ' selecionada' : ''}${podeJogar ? ' jogavel' : ''}${estilo(c)}"${podeJogar ? ` data-mao="${c.id}"` : ` data-carta="${c.id}"`} data-voo="${c.id}"${oculta(c.id)}>${C.frente(c)}</div>`
      : `<div class="carta dorso ${cor}" data-voo="${c.id}"${oculta(c.id)}></div>`)).join('');
    ajustarSobreposicao($('#mao-' + p));
    const topo = j.cemiterio[j.cemiterio.length - 1];
    $('#pilhas-' + p).innerHTML = `
      ${M.BARALHOS.map(b => {
        const pulsa = ui.aoComprar && jogo.vez === p && j[b].length ? ' pulsando' : '';
        return `<div class="pilha${pulsa}" data-pilha="${p}:${b}">${pulsa ? '<span class="seta-compra">▼</span>' : ''}<div class="carta${j[b].length ? ' dorso ' + cor : ' vazia'}"><span class="marca-pilha">${b === 'letras' ? 'J Q K' : 'A–10'}</span></div><span class="cont">${j[b].length}</span><label>${M.NOME_BARALHO[b]}</label></div>`;
      }).join('')}
      <div class="pilha" data-cemiterio="${p}">${topo ? `<div class="carta">${C.frente(topo)}</div>` : '<div class="carta vazia"></div>'}<span class="cont">${j.cemiterio.length}</span><label>${t('ui.cemiterio')}</label></div>`;
  }

  function renderCampo(p, alvos) {
    const j = jogo.jogadores[p];
    // Figura ou Ás solto no campo esperando o número: aparece "fantasma" no lugar escolhido.
    const preparo = ui.destino != null && jogo.vez === p && ui.sel.length === 1 ? j.mao.find(c => c.id === ui.sel[0]) : null;
    const lugarPreparo = ui.pend && ui.pend.destino != null && jogo.vez === p ? ui.pend.destino : ui.destino;
    let h = '';
    for (let i = 0; i < M.ESPACOS; i++) {
      const u = j.campo[i];
      const clicavel = alvos.has(`slot:${p}:${i}`) || (u && alvos.has('uid:' + u.uid));
      const sacrificando = ui.pend && ui.pend.esc.sacrificios && u && ui.pend.esc.sacrificios.includes(u.uid);
      const sel = u && (ui.atacanteSel === u.uid || ui.bloqSel === u.uid || sacrificando);
      const cls = ['espaco'];
      if (clicavel) cls.push('clicavel');
      if (sel) cls.push('selecionado');
      if (u && voandoCampo.has(u.uid)) cls.push('voo-oculto');
      let dentro = u ? htmlUnidade(p, i, u) : '';
      if (preparo && i === lugarPreparo) {
        cls.push('preparo');
        if (!u) dentro = `<div class="carta-preparo"><div class="carta">${C.frente(preparo)}</div></div>`;
      }
      h += `<div class="${cls.join(' ')}" data-slot="${p}:${i}">${dentro}</div>`;
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
    let h = '';
    for (const at of ataquesVisiveis()) {
      if (at.atacante === u.uid) h += `<span class="tag tag-ataque">${t('tag.ataque', { n: at.n })}</span>`;
      const bl = jogo.fase === 'bloqueio' ? ui.bloqueios[at.n] || [] : at.bloqueadores;
      if (bl.includes(u.uid)) h += `<span class="tag tag-bloq">${t(alvoDoRei(at, at.alvo) && at.alvo !== u.uid ? 'tag.ajuda' : 'tag.bloqueia', { n: at.n })}</span>`;
      if (at.alvo === u.uid && M.ataqueDirecionado(jogo, at)) h += `<span class="tag tag-alvo">${t('tag.defende', { n: at.n })}</span>`;
    }
    return h ? `<div class="tags">${h}</div>` : '';
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
    return ` girando" style="--de:${ANGULO[r.de]}deg;--de-escala:var(--esc-${r.de}, 1);animation-delay:${-passou.toFixed(0)}ms`;
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
        <div class="selo-totem">${t('ui.totem')} ${SIMB[u.naipe]}</div>${tagsUnidade(u)}</div>`;
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
    return l ? M.nomeUnidade(l.u) : t('carta.A');
  }

  function chipAtaque(at, clicavel) {
    const loc = M.localizar(jogo, at.atacante);
    const nome = loc ? M.nomeUnidade(loc.u) : t('chip.foraDeCampo');
    const atk = loc ? M.ataque(jogo, loc.p, loc.i) : '–';
    const bl = (jogo.fase === 'bloqueio' ? ui.bloqueios[at.n] || [] : at.bloqueadores)
      .map(uid => { const l = M.localizar(jogo, uid); return l ? M.nomeUnidade(l.u) : '✖'; });
    const extras = [];
    if (M.ataqueDirecionado(jogo, at)) extras.push(t('chip.direto'));
    if (at.dados > 1) extras.push(t('chip.dados', { n: at.dados }));
    if (bl.length) extras.push(`⛨ ${bl.join(' + ')}`);
    if (at.resultado) extras.push(t('chip.resultado', { r: at.resultado.rolagens.join(','), d: at.resultado.dano }).replace(/^ · /, ''));
    return `<button class="cb-item${clicavel ? ' clicavel' : ''}${ui.foco === at.n ? ' foco' : ''}${at.resultado ? ' feito' : ''}" data-ataque="${at.n}">
      <span class="cb-num">${at.n}</span>
      <span class="cb-txt"><b>${nome} <em>⚔${atk}</em></b><span>→ ${nomeAlvo(at)}</span>${extras.length ? `<small>${extras.join(' · ')}</small>` : ''}</span></button>`;
  }

  function chipDeclaracao(a, k) {
    const loc = M.localizar(jogo, a.atacante);
    const temOuros = ourosLivres().length > 0;
    const n = ui.ataques.length;
    return `<div class="cb-item">
      <span class="cb-num">${k + 1}</span>
      <span class="cb-txt"><b>${M.nomeUnidade(loc.u)} <em>⚔${M.ataque(jogo, loc.p, loc.i)}</em></b><span>→ ${nomeAlvo(a)}</span>
        <span class="cb-ctrl">
          ${k > 0 ? `<button class="mini" data-acao="mover:${k}:-1" title="${t('chip.antes')}">▲</button>` : ''}
          ${k < n - 1 ? `<button class="mini" data-acao="mover:${k}:1" title="${t('chip.depois')}">▼</button>` : ''}
          ${a.ouros.length ? `<span class="dados-extra">${t('chip.dados', { n: 1 + a.ouros.length })} <button class="mini" data-acao="menos-dado:${k}" title="${t('chip.devolverOuros')}">−</button></span>` : ''}
          ${temOuros ? `<button class="mini" data-acao="mais-dado:${k}" title="${t('chip.gastarOuros')}">${t('chip.maisDado')}</button>` : ''}
          <button class="mini" data-acao="remover-ataque:${k}" title="${t('chip.cancelar')}">✕</button>
        </span></span></div>`;
  }

  // Ícones dos botões grandes do centro (desenhados em SVG, sem imagens externas).
  const ICONE = {
    sumonar: '<rect x="4.5" y="7" width="13" height="19" rx="2" transform="rotate(-12 11 16.5)" fill="#fdf6e0" stroke="#3a2a10" stroke-width="1.4"/><rect x="13.5" y="5.5" width="13" height="19" rx="2" transform="rotate(9 20 15)" fill="#fff" stroke="#3a2a10" stroke-width="1.4"/><path d="M20.3 9.6l1.3 2.7 3 .4-2.2 2 .6 3-2.7-1.5-2.7 1.5.6-3-2.2-2 3-.4z" fill="#c99a34"/>',
    rainha: '<path d="M4 23l2-12 6 5 4-9 4 9 6-5 2 12z" fill="#ffe08a" stroke="#5a3a08" stroke-width="1.4" stroke-linejoin="round"/><rect x="4" y="23.5" width="24" height="4" rx="1.2" fill="#e9b949" stroke="#5a3a08" stroke-width="1.2"/><circle cx="6" cy="10" r="1.8" fill="#fff"/><circle cx="16" cy="6" r="1.8" fill="#fff"/><circle cx="26" cy="10" r="1.8" fill="#fff"/>',
    as: '<path d="M13 5h6l2.2 19H10.8z" fill="#e8f3ff" stroke="#123" stroke-width="1.4" stroke-linejoin="round"/><rect x="7.5" y="24" width="17" height="4" rx="1.2" fill="#9fc6e8" stroke="#123" stroke-width="1.2"/><path d="M16 10c1.8 2 3.4 3 3.4 4.8 0 1.4-1.2 2.2-2.4 1.8l.6 2h-3.2l.6-2c-1.2.4-2.4-.4-2.4-1.8 0-1.8 1.6-2.8 3.4-4.8z" fill="#123"/>',
    curar: '<path d="M16 28C7 21.5 3 17 3 11.6 3 7.6 6 5 9.4 5c2.8 0 5 1.6 6.6 4 1.6-2.4 3.8-4 6.6-4C26 5 29 7.6 29 11.6 29 17 25 21.5 16 28z" fill="#ff5a64" stroke="#5e0a10" stroke-width="1.4"/><path d="M16 11v9M11.5 15.5h9" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
    espadas: '<path d="M25.5 3.5l3 3-14 14-3-3z" fill="#e6eef8" stroke="#1a2230" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 16.5l7 7M10 22l-5.5 5.5" stroke="#c99a34" stroke-width="3" stroke-linecap="round"/><text x="5" y="11.5" font-size="10" font-weight="900" fill="#fff" font-family="Segoe UI,sans-serif">+1</text>',
    paus: '<path d="M16 2.5c1.6 5 7.5 7.4 7.5 15.2A7.5 7.5 0 0 1 8.5 17.7c0-3.8 1.9-6 3.8-7.8.1 2.8 1 4.6 2.8 4.8-.7-4.4.2-8.4.9-12.2z" fill="#ff8a2a" stroke="#5a1a00" stroke-width="1.3" stroke-linejoin="round"/><path d="M16 14.5c1 2.4 3.4 3.4 3.4 6.4a3.4 3.4 0 0 1-6.8 0c0-1.8.9-2.8 1.8-3.6.2 1.2.6 1.8 1.2 2-.3-1.8 0-3.4.4-4.8z" fill="#ffe08a"/>',
    comprar: '<rect x="6" y="5" width="15" height="21" rx="2.2" fill="#fff" stroke="#3a2a10" stroke-width="1.4"/><path d="M13.5 10l3.4 5.5-3.4 5.5-3.4-5.5z" fill="#c41e2a"/><circle cx="23" cy="22" r="6" fill="#e9b949" stroke="#5a3a08" stroke-width="1.3"/><path d="M23 18.8v6.4M19.8 22h6.4" stroke="#2a1a05" stroke-width="2.2" stroke-linecap="round"/>',
    reviver: '<path d="M8 28V13a8 8 0 0 1 16 0v15z" fill="#cfd3dc" stroke="#22252c" stroke-width="1.4"/><path d="M16 23v-9M12.2 17.6L16 13.8l3.8 3.8" stroke="#22252c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><rect x="5" y="27" width="22" height="2.5" rx="1" fill="#6b5a3a"/>',
    atacar: '<path d="M4 4l3 0 15 15-3 3L4 7z" fill="#e6eef8" stroke="#1a2230" stroke-width="1.2"/><path d="M28 4l-3 0L10 19l3 3L28 7z" fill="#e6eef8" stroke="#1a2230" stroke-width="1.2"/><path d="M6 21l5 5M26 21l-5 5" stroke="#c99a34" stroke-width="3" stroke-linecap="round"/>',
    escudo: '<path d="M16 3l11 4v8.5c0 6.8-4.8 11.3-11 13.5C9.8 26.8 5 22.3 5 15.5V7z" fill="#5aa7ff" stroke="#0f2557" stroke-width="1.5" stroke-linejoin="round"/><path d="M16 7v18.5M8.5 13h15" stroke="#e8f3ff" stroke-width="2" opacity=".8"/>',
    poder: '<path d="M16 3l3.6 8 8.4.8-6.3 5.7 1.8 8.5L16 21.6 8.5 26l1.8-8.5L4 11.8l8.4-.8z" fill="#ffe08a" stroke="#5a3a08" stroke-width="1.4" stroke-linejoin="round"/>',
  };
  const iconeSvg = nome => `<svg viewBox="0 0 32 32" aria-hidden="true">${ICONE[nome] || ICONE.poder}</svg>`;

  function iconeDaAcao(a) {
    if (a.tipo === 'sumonar') return a.sacrificio != null ? 'rainha' : 'sumonar';
    if (a.tipo === 'invocarAs') return 'as';
    return a.tipo;
  }

  // Ações em forma de carta (canto inferior esquerdo): arte da carta + título na fonte dos títulos.
  // O título vem do idioma (a arte não tem texto, por causa da versão em inglês).
  const ARTE_ACAO = { atacar: 'atacar', espadas: 'atacar', paus: 'atacar', escudo: 'defesa', curar: 'defesa', comprar: 'comprar', reviver: 'cemiterio', sumonar: 'sumonar', rainha: 'sumonar', as: 'sumonar' };
  const btnGrande = (acao, rotulo, icone, extra) => {
    const arte = ARTE_ACAO[icone] || 'sumonar';
    const sub = rotulo.replace(/^[^\p{L}\p{N}+]+/u, '');
    return `<button class="carta-acao arte-${arte} ${extra || ''}" data-acao="${acao}" title="${escapar(sub)}">
      <img src="arte/acoes/${arte}.webp" alt="" draggable="false"><b class="ca-titulo">${t('carta.' + icone)}</b><small class="ca-sub">${sub}</small></button>`;
  };

  function renderFaixa() {
    const p = jogo.vez, j = jogo.jogadores[p], d = 1 - p;
    const btn = (acao, rotulo, extra) => `<button class="btn ${extra || ''}" data-acao="${acao}">${rotulo}</button>`;
    let fase = t('faixa.turno', { n: jogo.turno, j: escapar(j.nome) }), texto = '', botoes = '', extras = '';
    const humanoNaVez = controle(p) === 'humano' && !ui.ocupado;

    if (jogo.vencedor != null) {
      fase = t('faixa.fim');
      texto = t('faixa.venceu', { j: escapar(jogo.jogadores[jogo.vencedor].nome) });
    } else if (ui.sorteio) {
      fase = t('sorteio.titulo');
      texto = ui.sorteio;
    } else if (jogo.fase === 'abertura') {
      fase = t('faixa.abertura');
      texto = t('faixa.escolhendoMaos');
    } else if (jogo.fase === 'compra') {
      fase += ` · ${t('faixa.compra')}`;
      if (humanoNaVez) {
        const figs = j.mao.filter(M.ehFigura).length, nums = j.mao.filter(M.ehNumero).length;
        texto = t('faixa.compreUma', { f: figs, n: nums });
      } else texto = t('faixa.botComprando', { j: escapar(j.nome) });
    } else if (jogo.fase === 'principal') {
      if (!humanoNaVez) texto = t('faixa.botJogando', { j: escapar(j.nome) });
      else if (ui.pend) {
        texto = textoPasso();
        extras = btn('cancelar', t('btn.cancelar'));
      } else if (ui.destino != null && ui.sel.length === 1) {
        // Figura ou Ás esperando no campo: falta o número.
        texto = t('faixa.preparo');
        extras = btn('cancelar', t('btn.cancelar'));
      } else {
        if (ui.sel.length) {
          const cands = candidatosSelecao();
          const chaves = [...new Set(cands.map(chaveAcao))];
          botoes = chaves.map(k => {
            const a = cands.find(x => chaveAcao(x) === k);
            return btnGrande('tipo:' + k, rotuloTipo(a.tipo, a), iconeDaAcao(a));
          }).join('');
          extras = btn('cancelar', t('btn.cancelarSelecao'));
          texto = chaves.length ? t('faixa.escolhaAcao') : dicaSelecao();
        } else texto = t(jogo.acoes > 0 ? 'faixa.comoJogar' : 'faixa.semAcoes');
        botoes += btnGrande('ir-ataque', t('btn.irAtaque').replace(/^⚔\s*/, ''), 'atacar', 'perigo');
      }
    } else if (jogo.fase === 'ataque') {
      fase += ` · ${t('faixa.ataque')}`;
      if (humanoNaVez) {
        const temAs = M.alvosPossiveis(jogo).length > 1;
        const temRei = atacantesRestantes().some(uid => M.localizar(jogo, uid).u.figura.rank === 'K');
        const extra = [temAs ? t('faixa.dicaAs') : '', temRei ? t('faixa.dicaRei') : ''].filter(Boolean).join('; ');
        if (!M.atacantesAptos(jogo).length) texto = t(jogo.turno === 1 ? 'faixa.primeiroNaoAtaca' : 'faixa.ninguemApto');
        else texto = atacantesRestantes().length ? t('faixa.comoAtacar', { extra }) : t('faixa.ataquesDeclarados');
        if (ui.ataques.length) botoes += btnGrande('confirmar-ataques', t('btn.confirmarAtaques', { n: ui.ataques.length }), 'atacar', 'perigo');
        extras = btn('voltar', t('btn.voltarAcoes'), 'voltar') + btn('sem-ataque', t(ui.ataques.length ? 'btn.encerrarSemAtacar' : 'btn.encerrarTurno'));
      } else texto = t('faixa.botDeclarando', { j: escapar(j.nome) });
    } else if (jogo.fase === 'bloqueio') {
      fase += ` · ${t('faixa.bloqueio')}`;
      const humanoDefende = controle(d) === 'humano' && !ui.ocupado;
      if (humanoDefende) {
        const desafiado = jogo.desafio != null && M.localizar(jogo, jogo.desafio);
        texto = t(ui.bloqSel != null ? 'faixa.solteBloqueio' : 'faixa.comoBloquear')
          + (desafiado ? ' ' + t('faixa.desafio', { u: M.nomeUnidade(desafiado.u) }) : '');
        botoes = btnGrande('confirmar-bloqueios', t('btn.confirmarBloqueios'), 'escudo', 'defesa');
        extras = btn('limpar-bloqueios', t('btn.limpar'));
      } else texto = t('faixa.botBloqueando', { j: escapar(jogo.jogadores[d].nome) });
    } else if (jogo.fase === 'resolucao' || jogo.fase === 'fimCombate') {
      fase += ` · ${t('faixa.combate')}`;
      texto = t('faixa.vejaPainel');
    } else if (jogo.fase === 'descarte') {
      texto = t('faixa.descarte', { n: M.limiteMao(j) });
    }
    renderAcoes();
    renderCombate();
    $('#fase').innerHTML = fase;
    $('#instrucao').innerHTML = texto;
    $('#chips').innerHTML = '';
    $('#botoes').innerHTML = '';
    definirHTML($('#cartas-acao'), botoes || extras ? `<div class="acoes-extra">${extras}</div><div class="leque-acoes">${botoes}</div>` : '');
  }

  // Painel de combate (lado direito, no meio da altura): a lista de ataques na declaração e no
  // bloqueio. Durante a resolução, o fluxo do combate mostra o duelo nele (ui.duelo).
  function renderCombate() {
    const el = $('#combate');
    if (ui.duelo) return;
    let titulo = '', itens = '';
    if (jogo.fase === 'ataque' && controle(jogo.vez) === 'humano' && ui.ataques.length) {
      titulo = t('cb.seusAtaques');
      itens = ui.ataques.map(chipDeclaracao).join('');
    } else if (jogo.combate && (jogo.fase === 'bloqueio' || jogo.fase === 'resolucao' || ui.mostrarFila)) {
      const humanoDefende = controle(1 - jogo.vez) === 'humano' && !ui.ocupado;
      titulo = ui.mostrarFila
        ? t('anuncio.vaiAtacar', { j: escapar(jogo.jogadores[jogo.vez].nome), n: jogo.combate.ataques.length })
        : t('cb.ataquesDe', { j: escapar(jogo.jogadores[jogo.vez].nome) });
      itens = jogo.combate.ataques.map(at => chipAtaque(at, humanoDefende && ui.bloqSel != null && !alvoDoRei(at, ui.bloqSel))).join('');
    }
    if (!itens) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.className = 'cor-' + corDe(jogo.vez);
    el.innerHTML = `<div class="cb-topo">${titulo}</div><div class="cb-lista">${itens}</div>${ui.mostrarFila ? botaoContinuar() : ''}`;
    el.hidden = false;
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
    caixa.innerHTML = `<div class="acoes-rotulo">${t('ui.acoesPassivas')}</div><div class="acoes-num"><b>${restantes}</b>/${total}</div><div class="acoes-pips">${pips}</div>
      <div class="acoes-vez">${t('ui.vezDe', { j: escapar(jogo.jogadores[jogo.vez].nome) })}</div>`;
    caixa.hidden = false;
  }

  // Registro da partida: fica escondido; o botão do canto superior direito abre uma caixa suspensa.
  function alternarLog(abrir) {
    const painel = $('#painel');
    painel.hidden = abrir ? !painel.hidden : true;
    $('.btn-log').classList.toggle('ativo', !painel.hidden);
    if (!painel.hidden && jogo) renderLog();
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
      n: at.n, dados: at.dados, bonusAtaque: at.bonusAtaque || 0, defensor: d, pvAntes: jogo.jogadores[d].pv,
      atacante: fotoUnidade(at.atacante),
      bloqueadores: at.bloqueadores.map(fotoUnidade).filter(Boolean),
      alvoAs: at.alvo !== 'jogador' ? fotoUnidade(at.alvo) : null,
      direto: M.ataqueDirecionado(jogo, at), // Rei contra um Senhor(a): o alvo defende, junto com os ajudantes
    };
  }

  function efeitoDe(f) {
    const l = M.localizar(jogo, f.uid);
    if (!l) return 'morreu';
    const bh = l.u.berserk ? l.u.berserk.hits : 0;
    return l.u.hits > f.hits || bh > f.bhits ? 'hit' : 'ileso';
  }

  const SELO_EFEITO = tabela('selo.');

  function cartaFotoHTML(f, efeito, papel) {
    const u = f.u;
    const vivo = efeito && efeito !== 'morreu' ? M.localizar(jogo, f.uid) : null;
    const postura = vivo ? M.postura(jogo, vivo.p, vivo.i) : f.postura;
    const mostrarSelo = efeito && !(efeito === 'ileso' && papel === 'atacante');
    const selo = mostrarSelo ? `<div class="efeito efeito-${efeito}">${SELO_EFEITO[efeito]}${efeito === 'hit' && papel === 'atacante' ? ' ' + t('selo.contra') : ''}</div>` : '';
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
    const defensores = s.direto && s.alvoAs ? [s.alvoAs].concat(s.bloqueadores) : s.bloqueadores;
    if (defensores.length) {
      const rotulo = s.direto ? t(defensores.length > 1 ? 'duelo.defendem' : 'duelo.defende') : t('duelo.bloqueadoPor');
      defesa = `<div class="anuncio-grupo"><div class="anuncio-rotulo bloq">⛨ ${rotulo}</div><div class="anuncio-linha">${defensores.map(f => cartaFotoHTML(f, ef(f), 'bloqueador')).join('')}</div></div>`;
      if (pvDepois < s.pvAntes) defesa += `<div class="duelo-seta pequena">➜</div>${jogadorFotoHTML(s.defensor, s.pvAntes, pvDepois, t('duelo.atropelar'))}`;
    } else if (s.alvoAs) {
      defesa = `<div class="anuncio-grupo"><div class="anuncio-rotulo">◎ ${t('duelo.alvo')}</div>${cartaFotoHTML(s.alvoAs, ef(s.alvoAs), 'alvo')}</div>`;
    } else defesa = jogadorFotoHTML(s.defensor, s.pvAntes, pvDepois, t('duelo.direto'));
    return `<div class="anuncio-topo">${t('duelo.topo', { n: s.n, total })}${s.dados > 1 ? ` · ${t('duelo.dados', { n: s.dados })}` : ''}${s.bonusAtaque ? ` · ${t('duelo.golpe', { n: s.bonusAtaque })}` : ''}</div>
      <div class="duelo">${atacante}<div class="duelo-seta">⚔</div>${defesa}</div>`;
  }

  // Duelo no painel de combate: quem ataca × quem defende e o resultado.
  // linhas = null: antes do dado; com as linhas do registro: mostra o resultado (selos e PV animado).
  function mostrarDuelo(foto, total, linhas) {
    ui.duelo = true;
    const el = $('#combate');
    const depois = linhas != null;
    let resultado = '';
    if (depois) {
      const l = linhas.slice(), destaque = l.shift() || '';
      resultado = `<p class="principal">${escapar(destaque.replace(/^\S+ \d+: /, ''))}</p>${l.map(x => `<p>${escapar(x)}</p>`).join('')}`;
    }
    el.className = 'duelo-ativo cor-' + corDe(jogo.vez);
    el.innerHTML = `${dueloHTML(foto, total, depois)}
      <div class="cb-resultado">${depois ? resultado : `<p class="espera">${t(controle(jogo.vez) === 'humano' ? 'cb.joguePeca' : 'cb.rolando')}</p>`}</div>
      <div class="cb-continuar">${depois ? botaoContinuar() : ''}</div>`;
    el.hidden = false;
  }

  // Conta o PV para baixo dentro do pop-up, depois do "tremor" de dano.
  function animarPV() {
    const caixa = $('#combate [data-pv-de]') || $('#anuncio [data-pv-de]');
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

  const botaoContinuar = () => `<div class="anuncio-acoes"><button class="btn principal" data-continuar>${t('btn.continuar')}</button><span>${t('ui.ouEnter')}</span></div>`;

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

  function anuncioInicio(primeiro, dados) {
    const lado = p => {
      const pal = palhacoDe(p);
      return `<div class="inicio-lado${p === primeiro ? ' comeca' : ''}">
        <div class="heroi mini cor-${pal.cor}${pal.retrato ? ' com-retrato' : ''}">${arteHeroi(pal)}<div class="heroi-nome">${pal.nome}</div></div>
        <span>${t(controle(p) === 'humano' ? 'ui.voce' : 'ui.oponente')}</span>
        ${dados ? `<b class="dado-inicio">🎲 ${dados[p]}</b>` : ''}
        ${p === primeiro ? `<em>${t('inicio.comeca')}</em>` : ''}</div>`;
    };
    const motivo = t('inicio.dado');
    return `<div class="anuncio-topo">${t('inicio.quem')}</div><div class="duelo">${lado(0)}<div class="duelo-seta">×</div>${lado(1)}</div><p class="nota">${motivo}</p>`;
  }

  function anuncioDeclaracao(ataques, nome) {
    const itens = ataques.map(at => {
      const l = M.localizar(jogo, at.atacante);
      return `<div class="fila-item"><div class="fila-num">${t('chip.ordem', { n: at.n })}</div>${cartaUnidadeHTML(l.u, l.p, l.i)}<div class="fila-alvo">→ ${nomeAlvo(at)}</div></div>`;
    }).join('');
    return `<div class="anuncio-topo">${t('anuncio.vaiAtacar', { j: escapar(nome), n: ataques.length })}</div><div class="fila">${itens}</div>${botaoContinuar()}`;
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

  // Abertura do jogador desta tela, em duas etapas: escolher as figuras (devolve os ids) e,
  // depois de ver a mão, decidir o mulligan (devolve true/false). No online, as etapas dos dois
  // jogadores são aplicadas na mesma ordem nas duas telas, para o sorteio dar igual.
  function escolherFigurasModal() {
    return new Promise(resolver => {
      const figs = M.figurasNoBaralho(jogo, eu), qtd = Math.min(3, figs.length), esc = [];
      const tela = () => modal(`<h2>${t('ab.escolha', { n: qtd })}</h2>
          <p class="nota">${t('ab.nota')}</p>
          ${gradeCartas(figs, esc, true)}
          <div class="acoes-menu"><button class="btn principal" data-m="ok"${esc.length === qtd ? '' : ' disabled'}>${t('btn.confirmar')} (${esc.length}/${qtd})</button></div>`,
        ev => {
          const id = cartaClicada(ev);
          if (id) {
            const k = esc.indexOf(id);
            if (k >= 0) esc.splice(k, 1);
            else if (esc.length < qtd) esc.push(id);
            return tela();
          }
          if (ev.target.closest('[data-m="ok"]') && esc.length === qtd) resolver(esc.slice());
        });
      tela();
    });
  }

  function decidirMulliganModal() {
    return new Promise(resolver => {
      modal(`<h2>${t('ab.suaMao')}</h2>
          ${gradeCartas(jogo.jogadores[eu].mao, null, false)}
          <p class="nota">${t('ab.mulliganNota')}</p>
          <div class="acoes-menu"><button class="btn principal" data-m="manter">${t('ab.manter')}</button><button class="btn" data-m="mulligan">Mulligan</button></div>`,
      ev => {
        const b = ev.target.closest('[data-m]');
        if (b) resolver(b.dataset.m === 'mulligan');
      });
    });
  }

  async function aberturaHumana() {
    const ids = await escolherFigurasModal();
    M.escolherFiguras(jogo, eu, ids);
    render();
    if (await decidirMulliganModal()) M.mulligan(jogo, eu);
    else M.confirmarAbertura(jogo, eu);
    fecharModal();
  }

  // Janela de espera enquanto o amigo decide algo (abertura, revanche...).
  function modalEspera(chave) {
    modal(`<h2>${t(chave || 'on.esperandoAmigo', { j: escapar(jogo ? jogo.jogadores[1 - eu].nome : '') })}</h2>
      <div class="espera-pontos"><i></i><i></i><i></i></div>`);
  }

  async function aberturaOnline(id) {
    const minhas = await escolherFigurasModal();
    if (id !== partida) return false;
    SS.Rede.enviar({ t: 'figuras', ids: minhas });
    modalEspera();
    const dele = await SS.Rede.esperar(['figuras']);
    if (id !== partida) return false;
    if (!Array.isArray(dele.ids)) { jogadaInvalida(dele.ids); return false; }
    if (!aplicarRemoto(() => { for (const p of [0, 1]) M.escolherFiguras(jogo, p, p === eu ? minhas : dele.ids); })) return false;
    render();
    const mull = await decidirMulliganModal();
    if (id !== partida) return false;
    SS.Rede.enviar({ t: 'mulligan', sim: mull });
    modalEspera();
    const dele2 = await SS.Rede.esperar(['mulligan']);
    if (id !== partida) return false;
    for (const p of [0, 1]) {
      if (p === eu ? mull : dele2.sim === true) M.mulligan(jogo, p);
      else M.confirmarAbertura(jogo, p);
    }
    fecharModal();
    return true;
  }

  function escolherDescarte() {
    return new Promise(resolver => {
      const j = jogo.jogadores[jogo.vez], n = j.mao.length - M.limiteMao(j), esc = [];
      const tela = () => modal(`<h2>${t('desc.titulo', { n })}</h2>
          ${gradeCartas(j.mao, esc, true)}
          <div class="acoes-menu"><button class="btn principal" data-m="ok"${esc.length === n ? '' : ' disabled'}>${t('desc.btn')} (${esc.length}/${n})</button></div>`,
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
    modal(`<h2>${t('cem.reviver')}</h2>
      ${gradeCartas(j.cemiterio.filter(c => ids.has(c.id)), null, true)}
      <div class="acoes-menu"><button class="btn" data-m="cancelar">${t('btn.cancelar')}</button></div>`,
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
    modal(`<h2>${t('cem.de', { j: escapar(j.nome) })}</h2>
      ${j.cemiterio.length ? gradeCartas(j.cemiterio.slice().reverse(), null, false) : `<p class="nota">${t('cem.vazio')}</p>`}
      <div class="acoes-menu"><button class="btn" data-m="fechar">${t('btn.fechar')}</button></div>`,
    ev => { if (ev.target.closest('[data-m="fechar"]')) fecharModal(); });
  }

  // ---------- Fluxo da partida ----------

  // online: { eu, semente, palhacos, decks } (partida com um amigo; ver rede.js).
  async function iniciarPartida(modo, online) {
    cfg.modo = modo;
    partida++;
    const id = partida;
    fecharModal();
    esconderAnuncio();
    SS.Dados.cancelar();
    posturaAnterior = {};
    viradoAnterior = {};
    maoVista = [null, null];
    campoVisto = [null, null];
    cemVisto = [new Set(), new Set()];
    // No online, cada tela mostra o próprio jogador embaixo; o sorteio do motor usa a mesma semente nas duas.
    eu = online ? online.eu : 0;
    definirLados(eu);
    $('[data-acao="reiniciar"]').hidden = modo === 'online';
    M.definirRng(online ? SS.Rede.gerador(online.semente) : Math.random);
    revanche = { minha: false, dele: false };
    let contagens;
    if (online) {
      palhacos = online.palhacos.slice();
      contagens = online.decks;
    } else {
      // Contra o bot, você fica embaixo; o bot pega outro Palhaço (o escolhido ou um sorteado).
      const ids = P.LISTA.map(x => x.id);
      const sortear = lista => lista[Math.floor(Math.random() * lista.length)];
      const meu = modo === 'bots' ? sortear(ids) : cfg.palhaco;
      const outros = ids.filter(x => x !== meu);
      const rival = modo !== 'bots' && outros.includes(cfg.rival) ? cfg.rival : sortear(outros);
      palhacos = [meu, rival];
      contagens = [modo === 'bots' ? P.get(meu).deck : contagemEscolhida(), P.get(rival).deck];
    }
    const nomes = palhacos.map(x => P.get(x).nome);
    if (nomes[0] === nomes[1]) nomes[1] += ' 2'; // dois amigos com o mesmo Palhaço
    const decks = contagens.map((c, k) => M.cartasDoDeck(c, k));
    // Quem começa: sempre no dado. Cada jogador joga o seu e começa quem tirar mais; empate, joga de novo.
    // Mesa provisória só para mostrar os Palhaços durante o sorteio.
    jogo = M.criarJogo({ nomes, primeiro: 0, decks, palhacos });
    ui = novoUi();
    const dadosInicio = await sorteioNoDado(id, nomes);
    if (!dadosInicio) return;
    const primeiro = dadosInicio[0] > dadosInicio[1] ? 0 : 1;
    jogo = M.criarJogo({ nomes, primeiro, decks, palhacos });
    ui = novoUi();
    maoVista = [null, null];
    campoVisto = [null, null];
    M.registrar(jogo, `${nomes[0]} × ${nomes[1]}.`);
    M.registrar(jogo, t('log.inicioDados', { a: nomes[0], da: dadosInicio[0], b: nomes[1], db: dadosInicio[1], j: nomes[primeiro] }));
    render();
    mostrarAnuncio(anuncioInicio(primeiro, dadosInicio) + botaoContinuar());
    await esperarContinuar(2600);
    if (id !== partida) return;
    esconderAnuncio();
    if (modo === 'online') {
      if (!(await aberturaOnline(id))) return;
    } else {
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
    }
    proximoTurno(id);
  }

  // Deck escolhido no menu para o seu Palhaço.
  function contagemEscolhida() {
    if (cfg.deck === 'palhaco') return P.get(cfg.palhaco).deck;
    return cfg.deck === 'padrao' ? M.contagemPadrao() : SS.Decks.contagemPara(cfg.deck);
  }

  // Joga um dado na vez do jogador p: você arremessa (e no online manda o resultado),
  // o amigo manda o resultado dele pela rede, o bot rola sozinho.
  async function dadoDe(p, n, id) {
    const deCima = p !== eu;
    if (controle(p) === 'humano') {
      const r = await SS.Dados.jogar(n, corDe(p));
      if (cfg.modo === 'online') SS.Rede.enviar({ t: 'dados', v: r });
      return r;
    }
    if (controle(p) === 'remoto') {
      const msg = await SS.Rede.esperar(['dados']);
      if (id !== partida) return [1];
      if (!dadosValidos(msg.v, n)) {
        jogadaInvalida(msg.v);
        return [1];
      }
      return SS.Dados.mostrar(msg.v, corDe(p), deCima);
    }
    return SS.Dados.rolar(n, corDe(p), deCima);
  }

  // Desempate de quem começa: os dois jogam um dado na mesa, repetindo enquanto empatar.
  // Devolve [dado do jogador 0, dado do jogador 1], ou null se a partida foi abandonada no meio.
  async function sorteioNoDado(id, nomes) {
    ui.sorteio = t('sorteio.aviso');
    render();
    await esperar(1400);
    for (;;) {
      const r = [];
      for (const p of [0, 1]) {
        if (id !== partida) return null;
        ui.sorteio = (r.length ? t('sorteio.tirou', { j: escapar(nomes[0]), n: r[0] }) + ' ' : '')
          + (controle(p) === 'humano' ? t('sorteio.suaVez') : t('sorteio.vezDe', { j: escapar(nomes[p]) }));
        render();
        SS.Dados.definirArena($('#mesa'));
        const rol = await dadoDe(p, 1, id);
        if (id !== partida) return null;
        r[p] = rol[0];
        await esperar(900);
        SS.Dados.sumir();
      }
      SS.Dados.definirArena(null);
      ui.sorteio = t('sorteio.tirou', { j: escapar(nomes[0]), n: r[0] }) + ' ' + t('sorteio.tirou', { j: escapar(nomes[1]), n: r[1] });
      if (r[0] !== r[1]) {
        render();
        await esperar(700);
        ui.sorteio = null;
        return r;
      }
      ui.sorteio += ' ' + t('sorteio.empate', { n: r[0] });
      render();
      await esperar(1500);
    }
  }

  async function proximoTurno(id) {
    if (id !== partida) return;
    if (jogo.vencedor != null) return fimDeJogo();
    render();
    // Repete enquanto houver compras a fazer neste turno (nunca fica parado na fase de compra).
    while (jogo.fase === 'compra') {
      const p = jogo.vez;
      if (controle(p) === 'bot') {
        await esperar(500);
        if (id !== partida) return;
        M.comprarDoTurno(jogo, Bot.escolherBaralho(jogo, p, cfg.nivel));
      } else if (controle(p) === 'remoto') {
        // Online: o amigo escolhe o baralho na tela dele.
        const m = await SS.Rede.esperar(['compra']);
        if (id !== partida) return;
        if (!M.BARALHOS.includes(m.b)) return jogadaInvalida(m.b);
        if (!aplicarRemoto(() => M.comprarDoTurno(jogo, m.b))) return;
      } else {
        // Os dois baralhos pulsam na mesa; o jogador clica no que quer comprar.
        const origem = await new Promise(r => { ui.aoComprar = r; render(); });
        if (id !== partida) return;
        if (cfg.modo === 'online') SS.Rede.enviar({ t: 'compra', b: origem });
        M.comprarDoTurno(jogo, origem);
      }
      if (jogo.vencedor != null) return fimDeJogo();
      render();
    }
    if (controle(jogo.vez) === 'bot') turnoBot(id);
    else if (controle(jogo.vez) === 'remoto') turnoRemoto(id);
  }

  // O Profissional pensa num Web Worker (js/cerebro.js) para a tela não travar enquanto ele simula jogadas.
  // Os outros níveis são rápidos e pensam aqui mesmo. Se o worker não abrir, o Profissional pensa aqui também.
  let cerebro = null, cerebroQuebrado = false, proximoPedido = 0;
  const pedidos = new Map();
  function pensar(fn, ...args) {
    const aqui = () => Bot[fn](...args);
    if (cfg.nivel !== 'profissional' || cerebroQuebrado || typeof Worker !== 'function') return Promise.resolve(aqui());
    try {
      if (!cerebro) {
        const s = document.querySelector('script[src*="js/bot.js"]');
        cerebro = new Worker('js/cerebro.js' + (s ? new URL(s.src).search : ''));
        cerebro.onmessage = ev => {
          const pd = pedidos.get(ev.data.id);
          if (!pd) return;
          pedidos.delete(ev.data.id);
          if (ev.data.erro) pd.falhou();
          else pd.pronto(ev.data.r);
        };
        cerebro.onerror = ev => {
          if (ev.preventDefault) ev.preventDefault();
          cerebroQuebrado = true;
          cerebro = null;
          for (const pd of pedidos.values()) pd.falhou();
          pedidos.clear();
        };
      }
      return new Promise(pronto => {
        const id = ++proximoPedido;
        pedidos.set(id, { pronto, falhou: () => pronto(aqui()) });
        cerebro.postMessage({ id, fn, args });
      });
    } catch (erro) {
      cerebroQuebrado = true;
      return Promise.resolve(aqui());
    }
  }

  async function turnoBot(id) {
    const p = jogo.vez;
    ui.ocupado = true;
    render();
    await esperar(800);
    if (id !== partida) return;
    for (let g = 0; g < 12 && jogo.fase === 'principal'; g++) {
      const a = await pensar('proximaAcao', jogo, p, cfg.nivel);
      if (id !== partida) return;
      M.aplicarAcao(jogo, a);
      render();
      if (jogo.vencedor != null) return fimDeJogo();
      await esperar(a.tipo === 'atacar' ? 300 : 900);
      if (id !== partida) return;
    }
    if (jogo.fase === 'principal') M.aplicarAcao(jogo, { tipo: 'atacar' });
    const lista = await pensar('declararAtaques', jogo, p, cfg.nivel);
    if (id !== partida) return;
    M.declararAtaques(jogo, lista);
    await mostrarDeclaracao(lista);
    if (id !== partida) return;
    fluxoCombate(id);
  }

  // A ordem dos ataques do oponente aparece no painel da direita (e as setas na mesa).
  async function mostrarDeclaracao(lista) {
    render();
    if (lista.length) {
      ui.mostrarFila = true;
      render();
      await esperarContinuar(2200);
      ui.mostrarFila = false;
    } else await esperar(400);
  }

  // ---------- Online: tudo o que chega do amigo é conferido antes de entrar no jogo ----------
  // Uma jogada que não bate com as regras (trapaça ou mensagem quebrada) encerra a partida.
  // (campos vazios ficam de fora: na rede, um campo undefined simplesmente some)
  const chaveJogada = a => JSON.stringify(Object.keys(a).filter(k => a[k] !== undefined).sort().map(k => [k, a[k]]));

  function jogadaInvalida(err) {
    if (err) console.warn('Jogada inválida recebida:', err);
    amigoSaiu('on.invalido');
    // Corta a conexão: nada mais desse jogador entra nesta tela.
    SS.Rede.enviar({ t: 'tchau' });
    SS.Rede.sair();
  }

  // Aplica uma jogada do amigo; se o motor recusar, encerra a partida. Devolve true se deu certo.
  function aplicarRemoto(fn) {
    try {
      fn();
      return true;
    } catch (err) {
      jogadaInvalida(err);
      return false;
    }
  }

  // A jogada do amigo precisa ser exatamente uma das jogadas permitidas agora.
  function acaoLegalRemota(a) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
    const k = chaveJogada(a);
    return M.acoesLegais(jogo).some(x => chaveJogada(x) === k);
  }

  // Dados que o amigo jogou: a quantidade certa, cada um de 1 a 6.
  const dadosValidos = (v, n) => Array.isArray(v) && v.length === n && v.every(x => Number.isInteger(x) && x >= 1 && x <= 6);

  // Vez do amigo (online): aplica as jogadas que chegam pela rede, na ordem em que ele fez.
  async function turnoRemoto(id) {
    ui.ocupado = true;
    render();
    for (;;) {
      const m = await SS.Rede.esperar(['acao', 'declarar']);
      if (id !== partida) return;
      if (m.t === 'acao') {
        if (!acaoLegalRemota(m.a)) return jogadaInvalida(m.a);
        if (!aplicarRemoto(() => M.aplicarAcao(jogo, m.a))) return;
        render();
        if (jogo.vencedor != null) return fimDeJogo();
        continue;
      }
      if (jogo.fase === 'principal') M.aplicarAcao(jogo, { tipo: 'atacar' });
      if (!Array.isArray(m.lista) || !aplicarRemoto(() => M.declararAtaques(jogo, m.lista))) return;
      await mostrarDeclaracao(m.lista);
      if (id !== partida) return;
      return fluxoCombate(id);
    }
  }

  async function fluxoCombate(id) {
    ui.ocupado = true;
    render();
    if (jogo.fase === 'bloqueio') {
      const d = 1 - jogo.vez;
      if (controle(d) === 'bot') {
        await esperar(500);
        if (id !== partida) return;
        const mapa = await pensar('bloquear', jogo, d, cfg.nivel);
        if (id !== partida) return;
        M.definirBloqueios(jogo, mapa);
      } else if (!M.bloqueadoresAptos(jogo).length) {
        M.registrar(jogo, t('log.semBloqueadores', { j: jogo.jogadores[d].nome }));
        M.definirBloqueios(jogo, {});
      } else if (!jogo.combate.ataques.some(at => M.bloqueadoresAptos(jogo).some(uid => !alvoDoRei(at, uid)))) {
        // Só o próprio alvo do Rei estaria livre: não há quem mandar para ajudar.
        M.registrar(jogo, t('log.ninguemAjuda', { j: jogo.jogadores[d].nome }));
        M.definirBloqueios(jogo, {});
      } else if (controle(d) === 'remoto') {
        const m = await SS.Rede.esperar(['bloqueios']);
        if (id !== partida) return;
        const mapa = m.mapa && typeof m.mapa === 'object' && !Array.isArray(m.mapa) ? m.mapa : null;
        if (!mapa || !Object.values(mapa).every(Array.isArray)) return jogadaInvalida(m.mapa);
        if (!aplicarRemoto(() => M.definirBloqueios(jogo, mapa))) return;
      } else {
        ui.ocupado = false;
        ui.bloqueios = bloqueiosIniciais();
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
      const temDuelo = !!foto.atacante;
      // O duelo aparece no painel da direita (dentro do tabuleiro); os dados rolam soltos pela mesa.
      if (temDuelo) mostrarDuelo(foto, total, null);
      SS.Dados.definirArena($('#mesa'));
      // Quem ataca joga o dado: você arremessa, o amigo manda o resultado, o bot rola.
      const rolagens = await dadoDe(jogo.vez, at.dados, id);
      if (id !== partida) return;
      await esperar(600); // tempo para ver a face do dado
      if (id !== partida) return;
      const antes = jogo.log.length;
      const cena = prepararInvestida(at);
      M.resolverProximo(jogo, rolagens);
      const linhas = jogo.log.slice(antes);
      await investida(cena, danosDesde(cena));
      if (id !== partida) return;
      render();
      if (temDuelo) {
        mostrarDuelo(foto, total, linhas);
        animarPV();
        await esperarContinuar();
      } else await esperar(1200);
      if (id !== partida) return;
      SS.Dados.sumir();
    }
    SS.Dados.definirArena(null);
    ui.duelo = false;
    ui.foco = null;
    if (jogo.vencedor != null) return fimDeJogo();
    M.encerrarTurno(jogo);
    if (jogo.fase === 'descarte') {
      if (controle(jogo.vez) === 'bot') M.descartar(jogo, Bot.descartar(jogo, jogo.vez));
      else if (controle(jogo.vez) === 'remoto') {
        const m = await SS.Rede.esperar(['descarte']);
        if (id !== partida) return;
        if (!Array.isArray(m.ids) || new Set(m.ids).size !== m.ids.length) return jogadaInvalida(m.ids);
        if (!aplicarRemoto(() => M.descartar(jogo, m.ids))) return;
      } else {
        ui.ocupado = false;
        render();
        const ids = await escolherDescarte();
        if (id !== partida) return;
        if (cfg.modo === 'online') SS.Rede.enviar({ t: 'descarte', ids });
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
    const venceu = cfg.modo === 'bots' ? null : v === eu;
    const titulo = cfg.modo === 'bots' ? t('faixa.venceu', { j: escapar(jogo.jogadores[v].nome) }) : t(venceu ? 'fim.vitoria' : 'fim.derrota');
    const online = cfg.modo === 'online';
    modal(`<h2 class="titulo-fim${venceu === false ? ' derrota' : ''}">${titulo}</h2>
      <p>${t('fim.turno', { n: jogo.turno })}</p>
      ${online && revanche.dele ? `<p class="nota destaque">${t('on.amigoQuerRevanche', { j: escapar(jogo.jogadores[1 - eu].nome) })}</p>` : ''}
      <div class="acoes-menu"><button class="btn principal" data-m="denovo">${t(online ? 'on.revanche' : 'fim.denovo')}</button><button class="btn" data-m="ver">${t('fim.ver')}</button><button class="btn" data-m="menu">${t('fim.menu')}</button></div>`,
    ev => {
      const b = ev.target.closest('[data-m]');
      if (!b) return;
      if (b.dataset.m === 'denovo') return online ? pedirRevanche() : iniciarPartida(cfg.modo);
      if (b.dataset.m === 'ver') return fecharModal();
      menu();
    });
  }

  function confirmarDesistir() {
    if (!jogo || jogo.vencedor != null) return;
    const assistindo = cfg.modo === 'bots';
    const k = assistindo ? 'conf.encerrar' : 'conf.desistir';
    modal(`<h2>${t(k + 'Titulo')}</h2>
      <p class="nota">${t(k + 'Nota')}</p>
      <div class="acoes-menu"><button class="btn principal" data-m="sim">${t(k + 'Btn')}</button><button class="btn" data-m="nao">${t('conf.continuar')}</button></div>`,
    ev => {
      const b = ev.target.closest('[data-m]');
      if (!b) return;
      if (b.dataset.m === 'nao') return fecharModal();
      if (assistindo) return menu();
      partida++; // interrompe o turno em andamento
      SS.Dados.cancelar();
      if (cfg.modo === 'online') SS.Rede.enviar({ t: 'desistir' });
      M.desistir(jogo, eu);
      fimDeJogo();
    });
  }

  function confirmarReiniciar() {
    if (!jogo) return;
    modal(`<h2>${t('conf.reiniciarTitulo')}</h2><p class="nota">${t('conf.reiniciarNota')}</p>
      <div class="acoes-menu"><button class="btn principal" data-m="sim">${t('conf.reiniciarBtn')}</button><button class="btn" data-m="nao">${t('conf.continuar')}</button></div>`,
    ev => {
      const b = ev.target.closest('[data-m]');
      if (!b) return;
      if (b.dataset.m === 'sim') iniciarPartida(cfg.modo);
      else fecharModal();
    });
  }

  function confirmarMenu() {
    if (!jogo || jogo.vencedor != null) return menu();
    modal(`<h2>${t('conf.menuTitulo')}</h2><div class="acoes-menu"><button class="btn principal" data-m="sim">${t('conf.menuBtn')}</button><button class="btn" data-m="nao">${t('conf.continuar')}</button></div>`,
      ev => {
        const b = ev.target.closest('[data-m]');
        if (!b) return;
        if (b.dataset.m === 'sim') menu();
        else fecharModal();
      });
  }

  // ---------- Online: jogar com um amigo (rede.js) ----------

  // papel: 'anfitriao' (criou a sala, é o jogador 0) ou 'convidado' (entrou pelo link, jogador 1).
  let papel = null, sala = null, amigoFora = false;
  const espera = () => '<div class="espera-pontos"><i></i><i></i><i></i></div>';

  function telaOnline(voltar, aviso) {
    const disp = SS.Rede.disponivel();
    modal(`<h2>${t('on.titulo')}</h2>
      <p class="nota">${t('on.nota', { p: P.get(cfg.palhaco).nome })}</p>
      <p class="nota aviso-ip">🔒 ${t('on.avisoIp')}</p>
      ${disp ? '' : `<p class="nota erro">${t('on.semRede')}</p>`}
      <div class="online-opcoes">
        <div class="online-caixa"><h3>${t('on.criarTitulo')}</h3><p class="nota">${t('on.criarNota')}</p>
          <button class="btn principal" data-m="criar"${disp ? '' : ' disabled'}>${t('on.criar')}</button></div>
        <div class="online-caixa"><h3>${t('on.entrarTitulo')}</h3><p class="nota">${t('on.entrarNota')}</p>
          <div class="link-sala"><input class="campo-codigo" maxlength="8" placeholder="${t('on.codigo')}" autocomplete="off">
          <button class="btn" data-m="entrar"${disp ? '' : ' disabled'}>${t('on.entrar')}</button></div></div>
      </div>
      ${aviso ? `<p class="nota ${aviso.erro ? 'erro' : ''}">${escapar(aviso.msg)}</p>` : ''}
      <div class="acoes-menu"><button class="btn" data-m="voltar">${t('btn.voltar')}</button></div>`,
    ev => {
      const b = ev.target.closest('[data-m]');
      if (!b) return;
      if (b.dataset.m === 'criar') return criarSalaOnline(voltar);
      if (b.dataset.m === 'entrar') return entrarNaSala($('#modal .campo-codigo').value, voltar);
      if (b.dataset.m === 'voltar') { SS.Rede.sair(); voltar(); }
    });
  }

  async function criarSalaOnline(voltar) {
    modal(`<h2>${t('on.criando')}</h2>${espera()}`);
    let cod;
    try {
      cod = await SS.Rede.criarSala();
    } catch (err) {
      return telaOnline(voltar, { erro: true, msg: t('on.erroRede', { m: err.type || err.message }) });
    }
    papel = 'anfitriao';
    amigoFora = false;
    sala = { palhaco: cfg.palhaco, deck: contagemEscolhida(), convidado: null };
    const link = SS.Rede.link(cod);
    modal(`<h2>${t('on.salaCriada')}</h2>
      <p class="nota">${t('on.mandeLink')}</p>
      <div class="link-sala"><input readonly value="${escapar(link)}"><button class="btn principal" data-m="copiar">${t('on.copiar')}</button></div>
      <p class="nota">${t('on.ouCodigo')} <b class="codigo-sala">${cod}</b></p>
      <p class="nota">${t('on.esperando')}</p>${espera()}
      <div class="acoes-menu"><button class="btn" data-m="cancelar">${t('btn.cancelar')}</button></div>`,
    ev => {
      const b = ev.target.closest('[data-m]');
      if (!b) return;
      if (b.dataset.m === 'copiar') {
        const feito = () => { b.textContent = t('on.copiado'); };
        if (navigator.clipboard) navigator.clipboard.writeText(link).then(feito, () => $('#modal .link-sala input').select());
        else $('#modal .link-sala input').select();
        return;
      }
      if (b.dataset.m === 'cancelar') { SS.Rede.sair(); papel = null; telaOnline(voltar); }
    });
  }

  async function entrarNaSala(codigo, voltar) {
    codigo = String(codigo || '').trim().toUpperCase();
    if (!codigo) return telaOnline(voltar, { erro: true, msg: t('on.erroSala') });
    modal(`<h2>${t('on.conectando', { c: escapar(codigo) })}</h2>${espera()}`);
    try {
      await SS.Rede.entrar(codigo);
    } catch (err) {
      const msg = err.type === 'peer-unavailable' || err.message === 'tempo' ? t('on.erroSala') : t('on.erroRede', { m: err.type || err.message });
      return telaOnline(voltar, { erro: true, msg });
    }
    papel = 'convidado';
    amigoFora = false;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    modal(`<h2>${t('on.conectado')}</h2>${espera()}`);
    // O anfitrião recebe o seu Palhaço e deck e começa a partida para os dois.
    SS.Rede.enviar({ t: 'ola', palhaco: cfg.palhaco, deck: contagemEscolhida() });
  }

  // Anfitrião: sorteia a semente e manda a configuração para o amigo; os dois começam juntos.
  function comecarOnline() {
    const config = {
      semente: Math.floor(Math.random() * 4294967296) >>> 0,
      palhacos: [sala.palhaco, sala.convidado.palhaco],
      decks: [sala.deck, sala.convidado.deck],
    };
    SS.Rede.enviar(Object.assign({ t: 'inicio' }, config));
    iniciarPartida('online', Object.assign({ eu: 0 }, config));
  }

  function pedirRevanche() {
    revanche.minha = true;
    SS.Rede.enviar({ t: 'revanche' });
    if (revanche.dele && papel === 'anfitriao') return comecarOnline();
    modalEspera(revanche.dele ? 'on.comecando' : 'on.esperandoRevanche');
  }

  // O amigo saiu, desistiu ou a conexão caiu.
  function amigoSaiu(chave) {
    if (cfg.modo !== 'online' || amigoFora) return;
    amigoFora = true;
    partida++;
    SS.Dados.cancelar();
    ui.ocupado = false;
    modal(`<h2>${t(chave, { j: escapar(jogo ? jogo.jogadores[1 - eu].nome : '') })}</h2>
      <div class="acoes-menu"><button class="btn principal" data-m="menu">${t('fim.menu')}</button><button class="btn" data-m="ver">${t('fim.ver')}</button></div>`,
    ev => {
      const b = ev.target.closest('[data-m]');
      if (!b) return;
      if (b.dataset.m === 'ver') return fecharModal();
      menu();
    });
  }

  SS.Rede.ao('ola', m => {
    if (papel !== 'anfitriao' || !sala) return;
    const palhaco = P.get(m.palhaco) ? m.palhaco : 'lancalotte';
    const deck = m.deck && !M.validarDeck(m.deck).length ? m.deck : P.get(palhaco).deck;
    sala.convidado = { palhaco, deck };
    comecarOnline();
  });
  SS.Rede.ao('inicio', m => {
    if (papel !== 'convidado') return;
    // A configuração vem do anfitrião: confere Palhaços, decks e semente antes de começar.
    const ok = Array.isArray(m.palhacos) && m.palhacos.length === 2 && m.palhacos.every(x => typeof x === 'string' && P.get(x))
      && Array.isArray(m.decks) && m.decks.length === 2 && m.decks.every(d => !M.validarDeck(d).length)
      && Number.isInteger(m.semente) && m.semente >= 0;
    if (!ok) {
      SS.Rede.sair();
      papel = null;
      return modal(`<h2>${t('on.invalido', { j: '' })}</h2><div class="acoes-menu"><button class="btn principal" data-m="menu">${t('fim.menu')}</button></div>`,
        ev => { if (ev.target.closest('[data-m="menu"]')) menu(); });
    }
    iniciarPartida('online', { eu: 1, semente: m.semente, palhacos: m.palhacos, decks: m.decks });
  });
  SS.Rede.ao('desistir', () => {
    if (cfg.modo !== 'online' || !jogo || jogo.vencedor != null) return;
    partida++;
    SS.Dados.cancelar();
    M.desistir(jogo, 1 - eu);
    fimDeJogo();
  });
  SS.Rede.ao('revanche', () => {
    revanche.dele = true;
    if (revanche.minha && papel === 'anfitriao') return comecarOnline();
    if (!revanche.minha && jogo && jogo.vencedor != null && cfg.modo === 'online' && !$('#modal').hidden) fimDeJogo();
  });
  SS.Rede.ao('tchau', () => amigoSaiu('on.saiu'));
  SS.Rede.ao('caiu', () => amigoSaiu('on.caiu'));

  function menu() {
    if (cfg.modo === 'online') {
      SS.Rede.enviar({ t: 'tchau' });
      SS.Rede.sair();
      cfg.modo = 'bot';
    }
    papel = null;
    eu = 0;
    definirLados(0);
    M.definirRng(Math.random);
    partida++;
    SS.Dados.cancelar();
    jogo = null;
    ui = novoUi();
    renderVazio();
    telaInicio();
  }

  // ---------- Menu: início → escolha do Palhaço (cartas) → VS e escolha do oponente ----------

  const grupoMenu = (nome, opcoes, valor) => `<div class="grupo" data-grupo="${nome}">${opcoes.map(([v, r]) =>
    `<button data-v="${v}" class="${(valor !== undefined ? valor : cfg[nome]) === v ? 'ativo' : ''}">${r}</button>`).join('')}</div>`;

  // Marca o botão escolhido de um grupo sem redesenhar a tela (as cartas não piscam).
  function marcarGrupo(botao) {
    for (const b of botao.parentElement.children) b.classList.toggle('ativo', b === botao);
  }

  const cartaJoker = (pal, sel, k) => `<button class="carta-joker cor-${pal.cor}${sel === pal.id ? ' ativo' : ''}" data-palhaco="${pal.id}" style="--i:${k}" aria-label="${pal.nome}">
      <img src="${pal.carta}" alt="${pal.nome}" draggable="false"></button>`;

  const pontuar = s => (/[.!?]$/.test(s) ? s : s + '.');

  // Caixa branca com as habilidades do Palhaço (aparece ao clicar na carta).
  function caixaInfo(id) {
    if (id === 'aleatorio') {
      return `<div class="caixa-info"><h3>? ${t('menu.surpresa')}</h3><p>${t('menu.surpresaTexto')}</p></div>`;
    }
    const pal = P.get(id);
    return `<div class="caixa-info cor-${pal.cor}">
      <h3><span class="naipe-info">${SIMB[pal.naipe]}</span> ${pal.nome} <small>${pal.titulo} · ${NOME_NAIPE[pal.naipe]}</small></h3>
      <p><b>${t('menu.passiva')} ${pontuar(pal.passiva.nome)}</b> ${pal.passiva.texto}</p>
      ${pal.poder ? `<p><b>${t('menu.poder')} ${pontuar(pal.poder.nome)}</b> ${pal.poder.texto}</p>` : ''}
      <p class="plano">${t('menu.estilo')} ${pal.plano}</p></div>`;
  }

  function telaInicio() {
    const convite = SS.Rede.codigoDoLink();
    modal(`<div class="menu-tema inicio">
      <div class="opcao idioma">${grupoMenu('idioma', [['en', 'English'], ['pt', 'Português']], SS.Idioma.atual())}</div>
      <div class="leque-inicio">${P.LISTA.map((pal, k) => `<img src="${pal.carta}" alt="" style="--i:${k}" draggable="false">`).join('')}</div>
      <h1 class="titulo">${t('menu.titulo')}</h1>
      <p class="sub">${t('menu.sub')}</p>
      ${convite ? `<div class="convite"><span>🌐 ${t('on.convite', { c: escapar(convite) })}</span>
        <button class="btn principal" data-m="entrar-convite">${t('on.entrarEscolher')}</button>
        <p class="nota aviso-ip">🔒 ${t('on.avisoIp')}</p></div>` : ''}
      <div class="menu-principal">
        <button class="btn-menu principal" data-m="jogar"><span>⚔</span>${t('menu.jogar')}</button>
        <button class="btn-menu" data-m="online"><span>🌐</span>${t('menu.online')}</button>
        <button class="btn-menu" data-m="assistir"><span>🎭</span>${t('menu.assistir')}</button>
      </div>
      <div class="acoes-menu secundario">
        <button class="btn" data-m="decks">🂠 ${t('menu.decks')}</button>
        <button class="btn" data-m="regras">📖 ${t('menu.regras')}</button>
        <button class="btn" data-m="simular">${t('menu.simular')}</button>
      </div></div>`,
    ev => {
      const g = ev.target.closest('[data-grupo="idioma"] [data-v]');
      if (g) {
        SS.Idioma.definir(g.dataset.v);
        renderVazio();
        return telaInicio();
      }
      const b = ev.target.closest('[data-m]');
      if (!b) return;
      const m = b.dataset.m;
      if (m === 'jogar') telaPalhacos('bot');
      else if (m === 'online') telaPalhacos('online');
      else if (m === 'entrar-convite') telaPalhacos('convite');
      else if (m === 'assistir') iniciarPartida('bots');
      else if (m === 'decks') {
        fecharModal();
        SS.Decks.abrir(telaInicio);
      } else if (m === 'regras') {
        fecharModal();
        SS.Regras.abrir(telaInicio);
      } else if (m === 'simular') simulacao(telaInicio);
    });
  }

  // modo: 'bot' (segue para o VS), 'online' (criar/entrar numa sala) ou 'convite' (entrar pelo link recebido).
  function telaPalhacos(modo, selInicial) {
    let sel = selInicial || null;
    const decks = [{ id: 'palhaco', nome: t('menu.deckPalhaco') }].concat(SS.Decks.opcoes());
    if (!decks.some(d => d.id === cfg.deck)) cfg.deck = 'palhaco';
    const notaDeck = () => (cfg.deck === 'palhaco' ? t('menu.deckTematico2') : t('menu.monteDecks'));
    modal(`<div class="menu-tema">
      <h2 class="titulo-etapa">${t('menu.escolhaPalhaco')}</h2>
      <div class="mesa-cartas${sel ? ' com-escolha' : ''}">${P.LISTA.map((pal, k) => cartaJoker(pal, sel, k)).join('')}</div>
      <div class="info-carta">${sel ? caixaInfo(sel) : `<p class="dica-carta">${t('menu.cliqueCarta')}</p>`}</div>
      <div class="opcao"><label>${t('menu.seuDeck')}</label>${grupoMenu('deck', decks.map(d => [d.id, escapar(d.nome)]))}
        <p class="nota nota-deck">${notaDeck()}</p></div>
      <div class="acoes-menu">
        <button class="btn" data-m="voltar">${t('btn.voltar')}</button>
        <button class="btn principal" data-m="confirmar"${sel ? '' : ' disabled'}>${modo === 'convite' ? t('on.entrarConvite', { c: escapar(SS.Rede.codigoDoLink() || '') }) : t('menu.confirmar')}</button>
      </div></div>`,
    ev => {
      const carta = ev.target.closest('[data-palhaco]');
      if (carta) {
        sel = carta.dataset.palhaco;
        for (const c of document.querySelectorAll('#modal .carta-joker')) c.classList.toggle('ativo', c === carta);
        $('#modal .mesa-cartas').classList.add('com-escolha');
        $('#modal .info-carta').innerHTML = caixaInfo(sel);
        $('#modal [data-m="confirmar"]').disabled = false;
        return;
      }
      const g = ev.target.closest('[data-grupo="deck"] [data-v]');
      if (g) {
        cfg.deck = g.dataset.v;
        marcarGrupo(g);
        $('#modal .nota-deck').textContent = notaDeck();
        return;
      }
      const b = ev.target.closest('[data-m]');
      if (!b || b.disabled) return;
      if (b.dataset.m === 'voltar') return telaInicio();
      if (b.dataset.m !== 'confirmar' || !sel) return;
      cfg.palhaco = sel;
      const voltar = () => telaPalhacos(modo, sel);
      if (modo === 'bot') {
        const img = $(`#modal .carta-joker[data-palhaco="${sel}"]`);
        telaVersus(img ? img.getBoundingClientRect() : null);
      } else if (modo === 'online') telaOnline(voltar);
      else entrarNaSala(SS.Rede.codigoDoLink(), voltar);
    });
  }

  // A sua carta desliza para a esquerda, aparece o VS e você escolhe contra quem vai lutar.
  function telaVersus(deOnde) {
    const meu = P.get(cfg.palhaco);
    const outros = P.LISTA.filter(x => x.id !== meu.id);
    if (cfg.rival !== 'aleatorio' && !outros.some(x => x.id === cfg.rival)) cfg.rival = 'aleatorio';
    modal(`<div class="menu-tema">
      <h2 class="titulo-etapa">${t('menu.escolhaRival')}</h2>
      <div class="versus">
        <div class="lado-eu"><div class="carta-joker grande cor-${meu.cor} ativo"><img src="${meu.carta}" alt="${meu.nome}" draggable="false"></div></div>
        <div class="vs">VS</div>
        <div class="lado-rivais mesa-cartas com-escolha">
          ${outros.map((pal, k) => cartaJoker(pal, cfg.rival, k)).join('')}
          <button class="carta-joker aleatoria${cfg.rival === 'aleatorio' ? ' ativo' : ''}" data-palhaco="aleatorio" style="--i:3" aria-label="${t('menu.surpresa')}"><span>?</span></button>
        </div>
      </div>
      <div class="info-carta">${caixaInfo(cfg.rival)}</div>
      <div class="opcao"><label>${t('menu.dificuldade')}</label>${grupoMenu('nivel', NIVEIS_BOT.map(n => [n, NOME_NIVEL[n]]))}</div>
      <div class="acoes-menu">
        <button class="btn" data-m="voltar">${t('btn.voltar')}</button>
        <button class="btn principal grande" data-m="lutar">⚔ ${t('menu.lutar')}</button>
      </div></div>`,
    ev => {
      const carta = ev.target.closest('.lado-rivais [data-palhaco]');
      if (carta) {
        cfg.rival = carta.dataset.palhaco;
        for (const c of document.querySelectorAll('#modal .lado-rivais .carta-joker')) c.classList.toggle('ativo', c === carta);
        $('#modal .info-carta').innerHTML = caixaInfo(cfg.rival);
        return;
      }
      const g = ev.target.closest('[data-grupo="nivel"] [data-v]');
      if (g) {
        cfg.nivel = g.dataset.v;
        marcarGrupo(g);
        return;
      }
      const b = ev.target.closest('[data-m]');
      if (!b) return;
      if (b.dataset.m === 'voltar') telaPalhacos('bot', cfg.palhaco);
      else if (b.dataset.m === 'lutar') iniciarPartida('bot');
    });
    // A carta escolhida "voa" de onde estava na tela anterior até a esquerda.
    const minha = $('#modal .lado-eu .carta-joker');
    if (deOnde && minha && !MOVIMENTO_REDUZIDO) {
      const r = minha.getBoundingClientRect();
      const dx = deOnde.left + deOnde.width / 2 - (r.left + r.width / 2), dy = deOnde.top + deOnde.height / 2 - (r.top + r.height / 2);
      minha.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${(deOnde.width / r.width).toFixed(3)})` },
        { transform: 'translate(0, 0) scale(1)' },
      ], { duration: 650, easing: 'cubic-bezier(.3, .8, .3, 1)' });
    }
  }

  // Quem começa (na simulação): maior dado, repetindo no empate, como na partida.
  function quemComeca() {
    let a, b;
    do {
      a = Math.random();
      b = Math.random();
    } while (Math.floor(a * 6) === Math.floor(b * 6));
    return Math.floor(a * 6) > Math.floor(b * 6) ? 0 : 1;
  }

  // ---------- Simulação em massa (teste de equilíbrio) ----------

  function simulacao(voltar) {
    const s = { n: 100, a: 'medio', b: 'medio', rodando: false, feitos: 0, r: null, id: 0 };
    const grupo = (chave, opcoes) => `<div class="grupo" data-s="${chave}">${opcoes.map(([v, r]) =>
      `<button data-v="${v}" class="${String(s[chave]) === String(v) ? 'ativo' : ''}"${s.rodando ? ' disabled' : ''}>${r}</button>`).join('')}</div>`;
    // O Profissional fica de fora da simulação: ele pensa alguns segundos por jogada (centenas de partidas travariam).
    const niveis = NIVEIS_BOT.filter(n => n !== 'profissional').map(n => [n, NOME_NIVEL[n]]);
    const pct = (x, tot) => (tot ? Math.round((100 * x) / tot) + '%' : '–');
    const resultado = () => {
      const r = s.r;
      if (!r) return '';
      const total = r.vit[0] + r.vit[1];
      const linhasPalhaco = P.LISTA.map(pal => {
        const x = r.palhacos[pal.id];
        return `<tr><td>${SIMB[pal.naipe]} ${pal.nome}</td><td>${x.vit}/${x.jogos} (${pct(x.vit, x.jogos)})</td></tr>`;
      }).join('');
      return `<table class="tabela">
        <tr><td>${t('sim.partidas')}</td><td>${s.feitos}</td></tr>
        <tr><td>${t('sim.vitBot', { b: 'A', n: NOME_NIVEL[s.a] })}</td><td>${r.vit[0]} (${pct(r.vit[0], total)})</td></tr>
        <tr><td>${t('sim.vitBot', { b: 'B', n: NOME_NIVEL[s.b] })}</td><td>${r.vit[1]} (${pct(r.vit[1], total)})</td></tr>
        <tr><td colspan="2">${t('sim.porPalhaco')}</td></tr>
        ${linhasPalhaco}
        <tr><td>${t('sim.primeiro')}</td><td>${pct(r.primeiroVenceu, total)}</td></tr>
        <tr><td>${t('sim.mediaTurnos')}</td><td>${total ? (r.turnos / total).toFixed(1) : '–'}</td></tr>
        <tr><td>${t('sim.empates')}</td><td>${r.empates}</td></tr>
        ${r.erros ? `<tr><td>${t('sim.erros')}</td><td>${r.erros}</td></tr>` : ''}
      </table>`;
    };
    const tela = () => modal(`<h2>${t('sim.titulo')}</h2>
        <p class="nota">${t('sim.nota')}</p>
        <div class="opcao"><label>${t('sim.partidas')}</label>${grupo('n', [[50, '50'], [100, '100'], [200, '200'], [500, '500']])}</div>
        <div class="opcao"><label>Bot A</label>${grupo('a', niveis)}</div>
        <div class="opcao"><label>Bot B</label>${grupo('b', niveis)}</div>
        <div id="sim-res">${s.rodando ? `<p>${t('sim.rodando')} ${s.feitos}/${s.n}</p>` : ''}${resultado()}</div>
        <div class="acoes-menu"><button class="btn principal" data-m="rodar"${s.rodando ? ' disabled' : ''}>${t('sim.rodar')}</button><button class="btn" data-m="voltar">${t('btn.voltar')}</button></div>`,
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
      s.r = { vit: [0, 0], primeiroVenceu: 0, turnos: 0, empates: 0, erros: 0, palhacos: Object.fromEntries(P.LISTA.map(x => [x.id, { vit: 0, jogos: 0 }])) };
      // Todos os confrontos entre Palhaços diferentes, em rodízio (os dois lados de cada um).
      const confrontos = [];
      for (const a of P.LISTA) for (const b of P.LISTA) if (a.id !== b.id) confrontos.push([a.id, b.id]);
      const id = ++s.id;
      const lote = () => {
        if (id !== s.id) return;
        const fim = performance.now() + 120;
        while (s.feitos < s.n && performance.now() < fim) {
          try {
            const par = confrontos[s.feitos % confrontos.length];
            const r = Bot.partidaAutomatica([s.a, s.b], quemComeca(), 200, {
              palhacos: par, decks: par.map((x, k) => M.cartasDoDeck(P.get(x).deck, k)),
            });
            if (r.vencedor == null) s.r.empates++;
            else {
              s.r.vit[r.vencedor]++;
              s.r.turnos += r.turnos;
              if (r.vencedor === r.primeiro) s.r.primeiroVenceu++;
              for (let k = 0; k < 2; k++) {
                s.r.palhacos[par[k]].jogos++;
                if (r.vencedor === k) s.r.palhacos[par[k]].vit++;
              }
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

  // Graminhas soltas pela mesa, balançando num vento leve (cada uma no seu ritmo).
  function plantarGraminhas() {
    const campo = $('#graminhas');
    if (!campo || campo.childElementCount) return;
    const sorte = (a, b) => a + Math.random() * (b - a);
    let h = '';
    for (let k = 0; k < 46; k++) {
      const s = sorte(.7, 1.25).toFixed(2), d = sorte(2.6, 4.6).toFixed(2), a = (-sorte(0, 4.6)).toFixed(2);
      const folhas = Math.random() < .5
        ? '<path d="M6 17C5 12 3 9 1 6M12 17c0-5 0-9 .5-13M18 17c1-5 3-8 5-11"/>'
        : '<path d="M7 17C6 13 4.5 10 3 8M12 17c.3-4 1-8 2.5-11M17 17c1.2-3.6 2.6-5.6 4.5-7.5"/>';
      h += `<span class="tufo" style="left:${sorte(1, 98).toFixed(1)}%;top:${sorte(2, 96).toFixed(1)}%;--s:${s};--d:${d}s;--a:${a}s"><svg viewBox="0 0 24 18">${folhas}</svg></span>`;
    }
    campo.innerHTML = h;
  }

  function ajustarEscala() {
    const app = $('#app');
    escala = Math.min(innerWidth / app.offsetWidth, innerHeight / app.offsetHeight);
    app.style.transform = `translate(-50%, -50%) scale(${escala})`;
    if (jogo) desenharSetas();
  }

  SS.Idioma.aplicarEstaticos();
  C.aplicarTexturas();
  plantarGraminhas();
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
    duelo: (foto, total, linhas) => { mostrarDuelo(foto, total, linhas || null); if (linhas) animarPV(); },
    fila: ligar => { ui.mostrarFila = !!ligar; render(); },
    combate: () => fluxoCombate(partida),
  };
})(window.SS);
