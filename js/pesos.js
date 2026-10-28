/* Pesos aprendidos pelo bot (gerados por ferramentas/treino.js, SS.Treino.evoluir: estratégia de evolução
   com autojogo — 200 iterações de 20 partidas). Usados pelos níveis Médio, Difícil e Profissional (ver bot.js).
   Contra o bot de pesos feitos à mão (o Fácil) estes pesos venceram 64% de 400 partidas novas. */
window.SS = window.SS || {};
window.SS.PESOS_APRENDIDOS = {
  pvBaixo: 3, pvAlto: 0.461, perigo: 2.88, desafio: 1.302,
  asBase: 2.765, asVizinho: 1.32,
  uBase: 0.743, uAtk: 2.209, uVida: 0.927, uNaipado: 1.621, uRealeza: 1.05, uPorUmFio: 1.14, uNaoBloqueia: 1.195, uVigilia: 0.431, uBonus: 1.108,
  maoNum: -0.255, maoAs: 1.129, maoPar: 4.438, maoFigSolta: 0.655, maoNumSolto: 0.692,
  opMao: 0.683, ferida: 3.362, deckPouco: 0.555,
  ameaca: 0.003, bloqueadores: 0.156,
};

/* Profissional: 2ª rodada de treino (90 iterações de 30 partidas), começando dos pesos acima e medida
   contra o Difícil (~53% de 300 partidas no treino). */
window.SS.PESOS_PRO = {
  pvBaixo: 3, pvAlto: 0.386, perigo: 3.014, desafio: 1.288,
  asBase: 2.645, asVizinho: 1.165,
  uBase: 0.729, uAtk: 2.2, uVida: 1.128, uNaipado: 1.695, uRealeza: 0.956, uPorUmFio: 1.062, uNaoBloqueia: 1.06, uVigilia: 0.441, uBonus: 1.295,
  maoNum: -0.309, maoAs: 1.119, maoPar: 4.946, maoFigSolta: 0.642, maoNumSolto: 0.837,
  opMao: 0.644, ferida: 3.44, deckPouco: 0.522,
  ameaca: -0.038, bloqueadores: 0.183,
};

/* Pesos novos (27/10/2026), treinados nas regras oficiais novas e com os decks temáticos novos: estratégia evolutiva
   (80 iterações de 576 partidas, sorte comum entre as variações), a partir dos pesos aprendidos acima.
   Usados por todos os níveis (ver bot.js). Venceram o Difícil antigo em 59% de 300 partidas (60% contra o publicado). */
window.SS.PESOS_NOVOS = {
  pvBaixo: 2.326, pvAlto: 0.443, perigo: 2.52, desafio: 1.283, asBase: 2.837, asVizinho: 1.543, uBase: 0.777, uAtk: 2.008, uVida: 1.042, uNaipado: 1.556, uRealeza: 0.9, uPorUmFio: 1.215, uNaoBloqueia: 0.585, uVigilia: 0.383, uBonus: 1.156, maoNum: -0.217, maoAs: 1.261, maoPar: 6.983, maoFigSolta: 0.492, maoNumSolto: 0.733, opMao: 0.708, ferida: 3.027, deckPouco: 0.571, ameaca: 0.036, bloqueadores: 0.133, maoParIgual: 2.584, maoOuros: 0.296, maoCopas: 0.286,
};
window.SS.LIMIAR_NOVO = 0.055;
