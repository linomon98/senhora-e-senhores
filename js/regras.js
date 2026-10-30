/* Tela "Regras do jogo": 6 abas com infográficos feitos das próprias cartas do jogo (cartas, Senhores montados,
   cartas de ação, o selo do dado e a régua de defesa). Os números (PV, limites) vêm do motor e dos Palhaços,
   então ficam iguais às regras oficiais em uso. Cada texto vem nos dois idiomas: x(pt, en). */
window.SS = window.SS || {};
(function (SS) {
  'use strict';
  const M = SS.Motor, C = SS.Cartas;
  const R = M.REGRAS_DECK;
  let EN = false;
  const x = (pt, en) => (EN ? en : pt);

  // ---------- Peças dos infográficos ----------
  const carta = (rank, naipe, cls) => `<span class="rg-c${cls ? ' ' + cls : ''}">${C.frente({ rank, naipe })}</span>`;
  const dorso = cor => `<span class="rg-c"><span class="carta dorso ${cor}"></span></span>`;
  // Senhor(a) montado(a): o número fica atrás da figura, como na mesa.
  const senhor = (fig, num, atk, extra) => `<span class="rg-senhor${extra ? ' ' + extra : ''}">${carta(num[0], num[1], 'num')}${carta(fig[0], fig[1], 'fig')}${atk != null ? `<b class="rg-atk">⚔ ${atk}</b>` : ''}</span>`;
  const op = s => `<i class="rg-op">${s}</i>`;
  const naipe = n => `<img class="rg-naipe" src="arte/naipes/${n}.webp" alt="" draggable="false">`;
  const escudos = (n, apagados) => `<span class="rg-escudos">${Array.from({ length: n }, (_, k) => `<img class="${k >= n - (apagados || 0) ? 'apagado' : ''}" src="arte/icones/escudo.webp" alt="" draggable="false">`).join('')}</span>`;
  const acao = (arte, titulo) => `<span class="rg-acao"><img src="arte/acoes/${arte}.webp" alt="" draggable="false"><b>${titulo}</b></span>`;
  const DADO = '<img class="dado-img" src="arte/icones/dado.webp" alt="" draggable="false">';
  const selo = (tipo, n, titulo, conta) => `<div class="selo-golpe ${tipo}"><span class="sg-dado">${DADO}<b>${n}</b></span><span class="sg-texto"><b class="sg-titulo">${titulo}</b>${conta ? `<span class="sg-conta">${conta}</span>` : ''}</span></div>`;
  const regua = (atk, dano, resultado, titulo) => {
    const max = Math.max(atk * 1.6, (dano || 0) + 1, atk + 2), pct = v => Math.min(100, Math.max(0, (v / max) * 100));
    const metade = String(atk / 2).replace('.', EN ? '.' : ',');
    return `<div class="regua-defesa caiu ${resultado || ''}">${titulo ? `<b class="rg-resultado">${titulo}</b>` : ''}<div class="rg-barra">`
      + `<i class="rg-ignora" style="width:${pct(atk / 2)}%"><span>${x('ignora', 'ignore')}</span></i><i class="rg-hit" style="width:${pct(atk) - pct(atk / 2)}%"><span>1 hit</span></i><i class="rg-pesado"><span>2 hits</span></i>`
      + `<em class="rg-marca" style="left:${pct(atk / 2)}%">${metade}</em><em class="rg-marca" style="left:${pct(atk)}%">${atk}</em>`
      + (dano != null ? `<span class="rg-seta" style="--ate:${pct(dano)}%"><b>${dano}</b></span>` : '') + '</div></div>';
  };
  // Bloco do infográfico: a figura em cima (ou ao lado) e a explicação.
  const bloco = (titulo, figura, texto, cls) => `<div class="rg-bloco${cls ? ' ' + cls : ''}">${titulo ? `<h3>${titulo}</h3>` : ''}<div class="rg-figura">${figura}</div><div class="rg-texto">${texto}</div></div>`;
  const grade = itens => `<div class="rg-grade">${itens.join('')}</div>`;

  // ---------- Abas ----------
  const TEMAS = [
    {
      id: 'visao', titulo: () => x('Visão geral', 'Overview'),
      html: () => {
        const pals = SS.Palhacos.LISTA;
        return `
        ${bloco(x('O objetivo', 'The goal'),
          `<div class="rg-linha">${pals.slice(0, 2).map(p => `<span class="rg-pal"><img src="${p.carta}" alt="" draggable="false"><b class="rg-pv">${p.pvBase}</b></span>`).join(op('⚔'))}</div>`,
          x(`Cada jogador tem um <b>Palhaço</b> com PV. <b>Zere o PV do Palhaço inimigo</b> e você vence. Você bate nele com os seus <b>Senhores e Senhoras</b>, que defendem você também.`,
            `Each player has a <b>Jester</b> with HP. <b>Bring the enemy Jester's HP to zero</b> and you win. You hit him with your <b>Ladies and Gentlemen</b>, who also defend you.`))}
        ${bloco(x('Dois baralhos', 'Two decks'),
          `<div class="rg-linha"><span class="rg-pilha">${dorso('vermelho')}<small>J Q K</small><b>${x('Letras', 'Faces')}</b><em>${x('até', 'up to')} ${R.letras}</em></span>
            <span class="rg-pilha">${dorso('vermelho')}<small>A–10</small><b>${x('Números', 'Numbers')}</b><em>${x('até', 'up to')} ${R.numeros}</em></span></div>`,
          x(`O baralho de <b>Letras</b> tem as figuras (Valete, Rainha e Rei). O de <b>Números</b> tem do Ás ao 10. No começo do turno você compra 1 carta do baralho que quiser.`,
            `The <b>Faces</b> deck holds the face cards (Jack, Queen and King). The <b>Numbers</b> deck goes from Ace to 10. At the start of your turn you draw 1 card from the deck you want.`))}
        ${bloco(x('A ideia', 'The idea'),
          `<div class="rg-linha">${carta('K', 'paus')}${op('+')}${carta('6', 'paus')}${op('=')}${senhor(['K', 'paus'], ['6', 'paus'], 6)}</div>`,
          x(`<b>1 figura + 1 número</b> viram um <b>Senhor(a)</b>: o número é o ataque dele(a). Os números também servem sozinhos como <b>recursos</b> (curar, comprar, +1 de ataque...), e os pares de números viram <b>magias</b>.`,
            `<b>1 face card + 1 number</b> become a <b>Gentleman</b>: the number is its attack. Numbers also work alone as <b>resources</b> (heal, draw, +1 attack...), and pairs of numbers become <b>spells</b>.`))}
        <h3>${x('O turno', 'The turn')}</h3>
        <ol class="rg-passos">
          <li><b>${x('Acorda', 'Wake up')}</b><span>${x('Os seus Senhores virados voltam a ficar ativos.', 'Your flipped Gentlemen become ready again.')}</span></li>
          <li><b>${x('Compra', 'Draw')}</b><span>${x('1 carta de Letras ou de Números.', '1 card from Faces or Numbers.')}</span></li>
          <li><b>${M.ACOES_POR_TURNO} ${x('ações', 'actions')}</b><span>${x('Invocar, usar recursos, magias, o poder do Palhaço.', 'Summon, use resources, spells, the Jester\'s power.')}</span></li>
          <li><b>${x('Ataque', 'Attack')}</b><span>${x('Prepare o ataque, escolha os alvos e role o dado.', 'Prepare the attack, choose targets and roll the die.')}</span></li>
          <li><b>${x('Fim', 'End')}</b><span>${x(`Quem atacou vira para baixo; mais de ${M.LIMITE_MAO} cartas na mão, descarte.`, `Whoever attacked flips face down; more than ${M.LIMITE_MAO} cards in hand, discard.`)}</span></li>
        </ol>
        <div class="rg-caixinhas">
          <p><b>${x('Começo:', 'Setup:')}</b> ${x('cada um escolhe 3 figuras e compra 4 números (no mulligan, dá para trocar os números que quiser, até 3 vezes: eles vão para o fundo do baralho e vêm outros). Quem começa é decidido no dado; no 1º turno, quem começa não compra e não ataca.', 'each player picks 3 face cards and draws 4 numbers (with the mulligan you can swap any numbers, up to 3 times: they go to the bottom of the deck and new ones come in). The die decides who starts; on turn 1, the starting player neither draws nor attacks.')}</p>
          <p><b>${x('Fim de jogo:', 'Game end:')}</b> ${x(`quem chega a 0 PV perde. Comprar com os dois baralhos vazios custa ${2} PV por carta.`, `reaching 0 HP loses. Drawing with both decks empty costs ${2} HP per card.`)}</p>
        </div>`;
      },
    },
    {
      id: 'invocar', titulo: () => x('Invocações', 'Summoning'),
      html: () => `
        ${bloco(x('Letra + número', 'Letter + number'),
          `<div class="rg-linha">${carta('J', 'copas')}${op('+')}${carta('3', 'espadas')}${op('=')}${senhor(['J', 'copas'], ['3', 'espadas'], 3)}</div>`,
          x(`Invocar gasta <b>1 ação</b>: junte uma figura e uma carta numérica da mão. O <b>número é o ataque</b>, e cada figura só aceita alguns números. Por turno, dá para invocar <b>1 Valete, 1 Rainha e 1 Rei</b>.`,
            `Summoning costs <b>1 action</b>: put a face card and a number card from your hand together. The <b>number is the attack</b>, and each face card only takes some numbers. Each turn you can summon <b>1 Jack, 1 Queen and 1 King</b>.`))}
        <h3>${x('As figuras e os sacrifícios', 'Face cards and sacrifices')}</h3>
        <p>${x('As figuras mais fortes entram no lugar de outras: o Valete vira Rei, e o Rei (ou dois Valetes) vira Rainha. Quem é sacrificado precisa já estar em campo antes deste turno.', 'Stronger face cards enter in place of others: a Jack becomes a King, and a King (or two Jacks) becomes a Queen. Whoever is sacrificed must already be on the field before this turn.')}</p>
        <div class="rg-escada">
          <div class="rg-degrau">${senhor(['J', 'espadas'], ['4', 'espadas'], 4)}<b>${x('Valete', 'Jack')}</b><em>2–4</em>
            <span><b>${x('Ímpeto', 'Haste')}:</b> ${x('ataca no mesmo turno em que entra.', 'attacks the same turn it enters.')}</span><small>${x('Entra direto.', 'Enters directly.')}</small></div>
          ${op('→')}
          <div class="rg-degrau">${senhor(['K', 'espadas'], ['7', 'espadas'], 7)}<b>${x('Rei', 'King')}</b><em>2–7</em>
            <span><b>${x('Ordem real', 'Royal order')}:</b> ${x('pode atacar um Senhor(a) inimigo, que é obrigado a defender.', 'may attack an enemy Gentleman, who must defend.')}</span><small>${x('Sacrifica 1 Valete e fica no lugar dele.', 'Sacrifices 1 Jack and takes its place.')}</small></div>
          ${op('→')}
          <div class="rg-degrau">${senhor(['Q', 'espadas'], ['10', 'espadas'], 10)}<b>${x('Rainha', 'Queen')}</b><em>2–10</em>
            <span><b>${x('Atropelar', 'Trample')}:</b> ${x('se matar quem defendeu, o dano que sobra vai no Palhaço.', 'if she kills the defender, the leftover damage hits the Jester.')}</span><small>${x('Sacrifica 1 Rei ou 2 Valetes e fica no lugar.', 'Sacrifices 1 King or 2 Jacks and takes the place.')}</small></div>
        </div>
        ${bloco(x('Vida: os escudinhos', 'Life: the little shields'),
          `<div class="rg-linha"><span class="rg-coluna">${escudos(2)}<small>${x('saudável', 'healthy')}</small></span><span class="rg-coluna">${escudos(2, 1)}<small>${x('1 hit: deitado', '1 hit: lying down')}</small></span><span class="rg-coluna">${escudos(3)}<small>${x('Naipado de Paus', 'Clubs Suited')}</small></span></div>`,
          x(`Cada Senhor(a) aguenta <b>2 hits</b>; cada hit apaga um escudo e a carta deita. Naipado de Paus, Ás de Paus vizinho e Par de Paus dão escudos a mais (sem limite).`,
            `Each Gentleman takes <b>2 hits</b>; each hit turns a shield off and the card lies down. Clubs Suited, a neighboring Ace of Clubs and the Pair of Clubs give extra shields (no limit).`))}
        <h3>${x('Naipados: figura e número do mesmo naipe', 'Suited: face card and number of the same suit')}</h3>
        ${grade([
          bloco('', `${senhor(['J', 'paus'], ['4', 'paus'], 4)}${naipe('paus')}`, x('<b>Paus:</b> aguenta 3 hits.', '<b>Clubs:</b> takes 3 hits.'), 'rg-mini'),
          bloco('', `${senhor(['K', 'espadas'], ['5', 'espadas'], 6)}${naipe('espadas')}`, x('<b>Espadas:</b> +1 de ataque fixo.', '<b>Spades:</b> +1 permanent attack.'), 'rg-mini'),
          bloco('', `${senhor(['K', 'copas'], ['7', 'copas'], 7)}${naipe('copas')}`, x(`<b>Copas:</b> quando acerta o Palhaço inimigo, você cura ${M.CURA_NAIPADO_COPAS} PV, e o inimigo não cura acima do PV que sobrou enquanto ele viver.`, `<b>Hearts:</b> when it hits the enemy Jester, you heal ${M.CURA_NAIPADO_COPAS} HP, and the enemy can't heal above the HP left while it lives.`), 'rg-mini'),
          bloco('', `${senhor(['J', 'ouros'], ['3', 'ouros'], 3)}${naipe('ouros')}`, x('<b>Ouros:</b> ataca 2 vezes por turno.', '<b>Diamonds:</b> attacks twice per turn.'), 'rg-mini'),
        ])}
        <h3>${x('Ases: os totens', 'Aces: the totems')}</h3>
        ${bloco('',
          `<div class="rg-linha">${senhor(['K', 'paus'], ['6', 'copas'], 6)}${carta('A', 'paus', 'as')}${senhor(['J', 'espadas'], ['3', 'copas'], 3)}</div>`,
          x(`Invocar um Ás gasta 1 ação e 1 número do <b>mesmo naipe</b> (1 Ás por turno). Ele ocupa um espaço, não ataca nem defende, morre com 1 golpe e dá bônus aos <b>vizinhos</b>. Ele pode entrar entre duas cartas, empurrando-as.`,
            `Summoning an Ace costs 1 action and 1 number of the <b>same suit</b> (1 Ace per turn). It takes a space, neither attacks nor blocks, dies to 1 hit and gives a bonus to its <b>neighbors</b>. It can enter between two cards, pushing them aside.`))}
        ${grade([
          bloco('', carta('A', 'paus'), x('<b>Paus:</b> vizinhos aguentam +1 hit.', '<b>Clubs:</b> neighbors take +1 hit.'), 'rg-mini'),
          bloco('', carta('A', 'espadas'), x('<b>Espadas:</b> vizinhos +1 de ataque.', '<b>Spades:</b> neighbors +1 attack.'), 'rg-mini'),
          bloco('', carta('A', 'ouros'), x('<b>Ouros:</b> vale 1 Ouros extra por turno.', '<b>Diamonds:</b> counts as 1 extra Diamond per turn.'), 'rg-mini'),
          bloco('', carta('A', 'copas'), x(`<b>Copas:</b> cura ${M.CURA_AS_COPAS} PV no começo do seu turno.`, `<b>Hearts:</b> heals ${M.CURA_AS_COPAS} HP at the start of your turn.`), 'rg-mini'),
        ])}`,
    },
    {
      id: 'combate', titulo: () => x('Ataque e defesa', 'Attack and defense'),
      html: () => `
        ${bloco(x('Quem ataca e onde', 'Who attacks and where'),
          `<div class="rg-linha">${senhor(['J', 'copas'], ['4', 'espadas'], 4)}${op('➜')}<span class="rg-pal pequeno"><img src="${SS.Palhacos.LISTA[2].carta}" alt="" draggable="false"></span></div>`,
          x(`Cada Senhor(a) ativo(a) ataca <b>1 vez por turno</b>, se entrou num turno anterior (o Valete ataca já no turno em que entra). O alvo é o <b>Palhaço</b> inimigo ou um <b>Ás</b> dele; o Rei também pode mirar um Senhor(a). Quem atacou vira para baixo no fim do turno e não defende no turno do oponente.`,
            `Each ready Gentleman attacks <b>once per turn</b>, if it entered on an earlier turn (the Jack already attacks on the turn it enters). The target is the enemy <b>Jester</b> or one of his <b>Aces</b>; the King may also aim at a Gentleman. Whoever attacked flips face down at the end of the turn and can't defend on the opponent's turn.`))}
        <h3>${x('O dado decide o dano', 'The die decides the damage')}</h3>
        <div class="rg-selos">${selo('cheio', 5, x('Dano cheio!', 'Full damage!'), '⚔ 6')}${selo('metade', 3, x('Metade!', 'Half!'), '<s>⚔ 6</s> → ⚔ 3')}${selo('errou', 1, x('Errou!', 'Miss!'))}</div>
        <p class="rg-centro">${x(`<b>${M.DADO_ATAQUE_TOTAL} a 6</b>: dano cheio · <b>2 ou 3</b>: metade, arredondada para baixo · <b>1</b>: errou, ninguém leva hit (nem o contra-ataque). Na partida, esse selo aparece depois de cada rolagem.`, `<b>${M.DADO_ATAQUE_TOTAL} to 6</b>: full damage · <b>2 or 3</b>: half, rounded down · <b>1</b>: miss, nobody takes a hit (not even the counterattack). In a match, this badge shows up after every roll.`)}</p>
        <h3>${x('Defender: a régua', 'Defending: the gauge')}</h3>
        <p>${x('Quem defende compara o dano com a <b>própria carta equipada</b>. Para um defensor com 6:', 'The defender compares the damage with <b>its own equipped card</b>. For a defender with 6:')}</p>
        <div class="rg-reguas">${regua(6, 2, 'ignorou', x('Ignorou!', 'Shrugged off!'))}${regua(6, 5, 'hit', '1 hit')}${regua(6, 8, 'pesado', '2 hits!')}</div>
        <p class="rg-centro">${x('Menos da metade: não machuca · até o valor dele: 1 hit · passou do valor dele: 2 hits. Vários Senhores podem defender o mesmo atacante: cada defensor a mais tira 1 do ataque dele.', 'Under half: no harm · up to its value: 1 hit · over its value: 2 hits. Several Gentlemen can block the same attacker: each extra defender takes 1 off its attack.')}</p>
        ${bloco(x('Contra-ataque', 'Counterattack'),
          `<div class="rg-linha">${senhor(['J', 'copas'], ['4', 'copas'], 4)}${op('⚔')}${senhor(['K', 'espadas'], ['6', 'paus'], 6, 'defende')}${op('=')}<span class="rg-coluna">${escudos(2, 1)}<small>${x('o Valete leva 1 hit', 'the Jack takes 1 hit')}</small></span></div>`,
          x(`Se o <b>número de quem ataca for menor</b> que o de quem defende, o atacante leva <b>1 hit</b>, sem dado. Aqui o 4 do Valete é menor que o 6 do Rei: mesmo que o golpe seja ignorado, o Valete se machuca.`,
            `If the <b>attacker's number is lower</b> than the defender's, the attacker takes <b>1 hit</b>, no die needed. Here the Jack's 4 is lower than the King's 6: even if the blow is shrugged off, the Jack gets hurt.`))}
        ${bloco(x('Atropelar (Rainha)', 'Trample (Queen)'),
          `<div class="rg-linha">${senhor(['Q', 'ouros'], ['10', 'ouros'], 10)}${op('⚔')}${senhor(['K', 'copas'], ['6', 'copas'], 6, 'defende')}${op('➜')}<b class="rg-numero">4</b></div>`,
          x(`A Rainha com 10 tira 5 (10 de dano) contra um Rei com 6: o Rei morre e os <b>4</b> que sobram (10 − 6) vão no Palhaço.`,
            `The Queen with 10 rolls 5 (10 damage) against a King with 6: the King dies and the <b>4</b> left over (10 − 6) hit the Jester.`))}`,
    },
    {
      id: 'recursos', titulo: () => x('Recursos e Pargias', 'Resources and Pairgics'),
      html: () => `
        <h3>${x('Recursos: uma carta numérica sozinha (1 ação)', 'Resources: a single number card (1 action)')}</h3>
        ${grade([
          bloco('', `${carta('6', 'copas')}${acao('cura', x('Curar', 'Heal'))}`, x('<b>Copas:</b> cura PV (Ás a 5 cura 3, 6 a 10 cura 4).', '<b>Hearts:</b> heals HP (Ace to 5 heals 3, 6 to 10 heals 4).'), 'recurso'),
          bloco('', `${carta('4', 'ouros')}${acao('comprar', x('Comprar', 'Draw'))}`, x('<b>Ouros:</b> troque por 1 carta do baralho que quiser.', '<b>Diamonds:</b> swap it for 1 card from the deck you want.'), 'recurso'),
          bloco('', `${carta('2', 'ouros')}${acao('dado', x('Dado adicional', 'Extra die'))}`, x('<b>Ouros no ataque:</b> +1 dado para um Senhor(a); vale o maior.', '<b>Diamonds on attack:</b> +1 die for a Gentleman; the highest counts.'), 'recurso'),
          bloco('', `${carta('5', 'espadas')}${acao('dano', '+1')}`, x('<b>Espadas:</b> +1 de ataque no turno (no dado 6, vira metade do valor da carta).', '<b>Spades:</b> +1 attack this turn (on a 6, it becomes half the card\'s value).'), 'recurso'),
          bloco('', `${carta('7', 'paus')}${acao('berserk', 'Berserk')}`, x('<b>Paus:</b> Berserk: um Senhor(a) ferido(a) se levanta até o fim do próximo turno do oponente; se levar hit nesse tempo, morre.', '<b>Clubs:</b> Berserk: a wounded Gentleman stands up until the end of the opponent\'s next turn; if hit meanwhile, it dies.'), 'recurso'),
        ])}
        <h3>${x('Pares do mesmo naipe (1 ação)', 'Pairs of the same suit (1 action)')}</h3>
        ${grade([
          bloco('', `${carta('3', 'copas')}${carta('8', 'copas')}${acao('cemiterio', x('Reviver', 'Revive'))}`, x('<b>Copas:</b> um Senhor(a) seu do cemitério volta direto para o campo.', '<b>Hearts:</b> one of your Gentlemen comes back from the graveyard straight to the field.'), 'par'),
          bloco('', `${carta('2', 'ouros')}${carta('9', 'ouros')}${acao('parouros', x('Buscar Ás', 'Fetch Ace'))}`, x('<b>Ouros:</b> escolha um Ás do seu baralho e leve a seta até o espaço onde ele entra.', '<b>Diamonds:</b> pick an Ace from your deck and drag the arrow to the space where it enters.'), 'par'),
          bloco('', `${carta('4', 'paus')}${carta('6', 'paus')}${acao('parpaus', x('Defesa', 'Defense'))}`, x('<b>Paus:</b> +1 de defesa para sempre num Senhor(a) seu, ou −1 num inimigo.', '<b>Clubs:</b> +1 defense for good on one of your Gentlemen, or −1 on an enemy.'), 'par'),
          bloco('', `${carta('5', 'espadas')}${carta('10', 'espadas')}${acao('parespadas', x('Dano', 'Damage'))}`, x('<b>Espadas:</b> +1 de dano para sempre num Senhor(a) seu, ou −1 de ataque num inimigo.', '<b>Spades:</b> +1 damage for good on one of your Gentlemen, or −1 attack on an enemy.'), 'par'),
        ])}
        <h3>${x('Pargias: pares de números iguais', 'Pairgics: pairs of equal numbers')}</h3>
        <p>${x('Dois números iguais, de qualquer naipe. O que a Pargia faz depende do número; as que pedem alvo usam a seta roxa saindo da carta.', 'Two equal numbers, any suits. What the Pairgic does depends on the number; the ones that need a target use the purple arrow coming out of the card.')}</p>
        ${grade([
          bloco('', `${carta('3', 'copas')}${carta('3', 'paus')}${acao('reflexo', x('Refletir!', 'Reflect!'))}`, x('<b>2 a 4 · Refletir!</b> Na defesa, sem gastar ação: um atacante bate no próprio dono.', '<b>2 to 4 · Reflect!</b> On defense, no action: an attacker hits its own owner.'), 'par'),
          bloco('', `${carta('6', 'ouros')}${carta('6', 'espadas')}${acao('tchau', x('Sai daqui!', 'Get out!'))}`, x('<b>5 a 7 · Sai daqui!</b> No seu turno (1 ação): um Senhor(a) inimigo volta para a mão do dono.', '<b>5 to 7 · Get out!</b> On your turn (1 action): an enemy Gentleman goes back to its owner\'s hand.'), 'par'),
          bloco('', `${carta('9', 'copas')}${carta('9', 'paus')}${acao('meteoro', x('Meteoro!', 'Meteor!'))}`, x('<b>8 a 10 · Meteoro!</b> No seu turno (1 ação): destrói <b>todos</b> os Senhores e Ases da mesa, os seus também. Quem está em <b>Berserk</b> aguenta.', '<b>8 to 10 · Meteor!</b> On your turn (1 action): destroys <b>every</b> Gentleman and Ace on the table, yours too. <b>Berserk</b> ones hold on.'), 'par'),
          bloco('', `${carta('A', 'espadas')}${carta('A', 'ouros')}${acao('raio', x('Trovão', 'Thunder'))}`, x(`<b>Ases · Trovão.</b> No seu turno (1 ação): 1 hit num Senhor(a) inimigo <b>ou</b> ${M.DANO_RAIO_PALHACO} PV no Palhaço.`, `<b>Aces · Thunder.</b> On your turn (1 action): 1 hit on an enemy Gentleman <b>or</b> ${M.DANO_RAIO_PALHACO} HP on the Jester.`), 'par'),
        ])}
        <p class="rg-centro"><small>${x('Refletir o reflexo: se o seu ataque foi refletido e você tem um par de 2 a 4, dá para mandar o golpe de volta no Palhaço do adversário (1 vez por ataque).', 'Reflect the reflection: if your attack was reflected and you hold a pair of 2 to 4, you can send the blow back at the opponent\'s Jester (once per attack).')}</small></p>`,
    },
    {
      id: 'palhacos', titulo: () => x('Palhaços', 'Jesters'),
      html: () => `
        <p>${x('Cada Palhaço tem PV próprios, uma <b>passiva</b> (vale a partida toda) e um <b>poder</b> (1 ação, 1 vez por turno, pelo botão ao lado dele). Cada um tem também um deck temático do seu naipe.', 'Each Jester has its own HP, a <b>passive</b> (lasts the whole match) and a <b>power</b> (1 action, once per turn, with the button next to him). Each one also has a themed deck of its suit.')}</p>
        <div class="rg-palhacos">${SS.Palhacos.LISTA.map(p => `<div class="rg-palhaco cor-${p.cor}">
          <span class="rg-pal"><img src="${p.carta}" alt="" draggable="false"><b class="rg-pv">${p.pvBase}</b></span>
          <div><h3>${naipe(p.naipe)} ${p.nome} <small>${p.titulo}</small></h3>
            <p><b class="rg-tag passiva">${x('Passiva', 'Passive')}</b> <b>${p.passiva.nome}:</b> ${p.passiva.texto}</p>
            <p><b class="rg-tag poder">${x('Poder', 'Power')}</b> <b>${p.poder.nome}:</b> ${p.poder.texto}</p>
            <p class="rg-plano">${p.plano}</p></div></div>`).join('')}</div>`,
    },
    {
      id: 'deck', titulo: () => x('Montagem de deck', 'Deck building'),
      html: () => `
        ${bloco(x('Os limites', 'The limits'),
          `<div class="rg-linha"><span class="rg-deck">${SS.Decks.caixa({ tampa: 'roxo', icone: 'cavaleiro', corIcone: 'amarelo' }, x('Meu deck', 'My deck'))}</span>
            <span class="rg-copias">${carta('4', 'espadas')}<b>×${R.copias}</b></span></div>`,
          x(`<ul><li>Até <b>${R.letras} figuras</b> no baralho de Letras e até <b>${R.numeros} cartas</b> no de Números.</li><li>Até <b>${R.copias} cópias</b> da mesma carta (mesmo valor e naipe), em qualquer mistura de naipes.</li><li>Não há mínimo: um deck menor traz as melhores cartas mais vezes, mas acaba antes (comprar com os baralhos vazios custa 2 PV por carta).</li></ul>`,
            `<ul><li>Up to <b>${R.letras} face cards</b> in the Faces deck and up to <b>${R.numeros} cards</b> in the Numbers deck.</li><li>Up to <b>${R.copias} copies</b> of the same card (same value and suit), in any mix of suits.</li><li>There is no minimum: a smaller deck brings your best cards more often, but runs out sooner (drawing with both decks empty costs 2 HP per card).</li></ul>`))}
        ${bloco(x('No Deckbuilder', 'In the Deckbuilder'),
          `<div class="rg-linha">${['paus', 'copas', 'espadas', 'ouros'].map(n => `<span class="rg-aba-naipe ${n}">${naipe(n)}</span>`).join('')}</div>`,
          x(`Você tem <b>4 espaços</b> para os seus decks, cada um com uma caixinha personalizada (nome, cor da tampa, ícone). Embaixo ficam todas as cartas, em abas de naipe: clique para pôr no deck, botão direito para tirar. Os decks prontos de cada Palhaço servem de base para copiar e mexer. Antes da partida, você escolhe com qual deck vai jogar.`,
            `You have <b>4 slots</b> for your decks, each with a custom box (name, lid color, icon). All cards sit below in suit tabs: click to add to the deck, right-click to remove. Each Jester's ready-made deck works as a base to copy and tweak. Before a match, you choose which deck to play.`))}`,
    },
  ];

  // ---------- Tela ----------
  let atual = 'visao', aoVoltar = null;

  function tela() {
    let el = document.getElementById('tela-regras');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tela-regras';
      el.className = 'tela tela-regras-nova';
      document.body.appendChild(el);
      el.addEventListener('click', aoClicar);
    }
    return el;
  }

  function desenhar(animar) {
    EN = SS.Idioma && SS.Idioma.atual() === 'en';
    const tr = SS.Idioma.t, tema = TEMAS.find(t => t.id === atual);
    tela().innerHTML = `<div class="rg-tela">
      <div class="rg-topo"><button class="db-btn" data-regra-cmd="voltar">← ${tr('btn.voltarMenu')}</button><h1>${tr('menu.regras')}</h1></div>
      <nav class="rg-abas">${TEMAS.map(t => `<button class="rg-aba${t.id === atual ? ' ativa' : ''}" data-tema="${t.id}">${t.titulo()}</button>`).join('')}</nav>
      <section class="rg-pagina${animar ? ' entra' : ''}"><h2>${tema.titulo()}</h2>${tema.html()}</section></div>`;
  }

  function aoClicar(ev) {
    if (ev.target.closest('[data-regra-cmd="voltar"]')) {
      tela().hidden = true;
      tela().innerHTML = '';
      if (aoVoltar) aoVoltar();
      return;
    }
    const b = ev.target.closest('[data-tema]');
    if (b && b.dataset.tema !== atual) {
      atual = b.dataset.tema;
      desenhar(true);
      tela().scrollTop = 0;
    }
  }

  function abrir(voltar) {
    aoVoltar = voltar;
    desenhar();
    tela().hidden = false;
  }

  SS.Regras = { abrir };
})(window.SS);
