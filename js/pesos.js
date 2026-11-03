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

/* Pesos novos (03/11/2026), treinados nas regras oficiais atuais (compra de 2 cartas, Ás de Ouros com +1 dado, Pargias e Trígicas)
   e com os decks temáticos: estratégia evolutiva (50 iterações de 288 partidas, sorte comum entre as variações), a partir dos pesos
   de 27/10/2026. Usados por todos os níveis (ver bot.js). Venceram os pesos e o bot anteriores em 58% de 1200 partidas no Médio. */
window.SS.PESOS_NOVOS = {
  pvBaixo: 2.326, pvAlto: 0.407, perigo: 2.351, desafio: 1.217, asBase: 2.655, asVizinho: 1.307, uBase: 0.696, uAtk: 2.426, uVida: 1.749, uNaipado: 1.645, uRealeza: 1.072, uPorUmFio: 1.152, uNaoBloqueia: 0.527, uVigilia: 0.328, uBonus: 1.057, maoNum: -0.042, maoAs: 1.663, maoPar: 8.226, maoFigSolta: 0.371, maoNumSolto: 0.661, opMao: 0.806, ferida: 3.374, deckPouco: 0.565, ameaca: -0.088, bloqueadores: 0.048, maoParIgual: 3.603, maoOuros: 0.396, maoCopas: 0.366, maoTrinca: 1.58, uTotem: 0.513, uCheio: 0.545,
};
window.SS.LIMIAR_NOVO = 0.059;
