/* Bot de "Senhora e Senhores".
   - Fácil: jogadas válidas aleatórias.
   - Médio: escolhe a melhor jogada pela avaliação da mesa, com um pouco de "ruído".
   - Difícil: sem ruído, considera atacar Ases, gastar Ouros em dados extras e bloqueios em dupla.
   Ataques e bloqueios são decididos pelo valor esperado de todas as rolagens possíveis. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';
  const M = SS.Motor;
  const clonar = typeof structuredClone === 'function' ? structuredClone : o => JSON.parse(JSON.stringify(o));
  const NIVEIS = {
    medio: { ruido: 4.5, limiar: 0.4, alvosAs: false, ourosDados: false, pares: false },
    dificil: { ruido: 0, limiar: 0.15, alvosAs: true, ourosDados: true, pares: true },
  };
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
        v += M.valor(c) * 0.04;
      } else v += 1.6;
    }
    const pares = Math.min(figuras, numeros);
    return v + pares * 3.4 + (figuras - pares) * 1.0 + (numeros - pares) * 1.0;
  }

  // Escolhe o baralho da compra do turno pelo valor médio da mão depois de comprar.
  function escolherBaralho(e, p, nivel) {
    const j = e.jogadores[p];
    const opcoes = M.BARALHOS.filter(b => j[b].length);
    if (nivel === 'facil' || opcoes.length < 2) return sortear(opcoes.length ? opcoes : ['numeros']);
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

  function valorUnidade(e, p, i) {
    const j = e.jogadores[p], u = j.campo[i];
    if (u.tipo === 'as') {
      let v = 2.5;
      for (const k of [i - 1, i + 1]) {
        const w = j.campo[k];
        if (w && w.tipo === 'senhor') v += 1.2;
      }
      return v;
    }
    const atk = M.ataqueBase(e, p, i), res = M.resistencia(e, p, i);
    let hits = u.hits;
    if (u.berserk) hits = u.berserk.hits > 0 ? res : Math.max(0, u.hits - 1);
    let v = 1 + atk * 1.1 + Math.max(0, res - hits) * 1.8;
    if (M.naipado(u)) v += 1.5;
    if (u.figura.rank === 'K' || u.figura.rank === 'Q') v += 1;
    if (!u.berserk && res > 1 && hits === res - 1) v -= 1.5; // por um fio: o próximo hit mata
    if (e.vez === p && (!u.ativo || (u.atacou && !u.vigilia))) v -= 1.2; // não vai poder bloquear no turno do oponente
    if (e.vez === p && u.vigilia && !u.atacou) v += 0.6; // pode atacar sem perder o bloqueio
    if (M.podeAtacar(e, p, i)) v += u.bonus.length * 0.9;
    return v;
  }

  const perigo = pv => (pv <= 6 ? (7 - pv) * 2.5 : 0);
  // PV alto vale um pouco menos por ponto: a partir de 14 PV, cada ponto vale metade.
  const valorPV = pv => (pv <= 14 ? pv * 3 : 42 + (pv - 14) * 1.5);

  function avaliar(e, p) {
    if (e.vencedor != null) return e.vencedor === p ? 10000 : -10000;
    const eu = e.jogadores[p], op = e.jogadores[1 - p];
    let s = valorPV(eu.pv) - valorPV(op.pv) - perigo(eu.pv) + perigo(op.pv);
    if (e.vez === p && e.desafio != null) s += 1.2; // Desafio! do Lançalotte armado para o ataque
    for (let i = 0; i < M.ESPACOS; i++) {
      if (eu.campo[i]) s += valorUnidade(e, p, i);
      if (op.campo[i]) s -= valorUnidade(e, 1 - p, i);
    }
    s += valorMao(eu.mao);
    s -= op.mao.length * 1.2;
    if (isFinite(M.tetoCura(eu))) s -= 2; // ferida de Copas: não pode curar
    if (isFinite(M.tetoCura(op))) s += 2;
    const restantes = eu.letras.length + eu.numeros.length;
    if (restantes < 5) s -= 5 - restantes;
    return s;
  }

  // ---------- Fase principal ----------

  function proximaAcao(e, p, nivel) {
    const legais = M.acoesLegais(e).filter(a => a.tipo !== 'atacar');
    if (!legais.length) return { tipo: 'atacar' };
    if (nivel === 'facil') {
      if (Math.random() < 0.25) return { tipo: 'atacar' };
      const preferidas = legais.filter(a => a.tipo !== 'reviver');
      return sortear(preferidas.length ? preferidas : legais);
    }
    const cfg = NIVEIS[nivel];
    const base = avaliar(e, p);
    let melhor = null, melhorValor = -Infinity;
    for (const a of legais) {
      let v;
      if (a.tipo === 'comprar') {
        // O bot não pode "espiar" o topo do baralho: faz a média de algumas compras embaralhadas.
        v = 0;
        for (let k = 0; k < 4; k++) {
          const c = clonar(e);
          embaralhar(c.jogadores[p][a.baralho]);
          M.aplicarAcao(c, a);
          v += avaliar(c, p) / 4;
        }
      } else {
        const c = clonar(e);
        M.aplicarAcao(c, a);
        v = avaliar(c, p);
      }
      v += (Math.random() - 0.5) * cfg.ruido;
      if (v > melhorValor) {
        melhorValor = v;
        melhor = a;
      }
    }
    return melhor && melhorValor > base + cfg.limiar ? melhor : { tipo: 'atacar' };
  }

  // ---------- Combate ----------

  const forca = (e, uid) => {
    const l = M.localizar(e, uid);
    return l ? M.ataque(e, l.p, l.i) : 0;
  };

  function opcoesBloqueio(e, pares, usados) {
    const aptos = M.bloqueadoresAptos(e).filter(uid => (usados[uid] || 0) < M.capacidadeBloqueio(M.localizar(e, uid).u));
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
    // Ataque do Rei contra um Senhor(a) não pode ser bloqueado.
    const opcoes = M.ataqueDirecionado(c, c.combate.ataques[0]) ? [[]] : opcoesBloqueio(c, cfg.pares, {});
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
    const aptos = M.atacantesAptos(e);
    if (nivel === 'facil') return aptos.filter(() => Math.random() < 0.6).map(uid => ({ atacante: uid, alvo: 'jogador', ouros: [] }));
    const cfg = NIVEIS[nivel];
    const base = avaliar(e, p);
    let ourosLivres = M.ourosDisponiveis(e, p);
    const plano = [];
    for (const uid of aptos.slice().sort((a, b) => forca(e, b) - forca(e, a))) {
      const u = M.localizar(e, uid).u;
      for (let t = 0; t < u.ataques; t++) {
        let melhor = null, mv = base + cfg.limiar;
        // O Rei sempre considera mirar um Senhor(a); Ases só no Difícil.
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
    const mapa = {}, usados = {};
    const marcar = op => op.forEach(uid => { usados[uid] = (usados[uid] || 0) + 1; });
    const ataques = e.combate.ataques.filter(at => !M.ataqueDirecionado(e, at)); // ataque do Rei a um Senhor não se bloqueia
    if (nivel === 'facil') {
      for (const at of ataques) {
        if (Math.random() < 0.5) continue;
        const ops = opcoesBloqueio(e, false, usados).filter(o => o.length);
        if (!ops.length) continue;
        mapa[at.n] = sortear(ops);
        marcar(mapa[at.n]);
      }
      return mapa;
    }
    const cfg = NIVEIS[nivel];
    const ordem = ataques.slice().sort((a, b) => forca(e, b.atacante) * b.dados - forca(e, a.atacante) * a.dados);
    for (const at of ordem) {
      const c0 = clonar(e);
      c0.combate.ataques = c0.combate.ataques.filter(x => x.n === at.n);
      let melhor = [], mv = -Infinity;
      for (const op of opcoesBloqueio(e, cfg.pares, usados)) {
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

  function escolherFiguras(e, p, nivel) {
    const figs = M.figurasNoBaralho(e, p);
    const qtd = Math.min(3, figs.length);
    const escolha = [];
    if (nivel !== 'facil') {
      for (const rank of ['J', 'K', 'Q']) {
        const opcoes = figs.filter(c => c.rank === rank && !escolha.includes(c.id));
        if (opcoes.length && escolha.length < qtd) escolha.push(sortear(opcoes).id);
      }
    }
    const resto = figs.filter(c => !escolha.includes(c.id));
    embaralhar(resto);
    while (escolha.length < qtd) escolha.push(resto.pop().id);
    return escolha;
  }

  function querMulligan(e, p, nivel) {
    if (nivel === 'facil') return false;
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
    const limite = limiteTurnos || 200;
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
    return { vencedor: e.vencedor, turnos: e.turno, primeiro, estado: e };
  }

  SS.Bot = { proximaAcao, escolherBaralho, declararAtaques, bloquear, descartar, escolherFiguras, querMulligan, partidaAutomatica, avaliar };
})(window.SS);
