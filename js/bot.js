/* Bot de "Senhora e Senhores".
   O bot escolhe, a cada momento, a jogada que deixa a mesa com a melhor "nota" (avaliar). Ataques e
   bloqueios são decididos pelo valor esperado de todas as rolagens possíveis.
   - Fácil: pesos feitos à mão (o antigo Difícil).
   - Médio: meio caminho entre os pesos feitos à mão e os aprendidos.
   - Difícil: pesos aprendidos por autojogo (1ª rodada de treino).
   - Profissional: pesos treinados + simulação: antes de cada jogada, testa as melhores opções jogando o
     resto do turno e o turno do rival várias vezes (sem espiar a mão do rival). */
window.SS = window.SS || {};
(function (SS) {
  'use strict';
  const M = SS.Motor;
  const clonar = typeof structuredClone === 'function' ? structuredClone : o => JSON.parse(JSON.stringify(o));

  // Pesos da avaliação da mesa. PESOS_BASE são os pesos feitos à mão (o bot "clássico");
  // os níveis de cima usam pesos aprendidos por autojogo (js/pesos.js, gerados por ferramentas/treino.js).
  const PESOS_BASE = {
    pvBaixo: 3, pvAlto: 1.5, perigo: 2.5, desafio: 1.2,
    asBase: 2.5, asVizinho: 1.2,
    uBase: 1, uAtk: 1.1, uVida: 1.8, uNaipado: 1.5, uRealeza: 1, uPorUmFio: 1.5, uNaoBloqueia: 1.2, uVigilia: 0.6, uBonus: 0.9,
    maoNum: 0.04, maoAs: 1.6, maoPar: 3.4, maoFigSolta: 1, maoNumSolto: 1,
    opMao: 1.2, ferida: 2, deckPouco: 1,
    ameaca: 0, bloqueadores: 0, // extras que o aprendizado pode descobrir (começam desligados)
  };
  const PESOS_APRENDIDOS = Object.assign({}, PESOS_BASE, SS.PESOS_APRENDIDOS || {});
  const PESOS_PRO = Object.assign({}, PESOS_APRENDIDOS, SS.PESOS_PRO || {});
  const PESOS_MEDIO = {};
  for (const k in PESOS_BASE) PESOS_MEDIO[k] = (PESOS_BASE[k] + PESOS_APRENDIDOS[k]) / 2;
  // Pesos em uso na decisão atual (as decisões são síncronas, então dá para trocar por nível).
  let W = PESOS_BASE;

  // Níveis. profundidade 2 = planeja a sequência de jogadas do turno (melhor 2ª jogada depois de cada 1ª).
  const NIVEIS = {
    facil: { pesos: PESOS_BASE, ruido: 0, limiar: 0.15, alvosAs: true, ourosDados: true, pares: true, profundidade: 1 },
    medio: { pesos: PESOS_MEDIO, ruido: 0, limiar: 0.15, alvosAs: true, ourosDados: true, pares: true, profundidade: 1 },
    dificil: { pesos: PESOS_APRENDIDOS, ruido: 0, limiar: 0.15, alvosAs: true, ourosDados: true, pares: true, profundidade: 1 },
    profissional: { pesos: PESOS_PRO, ruido: 0, limiar: 0.15, alvosAs: true, ourosDados: true, pares: true, profundidade: 1, simulacoes: 6, largura: 4, politica: 'dificil' },
  };
  // Configuração de um nível (aceita também um objeto de configuração pronto, usado no treino).
  const configDe = nivel => (typeof nivel === 'object' ? nivel : NIVEIS[nivel] || NIVEIS.medio);
  const usar = cfg => { W = cfg.pesos || PESOS_BASE; return cfg; };
  const sortear = arr => arr[Math.floor(Math.random() * arr.length)];
  const rolar = n => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));

  function embaralhar(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // Probabilidade de o maior de n dados ser 1..6.
  function distribuicaoMaior(n) {
    const p = [];
    for (let r = 1; r <= 6; r++) p.push(Math.pow(r / 6, n) - Math.pow((r - 1) / 6, n));
    return p;
  }

  function valorCarta(c) {
    if (M.ehFigura(c)) return 2.2;
    if (M.ehAs(c)) return 1.6;
    return 0.9 + M.valor(c) * 0.04;
  }

  // A mão vale mais quando tem pares figura + número (um Senhor pronto para sumonar).
  function valorMao(mao) {
    let figuras = 0, numeros = 0, v = 0;
    for (const c of mao) {
      if (M.ehFigura(c)) figuras++;
      else if (M.ehNumero(c)) {
        numeros++;
        v += M.valor(c) * W.maoNum;
      } else v += W.maoAs;
    }
    const pares = Math.min(figuras, numeros);
    return v + pares * W.maoPar + (figuras - pares) * W.maoFigSolta + (numeros - pares) * W.maoNumSolto;
  }

  // Escolhe o baralho da compra do turno pelo valor médio da mão depois de comprar.
  function escolherBaralho(e, p, nivel) {
    usar(configDe(nivel));
    const j = e.jogadores[p];
    const opcoes = M.BARALHOS.filter(b => j[b].length);
    if (opcoes.length < 2) return opcoes[0] || 'numeros';
    let melhor = opcoes[0], mv = -Infinity;
    for (const b of opcoes) {
      const v = j[b].reduce((s, c) => s + valorMao(j.mao.concat([c])), 0) / j[b].length;
      if (v > mv) {
        mv = v;
        melhor = b;
      }
    }
    return melhor;
  }

  // Características da mesa do ponto de vista de p. A nota é a soma de característica × peso,
  // então dá para aprender os pesos a partir de partidas (ver ferramentas/treino.js).
  // Diferenças "meu − dele" quando faz sentido; as de "penalidade" já vêm com o sinal certo.
  function caracteristicas(e, p) {
    const F = {};
    for (const k in PESOS_BASE) F[k] = 0;
    const eu = e.jogadores[p], op = e.jogadores[1 - p];
    const pv = (q, x) => { F.pvBaixo += q * Math.min(x, 14); F.pvAlto += q * Math.max(0, x - 14); F.perigo -= q * (x <= 6 ? 7 - x : 0); };
    pv(1, eu.pv);
    pv(-1, op.pv);
    if (e.vez === p && e.desafio != null) F.desafio = 1; // Desafio! do Lançalotte armado para o ataque
    for (const [q, s] of [[p, 1], [1 - p, -1]]) {
      const j = e.jogadores[q];
      for (let i = 0; i < M.ESPACOS; i++) {
        const u = j.campo[i];
        if (!u) continue;
        if (u.tipo === 'as') {
          F.asBase += s;
          for (const k of [i - 1, i + 1]) {
            const w = j.campo[k];
            if (w && w.tipo === 'senhor') F.asVizinho += s;
          }
          continue;
        }
        const atk = M.ataqueBase(e, q, i), res = M.resistencia(e, q, i);
        let hits = u.hits;
        if (u.berserk) hits = u.berserk.hits > 0 ? res : Math.max(0, u.hits - 1);
        F.uBase += s;
        F.uAtk += s * atk;
        F.uVida += s * Math.max(0, res - hits);
        if (M.naipado(u)) F.uNaipado += s;
        if (u.figura.rank === 'K' || u.figura.rank === 'Q') F.uRealeza += s;
        if (!u.berserk && res > 1 && hits === res - 1) F.uPorUmFio -= s; // por um fio: o próximo hit mata
        if (e.vez === q && (!u.ativo || (u.atacou && !u.vigilia))) F.uNaoBloqueia -= s; // não bloqueia no turno do oponente
        if (e.vez === q && u.vigilia && !u.atacou) F.uVigilia += s; // ataca sem perder o bloqueio
        if (M.podeAtacar(e, q, i)) F.uBonus += s * u.bonus.length;
      }
    }
    let figuras = 0, numeros = 0;
    for (const c of eu.mao) {
      if (M.ehFigura(c)) figuras++;
      else if (M.ehNumero(c)) {
        numeros++;
        F.maoNum += M.valor(c);
      } else F.maoAs++;
    }
    const pares = Math.min(figuras, numeros);
    F.maoPar = pares;
    F.maoFigSolta = figuras - pares;
    F.maoNumSolto = numeros - pares;
    F.opMao = -op.mao.length;
    if (isFinite(M.tetoCura(eu))) F.ferida -= 1; // ferida de Copas: não pode curar
    if (isFinite(M.tetoCura(op))) F.ferida += 1;
    const restantes = eu.letras.length + eu.numeros.length;
    if (restantes < 5) F.deckPouco = -(5 - restantes);
    // Ameaça do próximo turno do oponente (ataque somado dele em relação ao meu PV) e meus bloqueadores prontos.
    let atkOp = 0, bloq = 0;
    op.campo.forEach((u, i) => { if (u && u.tipo === 'senhor') atkOp += M.ataqueBase(e, 1 - p, i); });
    for (const u of eu.campo) if (u && u.tipo === 'senhor' && u.ativo && (!u.atacou || u.vigilia)) bloq++;
    F.ameaca = -atkOp / Math.max(1, eu.pv);
    if (e.vez === p) F.bloqueadores = bloq;
    return F;
  }

  function avaliar(e, p) {
    if (e.vencedor != null) return e.vencedor === p ? 10000 : -10000;
    const F = caracteristicas(e, p);
    let s = 0;
    for (const k in F) s += F[k] * (W[k] || 0);
    return s;
  }

  // ---------- Fase principal ----------

  // Valor de uma jogada: avaliação da mesa depois dela (média, se a jogada tem sorteio).
  function valorDepois(e, p, a) {
    if (a.tipo === 'comprar' || (a.tipo === 'poder' && a.alvo == null)) {
      // Compra ou roubo (Ourinhos): a carta é sorteada. O bot não pode "espiar" o topo do
      // baralho, então faz a média de algumas tentativas (com o baralho embaralhado).
      let v = 0;
      for (let k = 0; k < 4; k++) {
        const c = clonar(e);
        if (a.baralho) embaralhar(c.jogadores[p][a.baralho]);
        M.aplicarAcao(c, a);
        v += avaliar(c, p) / 4;
      }
      return { v, estado: null };
    }
    const c = clonar(e);
    M.aplicarAcao(c, a);
    return { v: avaliar(c, p), estado: c };
  }

  // Jogadas iguais em espaços diferentes (ex.: Ás em 8 espaços) viram uma só na busca funda.
  const chaveSemEspaco = a => JSON.stringify(Object.assign({}, a, { slot: undefined }));

  // Melhor valor alcançável a partir de e com até "prof" jogadas (parar também é uma opção).
  function melhorSequencia(e, p, prof, largura) {
    const parar = avaliar(e, p);
    if (prof <= 0 || e.fase !== 'principal' || e.vencedor != null) return parar;
    const legais = M.acoesLegais(e).filter(a => a.tipo !== 'atacar');
    if (!legais.length) return parar;
    const notas = legais.map(a => Object.assign({ a }, valorDepois(e, p, a))).sort((x, y) => y.v - x.v);
    let melhor = Math.max(parar, notas[0].v);
    const vistos = new Set();
    for (const n of notas) {
      if (vistos.size >= largura) break;
      if (!n.estado) continue;
      const k = chaveSemEspaco(n.a);
      if (vistos.has(k)) continue;
      vistos.add(k);
      melhor = Math.max(melhor, melhorSequencia(n.estado, p, prof - 1, largura));
    }
    return melhor;
  }

  // Gerador com semente (mulberry32): cada simulação usa a mesma sorte para todas as jogadas comparadas,
  // assim a diferença entre elas vem da jogada e não dos dados.
  function gerador(s) {
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // O bot não espia: antes de simular, embaralha o que ele não vê (a mão do rival e a ordem dos baralhos).
  function determinizar(c, p) {
    const eu = c.jogadores[p], op = c.jogadores[1 - p];
    embaralhar(eu.letras);
    embaralhar(eu.numeros);
    const fig = op.mao.filter(M.ehFigura), resto = op.mao.filter(x => !M.ehFigura(x));
    const pf = fig.concat(op.letras), pn = resto.concat(op.numeros);
    embaralhar(pf);
    embaralhar(pn);
    op.mao = pf.slice(0, fig.length).concat(pn.slice(0, resto.length));
    op.letras = pf.slice(fig.length);
    op.numeros = pn.slice(resto.length);
  }

  // Valor médio da jogada a: aplica, joga até o fim do turno do rival (com a política do Difícil) e avalia.
  function simular(e, p, a, cfg, sementes) {
    const politica = configDe(cfg.politica || 'dificil');
    const rngMotor = M.rngAtual(), aleatorio = Math.random;
    let soma = 0;
    try {
      for (const s of sementes) {
        const g = gerador(s);
        Math.random = g;
        M.definirRng(g);
        try {
          const c = clonar(e);
          determinizar(c, p);
          M.aplicarAcao(c, a);
          jogarAte(c, [politica, politica], e.turno + 2);
          usar(cfg);
          soma += avaliar(c, p);
        } catch (erro) {
          usar(cfg); // simulação que travou (não deve acontecer): vale a mesa de agora
          soma += avaliar(e, p);
        }
      }
    } finally {
      Math.random = aleatorio;
      M.definirRng(rngMotor);
    }
    return soma / sementes.length;
  }

  function proximaAcao(e, p, nivel) {
    const cfg = usar(configDe(nivel));
    const legais = M.acoesLegais(e).filter(a => a.tipo !== 'atacar');
    if (!legais.length) return { tipo: 'atacar' };
    const base = avaliar(e, p);
    let notas = legais.map(a => Object.assign({ a }, valorDepois(e, p, a)));
    // Profundidade 2+: cada jogada vale o melhor que dá para fazer DEPOIS dela no mesmo turno.
    if ((cfg.profundidade || 1) > 1) {
      const largura = cfg.largura || 4;
      notas.sort((x, y) => y.v - x.v);
      const vistos = new Set();
      for (const n of notas) {
        if (vistos.size >= largura) break;
        if (!n.estado) continue;
        const k = chaveSemEspaco(n.a);
        if (vistos.has(k)) continue;
        vistos.add(k);
        n.v = Math.max(n.v, melhorSequencia(n.estado, p, cfg.profundidade - 1, largura));
      }
    }
    // Simulação: as melhores jogadas (e "parar e atacar") são testadas jogando o resto do turno e o turno
    // do rival várias vezes; vence a que deixa a mesa melhor, em média.
    if (cfg.simulacoes) {
      notas.sort((x, y) => y.v - x.v);
      const cands = [{ a: { tipo: 'atacar' } }], vistos = new Set();
      for (const n of notas) {
        if (cands.length > cfg.largura) break;
        const k = chaveSemEspaco(n.a);
        if (vistos.has(k) || !n.estado) continue;
        vistos.add(k);
        cands.push(n);
      }
      const sementes = Array.from({ length: cfg.simulacoes }, () => (Math.random() * 2 ** 32) >>> 0);
      let melhorS = cands[0], melhorV = -Infinity;
      for (const n of cands) {
        const v = simular(e, p, n.a, cfg, sementes);
        if (v > melhorV) {
          melhorV = v;
          melhorS = n;
        }
      }
      usar(cfg);
      return melhorS.a;
    }
    let melhor = null, melhorValor = -Infinity;
    for (const n of notas) {
      const v = n.v + (Math.random() - 0.5) * cfg.ruido;
      if (v > melhorValor) {
        melhorValor = v;
        melhor = n.a;
      }
    }
    return melhor && melhorValor > base + cfg.limiar ? melhor : { tipo: 'atacar' };
  }

  // ---------- Combate ----------

  const forca = (e, uid) => {
    const l = M.localizar(e, uid);
    return l ? M.ataque(e, l.p, l.i) : 0;
  };

  // excluir: o alvo do ataque do Rei, que já defende sozinho e não entra como ajudante.
  function opcoesBloqueio(e, pares, usados, excluir) {
    const aptos = M.bloqueadoresAptos(e).filter(uid => uid !== excluir && (usados[uid] || 0) < M.capacidadeBloqueio(M.localizar(e, uid).u));
    const ops = [[]];
    for (const b of aptos) ops.push([b]);
    if (pares) {
      const top = aptos.slice().sort((a, b) => forca(e, b) - forca(e, a)).slice(0, 4);
      for (let x = 0; x < top.length; x++) for (let y = x + 1; y < top.length; y++) ops.push([top[x], top[y]]);
    }
    return ops;
  }

  // e: em fase de bloqueio com um único ataque.
  function valorEsperado(e, mapa, p) {
    const dist = distribuicaoMaior(e.combate.ataques[0].dados);
    let total = 0;
    for (let r = 1; r <= 6; r++) {
      const c = clonar(e);
      M.definirBloqueios(c, mapa);
      M.resolverProximo(c, [r]);
      total += dist[r - 1] * avaliar(c, p);
    }
    return total;
  }

  // Valor para o atacante, supondo que o defensor responda da melhor forma.
  function valorAtaque(e, p, uid, alvo, ouros, cfg) {
    const c = clonar(e);
    M.declararAtaques(c, [{ atacante: uid, alvo, ouros }]);
    const n = c.combate.ataques[0].n;
    let pior = Infinity;
    const at0 = c.combate.ataques[0];
    const opcoes = opcoesBloqueio(c, cfg.pares, {}, M.ataqueDirecionado(c, at0) ? at0.alvo : null);
    for (const op of opcoes) {
      const v = valorEsperado(c, { [n]: op }, p);
      if (v < pior) pior = v;
    }
    return pior;
  }

  function removerItens(lista, itens) {
    const r = lista.slice();
    for (const it of itens) {
      const k = r.indexOf(it);
      if (k >= 0) r.splice(k, 1);
    }
    return r;
  }

  function declararAtaques(e, p, nivel) {
    const cfg = usar(configDe(nivel));
    const aptos = M.atacantesAptos(e);
    const base = avaliar(e, p);
    let ourosLivres = M.ourosDisponiveis(e, p);
    const plano = [];
    for (const uid of aptos.slice().sort((a, b) => forca(e, b) - forca(e, a))) {
      const u = M.localizar(e, uid).u;
      for (let t = 0; t < u.ataques; t++) {
        let melhor = null, mv = base + cfg.limiar;
        const todos = M.alvosPossiveis(e, uid);
        const alvos = cfg.alvosAs ? todos : todos.filter(a => a === 'jogador' || (u.figura.rank === 'K' && M.localizar(e, a).u.tipo === 'senhor'));
        for (const alvo of alvos) {
          const maxDados = cfg.ourosDados ? Math.min(2, ourosLivres.length) : 0;
          for (let k = 0; k <= maxDados; k++) {
            const ouros = ourosLivres.slice(0, k);
            const v = valorAtaque(e, p, uid, alvo, ouros, cfg) + (Math.random() - 0.5) * cfg.ruido;
            if (v > mv) {
              mv = v;
              melhor = { atacante: uid, alvo, ouros };
            }
          }
        }
        if (!melhor) break;
        plano.push(melhor);
        ourosLivres = removerItens(ourosLivres, melhor.ouros);
      }
    }
    return plano;
  }

  function bloquear(e, d, nivel) {
    const cfg = usar(configDe(nivel));
    const mapa = {}, usados = {};
    const marcar = op => op.forEach(uid => { usados[uid] = (usados[uid] || 0) + 1; });
    const ataques = e.combate.ataques;
    // No ataque do Rei a um Senhor(a), o próprio alvo não entra como ajudante.
    const excluir = at => (M.ataqueDirecionado(e, at) ? at.alvo : null);
    const ordem = ataques.slice().sort((a, b) => forca(e, b.atacante) * b.dados - forca(e, a.atacante) * a.dados);
    for (const at of ordem) {
      const c0 = clonar(e);
      c0.combate.ataques = c0.combate.ataques.filter(x => x.n === at.n);
      let melhor = [], mv = -Infinity;
      for (const op of opcoesBloqueio(e, cfg.pares, usados, excluir(at))) {
        const v = valorEsperado(c0, { [at.n]: op }, d) + (Math.random() - 0.5) * cfg.ruido;
        if (v > mv) {
          mv = v;
          melhor = op;
        }
      }
      mapa[at.n] = melhor;
      marcar(melhor);
    }
    return mapa;
  }

  // ---------- Abertura e descarte ----------

  function escolherFiguras(e, p) {
    const figs = M.figurasNoBaralho(e, p);
    const qtd = Math.min(3, figs.length);
    const escolha = [];
    for (const rank of ['J', 'K', 'Q']) {
      const opcoes = figs.filter(c => c.rank === rank && !escolha.includes(c.id));
      if (opcoes.length && escolha.length < qtd) escolha.push(sortear(opcoes).id);
    }
    const resto = figs.filter(c => !escolha.includes(c.id));
    embaralhar(resto);
    while (escolha.length < qtd) escolha.push(resto.pop().id);
    return escolha;
  }

  function querMulligan(e, p) {
    const nums = e.jogadores[p].mao.filter(M.ehNumero);
    return nums.length < 2 || !nums.some(c => M.valor(c) <= 7);
  }

  function descartar(e, p) {
    const mao = e.jogadores[p].mao;
    const n = mao.length - M.limiteMao(e.jogadores[p]);
    return mao.slice().sort((a, b) => valorCarta(a) - valorCarta(b)).slice(0, n).map(c => c.id);
  }

  // ---------- Partida completa sem interface (para testar o equilíbrio) ----------

  // opcoes: { palhacos: [id, id], decks: [cartas, cartas] } (opcional)
  function partidaAutomatica(niveis, primeiro, limiteTurnos, opcoes) {
    const o = opcoes || {};
    const e = M.criarJogo({ nomes: ['Bot A', 'Bot B'], primeiro, palhacos: o.palhacos, decks: o.decks });
    for (const p of [0, 1]) {
      M.escolherFiguras(e, p, escolherFiguras(e, p, niveis[p]));
      if (querMulligan(e, p, niveis[p])) M.mulligan(e, p);
      else M.confirmarAbertura(e, p);
    }
    jogarAte(e, niveis, limiteTurnos || 200);
    return { vencedor: e.vencedor, turnos: e.turno, primeiro, estado: e };
  }

  // Joga a partida a partir de onde ela estiver (até o turno "limite" ou até alguém vencer).
  function jogarAte(e, niveis, limite) {
    while (e.vencedor == null && e.turno < limite) {
      const p = e.vez;
      while (e.fase === 'compra') M.comprarDoTurno(e, escolherBaralho(e, p, niveis[p])); // o Ourinhos compra 2
      if (e.vencedor != null) break;
      for (let g = 0; g < 12 && e.fase === 'principal'; g++) M.aplicarAcao(e, proximaAcao(e, p, niveis[p]));
      if (e.vencedor != null) break;
      if (e.fase === 'principal') M.aplicarAcao(e, { tipo: 'atacar' });
      M.declararAtaques(e, declararAtaques(e, p, niveis[p]));
      if (e.fase === 'bloqueio') M.definirBloqueios(e, bloquear(e, 1 - p, niveis[1 - p]));
      while (e.fase === 'resolucao') M.resolverProximo(e, rolar(e.combate.ataques[e.combate.indice].dados));
      if (e.vencedor != null) break;
      M.encerrarTurno(e);
      if (e.fase === 'descarte') M.descartar(e, descartar(e, e.vez));
    }
  }

  SS.Bot = { proximaAcao, escolherBaralho, declararAtaques, bloquear, descartar, escolherFiguras, querMulligan, partidaAutomatica, avaliar, caracteristicas, PESOS_BASE, PESOS_APRENDIDOS, PESOS_PRO, NIVEIS };
})(window.SS);
