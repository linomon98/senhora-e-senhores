/* Os 4 Palhaços (os "heróis" do jogo): textos, cores e o deck temático de cada um.
   As regras de cada Palhaço (PV, limite de mão, poderes) ficam no motor: SS.Motor.PALHACOS. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';

  // Decks temáticos: 12 figuras (Letras) + 40 números, sem limite de cópias ou de naipe.
  const LISTA = [
    {
      // Duelista: muitos Valetes de Espadas (entram atacando, Naipados ganham +1) e números baixos de Espadas.
      id: 'lancalotte', nome: 'Lançalotte', naipe: 'espadas', cor: 'azul',
      deck: {
        'J-espadas': 4, 'J-copas': 1, 'J-ouros': 1, 'Q-espadas': 2, 'K-espadas': 3, 'K-ouros': 1,
        '2-espadas': 4, '3-espadas': 4, '4-espadas': 4, '5-espadas': 4, '8-espadas': 2, '9-espadas': 2, '10-espadas': 2, 'A-espadas': 2,
        '2-ouros': 2, '3-ouros': 2, '4-ouros': 2,
        '5-copas': 2, '6-copas': 1, '7-copas': 2, '9-copas': 1,
        '6-paus': 2, '7-paus': 2,
      },
    },
    {
      // Coração teimoso: Reis de Copas Naipados (ferida), muita cura e Ases de Copas (vampiro).
      id: 'infartitte', nome: 'Infartitte', naipe: 'copas', cor: 'vermelho',
      deck: {
        'K-copas': 5, 'Q-copas': 2, 'J-copas': 2, 'K-paus': 1, 'K-espadas': 1, 'J-espadas': 1,
        '3-copas': 2, '4-copas': 2, '5-copas': 3, '6-copas': 4, '7-copas': 4, '8-copas': 2, '9-copas': 2, '10-copas': 2, 'A-copas': 3,
        '5-paus': 2, '6-paus': 2, '7-paus': 2, '8-paus': 1,
        '5-espadas': 2, '7-espadas': 2, '9-espadas': 1,
        '3-ouros': 2, '4-ouros': 2,
      },
    },
    {
      // Muro: Reis e Valetes de Paus Naipados (3 hits), Ases de Paus e Berserk.
      id: 'paumol', nome: 'Paumol', naipe: 'paus', cor: 'verde',
      deck: {
        'K-paus': 4, 'J-paus': 3, 'Q-paus': 2, 'K-copas': 1, 'K-espadas': 1, 'J-ouros': 1,
        '2-paus': 2, '3-paus': 2, '4-paus': 3, '5-paus': 3, '6-paus': 3, '7-paus': 3, '8-paus': 2, '9-paus': 1, '10-paus': 1, 'A-paus': 4,
        '4-copas': 2, '6-copas': 2, '8-copas': 1,
        '5-espadas': 2, '7-espadas': 2, '9-espadas': 1,
        '2-ouros': 2, '3-ouros': 2, '5-ouros': 2,
      },
    },
    {
      // Banqueiro ladrão: Valetes de Ouros Naipados (2 ataques por turno), Ouros para trocar cartas e dados extras.
      id: 'ourinhos', nome: 'Ourinhos', naipe: 'ouros', cor: 'dourado',
      deck: {
        'J-ouros': 4, 'Q-ouros': 2, 'K-ouros': 2, 'J-espadas': 1, 'J-copas': 1, 'K-paus': 1, 'Q-espadas': 1,
        '2-ouros': 3, '3-ouros': 3, '4-ouros': 3, '5-ouros': 3, '6-ouros': 2, '7-ouros': 2, '9-ouros': 1, '10-ouros': 1, 'A-ouros': 3,
        '4-espadas': 2, '8-espadas': 2, '10-espadas': 1,
        '3-copas': 2, '5-copas': 2, '7-copas': 2,
        '4-paus': 2, '5-paus': 2, '6-paus': 2, '7-paus': 2,
      },
    },
  ];

  // Textos de cada Palhaço nos dois idiomas (os nomes ficam iguais).
  const TEXTOS = {
    lancalotte: {
      pt: {
        titulo: 'o duelista',
        passiva: { nome: 'Golpe certeiro', texto: 'O 1º ataque de cada turno ganha +1 dado (vale o maior) e +1 de ataque. Começa com 19 PV.' },
        poder: { nome: 'Desafio!', texto: 'Escolha um Senhor(a) inimigo ativo: neste turno ele(a) é obrigado(a) a bloquear o seu primeiro ataque (se puder).' },
        plano: 'Ataca cedo e forte: Valetes entram atacando, Rainhas fecham o jogo, Naipados de Espadas ganham +1.',
      },
      en: {
        titulo: 'the duelist',
        passiva: { nome: 'True Strike', texto: 'The 1st attack each turn gets +1 die (the highest counts) and +1 attack. Starts with 19 HP.' },
        poder: { nome: 'Challenge!', texto: 'Choose a ready enemy Gentleman: this turn it must block your first attack (if it can).' },
        plano: 'Attacks early and hard: Jacks come in swinging, Queens close the game, Suited Spades get +1.',
      },
    },
    infartitte: {
      pt: {
        titulo: 'o coração teimoso',
        passiva: { nome: 'Coração forte', texto: 'Começa com 27 PV (os outros começam com 18 a 20).' },
        poder: { nome: 'Transfusão', texto: 'Pague 2 PV para tirar 1 hit de um Senhor(a) seu.' },
        plano: 'Aguenta e drena: Reis seguram a linha, Copas cura, Naipados de Copas aplicam ferida.',
      },
      en: {
        titulo: 'the stubborn heart',
        passiva: { nome: 'Strong Heart', texto: 'Starts with 27 HP (the others start with 18 to 20).' },
        poder: { nome: 'Transfusion', texto: 'Pay 2 HP to remove 1 hit from one of your Gentlemen.' },
        plano: 'Endures and drains: Kings hold the line, Hearts heal, Suited Hearts inflict wounds.',
      },
    },
    paumol: {
      pt: {
        titulo: 'o muro',
        passiva: { nome: 'Casca grossa', texto: 'Seus Senhores com carta de Paus (na figura ou no número) recebem 1 de dano a menos ao defender. Começa com 18 PV.' },
        poder: { nome: 'Vigília', texto: 'Escolha 1 Senhor(a) seu: ele(a) não vira para baixo no fim deste turno (ataca e ainda pode bloquear).' },
        plano: 'Ninguém passa: Naipados de Paus aguentam 3 hits e Ases de Paus deixam a fileira mais resistente.',
      },
      en: {
        titulo: 'the wall',
        passiva: { nome: 'Thick Bark', texto: 'Your Gentlemen with a Clubs card (face or number) take 1 less damage when defending. Starts with 18 HP.' },
        poder: { nome: 'Vigil', texto: "Choose 1 of your Gentlemen: it doesn't flip face down at the end of this turn (it attacks and can still block)." },
        plano: 'None shall pass: Suited Clubs survive 3 hits and Aces of Clubs make the row sturdier.',
      },
    },
    ourinhos: {
      pt: {
        titulo: 'o banqueiro',
        passiva: { nome: 'Cofre cheio', texto: 'Limite de mão de 9 cartas (em vez de 7). Começa com 20 PV.' },
        poder: { nome: 'Cobrança', texto: 'Rouba 1 carta sorteada da mão do oponente.' },
        plano: 'Rouba e acumula: tira as cartas do oponente e usa Valetes Naipados de Ouros, que atacam 2 vezes no mesmo turno.',
      },
      en: {
        titulo: 'the banker',
        passiva: { nome: 'Full Vault', texto: 'Hand limit of 9 cards (instead of 7). Starts with 20 HP.' },
        poder: { nome: 'Debt Collection', texto: "Steals 1 random card from the opponent's hand." },
        plano: "Steals and hoards: takes the opponent's cards and uses Suited Jacks of Diamonds, which attack twice in the same turn.",
      },
    },
  };
  // Retrato de cada Palhaço (provisório). Para trocar a arte, substitua o arquivo com o mesmo nome.
  for (const pal of LISTA) pal.retrato = `arte/palhacos/${pal.id}.jpg`;

  for (const pal of LISTA) {
    for (const campo of ['titulo', 'passiva', 'poder', 'custo', 'plano']) {
      Object.defineProperty(pal, campo, {
        enumerable: true,
        get: () => {
          const tx = TEXTOS[pal.id];
          const lingua = SS.Idioma && tx[SS.Idioma.atual()] ? SS.Idioma.atual() : 'pt';
          return tx[lingua][campo];
        },
      });
    }
  }

  const POR_ID = Object.fromEntries(LISTA.map(p => [p.id, p]));

  SS.Palhacos = {
    LISTA,
    get: id => POR_ID[id],
  };
})(window.SS);
