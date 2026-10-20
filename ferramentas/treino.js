/* Treino do bot por autojogo (aprendizado de máquina no navegador, sem instalar nada).

   Como usar: abra o jogo no navegador e, no console (F12), rode:
     var s = document.createElement('script'); s.src = 'ferramentas/treino.js'; document.head.appendChild(s);
     SS.Treino.treinar({ rodadas: 4, partidas: 250 });   // acompanhe em SS.Treino.estado
   No fim, SS.Treino.estado.melhor tem os pesos aprendidos: copie para js/pesos.js.

   Como funciona:
   1. Coleta: bots jogam entre si; em cada decisão, guarda as características da mesa (bot.js:
      caracteristicas) do ponto de vista dos dois jogadores e, no fim, quem ganhou.
   2. Aprende: regressão logística — descobre quanto cada característica pesa na chance de vencer.
      Os pesos viram a nova "nota" da mesa do bot (normalizados para 1 PV valer o mesmo que no bot antigo).
   3. Repete: o bot novo gera partidas novas (aprende com um jogador melhor) e treina de novo.
   4. Mede: cada versão joga contra o bot de pesos feitos à mão; fica a que mais vence. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';
  const M = SS.Motor, B = SS.Bot, P = SS.Palhacos;
  const CHAVES = Object.keys(B.PESOS_BASE);
  const IDS = P.LISTA.map(x => x.id);
  const rolar = n => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
  // Pausa curta para a página respirar (MessageChannel não é freado como setTimeout em aba escondida).
  const canal = new MessageChannel(), filaPausa = [];
  canal.port1.onmessage = () => { const r = filaPausa.shift(); if (r) r(); };
  const pausa = () => new Promise(r => { filaPausa.push(r); canal.port2.postMessage(0); });

  const config = (pesos, extra) => Object.assign({ pesos, ruido: 0, limiar: 0.15, alvosAs: true, ourosDados: true, pares: true, profundidade: 1 }, extra || {});

  // Uma partida completa entre duas configurações de bot (cfgs[0] e cfgs[1]), com Palhaços sorteados.
  // amostras (opcional): recebe { x: [características], p } em cada decisão, rotuladas no fim.
  function partida(cfgs, amostras) {
    let a = IDS[Math.floor(Math.random() * IDS.length)], b;
    do b = IDS[Math.floor(Math.random() * IDS.length)]; while (b === a);
    const palhacos = [a, b];
    const e = M.criarJogo({ nomes: ['A', 'B'], primeiro: Math.random() < 0.5 ? 0 : 1, palhacos, decks: palhacos.map((x, k) => M.cartasDoDeck(P.get(x).deck, k)) });
    for (const p of [0, 1]) {
      M.escolherFiguras(e, p, B.escolherFiguras(e, p, cfgs[p]));
      if (B.querMulligan(e, p, cfgs[p])) M.mulligan(e, p);
      else M.confirmarAbertura(e, p);
    }
    const locais = [];
    const guardar = () => {
      if (!amostras) return;
      for (const q of [0, 1]) {
        const F = B.caracteristicas(e, q);
        locais.push({ x: CHAVES.map(k => F[k]), p: q });
      }
    };
    while (e.vencedor == null && e.turno < 200) {
      const p = e.vez;
      while (e.fase === 'compra') M.comprarDoTurno(e, B.escolherBaralho(e, p, cfgs[p]));
      if (e.vencedor != null) break;
      guardar();
      for (let g = 0; g < 12 && e.fase === 'principal'; g++) M.aplicarAcao(e, B.proximaAcao(e, p, cfgs[p]));
      if (e.vencedor != null) break;
      if (e.fase === 'principal') M.aplicarAcao(e, { tipo: 'atacar' });
      guardar();
      M.declararAtaques(e, B.declararAtaques(e, p, cfgs[p]));
      if (e.fase === 'bloqueio') M.definirBloqueios(e, B.bloquear(e, 1 - p, cfgs[1 - p]));
      while (e.fase === 'resolucao') M.resolverProximo(e, rolar(e.combate.ataques[e.combate.indice].dados));
      if (e.vencedor != null) break;
      M.encerrarTurno(e);
      if (e.fase === 'descarte') M.descartar(e, B.descartar(e, e.vez));
    }
    if (amostras && e.vencedor != null) for (const s of locais) amostras.push({ x: s.x, y: s.p === e.vencedor ? 1 : 0 });
    return e.vencedor;
  }

  // Taxa de vitória de A contra B em n partidas (A alterna de cadeira).
  async function confronto(cfgA, cfgB, n) {
    let v = 0, t = 0;
    for (let k = 0; k < n; k++) {
      const aEm0 = k % 2 === 0;
      const w = partida(aEm0 ? [cfgA, cfgB] : [cfgB, cfgA]);
      if (w != null) {
        t++;
        if ((w === 0) === aEm0) v++;
      }
      if (k % 4 === 3) await pausa();
    }
    return t ? v / t : 0.5;
  }

  // Regressão logística (com L2) sobre as amostras; devolve os pesos já normalizados (pvBaixo = 3).
  function ajustar(amostras, opcoes) {
    const o = Object.assign({ passos: 400, taxa: 0.5, l2: 1e-3 }, opcoes || {});
    const d = CHAVES.length, n = amostras.length;
    const media = new Array(d).fill(0), desvio = new Array(d).fill(0);
    for (const s of amostras) s.x.forEach((v, k) => { media[k] += v / n; });
    for (const s of amostras) s.x.forEach((v, k) => { desvio[k] += (v - media[k]) ** 2 / n; });
    for (let k = 0; k < d; k++) desvio[k] = Math.sqrt(desvio[k]) || 1;
    const z = amostras.map(s => s.x.map((v, k) => (v - media[k]) / desvio[k]));
    const beta = new Array(d).fill(0);
    let b0 = 0;
    for (let it = 0; it < o.passos; it++) {
      const g = new Array(d).fill(0);
      let g0 = 0;
      for (let i = 0; i < n; i++) {
        let s = b0;
        for (let k = 0; k < d; k++) s += beta[k] * z[i][k];
        const erro = 1 / (1 + Math.exp(-s)) - amostras[i].y;
        g0 += erro;
        for (let k = 0; k < d; k++) g[k] += erro * z[i][k];
      }
      b0 -= o.taxa * g0 / n;
      for (let k = 0; k < d; k++) beta[k] -= o.taxa * (g[k] / n + o.l2 * beta[k]);
    }
    // Volta para a escala original das características e normaliza: 1 PV vale como no bot antigo.
    const w = beta.map((b, k) => b / desvio[k]);
    const kPv = CHAVES.indexOf('pvBaixo');
    const escala = w[kPv] > 1e-6 ? B.PESOS_BASE.pvBaixo / w[kPv] : 1;
    const pesos = {};
    CHAVES.forEach((k, i) => { pesos[k] = Math.round(w[i] * escala * 1000) / 1000; });
    // Acerto (fração de previsões certas), para acompanhar.
    let certos = 0;
    for (let i = 0; i < n; i++) {
      let s = b0;
      for (let k = 0; k < d; k++) s += beta[k] * z[i][k];
      if ((s > 0) === (amostras[i].y === 1)) certos++;
    }
    return { pesos, acerto: certos / n };
  }

  const estado = { fase: 'parado', log: [], melhor: null, amostras: 0 };

  async function treinar(opcoes) {
    const o = Object.assign({ rodadas: 4, partidas: 250, avaliacao: 200 }, opcoes || {});
    estado.fase = 'rodando';
    estado.log = [];
    const base = config(B.PESOS_BASE);
    let atual = B.PESOS_BASE, melhor = { pesos: B.PESOS_BASE, vitoria: 0.5 };
    let amostras = [];
    for (let r = 1; r <= o.rodadas && estado.fase === 'rodando'; r++) {
      // Coleta: o bot atual contra ele mesmo (com um pouco de ruído para variar as partidas) e contra o antigo.
      const jogador = config(atual, { ruido: 1.5 }), antigo = config(B.PESOS_BASE, { ruido: 1.5 });
      for (let k = 0; k < o.partidas && estado.fase === 'rodando'; k++) {
        partida(k % 3 === 2 ? [jogador, antigo] : [jogador, jogador], amostras);
        estado.progresso = `rodada ${r}: partida ${k + 1}/${o.partidas}`;
        if (k % 3 === 2) await pausa();
      }
      if (amostras.length > 60000) amostras = amostras.slice(-60000);
      estado.amostras = amostras.length;
      const { pesos, acerto } = ajustar(amostras);
      estado.progresso = `rodada ${r}: medindo contra o bot antigo`;
      const vitoria = await confronto(config(pesos), base, o.avaliacao);
      estado.log.push({ rodada: r, amostras: amostras.length, acerto: Math.round(acerto * 1000) / 10 + '%', vitoriaContraAntigo: Math.round(vitoria * 1000) / 10 + '%', pesos });
      if (vitoria > melhor.vitoria) melhor = { pesos, vitoria, rodada: r };
      estado.melhor = melhor;
      atual = pesos;
      await pausa();
    }
    estado.fase = 'pronto';
    return melhor;
  }

  // ---------- Estratégia de evolução (o método que de fato melhora o jogo) ----------
  // A regressão aprende a PREVER quem vence, mas isso não garante jogar melhor (correlação não é causa).
  // Aqui o bot aprende pelo resultado: a cada passo, sorteia um "empurrão" nos pesos, joga a versão
  // (pesos + empurrão) contra (pesos − empurrão) e anda na direção de quem ganhou mais.
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  async function evoluir(opcoes) {
    const o = Object.assign({ iteracoes: 150, jogos: 16, sigma: 0.2, taxa: 0.6, avaliarCada: 25, avaliacao: 200, inicio: B.PESOS_BASE }, opcoes || {});
    estado.fase = 'rodando';
    estado.log = [];
    const base = o.rival || config(B.PESOS_BASE); // contra quem medir (padrão: o bot de pesos feitos à mão)
    let theta = Object.assign({}, o.inicio);
    let melhor = { pesos: Object.assign({}, theta), vitoria: 0.5, iteracao: 0 };
    for (let it = 1; it <= o.iteracoes && estado.fase === 'rodando'; it++) {
      const delta = {}, mais = {}, menos = {};
      for (const k of CHAVES) {
        delta[k] = gauss() * o.sigma * Math.max(0.5, Math.abs(theta[k]));
        mais[k] = theta[k] + delta[k];
        menos[k] = theta[k] - delta[k];
      }
      const v = await confronto(config(mais), config(menos), o.jogos);
      const s = v - 0.5;
      for (const k of CHAVES) theta[k] = Math.round((theta[k] + o.taxa * 2 * s * delta[k]) * 1000) / 1000;
      // O peso de 1 PV fica fixo: é a "moeda" da nota (o resto é medido em relação a ele).
      theta.pvBaixo = B.PESOS_BASE.pvBaixo;
      estado.progresso = `iteração ${it}/${o.iteracoes} (mais × menos: ${Math.round(v * 100)}%)`;
      if (it % o.avaliarCada === 0) {
        estado.progresso = `iteração ${it}: medindo contra o bot antigo`;
        const vb = await confronto(config(theta), base, o.avaliacao);
        estado.log.push({ iteracao: it, vitoriaContraAntigo: Math.round(vb * 1000) / 10 + '%', pesos: Object.assign({}, theta) });
        if (vb > melhor.vitoria) melhor = { pesos: Object.assign({}, theta), vitoria: vb, iteracao: it };
        estado.melhor = melhor;
      }
    }
    estado.fase = 'pronto';
    return melhor;
  }

  SS.Treino = { treinar, evoluir, confronto, partida, ajustar, config, estado, CHAVES, parar: () => { estado.fase = 'parado'; } };
})(window.SS);
