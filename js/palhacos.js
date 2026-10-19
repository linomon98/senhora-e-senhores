/* Os 4 Palhaços (os "heróis" do jogo): textos, cores e o deck temático de cada um.
   As regras de cada Palhaço (PV, compras, poderes) ficam no motor: SS.Motor.PALHACOS. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';

  const LISTA = [
    {
      id: 'lancalotte', nome: 'Lançalotte', naipe: 'espadas', cor: 'azul',
      deck: {
        'J-espadas': 2, 'Q-espadas': 2, 'K-espadas': 1, 'J-copas': 1, 'J-ouros': 1, 'J-paus': 1,
        'Q-copas': 1, 'Q-ouros': 1, 'K-copas': 1, 'K-paus': 1,
        'A-espadas': 2, '3-espadas': 2, '4-espadas': 3, '5-espadas': 3, '8-espadas': 2, '9-espadas': 2, '10-espadas': 2,
        'A-ouros': 1, '2-ouros': 2, '3-ouros': 2, '4-ouros': 1, '5-ouros': 2,
        '4-copas': 2, '5-copas': 2, '7-copas': 1, '8-copas': 1, '9-copas': 1, '10-copas': 1,
        '4-paus': 2, '5-paus': 2, '7-paus': 1, '8-paus': 1, '9-paus': 1, '10-paus': 1,
      },
    },
    {
      id: 'infartitte', nome: 'Infartitte', naipe: 'copas', cor: 'vermelho',
      deck: {
        'K-copas': 2, 'Q-copas': 2, 'J-copas': 1, 'K-espadas': 1, 'K-paus': 1, 'K-ouros': 1,
        'Q-ouros': 1, 'J-espadas': 1, 'J-paus': 1, 'J-ouros': 1,
        'A-copas': 3, '3-copas': 2, '5-copas': 2, '6-copas': 2, '7-copas': 3, '8-copas': 2, '9-copas': 1, '10-copas': 1,
        '4-paus': 2, '6-paus': 2, '7-paus': 2, '8-paus': 1, '9-paus': 1,
        'A-ouros': 1, '2-ouros': 2, '3-ouros': 2, '5-ouros': 1, '6-ouros': 1, '7-ouros': 1,
        '4-espadas': 2, '5-espadas': 2, '7-espadas': 2, '9-espadas': 1, '10-espadas': 1,
      },
    },
    {
      id: 'paumol', nome: 'Paumol', naipe: 'paus', cor: 'verde',
      deck: {
        'K-paus': 2, 'Q-paus': 1, 'J-paus': 2, 'K-copas': 1, 'K-ouros': 1, 'K-espadas': 1,
        'Q-copas': 1, 'Q-espadas': 1, 'J-ouros': 1, 'J-copas': 1,
        'A-paus': 3, '4-paus': 2, '5-paus': 2, '6-paus': 3, '7-paus': 4, '8-paus': 1, '10-paus': 1,
        '5-copas': 2, '6-copas': 2, '7-copas': 2, '9-copas': 1, '10-copas': 1,
        '2-espadas': 1, '4-espadas': 2, '6-espadas': 2, '7-espadas': 1, '9-espadas': 1, '10-espadas': 1,
        'A-ouros': 1, '2-ouros': 2, '3-ouros': 2, '5-ouros': 2, '7-ouros': 1,
      },
    },
    {
      id: 'ourinhos', nome: 'Ourinhos', naipe: 'ouros', cor: 'dourado',
      deck: {
        'J-ouros': 2, 'Q-ouros': 2, 'K-ouros': 1, 'J-copas': 1, 'J-paus': 1, 'J-espadas': 1,
        'Q-copas': 1, 'Q-espadas': 1, 'K-paus': 1, 'K-copas': 1,
        'A-ouros': 3, '2-ouros': 2, '3-ouros': 3, '4-ouros': 3, '5-ouros': 3, '9-ouros': 1, '10-ouros': 1,
        '4-espadas': 1, '5-espadas': 2, '8-espadas': 2, '9-espadas': 1, '10-espadas': 2,
        '3-copas': 1, '5-copas': 2, '6-copas': 1, '8-copas': 2, '10-copas': 2,
        '2-paus': 1, '4-paus': 2, '5-paus': 2, '7-paus': 2, '9-paus': 1,
      },
    },
  ];

  // Textos de cada Palhaço nos dois idiomas (os nomes ficam iguais).
  const TEXTOS = {
    lancalotte: {
      pt: {
        titulo: 'o duelista',
        passiva: { nome: 'Golpe certeiro', texto: 'O 1º ataque de cada turno ganha +1 dado (vale o maior) e +1 de ataque.' },
        poder: { nome: 'Desafio!', texto: 'Escolha um Senhor(a) inimigo ativo: neste turno ele(a) é obrigado(a) a bloquear o seu primeiro ataque (se puder).' },
        plano: 'Ataca cedo e forte: Valetes entram atacando, Rainhas fecham o jogo, Naipados de Espadas ganham +1.',
      },
      en: {
        titulo: 'the duelist',
        passiva: { nome: 'True Strike', texto: 'The 1st attack each turn gets +1 die (the highest counts) and +1 attack.' },
        poder: { nome: 'Challenge!', texto: 'Choose a ready enemy Lord: this turn it must block your first attack (if it can).' },
        plano: 'Attacks early and hard: Jacks come in swinging, Queens close the game, Suited Spades get +1.',
      },
    },
    infartitte: {
      pt: {
        titulo: 'o coração teimoso',
        passiva: { nome: 'Coração forte', texto: 'Começa com 24 PV em vez de 20.' },
        poder: { nome: 'Transfusão', texto: 'Pague 2 PV para tirar 1 hit de um Senhor(a) seu.' },
        plano: 'Aguenta e drena: Reis seguram a linha, Copas cura, Naipados de Copas aplicam ferida.',
      },
      en: {
        titulo: 'the stubborn heart',
        passiva: { nome: 'Strong Heart', texto: 'Starts with 24 HP instead of 20.' },
        poder: { nome: 'Transfusion', texto: 'Pay 2 HP to remove 1 hit from one of your Lords.' },
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
        passiva: { nome: 'Thick Bark', texto: 'Your Lords with a Clubs card (face or number) take 1 less damage when defending. Starts with 18 HP.' },
        poder: { nome: 'Vigil', texto: "Choose 1 of your Lords: it doesn't flip face down at the end of this turn (it attacks and can still block)." },
        plano: 'None shall pass: Suited Clubs survive 3 hits and Aces of Clubs make the row sturdier.',
      },
    },
    ourinhos: {
      pt: {
        titulo: 'o banqueiro',
        passiva: { nome: 'Juros compostos', texto: 'No começo do turno, compra sozinho 2 cartas: 1 Letra e 1 Número (não precisa escolher).' },
        poder: null,
        custo: { nome: 'Endividado', texto: 'Começa com 15 PV e tem limite de mão de 6 cartas.' },
        plano: 'Muitas cartas e muitos ataques: Valete Naipado de Ouros entra e ataca 2 vezes no mesmo turno.',
      },
      en: {
        titulo: 'the banker',
        passiva: { nome: 'Compound Interest', texto: 'At the start of the turn, automatically draws 2 cards: 1 Face and 1 Number (no need to choose).' },
        poder: null,
        custo: { nome: 'In Debt', texto: 'Starts with 15 HP and has a hand limit of 6 cards.' },
        plano: 'Lots of cards and lots of attacks: a Suited Jack of Diamonds comes in and attacks twice in the same turn.',
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
  const PRETOS = ['espadas', 'paus'];

  SS.Palhacos = {
    LISTA,
    get: id => POR_ID[id],
    ehPreto: id => PRETOS.includes(POR_ID[id].naipe),
  };
})(window.SS);
