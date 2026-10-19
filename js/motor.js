/* Motor de regras de "Senhora e Senhores" (Regras v2).
   Não conhece a interface: recebe ações e altera o estado do jogo.
   O estado é um objeto simples (clonável), o que permite ao bot simular jogadas
   e, no futuro, rodar o mesmo motor num servidor multiplayer. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';

  const NAIPES = ['copas', 'ouros', 'paus', 'espadas'];
  const SIMBOLO = { copas: '♥', ouros: '♦', paus: '♣', espadas: '♠' };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  // Textos no idioma escolhido (idioma.js); sem ele, devolve a própria chave.
  const t = (k, p) => (SS.Idioma ? SS.Idioma.t(k, p) : k);
  const LIMITE_FIGURA = { J: 5, Q: 10, K: 7 };
  const PV_INICIAL = 20; // não há máximo: Copas pode curar acima disso
  const ESPACOS = 8;
  const ACOES_POR_TURNO = 3;
  const CUSTO_RAINHA = 1; // ações passivas para sumonar uma Rainha
  const SACRIFICIOS_RAINHA = 2; // Senhores sacrificados para a Rainha entrar
  const DADO_ATAQUE_TOTAL = 4; // dado a partir do qual o ataque sai cheio (abaixo disso, metade)
  const LIMITE_MAO = 7;
  const DANO_BARALHO_VAZIO = 2;

  // Palhaços: o "herói" de cada jogador. Os textos e decks ficam em palhacos.js.
  // dadosPrimeiro/ataquePrimeiro: bônus do 1º ataque do turno (Lançalotte);
  // reducaoDefesa: dano a menos em quem defende; soPaus: só Senhores com carta de Paus (Paumol).
  // Valores calibrados com o simulador.
  // Compra do turno: 1 carta do baralho que o jogador escolher; o Ourinhos (compraDupla) compra sozinho 1 Letra + 1 Número.
  const PALHACOS = {
    lancalotte: { naipe: 'espadas', pv: 19, limiteMao: 7, poder: 'desafio', dadosPrimeiro: 1, ataquePrimeiro: 1 },
    infartitte: { naipe: 'copas', pv: 24, limiteMao: 7, poder: 'transfusao', curaExtra: 1 },
    paumol: { naipe: 'paus', pv: 22, limiteMao: 7, poder: 'vigilia', reducaoDefesa: 2, soPaus: false },
    ourinhos: { naipe: 'ouros', pv: 12, limiteMao: 6, poder: 'roubo', compraDupla: true }, // rouba 1 carta da mão do oponente
  };
  const SENHORES_POR_TURNO = 1; // Senhores que dá para sumonar por turno (a Rainha conta)
  const ASES_POR_TURNO = 1; // Ases (totens) que dá para invocar por turno
  const REDUCAO_POR_DEFENSOR = 1; // bloqueio em grupo: cada defensor a mais tira isso do ataque do atacante
  const CUSTO_TRANSFUSAO = 2; // PV pagos pela Transfusão do Infartitte para tirar 1 hit de um aliado
  const CUSTO_SANGRIA = 4; // PV pagos pela Transfusão para dar 1 hit num Senhor(a) inimigo
  const CUSTO_COBRANCA = 2; // PV pagos pelo Ourinhos para roubar 1 carta (Cobrança)
  const palhacoDe = j => (j && PALHACOS[j.palhaco]) || null;
  const temPalhaco = (j, id) => !!j && j.palhaco === id;
  const limiteMao = j => (palhacoDe(j) ? palhacoDe(j).limiteMao : LIMITE_MAO);

  let rng = Math.random;

  const ehFigura = c => c.rank === 'J' || c.rank === 'Q' || c.rank === 'K';
  const ehAs = c => c.rank === 'A';
  const ehNumero = c => !ehFigura(c) && !ehAs(c);
  const valor = c => (ehAs(c) ? 1 : parseInt(c.rank, 10));
  const nomeCarta = c => (['A', 'J', 'Q', 'K'].includes(c.rank) ? t('carta.' + c.rank) + ' ' : c.rank) + SIMBOLO[c.naipe];
  const nomeNaipe = n => t('naipe.' + n);
  const curaDe = c => (valor(c) <= 3 ? 1 : valor(c) <= 7 ? 2 : 3);
  // Cura de uma carta de Copas para este jogador (Infartitte, Coração forte: +1).
  const curaPara = (j, c) => curaDe(c) + (j && j.palhaco === 'infartitte' ? PALHACOS.infartitte.curaExtra : 0);

  function nomeUnidade(u) {
    if (u.tipo === 'as') return nomeCarta(u.carta);
    return `${nomeCarta(u.figura)} (${u.numero.rank}${SIMBOLO[u.numero.naipe]})`;
  }

  function embaralhar(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function baralhoPadrao(dono) {
    const cartas = [];
    for (const naipe of NAIPES) for (const rank of RANKS) cartas.push({ id: `${dono}-${rank}-${naipe}`, rank, naipe });
    return cartas;
  }

  // ---------- Criação e abertura ----------

  // Cada jogador tem 2 baralhos: Letras (J, Q, K) e Números (Ás a 10).
  const BARALHOS = ['letras', 'numeros'];
  const NOME_BARALHO = Object.defineProperties({}, {
    letras: { get: () => t('baralho.letras'), enumerable: true },
    numeros: { get: () => t('baralho.numeros'), enumerable: true },
  });
  const outroBaralho = b => (b === 'letras' ? 'numeros' : 'letras');

  function criarJogo(opcoes) {
    const o = opcoes || {};
    const nomes = o.nomes || ['Jogador', 'Oponente'];
    const primeiro = o.primeiro || 0;
    return {
      jogadores: [0, 1].map(i => {
        const cartas = o.decks && o.decks[i] ? o.decks[i].slice() : baralhoPadrao(i);
        const palhaco = o.palhacos && PALHACOS[o.palhacos[i]] ? o.palhacos[i] : null;
        return {
          nome: nomes[i],
          palhaco,
          pv: palhaco ? PALHACOS[palhaco].pv : PV_INICIAL,
          letras: embaralhar(cartas.filter(ehFigura)),
          numeros: embaralhar(cartas.filter(c => !ehFigura(c))),
          mao: [],
          cemiterio: [],
          campo: new Array(ESPACOS).fill(null),
          feridas: {}, // uid do Naipado de Copas inimigo -> PV máximo até onde dá para curar
          tokens: 0, // Ouros extras do Ás de Ouros neste turno
          abertura: { figuras: [], mulligan: false, pronto: false },
        };
      }),
      primeiro,
      vez: primeiro,
      turno: 0,
      fase: 'abertura',
      acoes: 0,
      compras: 0, // compras que faltam na fase de compra deste turno
      poderUsado: false, // poder do Palhaço já usado neste turno
      sumonados: 0, // Senhores sumonados neste turno
      asesTurno: 0, // Ases invocados neste turno
      desafio: null, // uid do Senhor inimigo desafiado pelo Lançalotte neste turno
      combate: null,
      vencedor: null,
      proximoUid: 1,
      log: [],
    };
  }

  function registrar(e, msg) {
    e.log.push(msg);
    if (e.log.length > 400) e.log.shift();
  }

  const figurasNoBaralho = (e, p) => e.jogadores[p].letras.slice();

  // Abertura: 3 figuras à escolha do baralho de Letras + 4 cartas do baralho de Números.
  function escolherFiguras(e, p, ids) {
    const j = e.jogadores[p];
    if (e.fase !== 'abertura' || j.abertura.figuras.length) throw new Error('Figuras já escolhidas');
    const qtd = Math.min(3, j.letras.length);
    if (ids.length !== qtd) throw new Error(`Escolha ${qtd} figuras`);
    for (const id of ids) {
      const k = j.letras.findIndex(c => c.id === id);
      if (k < 0) throw new Error('Figura inválida: ' + id);
      j.mao.push(j.letras.splice(k, 1)[0]);
    }
    j.abertura.figuras = ids.slice();
    embaralhar(j.letras);
    comprar(e, p, 4, 'numeros');
  }

  function mulligan(e, p) {
    const j = e.jogadores[p];
    if (j.abertura.mulligan || j.abertura.pronto) throw new Error('Mulligan indisponível');
    const devolver = j.mao.filter(c => !j.abertura.figuras.includes(c.id));
    j.mao = j.mao.filter(c => j.abertura.figuras.includes(c.id));
    j.numeros.push(...devolver);
    embaralhar(j.numeros);
    comprar(e, p, 3, 'numeros');
    j.abertura.mulligan = true;
    registrar(e, t('log.mulligan', { j: j.nome }));
    confirmarAbertura(e, p);
  }

  function confirmarAbertura(e, p) {
    e.jogadores[p].abertura.pronto = true;
    if (e.jogadores.every(j => j.abertura.pronto)) iniciarTurno(e);
  }

  // ---------- Utilidades de estado ----------

  function tirarDaMao(j, id) {
    const k = j.mao.findIndex(c => c.id === id);
    if (k < 0) throw new Error('Carta não está na mão: ' + id);
    return j.mao.splice(k, 1)[0];
  }

  function perderPV(e, p, n) {
    const j = e.jogadores[p];
    const perdido = Math.min(n, j.pv);
    j.pv -= perdido;
    if (j.pv <= 0 && e.vencedor == null) {
      e.vencedor = 1 - p;
      e.fase = 'fim';
      registrar(e, t('log.venceu', { j: e.jogadores[1 - p].nome }));
    }
    return perdido;
  }

  // Sem feridas, a cura não tem limite. Com ferida de Copas, não dá para curar
  // acima do PV que sobrou depois do golpe, enquanto o Naipado de Copas viver.
  function tetoCura(j) {
    let t = Infinity;
    for (const k in j.feridas) t = Math.min(t, j.feridas[k]);
    return t;
  }

  function curar(e, p, n) {
    const j = e.jogadores[p];
    const antes = j.pv;
    j.pv = Math.max(j.pv, Math.min(j.pv + n, tetoCura(j)));
    return j.pv - antes;
  }

  // Compra do baralho escolhido; se ele estiver vazio, compra do outro.
  // Sem cartas nos dois, perde 2 PV por compra.
  function comprar(e, p, n, origem) {
    const j = e.jogadores[p];
    for (let k = 0; k < n; k++) {
      const pilha = j[origem].length ? j[origem] : j[outroBaralho(origem)];
      if (!pilha.length) {
        registrar(e, t('log.semCartas', { j: j.nome, n: DANO_BARALHO_VAZIO }));
        perderPV(e, p, DANO_BARALHO_VAZIO);
        if (e.vencedor != null) return;
      } else j.mao.push(pilha.pop());
    }
  }

  // Baralhos que podem ser escolhidos para comprar (se os dois estiverem vazios, qualquer um).
  function baralhosDisponiveis(e, p) {
    const j = e.jogadores[p];
    const r = BARALHOS.filter(b => j[b].length);
    return r.length ? r : ['numeros'];
  }

  function localizar(e, uid) {
    for (let p = 0; p < 2; p++) {
      const campo = e.jogadores[p].campo;
      for (let i = 0; i < ESPACOS; i++) if (campo[i] && campo[i].uid === uid) return { p, i, u: campo[i] };
    }
    return null;
  }

  function asesVizinhos(e, p, i) {
    const campo = e.jogadores[p].campo;
    const r = [];
    for (const k of [i - 1, i + 1]) if (k >= 0 && k < ESPACOS && campo[k] && campo[k].tipo === 'as') r.push(campo[k].naipe);
    return r;
  }

  const naipado = u => (u.tipo === 'senhor' && u.figura.naipe === u.numero.naipe ? u.figura.naipe : null);

  // Ataque sem o bônus temporário de Espadas.
  function ataqueBase(e, p, i) {
    const u = e.jogadores[p].campo[i];
    let a = valor(u.numero);
    if (naipado(u) === 'espadas') a++;
    if (asesVizinhos(e, p, i).includes('espadas')) a++;
    return a;
  }

  const ataque = (e, p, i) => ataqueBase(e, p, i) + e.jogadores[p].campo[i].bonus.length;

  // Quantos hits matam esta unidade.
  function resistencia(e, p, i) {
    const u = e.jogadores[p].campo[i];
    if (u.tipo === 'as') return 1;
    let r = 2;
    if (naipado(u) === 'paus') r++;
    if (asesVizinhos(e, p, i).includes('paus')) r++;
    return r;
  }

  function postura(e, p, i) {
    const u = e.jogadores[p].campo[i];
    if (u.tipo === 'as' || u.berserk || u.hits === 0) return 'vertical';
    return u.hits >= resistencia(e, p, i) - 1 ? 'horizontal' : 'diagonal';
  }

  function podeAtacar(e, p, i) {
    const u = e.jogadores[p].campo[i];
    return !!u && u.tipo === 'senhor' && e.vez === p && e.turno > 1 && u.ativo && u.ataques > 0 &&
      (u.entrou < e.turno || u.figura.rank === 'J');
  }

  // ---------- Morte e dano ----------

  function morrer(e, p, i, motivo) {
    const j = e.jogadores[p];
    const u = j.campo[i];
    if (!u) return;
    j.campo[i] = null;
    if (u.tipo === 'as') j.cemiterio.push(u.carta);
    else {
      j.cemiterio.push(u.figura, u.numero);
      delete e.jogadores[1 - p].feridas[u.uid];
    }
    registrar(e, t('log.morreu', { u: nomeUnidade(u), j: j.nome, m: motivo ? t('mot.' + motivo) : '' }));
    verificarMortes(e);
  }

  // Ex.: se um Ás de Paus morre, o vizinho pode perder a resistência extra.
  function verificarMortes(e) {
    for (let p = 0; p < 2; p++) {
      for (let i = 0; i < ESPACOS; i++) {
        const u = e.jogadores[p].campo[i];
        if (u && u.tipo === 'senhor' && !u.berserk && u.hits >= resistencia(e, p, i)) {
          morrer(e, p, i, 'resistencia');
          return;
        }
      }
    }
  }

  function aplicarHit(e, p, i) {
    const u = e.jogadores[p].campo[i];
    if (u.tipo === 'as') return morrer(e, p, i, 'golpeado');
    if (u.berserk) {
      u.berserk.hits++;
      registrar(e, t('log.hitBerserk', { u: nomeUnidade(u) }));
      if (u.berserk.hits >= 2) morrer(e, p, i, 'berserk');
      return;
    }
    u.hits++;
    if (u.hits >= resistencia(e, p, i)) morrer(e, p, i, 'hits');
    else registrar(e, t('log.hit', { u: nomeUnidade(u) }));
  }

  function danoAoJogador(e, p, locA, dano) {
    if (dano <= 0) return;
    const d = 1 - p, D = e.jogadores[d];
    const perdido = Math.min(dano, D.pv);
    registrar(e, t('log.perdeuPV', { j: D.nome, n: perdido }));
    perderPV(e, d, dano);
    if (e.vencedor != null || !locA) return;
    const u = locA.u;
    if (naipado(u) === 'copas' && perdido > 0) {
      D.feridas[u.uid] = Math.min(D.feridas[u.uid] == null ? Infinity : D.feridas[u.uid], D.pv);
      registrar(e, t('log.ferida', { j: D.nome, n: D.feridas[u.uid], u: nomeUnidade(u) }));
    }
    if (asesVizinhos(e, p, locA.i).includes('copas')) {
      const c = curar(e, p, 1);
      if (c) registrar(e, t('log.vampiro', { j: e.jogadores[p].nome }));
    }
  }

  // ---------- Turno ----------

  function iniciarTurno(e) {
    e.turno++;
    const p = e.vez, j = e.jogadores[p];
    e.fase = 'principal';
    e.acoes = ACOES_POR_TURNO;
    e.combate = null;
    e.poderUsado = false;
    e.sumonados = 0;
    e.asesTurno = 0;
    e.desafio = null;
    j.tokens = 0;
    for (const u of j.campo) {
      if (!u) continue;
      if (u.tipo === 'senhor') {
        u.ativo = true;
        u.atacou = false;
        u.vigilia = false;
        u.ataques = naipado(u) === 'ouros' ? 2 : 1;
      } else if (u.naipe === 'ouros') j.tokens++;
    }
    registrar(e, t('log.turno', { n: e.turno, j: j.nome }));
    e.compras = 1;
    if (e.turno === 1) registrar(e, t('log.primeiroTurno', { j: j.nome }));
    else if (palhacoDe(j) && palhacoDe(j).compraDupla) {
      // Ourinhos (Juros compostos): compra sozinho 1 Letra e 1 Número, sem escolher (baralho vazio: vem do outro).
      comprar(e, p, 1, 'letras');
      if (e.vencedor == null) comprar(e, p, 1, 'numeros');
      registrar(e, t('log.juros', { j: j.nome }));
    } else if (!j.letras.length && !j.numeros.length) comprar(e, p, e.compras, 'numeros'); // sem cartas: perde PV
    else e.fase = 'compra'; // o jogador escolhe de qual baralho comprar
  }

  function comprarDoTurno(e, origem) {
    if (e.fase !== 'compra') throw new Error('Fora da fase de compra');
    const j = e.jogadores[e.vez];
    if (!BARALHOS.includes(origem) || !j[origem].length) throw new Error('Baralho vazio ou inválido');
    comprar(e, e.vez, 1, origem);
    registrar(e, t('log.comprou', { j: j.nome, b: NOME_BARALHO[origem] }));
    e.compras--;
    if (e.vencedor != null) return;
    if (e.compras <= 0) e.fase = 'principal';
    else if (!j.letras.length && !j.numeros.length) {
      comprar(e, e.vez, e.compras, 'numeros');
      if (e.vencedor == null) e.fase = 'principal';
    }
  }

  function ourosDisponiveis(e, p) {
    const j = e.jogadores[p];
    const r = j.mao.filter(c => ehNumero(c) && c.naipe === 'ouros').map(c => c.id);
    for (let t = 0; t < j.tokens; t++) r.push('TOKEN');
    return r;
  }

  function gastarOuros(e, p, id) {
    const j = e.jogadores[p];
    if (id === 'TOKEN') {
      if (j.tokens <= 0) throw new Error('Sem Ouros extra do Ás');
      j.tokens--;
    } else {
      const c = tirarDaMao(j, id);
      if (c.naipe !== 'ouros' || !ehNumero(c)) throw new Error('Não é Ouros: ' + id);
      j.cemiterio.push(c);
    }
  }

  function acoesLegais(e) {
    const r = [];
    if (e.fase !== 'principal' || e.vencedor != null) return r;
    r.push({ tipo: 'atacar' }); // encerra as ações passivas e vai para o ataque
    if (e.acoes <= 0) return r;
    const p = e.vez, j = e.jogadores[p];
    const figuras = j.mao.filter(ehFigura), numeros = j.mao.filter(ehNumero), ases = j.mao.filter(ehAs);
    const vazios = [], senhores = [];
    j.campo.forEach((u, i) => {
      if (!u) vazios.push(i);
      else if (u.tipo === 'senhor') senhores.push(i);
    });

    // Só 1 Senhor(a) por turno (a Rainha conta) e só 1 Ás.
    const podeSumonar = e.sumonados < SENHORES_POR_TURNO, podeAs = e.asesTurno < ASES_POR_TURNO;
    for (const f of podeSumonar ? figuras : []) {
      for (const n of numeros) {
        if (valor(n) > LIMITE_FIGURA[f.rank]) continue;
        if (f.rank === 'Q') {
          // A Rainha sacrifica 2 Senhores seus que já estavam em campo antes deste turno.
          if (e.acoes < CUSTO_RAINHA) continue;
          const aptos = senhores.filter(s => j.campo[s].entrou < e.turno);
          for (let x = 0; x < aptos.length; x++) {
            for (let y = x + 1; y < aptos.length; y++) {
              const sa = aptos[x], sb = aptos[y];
              for (const slot of vazios.concat([sa, sb])) {
                r.push({ tipo: 'sumonar', figura: f.id, numero: n.id, sacrificio: j.campo[sa].uid, sacrificio2: j.campo[sb].uid, slot });
              }
            }
          }
        } else for (const slot of vazios) r.push({ tipo: 'sumonar', figura: f.id, numero: n.id, sacrificio: null, slot });
      }
    }
    // O Ás pode entrar num espaço ocupado: empurra as cartas para o lado (se houver espaço vazio).
    const espacosAs = vazios.length ? [...Array(ESPACOS).keys()] : [];
    for (const a of podeAs ? ases : []) {
      for (const c of numeros) {
        if (c.naipe === a.naipe) for (const slot of espacosAs) r.push({ tipo: 'invocarAs', as: a.id, custo: c.id, slot });
      }
    }
    // Poder do Palhaço (1 ação, 1 vez por turno).
    const pal = palhacoDe(j);
    if (pal && pal.poder && !e.poderUsado) {
      if (pal.poder === 'desafio') {
        for (const u of e.jogadores[1 - p].campo) if (u && u.tipo === 'senhor' && u.ativo) r.push({ tipo: 'poder', alvo: u.uid });
      } else if (pal.poder === 'transfusao') {
        if (j.pv > CUSTO_TRANSFUSAO) for (const s of senhores) if (j.campo[s].hits > 0 && !j.campo[s].berserk) r.push({ tipo: 'poder', alvo: j.campo[s].uid });
        // Também ofensiva: paga mais PV para dar 1 hit num Senhor(a) inimigo.
        if (j.pv > CUSTO_SANGRIA) for (const u of e.jogadores[1 - p].campo) if (u && u.tipo === 'senhor') r.push({ tipo: 'poder', alvo: u.uid });
      } else if (pal.poder === 'vigilia') {
        for (const s of senhores) if (!j.campo[s].vigilia) r.push({ tipo: 'poder', alvo: j.campo[s].uid });
      } else if (pal.poder === 'roubo') {
        if (e.jogadores[1 - p].mao.length && j.pv > CUSTO_COBRANCA) r.push({ tipo: 'poder' }); // a carta é sorteada: não há alvo
      }
    }
    const teto = tetoCura(j);
    for (const c of numeros) {
      if (c.naipe === 'copas' && j.pv < teto) r.push({ tipo: 'curar', carta: c.id });
      if (c.naipe === 'espadas') for (const s of senhores) r.push({ tipo: 'espadas', carta: c.id, alvo: j.campo[s].uid });
      if (c.naipe === 'paus') {
        for (const s of senhores) {
          const u = j.campo[s];
          if (u.hits > 0 && !u.berserk) r.push({ tipo: 'paus', carta: c.id, alvo: u.uid });
        }
      }
    }
    const ouros = ourosDisponiveis(e, p);
    const fontes = baralhosDisponiveis(e, p);
    for (const o of new Set(ouros)) for (const b of fontes) r.push({ tipo: 'comprar', carta: o, baralho: b });
    if (j.cemiterio.length && ouros.length >= 2) {
      const pares = new Map();
      for (let a = 0; a < ouros.length; a++) {
        for (let b = a + 1; b < ouros.length; b++) {
          const par = [ouros[a], ouros[b]].sort();
          pares.set(par.join('|'), par);
        }
      }
      const escolhas = [...new Set(j.cemiterio.map(c => c.id))];
      for (const par of pares.values()) for (const id of escolhas) r.push({ tipo: 'reviver', cartas: par, escolha: id });
    }
    return r;
  }

  function aplicarAcao(e, a) {
    if (e.fase !== 'principal') throw new Error('Fora da fase principal');
    if (a.tipo === 'atacar') {
      e.fase = 'ataque';
      return;
    }
    if (e.acoes <= 0) throw new Error('Sem ações neste turno');
    const p = e.vez, j = e.jogadores[p];
    let custo = 1;
    switch (a.tipo) {
      case 'sumonar': {
        const f0 = j.mao.find(c => c.id === a.figura), n0 = j.mao.find(c => c.id === a.numero);
        if (!f0 || !n0 || !ehFigura(f0) || !ehNumero(n0) || valor(n0) > LIMITE_FIGURA[f0.rank]) throw new Error('Sumonar inválido');
        if (e.sumonados >= SENHORES_POR_TURNO) throw new Error('Só 1 Senhor(a) por turno');
        e.sumonados++;
        if (f0.rank === 'Q') {
          if (a.sacrificio == null || a.sacrificio2 == null || a.sacrificio === a.sacrificio2) throw new Error(`A Rainha exige ${SACRIFICIOS_RAINHA} sacrifícios`);
          if (e.acoes < CUSTO_RAINHA) throw new Error(`A Rainha custa ${CUSTO_RAINHA} ação`);
          custo = CUSTO_RAINHA;
          const sacs = [a.sacrificio, a.sacrificio2].map(uid => localizar(e, uid));
          for (const s of sacs) {
            if (!s || s.p !== p || s.u.tipo !== 'senhor') throw new Error('Sacrifício inválido');
            if (s.u.entrou >= e.turno) throw new Error('Não pode sacrificar quem entrou neste turno');
          }
          registrar(e, t('log.sacrifica', { j: j.nome, us: sacs.map(s => nomeUnidade(s.u)).join(` ${t('e')} `) }));
          for (const uid of [a.sacrificio, a.sacrificio2]) {
            const s = localizar(e, uid);
            if (s) morrer(e, s.p, s.i, 'sacrificio');
          }
        }
        if (j.campo[a.slot]) throw new Error('Espaço ocupado');
        const f = tirarDaMao(j, a.figura), n = tirarDaMao(j, a.numero);
        const u = {
          uid: e.proximoUid++, tipo: 'senhor', figura: f, numero: n, hits: 0, ativo: true, atacou: false,
          ataques: f.naipe === n.naipe && f.naipe === 'ouros' ? 2 : 1, entrou: e.turno, bonus: [], berserk: null,
        };
        j.campo[a.slot] = u;
        const nai = naipado(u);
        registrar(e, t('log.sumonou', { j: j.nome, u: nomeUnidade(u), a: ataque(e, p, a.slot), nai: nai ? nomeNaipe(nai) : '' }));
        break;
      }
      case 'invocarAs': {
        if (!j.campo.includes(null)) throw new Error('Fileira cheia');
        if (e.asesTurno >= ASES_POR_TURNO) throw new Error('Só 1 Ás por turno');
        e.asesTurno++;
        const as = tirarDaMao(j, a.as), custo = tirarDaMao(j, a.custo);
        if (!ehAs(as) || !ehNumero(custo) || custo.naipe !== as.naipe) throw new Error('Invocação de Ás inválida');
        j.cemiterio.push(custo);
        const empurrou = inserirNoCampo(j, a.slot, { uid: e.proximoUid++, tipo: 'as', carta: as, naipe: as.naipe });
        if (as.naipe === 'ouros') j.tokens++;
        registrar(e, t('log.invocouAs', { j: j.nome, as: nomeCarta(as), c: nomeCarta(custo), emp: empurrou }));
        verificarMortes(e); // os vizinhos mudaram: a resistência de alguém pode ter mudado
        break;
      }
      case 'poder': {
        const pal = palhacoDe(j);
        if (!pal || !pal.poder || e.poderUsado) throw new Error('Poder indisponível');
        if (pal.poder === 'roubo') {
          // Ourinhos (Cobrança): pega 1 carta sorteada da mão do oponente.
          const op = e.jogadores[1 - p];
          if (!op.mao.length) throw new Error('O oponente está sem cartas na mão');
          if (j.pv <= CUSTO_COBRANCA) throw new Error('PV insuficiente');
          j.pv -= CUSTO_COBRANCA;
          const c = op.mao.splice(Math.floor(rng() * op.mao.length), 1)[0];
          j.mao.push(c);
          registrar(e, t('log.roubo', { j: j.nome, o: op.nome, c: nomeCarta(c), n: CUSTO_COBRANCA }));
          e.poderUsado = true;
          break;
        }
        const alvo = localizar(e, a.alvo);
        if (!alvo || alvo.u.tipo !== 'senhor') throw new Error('Alvo inválido');
        if (pal.poder === 'desafio') {
          if (alvo.p === p || !alvo.u.ativo) throw new Error('Desafie um Senhor(a) inimigo ativo');
          e.desafio = alvo.u.uid;
          registrar(e, t('log.desafio', { j: j.nome, u: nomeUnidade(alvo.u) }));
        } else if (pal.poder === 'transfusao' && alvo.p !== p) {
          // Sangria: paga PV e dá 1 hit num Senhor(a) inimigo.
          if (j.pv <= CUSTO_SANGRIA) throw new Error('PV insuficiente');
          j.pv -= CUSTO_SANGRIA;
          registrar(e, t('log.sangria', { j: j.nome, n: CUSTO_SANGRIA, u: nomeUnidade(alvo.u) }));
          aplicarHit(e, alvo.p, alvo.i);
        } else if (pal.poder === 'transfusao') {
          if (alvo.u.hits <= 0 || alvo.u.berserk || j.pv <= CUSTO_TRANSFUSAO) throw new Error('Transfusão inválida');
          j.pv -= CUSTO_TRANSFUSAO;
          alvo.u.hits--;
          registrar(e, t('log.transfusao', { j: j.nome, n: CUSTO_TRANSFUSAO, u: nomeUnidade(alvo.u) }));
        } else if (pal.poder === 'vigilia') {
          if (alvo.p !== p) throw new Error('Escolha um Senhor(a) seu');
          alvo.u.vigilia = true;
          registrar(e, t('log.vigilia', { j: j.nome, u: nomeUnidade(alvo.u) }));
        }
        e.poderUsado = true;
        break;
      }
      case 'curar': {
        const c = tirarDaMao(j, a.carta);
        const qtd = curar(e, p, curaPara(j, c));
        j.cemiterio.push(c);
        registrar(e, t('log.curou', { j: j.nome, c: nomeCarta(c), n: qtd }));
        break;
      }
      case 'espadas': {
        const alvo = localizar(e, a.alvo);
        if (!alvo || alvo.p !== p || alvo.u.tipo !== 'senhor') throw new Error('Alvo inválido');
        const c = tirarDaMao(j, a.carta);
        alvo.u.bonus.push(valor(c));
        j.cemiterio.push(c);
        registrar(e, t('log.espadas', { j: j.nome, c: nomeCarta(c), u: nomeUnidade(alvo.u), n: Math.floor(valor(c) / 2) }));
        break;
      }
      case 'paus': {
        const alvo = localizar(e, a.alvo);
        if (!alvo || alvo.p !== p || alvo.u.tipo !== 'senhor' || alvo.u.hits === 0 || alvo.u.berserk) throw new Error('Alvo inválido');
        const c = tirarDaMao(j, a.carta);
        alvo.u.berserk = { hits: 0, expira: e.turno + 1 };
        j.cemiterio.push(c);
        registrar(e, t('log.paus', { j: j.nome, c: nomeCarta(c), u: nomeUnidade(alvo.u) }));
        break;
      }
      case 'comprar': {
        gastarOuros(e, p, a.carta);
        registrar(e, t('log.ourosCompra', { j: j.nome, b: NOME_BARALHO[a.baralho] }));
        comprar(e, p, 1, a.baralho);
        break;
      }
      case 'reviver': {
        const k = j.cemiterio.findIndex(c => c.id === a.escolha);
        if (k < 0) throw new Error('Carta não está no cemitério');
        const carta = j.cemiterio.splice(k, 1)[0];
        for (const o of a.cartas) gastarOuros(e, p, o);
        j.mao.push(carta);
        registrar(e, t('log.reviver', { j: j.nome, c: nomeCarta(carta) }));
        break;
      }
      default:
        throw new Error('Ação desconhecida: ' + a.tipo);
    }
    e.acoes -= custo;
  }

  // Coloca a unidade no espaço i. Se estiver ocupado, empurra as cartas na direção
  // do espaço vazio mais próximo (empate: para a direita). Devolve true se empurrou.
  function inserirNoCampo(j, i, unidade) {
    const campo = j.campo;
    if (!campo[i]) {
      campo[i] = unidade;
      return false;
    }
    let dir = -1, esq = -1;
    for (let k = i + 1; k < ESPACOS; k++) if (!campo[k]) { dir = k; break; }
    for (let k = i - 1; k >= 0; k--) if (!campo[k]) { esq = k; break; }
    if (dir < 0 && esq < 0) throw new Error('Fileira cheia');
    if (dir >= 0 && (esq < 0 || dir - i <= i - esq)) {
      for (let k = dir; k > i; k--) campo[k] = campo[k - 1];
    } else {
      for (let k = esq; k < i; k++) campo[k] = campo[k + 1];
    }
    campo[i] = unidade;
    return true;
  }

  // ---------- Combate ----------

  function atacantesAptos(e) {
    const p = e.vez, r = [];
    e.jogadores[p].campo.forEach((u, i) => { if (podeAtacar(e, p, i)) r.push(u.uid); });
    return r;
  }

  // Alvos de um atacante: o jogador e os Ases inimigos. O Rei também pode mirar um Senhor(a) inimigo.
  function alvosPossiveis(e, atacante) {
    const r = ['jogador'];
    const loc = atacante != null ? localizar(e, atacante) : null;
    const rei = !!loc && loc.u.tipo === 'senhor' && loc.u.figura.rank === 'K';
    for (const u of e.jogadores[1 - e.vez].campo) {
      if (!u) continue;
      if (u.tipo === 'as' || rei) r.push(u.uid);
    }
    return r;
  }

  // Ataque do Rei contra um Senhor(a): o alvo é obrigado a defender, e outros Senhores
  // ativos do mesmo dono podem entrar junto para ajudar (como num bloqueio duplo).
  function ataqueDirecionado(e, at) {
    if (at.alvo === 'jogador') return false;
    const l = localizar(e, at.alvo);
    return !!l && l.u.tipo === 'senhor';
  }

  const capacidadeBloqueio = () => 1;

  function bloqueadoresAptos(e) {
    const r = [];
    for (const u of e.jogadores[1 - e.vez].campo) if (u && u.tipo === 'senhor' && u.ativo) r.push(u.uid);
    return r;
  }

  // lista: [{ atacante: uid, alvo: 'jogador' | uid de Ás, ouros: [ids de Ouros ou 'TOKEN'] }]
  function declararAtaques(e, lista) {
    if (e.fase !== 'ataque') throw new Error('Fora da fase de ataque');
    const p = e.vez, j = e.jogadores[p];
    const contagem = {};
    const ourosLivres = ourosDisponiveis(e, p);
    for (const d of lista) {
      const loc = localizar(e, d.atacante);
      if (!loc || loc.p !== p || !podeAtacar(e, p, loc.i)) throw new Error('Atacante inválido');
      contagem[d.atacante] = (contagem[d.atacante] || 0) + 1;
      if (contagem[d.atacante] > loc.u.ataques) throw new Error('Ataques demais para este Senhor(a)');
      if (!alvosPossiveis(e, d.atacante).includes(d.alvo)) throw new Error('Alvo inválido');
      for (const o of d.ouros || []) {
        const k = ourosLivres.indexOf(o);
        if (k < 0) throw new Error('Ouros indisponível');
        ourosLivres.splice(k, 1);
      }
    }
    const ataques = [];
    lista.forEach((d, k) => {
      const extras = d.ouros || [];
      for (const o of extras) gastarOuros(e, p, o);
      // Lançalotte (Golpe certeiro): o 1º ataque do turno ganha dado (e ataque) extra.
      const golpe = k === 0 && temPalhaco(j, 'lancalotte') ? PALHACOS.lancalotte : null;
      ataques.push({
        n: k + 1, atacante: d.atacante, alvo: d.alvo, dados: 1 + extras.length + (golpe ? golpe.dadosPrimeiro : 0),
        bonusAtaque: golpe ? golpe.ataquePrimeiro : 0, bloqueadores: [], resultado: null,
      });
    });
    // Quem atacou só vira para baixo (desativa) no fim do turno.
    for (const uid of Object.keys(contagem)) {
      const u = localizar(e, Number(uid)).u;
      u.ataques = 0;
      u.atacou = true;
    }
    if (!ataques.length) {
      e.combate = null;
      e.fase = 'fimCombate';
      registrar(e, t('log.naoAtacou', { j: j.nome }));
      return;
    }
    e.combate = { ataques, indice: 0 };
    e.fase = 'bloqueio';
    for (const at of ataques) {
      const loc = localizar(e, at.atacante);
      const alvo = at.alvo === 'jogador' ? e.jogadores[1 - p].nome : nomeUnidade(localizar(e, at.alvo).u);
      registrar(e, t('log.declara', { n: at.n, u: nomeUnidade(loc.u), alvo, d: at.dados }));
    }
  }

  // mapa: { [número do ataque]: [uids dos bloqueadores] }
  function definirBloqueios(e, mapa) {
    if (e.fase !== 'bloqueio') throw new Error('Fora da fase de bloqueio');
    const d = 1 - e.vez, uso = {};
    mapa = Object.assign({}, mapa);
    // Desafio! do Lançalotte: o Senhor(a) desafiado(a) bloqueia o primeiro ataque que dá para bloquear.
    const desafiado = e.desafio != null ? localizar(e, e.desafio) : null;
    if (desafiado && desafiado.p === d && desafiado.u.ativo) {
      const primeiro = e.combate.ataques.find(at => !(ataqueDirecionado(e, at) && at.alvo === e.desafio));
      if (primeiro) {
        for (const n in mapa) mapa[n] = (mapa[n] || []).filter(uid => uid !== e.desafio);
        mapa[primeiro.n] = [e.desafio].concat(mapa[primeiro.n] || []);
        registrar(e, t('log.desafioBloqueio', { u: nomeUnidade(desafiado.u), n: primeiro.n }));
      }
    }
    for (const at of e.combate.ataques) {
      // No ataque do Rei a um Senhor(a), o alvo já defende: a lista são só os ajudantes.
      const lista = (mapa[at.n] || []).filter(uid => !(ataqueDirecionado(e, at) && uid === at.alvo));
      for (const uid of lista) {
        const loc = localizar(e, uid);
        if (!loc || loc.p !== d || loc.u.tipo !== 'senhor' || !loc.u.ativo) throw new Error('Bloqueador inválido');
        uso[uid] = (uso[uid] || 0) + 1;
        if (uso[uid] > capacidadeBloqueio(loc.u)) throw new Error('Bloqueios demais para este Senhor(a)');
      }
      at.bloqueadores = lista.slice();
      if (lista.length) registrar(e, t('log.bloqueado', { n: at.n, us: lista.map(uid => nomeUnidade(localizar(e, uid).u)).join(' + ') }));
    }
    e.fase = 'resolucao';
    e.combate.indice = 0;
  }

  // rolagens: resultados dos dados deste ataque (vale o maior)
  function resolverProximo(e, rolagens) {
    if (e.fase !== 'resolucao') throw new Error('Nada para resolver');
    const at = e.combate.ataques[e.combate.indice];
    const p = e.vez, D = e.jogadores[1 - p];
    const maior = Math.max(...rolagens);
    const res = { rolagens: rolagens.slice(), maior, dano: 0 };
    at.resultado = res;
    e.combate.indice++;
    const fim = () => {
      if (e.vencedor == null && e.combate.indice >= e.combate.ataques.length) e.fase = 'fimCombate';
      return res;
    };

    const locA = localizar(e, at.atacante);
    if (!locA) {
      registrar(e, t('log.cancelado', { n: at.n }));
      res.cancelado = true;
      return fim();
    }
    const u = locA.u;
    const base = ataqueBase(e, p, locA.i) + (at.bonusAtaque || 0);
    const bonus = maior === 6 ? u.bonus.reduce((s, v) => s + Math.floor(v / 2), 0) : u.bonus.length;
    // Ataque do Rei contra um Senhor(a): o alvo defende como se bloqueasse, junto com quem veio ajudar.
    const alvoDireto = at.alvo !== 'jogador' ? localizar(e, at.alvo) : null;
    const direcionado = !!alvoDireto && alvoDireto.u.tipo === 'senhor';
    const defensores = direcionado ? [at.alvo].concat(at.bloqueadores.filter(uid => uid !== at.alvo)) : at.bloqueadores;
    // Bloqueio em grupo: cada defensor a mais tira 1 do ataque do atacante (antes do dado decidir cheio ou metade).
    const vivos = defensores.filter(uid => localizar(e, uid)).length;
    const reducaoGrupo = Math.max(0, vivos - 1) * REDUCAO_POR_DEFENSOR;
    const total = Math.max(0, base + bonus - reducaoGrupo);
    const dano = maior >= DADO_ATAQUE_TOTAL ? total : Math.floor(total / 2);
    const numeroAtacante = base + u.bonus.length;
    res.dano = dano;
    if (reducaoGrupo) registrar(e, t('log.grupo', { n: vivos, r: reducaoGrupo, u: nomeUnidade(u) }));
    registrar(e, t('log.rolou', { n: at.n, u: nomeUnidade(u), r: rolagens.join(', '), cheio: maior >= DADO_ATAQUE_TOTAL, crit: maior === 6 && u.bonus.length > 0, d: dano }));
    if (!defensores.length) {
      if (at.alvo === 'jogador') danoAoJogador(e, p, locA, dano);
      else if (alvoDireto) morrer(e, alvoDireto.p, alvoDireto.i, 'atacado');
      else registrar(e, t('log.alvoSumiu'));
      return fim();
    }

    const bloq = defensores.map(uid => localizar(e, uid)).filter(Boolean);
    const atkBloq = bloq.map(b => ataque(e, b.p, b.i));
    const somaBloq = atkBloq.reduce((s, v) => s + v, 0);
    // Paumol (Casca grossa): quem defende do lado dele recebe dano a menos
    // (com soPaus, só os Senhores que têm carta de Paus, na figura ou no número).
    const pm = PALHACOS.paumol;
    // Cada defensor recebe o dano inteiro (já reduzido pelo bloqueio em grupo).
    const danoPara = b => {
      if (!temPalhaco(D, 'paumol')) return dano;
      if (pm.soPaus && b.u.figura.naipe !== 'paus' && b.u.numero.naipe !== 'paus') return dano;
      return Math.max(0, dano - pm.reducaoDefesa);
    };
    let todosMorreram = true;
    bloq.forEach((b, k) => {
      const uid = b.u.uid;
      const loc = localizar(e, uid);
      if (!loc) return;
      const danoDefesa = danoPara(b);
      if (danoDefesa < dano) registrar(e, t('log.casca', { u: nomeUnidade(loc.u), n: danoDefesa }));
      if (danoDefesa * 2 < atkBloq[k]) registrar(e, t('log.ignorou', { u: nomeUnidade(loc.u) }));
      else if (danoDefesa > atkBloq[k]) morrer(e, loc.p, loc.i, 'fatal');
      else aplicarHit(e, loc.p, loc.i);
      if (localizar(e, uid)) todosMorreram = false;
    });

    if (u.figura.rank === 'Q' && todosMorreram) {
      const sobra = dano - somaBloq;
      if (sobra > 0) {
        registrar(e, t('log.atropelar', { n: sobra, j: D.nome }));
        danoAoJogador(e, p, localizar(e, at.atacante), sobra);
        if (e.vencedor != null) return res;
      }
    }

    if (bloq.length && numeroAtacante < somaBloq) {
      const l = localizar(e, at.atacante);
      if (l) {
        registrar(e, t('log.contra', { u: nomeUnidade(l.u) }));
        aplicarHit(e, l.p, l.i);
      }
    }
    return fim();
  }

  function encerrarTurno(e) {
    if (e.fase !== 'fimCombate') throw new Error('O combate ainda não terminou');
    const p = e.vez, j = e.jogadores[p];
    e.combate = null;
    for (const u of j.campo) {
      if (!u || u.tipo !== 'senhor') continue;
      u.bonus = [];
      if (u.atacou) {
        if (!u.vigilia) u.ativo = false; // vira para baixo: não bloqueia no turno do oponente
        else registrar(e, t('log.vigiliaPe', { u: nomeUnidade(u) }));
        u.atacou = false;
      }
      u.vigilia = false;
    }
    for (let q = 0; q < 2; q++) {
      for (let i = 0; i < ESPACOS; i++) {
        const u = e.jogadores[q].campo[i];
        if (u && u.tipo === 'senhor' && u.berserk && u.berserk.expira <= e.turno) {
          const levou = u.berserk.hits;
          u.berserk = null;
          if (levou >= 1) morrer(e, q, i, 'fimBerserk');
          else registrar(e, t('log.fimBerserk', { u: nomeUnidade(u) }));
        }
      }
    }
    verificarMortes(e);
    if (e.vencedor != null) return;
    if (j.mao.length > limiteMao(j)) {
      e.fase = 'descarte';
      return;
    }
    passarVez(e);
  }

  function descartar(e, ids) {
    if (e.fase !== 'descarte') throw new Error('Fora da fase de descarte');
    const j = e.jogadores[e.vez];
    if (j.mao.length - ids.length !== limiteMao(j)) throw new Error(`Descarte até ficar com ${limiteMao(j)} cartas`);
    for (const id of ids) j.cemiterio.push(tirarDaMao(j, id));
    registrar(e, t('log.descartou', { j: j.nome, n: ids.length }));
    passarVez(e);
  }

  function passarVez(e) {
    e.vez = 1 - e.vez;
    iniciarTurno(e);
  }

  function desistir(e, p) {
    if (e.vencedor != null) return;
    registrar(e, t('log.desistiu', { j: e.jogadores[p].nome }));
    e.vencedor = 1 - p;
    e.fase = 'fim';
    registrar(e, t('log.venceu', { j: e.jogadores[1 - p].nome }));
  }

  // ---------- Montagem de deck ----------
  // Um deck é uma contagem { 'Q-copas': 1, '7-ouros': 2, ... }.

  // Regras de deck: só máximos (não há mínimo) e um limite de cópias da mesma carta.
  // Naipes e valores são livres. Um deck menor tem menos cartas para comprar (baralho vazio custa PV).
  const REGRAS_DECK = {
    letras: 12, // máximo de figuras no baralho de Letras
    numeros: 40, // máximo de cartas no baralho de Números (Ás a 10)
    copias: 6, // máximo de cópias da mesma carta (mesmo valor e naipe)
  };

  function contagemPadrao() {
    const c = {};
    for (const naipe of NAIPES) for (const rank of RANKS) c[`${rank}-${naipe}`] = 1;
    return c;
  }

  function resumoDeck(cont) {
    const r = { letras: 0, numeros: 0, soma: 0, ases: 0, porFigura: { J: 0, Q: 0, K: 0 }, figurasNaipe: {}, numerosNaipe: {} };
    for (const naipe of NAIPES) r.figurasNaipe[naipe] = r.numerosNaipe[naipe] = 0;
    for (const chave in cont) {
      const n = cont[chave];
      if (!n) continue;
      const [rank, naipe] = chave.split('-');
      if (rank === 'J' || rank === 'Q' || rank === 'K') {
        r.letras += n;
        r.porFigura[rank] += n;
        r.figurasNaipe[naipe] += n;
      } else {
        r.numeros += n;
        r.soma += n * (rank === 'A' ? 1 : Number(rank));
        r.numerosNaipe[naipe] += n;
        if (rank === 'A') r.ases += n;
      }
    }
    return r;
  }

  // Lista os problemas do deck (vazia = deck válido).
  // Um deck só pode ter cartas que existem (Ás a 10, Valete, Rainha, Rei, nos 4 naipes) com contagens inteiras.
  // Importante no online: o deck do outro jogador chega pela rede e não pode trazer nada além disso.
  function deckBemFormado(cont) {
    if (!cont || typeof cont !== 'object' || Array.isArray(cont)) return false;
    return Object.keys(cont).every(chave => {
      const partes = chave.split('-'), n = cont[chave];
      return partes.length === 2 && RANKS.includes(partes[0]) && NAIPES.includes(partes[1]) && Number.isInteger(n) && n >= 0 && n <= 99;
    });
  }

  function validarDeck(cont) {
    if (!deckBemFormado(cont)) return [t('deck.erroFormato')];
    const R = REGRAS_DECK, r = resumoDeck(cont), erros = [];
    if (r.letras + r.numeros === 0) erros.push(t('deck.erroVazio'));
    if (r.letras > R.letras) erros.push(t('deck.erroLetras', { a: R.letras, b: r.letras }));
    if (r.numeros > R.numeros) erros.push(t('deck.erroNumeros', { a: R.numeros, b: r.numeros }));
    for (const chave in cont) {
      if (cont[chave] > R.copias) {
        const [rank, naipe] = chave.split('-');
        erros.push(t('deck.erroCopias', { c: nomeCarta({ rank, naipe }), a: R.copias, b: cont[chave] }));
      }
    }
    return erros;
  }

  // Transforma a contagem em cartas com id único (o motor separa Letras e Números).
  function cartasDoDeck(cont, dono) {
    const cartas = [];
    for (const chave in cont) {
      const [rank, naipe] = chave.split('-');
      for (let k = 0; k < cont[chave]; k++) cartas.push({ id: `${dono}-${rank}-${naipe}-${k}`, rank, naipe });
    }
    return cartas;
  }

  SS.Motor = {
    desistir, REGRAS_DECK, RANKS, contagemPadrao, resumoDeck, validarDeck, cartasDoDeck,
    PALHACOS, CUSTO_TRANSFUSAO, CUSTO_SANGRIA, SACRIFICIOS_RAINHA, SENHORES_POR_TURNO, ASES_POR_TURNO, REDUCAO_POR_DEFENSOR, palhacoDe, limiteMao, ataqueDirecionado,
    NAIPES, SIMBOLO, LIMITE_FIGURA, PV_INICIAL, ESPACOS, ACOES_POR_TURNO, CUSTO_RAINHA, DADO_ATAQUE_TOTAL, LIMITE_MAO,
    definirRng: f => { rng = f; },
    ehFigura, ehAs, ehNumero, valor, nomeCarta, nomeNaipe, nomeUnidade, curaDe, curaPara, naipado,
    BARALHOS, NOME_BARALHO, baralhosDisponiveis, comprarDoTurno,
    criarJogo, registrar, figurasNoBaralho, escolherFiguras, mulligan, confirmarAbertura,
    localizar, tetoCura, ataque, ataqueBase, resistencia, postura, podeAtacar,
    acoesLegais, aplicarAcao, ourosDisponiveis,
    atacantesAptos, alvosPossiveis, capacidadeBloqueio, bloqueadoresAptos,
    declararAtaques, definirBloqueios, resolverProximo, encerrarTurno, descartar,
  };
})(window.SS);
