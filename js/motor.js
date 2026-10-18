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
  const NOME = { A: 'Ás', J: 'Valete', Q: 'Rainha', K: 'Rei' };
  const LIMITE_FIGURA = { J: 5, Q: 10, K: 7 };
  const PV_INICIAL = 20; // não há máximo: Copas pode curar acima disso
  const ESPACOS = 8;
  const ACOES_POR_TURNO = 3;
  const CUSTO_RAINHA = 2; // ações passivas para sumonar uma Rainha
  const LIMITE_MAO = 7;
  const DANO_BARALHO_VAZIO = 2;

  let rng = Math.random;

  const ehFigura = c => c.rank === 'J' || c.rank === 'Q' || c.rank === 'K';
  const ehAs = c => c.rank === 'A';
  const ehNumero = c => !ehFigura(c) && !ehAs(c);
  const valor = c => (ehAs(c) ? 1 : parseInt(c.rank, 10));
  const nomeCarta = c => (NOME[c.rank] ? NOME[c.rank] + ' ' : c.rank) + SIMBOLO[c.naipe];
  const curaDe = c => (valor(c) <= 3 ? 1 : valor(c) <= 7 ? 2 : 3);

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
  const NOME_BARALHO = { letras: 'Letras', numeros: 'Números' };
  const outroBaralho = b => (b === 'letras' ? 'numeros' : 'letras');

  function criarJogo(opcoes) {
    const o = opcoes || {};
    const nomes = o.nomes || ['Jogador', 'Oponente'];
    const primeiro = o.primeiro || 0;
    return {
      jogadores: [0, 1].map(i => {
        const cartas = o.decks && o.decks[i] ? o.decks[i].slice() : baralhoPadrao(i);
        return {
          nome: nomes[i],
          pv: PV_INICIAL,
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
    registrar(e, `${j.nome} fez mulligan.`);
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
      registrar(e, `${e.jogadores[1 - p].nome} venceu a partida!`);
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
        registrar(e, `${j.nome} não tem cartas para comprar e perde ${DANO_BARALHO_VAZIO} PV.`);
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
    registrar(e, `${nomeUnidade(u)} de ${j.nome} morreu${motivo ? ' (' + motivo + ')' : ''}.`);
    verificarMortes(e);
  }

  // Ex.: se um Ás de Paus morre, o vizinho pode perder a resistência extra.
  function verificarMortes(e) {
    for (let p = 0; p < 2; p++) {
      for (let i = 0; i < ESPACOS; i++) {
        const u = e.jogadores[p].campo[i];
        if (u && u.tipo === 'senhor' && !u.berserk && u.hits >= resistencia(e, p, i)) {
          morrer(e, p, i, 'resistência perdida');
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
      registrar(e, `${nomeUnidade(u)} levou 1 hit em berserk.`);
      if (u.berserk.hits >= 2) morrer(e, p, i, 'berserk');
      return;
    }
    u.hits++;
    if (u.hits >= resistencia(e, p, i)) morrer(e, p, i, 'hits');
    else registrar(e, `${nomeUnidade(u)} levou 1 hit.`);
  }

  function danoAoJogador(e, p, locA, dano) {
    if (dano <= 0) return;
    const d = 1 - p, D = e.jogadores[d];
    const perdido = Math.min(dano, D.pv);
    registrar(e, `${D.nome} perdeu ${perdido} PV.`);
    perderPV(e, d, dano);
    if (e.vencedor != null || !locA) return;
    const u = locA.u;
    if (naipado(u) === 'copas' && perdido > 0) {
      D.feridas[u.uid] = Math.min(D.feridas[u.uid] == null ? Infinity : D.feridas[u.uid], D.pv);
      registrar(e, `Ferida de Copas: ${D.nome} não pode curar acima de ${D.feridas[u.uid]} PV enquanto ${nomeUnidade(u)} viver.`);
    }
    if (asesVizinhos(e, p, locA.i).includes('copas')) {
      const c = curar(e, p, 1);
      if (c) registrar(e, `Ás de Copas (vampiro): ${e.jogadores[p].nome} cura 1 PV.`);
    }
  }

  // ---------- Turno ----------

  function iniciarTurno(e) {
    e.turno++;
    const p = e.vez, j = e.jogadores[p];
    e.fase = 'principal';
    e.acoes = ACOES_POR_TURNO;
    e.combate = null;
    j.tokens = 0;
    for (const u of j.campo) {
      if (!u) continue;
      if (u.tipo === 'senhor') {
        u.ativo = true;
        u.atacou = false;
        u.ataques = naipado(u) === 'ouros' ? 2 : 1;
      } else if (u.naipe === 'ouros') j.tokens++;
    }
    registrar(e, `— Turno ${e.turno}: ${j.nome} —`);
    if (e.turno === 1) registrar(e, `${j.nome} começa: não compra nem ataca neste turno.`);
    else if (!j.letras.length && !j.numeros.length) comprar(e, p, 1, 'numeros'); // sem cartas: perde PV
    else e.fase = 'compra'; // o jogador escolhe de qual baralho comprar
  }

  function comprarDoTurno(e, origem) {
    if (e.fase !== 'compra') throw new Error('Fora da fase de compra');
    const j = e.jogadores[e.vez];
    if (!BARALHOS.includes(origem) || !j[origem].length) throw new Error('Baralho vazio ou inválido');
    comprar(e, e.vez, 1, origem);
    registrar(e, `${j.nome} comprou do baralho de ${NOME_BARALHO[origem]}.`);
    e.fase = 'principal';
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

    for (const f of figuras) {
      for (const n of numeros) {
        if (valor(n) > LIMITE_FIGURA[f.rank]) continue;
        if (f.rank === 'Q') {
          if (e.acoes < CUSTO_RAINHA) continue;
          for (const s of senhores) {
            if (j.campo[s].entrou >= e.turno) continue; // não pode sacrificar quem entrou neste turno
            for (const slot of vazios.concat([s])) r.push({ tipo: 'sumonar', figura: f.id, numero: n.id, sacrificio: j.campo[s].uid, slot });
          }
        } else for (const slot of vazios) r.push({ tipo: 'sumonar', figura: f.id, numero: n.id, sacrificio: null, slot });
      }
    }
    for (const a of ases) {
      for (const c of numeros) {
        if (c.naipe === a.naipe) for (const slot of vazios) r.push({ tipo: 'invocarAs', as: a.id, custo: c.id, slot });
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
        if (f0.rank === 'Q') {
          if (a.sacrificio == null) throw new Error('A Rainha exige sacrifício');
          if (e.acoes < CUSTO_RAINHA) throw new Error(`A Rainha custa ${CUSTO_RAINHA} ações`);
          custo = CUSTO_RAINHA;
        }
        if (a.sacrificio != null) {
          const s = localizar(e, a.sacrificio);
          if (!s || s.p !== p || s.u.tipo !== 'senhor') throw new Error('Sacrifício inválido');
          if (s.u.entrou >= e.turno) throw new Error('Não pode sacrificar quem entrou neste turno');
          registrar(e, `${j.nome} sacrifica ${nomeUnidade(s.u)} para a Rainha.`);
          morrer(e, s.p, s.i, 'sacrifício');
        }
        if (j.campo[a.slot]) throw new Error('Espaço ocupado');
        const f = tirarDaMao(j, a.figura), n = tirarDaMao(j, a.numero);
        const u = {
          uid: e.proximoUid++, tipo: 'senhor', figura: f, numero: n, hits: 0, ativo: true, atacou: false,
          ataques: f.naipe === n.naipe && f.naipe === 'ouros' ? 2 : 1, entrou: e.turno, bonus: [], berserk: null,
        };
        j.campo[a.slot] = u;
        const nai = naipado(u);
        registrar(e, `${j.nome} sumonou ${nomeUnidade(u)} com ataque ${ataque(e, p, a.slot)}${nai ? ` — Naipado de ${nai[0].toUpperCase() + nai.slice(1)}!` : '.'}`);
        break;
      }
      case 'invocarAs': {
        if (j.campo[a.slot]) throw new Error('Espaço ocupado');
        const as = tirarDaMao(j, a.as), custo = tirarDaMao(j, a.custo);
        if (!ehAs(as) || !ehNumero(custo) || custo.naipe !== as.naipe) throw new Error('Invocação de Ás inválida');
        j.cemiterio.push(custo);
        j.campo[a.slot] = { uid: e.proximoUid++, tipo: 'as', carta: as, naipe: as.naipe };
        if (as.naipe === 'ouros') j.tokens++;
        registrar(e, `${j.nome} invocou o ${nomeCarta(as)} sacrificando ${nomeCarta(custo)}.`);
        break;
      }
      case 'curar': {
        const c = tirarDaMao(j, a.carta);
        const qtd = curar(e, p, curaDe(c));
        j.cemiterio.push(c);
        registrar(e, `${j.nome} usou ${nomeCarta(c)} e curou ${qtd} PV.`);
        break;
      }
      case 'espadas': {
        const alvo = localizar(e, a.alvo);
        if (!alvo || alvo.p !== p || alvo.u.tipo !== 'senhor') throw new Error('Alvo inválido');
        const c = tirarDaMao(j, a.carta);
        alvo.u.bonus.push(valor(c));
        j.cemiterio.push(c);
        registrar(e, `${j.nome} usou ${nomeCarta(c)}: ${nomeUnidade(alvo.u)} ganha +1 de ataque (crítico no 6: +${Math.floor(valor(c) / 2)}).`);
        break;
      }
      case 'paus': {
        const alvo = localizar(e, a.alvo);
        if (!alvo || alvo.p !== p || alvo.u.tipo !== 'senhor' || alvo.u.hits === 0 || alvo.u.berserk) throw new Error('Alvo inválido');
        const c = tirarDaMao(j, a.carta);
        alvo.u.berserk = { hits: 0, expira: e.turno + 1 };
        j.cemiterio.push(c);
        registrar(e, `${j.nome} usou ${nomeCarta(c)}: ${nomeUnidade(alvo.u)} entra em berserk.`);
        break;
      }
      case 'comprar': {
        gastarOuros(e, p, a.carta);
        registrar(e, `${j.nome} gastou 1 Ouros para comprar 1 carta de ${NOME_BARALHO[a.baralho]}.`);
        comprar(e, p, 1, a.baralho);
        break;
      }
      case 'reviver': {
        const k = j.cemiterio.findIndex(c => c.id === a.escolha);
        if (k < 0) throw new Error('Carta não está no cemitério');
        const carta = j.cemiterio.splice(k, 1)[0];
        for (const o of a.cartas) gastarOuros(e, p, o);
        j.mao.push(carta);
        registrar(e, `${j.nome} gastou 2 Ouros e recuperou ${nomeCarta(carta)} do cemitério.`);
        break;
      }
      default:
        throw new Error('Ação desconhecida: ' + a.tipo);
    }
    e.acoes -= custo;
  }

  // ---------- Combate ----------

  function atacantesAptos(e) {
    const p = e.vez, r = [];
    e.jogadores[p].campo.forEach((u, i) => { if (podeAtacar(e, p, i)) r.push(u.uid); });
    return r;
  }

  function alvosPossiveis(e) {
    const r = ['jogador'];
    for (const u of e.jogadores[1 - e.vez].campo) if (u && u.tipo === 'as') r.push(u.uid);
    return r;
  }

  const capacidadeBloqueio = u => (u.figura.rank === 'K' ? 2 : 1);

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
    const alvos = alvosPossiveis(e);
    for (const d of lista) {
      const loc = localizar(e, d.atacante);
      if (!loc || loc.p !== p || !podeAtacar(e, p, loc.i)) throw new Error('Atacante inválido');
      contagem[d.atacante] = (contagem[d.atacante] || 0) + 1;
      if (contagem[d.atacante] > loc.u.ataques) throw new Error('Ataques demais para este Senhor(a)');
      if (!alvos.includes(d.alvo)) throw new Error('Alvo inválido');
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
      ataques.push({ n: k + 1, atacante: d.atacante, alvo: d.alvo, dados: 1 + extras.length, bloqueadores: [], resultado: null });
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
      registrar(e, `${j.nome} não atacou.`);
      return;
    }
    e.combate = { ataques, indice: 0 };
    e.fase = 'bloqueio';
    for (const at of ataques) {
      const loc = localizar(e, at.atacante);
      const alvo = at.alvo === 'jogador' ? e.jogadores[1 - p].nome : nomeUnidade(localizar(e, at.alvo).u);
      registrar(e, `Ataque ${at.n}: ${nomeUnidade(loc.u)} → ${alvo}${at.dados > 1 ? ` (${at.dados} dados)` : ''}.`);
    }
  }

  // mapa: { [número do ataque]: [uids dos bloqueadores] }
  function definirBloqueios(e, mapa) {
    if (e.fase !== 'bloqueio') throw new Error('Fora da fase de bloqueio');
    const d = 1 - e.vez, uso = {};
    for (const at of e.combate.ataques) {
      const lista = (mapa && mapa[at.n]) || [];
      for (const uid of lista) {
        const loc = localizar(e, uid);
        if (!loc || loc.p !== d || loc.u.tipo !== 'senhor' || !loc.u.ativo) throw new Error('Bloqueador inválido');
        uso[uid] = (uso[uid] || 0) + 1;
        if (uso[uid] > capacidadeBloqueio(loc.u)) throw new Error('Bloqueios demais para este Senhor(a)');
      }
      at.bloqueadores = lista.slice();
      if (lista.length) registrar(e, `Ataque ${at.n} bloqueado por ${lista.map(uid => nomeUnidade(localizar(e, uid).u)).join(' + ')}.`);
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
      registrar(e, `Ataque ${at.n} cancelado: o atacante não está mais em campo.`);
      res.cancelado = true;
      return fim();
    }
    const u = locA.u;
    const base = ataqueBase(e, p, locA.i);
    const bonus = maior === 6 ? u.bonus.reduce((s, v) => s + Math.floor(v / 2), 0) : u.bonus.length;
    const total = base + bonus;
    const dano = maior >= 5 ? total : Math.floor(total / 2);
    const numeroAtacante = base + u.bonus.length;
    res.dano = dano;
    registrar(e, `Ataque ${at.n}: ${nomeUnidade(u)} rolou ${rolagens.join(', ')} → ${maior >= 5 ? 'ataque total' : 'meio ataque'}${maior === 6 && u.bonus.length ? ' com crítico de Espadas' : ''}: ${dano} de dano.`);

    if (!at.bloqueadores.length) {
      if (at.alvo === 'jogador') danoAoJogador(e, p, locA, dano);
      else {
        const alvo = localizar(e, at.alvo);
        if (alvo) morrer(e, alvo.p, alvo.i, 'atacado');
        else registrar(e, 'O Ás alvo já não está em campo.');
      }
      return fim();
    }

    const bloq = at.bloqueadores.map(uid => localizar(e, uid)).filter(Boolean);
    const atkBloq = bloq.map(b => ataque(e, b.p, b.i));
    const somaBloq = atkBloq.reduce((s, v) => s + v, 0);
    let todosMorreram = true;
    bloq.forEach((b, k) => {
      const uid = b.u.uid;
      const loc = localizar(e, uid);
      if (!loc) return;
      if (dano * 2 < atkBloq[k]) registrar(e, `${nomeUnidade(loc.u)} ignorou o golpe (dano menor que metade do seu ataque).`);
      else if (dano > atkBloq[k]) morrer(e, loc.p, loc.i, 'golpe fatal');
      else aplicarHit(e, loc.p, loc.i);
      if (localizar(e, uid)) todosMorreram = false;
    });

    if (u.figura.rank === 'Q' && todosMorreram) {
      const sobra = dano - somaBloq;
      if (sobra > 0) {
        registrar(e, `Atropelar! ${sobra} de dano passa para ${D.nome}.`);
        danoAoJogador(e, p, localizar(e, at.atacante), sobra);
        if (e.vencedor != null) return res;
      }
    }

    if (bloq.length && numeroAtacante < somaBloq) {
      const l = localizar(e, at.atacante);
      if (l) {
        registrar(e, `Contra-ataque! ${nomeUnidade(l.u)} leva 1 hit.`);
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
        u.ativo = false; // vira para baixo: não bloqueia no turno do oponente
        u.atacou = false;
      }
    }
    for (let q = 0; q < 2; q++) {
      for (let i = 0; i < ESPACOS; i++) {
        const u = e.jogadores[q].campo[i];
        if (u && u.tipo === 'senhor' && u.berserk && u.berserk.expira <= e.turno) {
          const levou = u.berserk.hits;
          u.berserk = null;
          if (levou >= 1) morrer(e, q, i, 'fim do berserk');
          else registrar(e, `O berserk de ${nomeUnidade(u)} acabou.`);
        }
      }
    }
    verificarMortes(e);
    if (e.vencedor != null) return;
    if (j.mao.length > LIMITE_MAO) {
      e.fase = 'descarte';
      return;
    }
    passarVez(e);
  }

  function descartar(e, ids) {
    if (e.fase !== 'descarte') throw new Error('Fora da fase de descarte');
    const j = e.jogadores[e.vez];
    if (j.mao.length - ids.length !== LIMITE_MAO) throw new Error(`Descarte até ficar com ${LIMITE_MAO} cartas`);
    for (const id of ids) j.cemiterio.push(tirarDaMao(j, id));
    registrar(e, `${j.nome} descartou ${ids.length} carta(s) pelo limite de mão.`);
    passarVez(e);
  }

  function passarVez(e) {
    e.vez = 1 - e.vez;
    iniciarTurno(e);
  }

  function desistir(e, p) {
    if (e.vencedor != null) return;
    registrar(e, `${e.jogadores[p].nome} desistiu da partida.`);
    e.vencedor = 1 - p;
    e.fase = 'fim';
    registrar(e, `${e.jogadores[1 - p].nome} venceu a partida!`);
  }

  // ---------- Montagem de deck ----------
  // Um deck é uma contagem { 'Q-copas': 1, '7-ouros': 2, ... }.

  const REGRAS_DECK = {
    letras: 12, // tamanho exato do baralho de Letras
    numeros: 40, // tamanho exato do baralho de Números
    copiasFigura: 2, // cópias da mesma figura e naipe (ex.: Rainha de Copas)
    copiasNumero: 4, // cópias do mesmo número e naipe (ex.: 7 de Ouros)
    porFigura: { J: 5, Q: 4, K: 5 }, // máximo de cada figura, somando os naipes
    ases: 4, // máximo de Ases
    orcamento: 220, // soma máxima dos valores numéricos (Ás = 1); igual à de um baralho comum
    figurasMesmoNaipe: 5, // máximo de figuras de um mesmo naipe
    numerosMesmoNaipe: 16, // máximo de cartas numéricas de um mesmo naipe
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
  function validarDeck(cont) {
    const R = REGRAS_DECK, r = resumoDeck(cont), erros = [];
    if (r.letras !== R.letras) erros.push(`O baralho de Letras precisa ter exatamente ${R.letras} figuras (tem ${r.letras}).`);
    if (r.numeros !== R.numeros) erros.push(`O baralho de Números precisa ter exatamente ${R.numeros} cartas (tem ${r.numeros}).`);
    for (const chave in cont) {
      const n = cont[chave], [rank] = chave.split('-');
      const max = rank === 'J' || rank === 'Q' || rank === 'K' ? R.copiasFigura : R.copiasNumero;
      if (n > max) erros.push(`${nomeCarta({ rank, naipe: chave.split('-')[1] })}: no máximo ${max} cópias (tem ${n}).`);
    }
    for (const f of ['J', 'Q', 'K']) if (r.porFigura[f] > R.porFigura[f]) erros.push(`No máximo ${R.porFigura[f]} ${NOME[f]}s (tem ${r.porFigura[f]}).`);
    if (r.ases > R.ases) erros.push(`No máximo ${R.ases} Ases (tem ${r.ases}).`);
    if (r.soma > R.orcamento) erros.push(`A soma dos números passou do orçamento: ${r.soma} de ${R.orcamento}.`);
    for (const naipe of NAIPES) {
      if (r.figurasNaipe[naipe] > R.figurasMesmoNaipe) erros.push(`No máximo ${R.figurasMesmoNaipe} figuras de ${naipe} (tem ${r.figurasNaipe[naipe]}).`);
      if (r.numerosNaipe[naipe] > R.numerosMesmoNaipe) erros.push(`No máximo ${R.numerosMesmoNaipe} números de ${naipe} (tem ${r.numerosNaipe[naipe]}).`);
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
    NAIPES, SIMBOLO, LIMITE_FIGURA, PV_INICIAL, ESPACOS, ACOES_POR_TURNO, CUSTO_RAINHA, LIMITE_MAO,
    definirRng: f => { rng = f; },
    ehFigura, ehAs, ehNumero, valor, nomeCarta, nomeUnidade, curaDe, naipado,
    BARALHOS, NOME_BARALHO, baralhosDisponiveis, comprarDoTurno,
    criarJogo, registrar, figurasNoBaralho, escolherFiguras, mulligan, confirmarAbertura,
    localizar, tetoCura, ataque, ataqueBase, resistencia, postura, podeAtacar,
    acoesLegais, aplicarAcao, ourosDisponiveis,
    atacantesAptos, alvosPossiveis, capacidadeBloqueio, bloqueadoresAptos,
    declararAtaques, definirBloqueios, resolverProximo, encerrarTurno, descartar,
  };
})(window.SS);
