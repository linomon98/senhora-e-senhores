/* Os 4 Palhaços (os "heróis" do jogo): textos, cores e o deck temático de cada um.
   As regras de cada Palhaço (PV, limite de mão, poderes) ficam no motor: SS.Motor.PALHACOS. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';

  // Decks temáticos: até 12 figuras e 40 números, até 6 cópias da mesma carta.
  // São os decks que o Leonardo montou para cada Palhaço (27/10/2026), com a caixinha de cada um.
  const LISTA = [
    {
      // Valetes e Reis de Espadas com Espadas baixas (Naipados entram atacando) e Ouros para os dados extras.
      id: 'lancalotte', nome: 'Lançalotte', naipe: 'espadas', cor: 'azul',
      caixa: { nome: 'VALETES', visual: { tampa: 'azul', icone: 'espada', corIcone: 'azul' } },
      deck: {
        'J-espadas': 6, 'K-espadas': 6,
        'A-espadas': 6, '3-espadas': 6, '4-espadas': 6, '7-espadas': 6,
        'A-ouros': 6, '4-ouros': 6, '7-ouros': 4,
      },
    },
    {
      // Figuras de Copas Naipadas (ferida) e muita Copas para curar e pagar a Transfusão; Ouros para dados extras.
      id: 'infartitte', nome: 'Infartitte', naipe: 'copas', cor: 'vermelho',
      caixa: { nome: 'Mi Corazon', visual: { tampa: 'vermelho', icone: 'cura', corIcone: 'vermelho' } },
      deck: {
        'J-copas': 3, 'Q-copas': 2, 'K-copas': 4, 'J-ouros': 3,
        'A-copas': 3, '2-copas': 2, '4-copas': 6, '7-copas': 6, '10-copas': 6,
        'A-ouros': 5, '4-ouros': 6, '6-ouros': 6,
      },
    },
    {
      // Reis e Rainhas de Paus Naipados (aguentam muito) com Paus para fechar a fileira; Ouros para dados extras.
      id: 'paumol', nome: 'Paumol', naipe: 'paus', cor: 'verde',
      caixa: { nome: 'REIeQUEEN', visual: { tampa: 'verde', icone: 'cavaleiro', corIcone: 'verde' } },
      deck: {
        'J-paus': 6, 'Q-paus': 2, 'K-paus': 4,
        '3-paus': 6, '4-paus': 6, '7-paus': 6, '10-paus': 6,
        'A-ouros': 6, '4-ouros': 6, '6-ouros': 4,
      },
    },
    {
      // Valetes e Reis de Ouros (Naipados atacam 2 vezes) com muitos Ouros para dados e compras; Paus baixos e Ases de Paus.
      id: 'ourinhos', nome: 'Ourinhos', naipe: 'ouros', cor: 'dourado',
      caixa: { nome: 'DAD??', visual: { tampa: 'amarelo', icone: 'dados', corIcone: 'amarelo' } },
      deck: {
        'J-ouros': 6, 'K-ouros': 6,
        'A-paus': 6, '3-paus': 4, '4-paus': 6,
        'A-ouros': 6, '4-ouros': 6, '6-ouros': 6, '7-ouros': 6,
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
        plano: 'Ataca cedo e forte: Valetes entram atacando, Reis miram os Senhores inimigos e Ouros compram dados extras.',
      },
      en: {
        titulo: 'the duelist',
        passiva: { nome: 'True Strike', texto: 'The 1st attack each turn gets +1 die (the highest counts) and +1 attack. Starts with 19 HP.' },
        poder: { nome: 'Challenge!', texto: 'Choose a ready enemy Gentleman: this turn it must block your first attack (if it can).' },
        plano: 'Attacks early and hard: Jacks come in swinging, Kings aim at enemy Gentlemen and Diamonds buy extra dice.',
      },
    },
    infartitte: {
      pt: {
        titulo: 'o coração teimoso',
        passiva: { nome: 'Coração forte', texto: 'Suas cartas de Copas curam +1 PV (o que paga a Transfusão). Começa com 24 PV.' },
        poder: { nome: 'Transfusão', texto: 'Pague 2 PV para tirar 1 hit de um Senhor(a) seu, ou 4 PV para dar 1 hit num Senhor(a) inimigo.' },
        plano: 'Aguenta e drena: figuras de Copas aplicam ferida, Copas cura e Ouros dão dados extras.',
      },
      en: {
        titulo: 'the stubborn heart',
        passiva: { nome: 'Strong Heart', texto: 'Your Hearts cards heal +1 HP (which pays for Transfusion). Starts with 24 HP.' },
        poder: { nome: 'Transfusion', texto: 'Pay 2 HP to remove 1 hit from one of your Gentlemen, or 4 HP to deal 1 hit to an enemy Gentleman.' },
        plano: 'Endures and drains: Hearts face cards inflict wounds, Hearts heal and Diamonds give extra dice.',
      },
    },
    paumol: {
      pt: {
        titulo: 'o muro',
        passiva: { nome: 'Casca grossa', texto: 'Seus Naipados de Paus recebem 1 de dano a menos ao defender. Começa com 20 PV.' },
        poder: { nome: 'Vigília', texto: 'Escolha 1 Senhor(a) seu: ele(a) não vira para baixo no fim deste turno (ataca e ainda pode bloquear).' },
        plano: 'Ninguém passa: Reis e Rainhas de Paus Naipados seguram a fileira e Ouros dão dados extras.',
      },
      en: {
        titulo: 'the wall',
        passiva: { nome: 'Thick Bark', texto: 'Your Clubs Suited take 1 less damage when defending. Starts with 20 HP.' },
        poder: { nome: 'Vigil', texto: "Choose 1 of your Gentlemen: it doesn't flip face down at the end of this turn (it attacks and can still block)." },
        plano: 'None shall pass: Suited Clubs Kings and Queens hold the row and Diamonds give extra dice.',
      },
    },
    ourinhos: {
      pt: {
        titulo: 'o banqueiro',
        passiva: { nome: 'Dividendos', texto: 'Uma vez por turno, quando um Senhor(a) seu causa dano no Palhaço inimigo, compra 1 carta de Números. Começa com 16 PV.' },
        poder: { nome: 'Cobrança', texto: 'Pague 2 PV para roubar 1 carta sorteada da mão do oponente.' },
        plano: 'Rouba e acumula: Valetes e Reis Naipados de Ouros (atacam 2 vezes) e muitos Ouros para dados e compras.',
      },
      en: {
        titulo: 'the banker',
        passiva: { nome: 'Dividends', texto: 'Once per turn, when one of your Gentlemen deals damage to the enemy Jester, draw 1 Numbers card. Starts with 16 HP.' },
        poder: { nome: 'Debt Collection', texto: "Pay 2 HP to steal 1 random card from the opponent's hand." },
        plano: "Steals and hoards: Suited Jacks and Kings of Diamonds (attack twice) and lots of Diamonds for dice and draws.",
      },
    },
  };
  // Retrato de cada Palhaço (provisório). Para trocar a arte, substitua o arquivo com o mesmo nome.
  for (const pal of LISTA) {
    pal.retrato = `arte/palhacos/${pal.id}.webp`;
    pal.carta = `arte/cartas/${pal.id}.webp`; // arte em formato de carta (tela de escolha)
    pal.corpo = `arte/corpo/${pal.id}.webp`; // corpo inteiro, sem corte (Palhaço solto na mesa)
  }

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

  // PV oficial de cada Palhaço (o que vale no jogo pode mudar pelos modificadores de regras da área de testes).
  for (const p of LISTA) p.pvBase = SS.Motor.PALHACOS[p.id].pv;
  const POR_ID = Object.fromEntries(LISTA.map(p => [p.id, p]));

  SS.Palhacos = {
    LISTA,
    get: id => POR_ID[id],
  };
})(window.SS);
