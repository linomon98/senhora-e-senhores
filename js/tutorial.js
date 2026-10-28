// Tutorial em aulas (no estilo do Hearthstone): uma partida de verdade, com as regras oficiais, um balão que conversa
// com o jogador e um foco que escurece o resto da mesa e só deixa clicar no que a aula pede.
// A aula só arruma a ordem das cartas nos baralhos, faz as jogadas do oponente e combina os dados dele; as regras
// são as de sempre (ninguém ataca no 1º turno de quem começa, quem atacou fica virado, o Rei sacrifica um Valete...).
// A interface chama SS.Tutorial.gancho(nome) nos pontos em que a aula pode precisar parar o jogo
// (antes e depois do sorteio, na abertura, antes e depois do dado, na defesa, no fim do turno, no turno do oponente).
(function (SS) {
  'use strict';
  const M = SS.Motor;
  const L = () => (SS.Idioma && SS.Idioma.atual() === 'en' ? 1 : 0);
  const tx = v => (typeof v === 'string' ? v : Array.isArray(v) ? v[L()] : '');
  const $ = s => document.querySelector(s);

  // ---------- Aulas ----------

  // Põe estas cartas no topo do baralho (a primeira da lista é a primeira a ser comprada).
  function empilhar(j, monte, cartas) {
    for (const [r, n] of cartas.slice().reverse()) {
      const k = j[monte].findIndex(c => c.rank === r && c.naipe === n);
      if (k >= 0) j[monte].push(j[monte].splice(k, 1)[0]);
    }
  }
  const idNaMao = (j, rank, naipe) => (j.mao.find(c => c.rank === rank && c.naipe === naipe) || {}).id;
  const maoSel = (p, rank, naipe) => api => `#mao-${p} [data-mao="${idNaMao(api.jogo().jogadores[p], rank, naipe)}"]`;
  // Senhor(a) em campo pela figura (e naipe da figura, se precisar) e o espaço dele.
  const unidadeFig = (e, p, rank, naipe) => e.jogadores[p].campo.find(u => u && u.tipo === 'senhor' && u.figura.rank === rank && (!naipe || u.figura.naipe === naipe));
  const slotFig = (p, rank, naipe) => api => { const e = api.jogo(), u = unidadeFig(e, p, rank, naipe); return u ? `[data-slot="${p}:${e.jogadores[p].campo.indexOf(u)}"]` : null; };
  const vidaFig = (p, rank, naipe) => api => { const s = slotFig(p, rank, naipe)(api); return s && s + ' .selo-vida'; };
  // Ás (totem) em campo e o espaço dele.
  const slotAs = p => api => { const i = api.jogo().jogadores[p].campo.findIndex(u => u && u.tipo === 'as'); return i >= 0 ? `[data-slot="${p}:${i}"]` : null; };
  const turno = () => T.api.jogo().turno;
  const ataqueDe = (e, p, rank, naipe) => { const u = unidadeFig(e, p, rank, naipe); return u && e.combate ? e.combate.ataques.find(a => a.atacante === u.uid) : null; };
  const ehAtaqueDe = (d, rank, naipe) => !!d.at && d.at.atacante === (unidadeFig(T.api.jogo(), d.p, rank, naipe) || {}).uid;
  // Jogada do oponente feita pela aula: entre as jogadas que servem, a do espaço mais perto do meio da fileira.
  function aplicarPerto(api, filtro) {
    const meio = (M.ESPACOS - 1) / 2;
    const a = M.acoesLegais(api.jogo()).filter(filtro).sort((x, y) => Math.abs((x.slot == null ? meio : x.slot) - meio) - Math.abs((y.slot == null ? meio : y.slot) - meio))[0];
    if (a) api.aplicar(a);
  }
  // Seleciona uma carta da mão só para mostrar as cartas de ação dela.
  const selecionar = (api, rank, naipe) => { const ui = api.ui(); ui.sel = [idNaMao(api.jogo().jogadores[0], rank, naipe)].filter(Boolean); ui.destino = null; api.render(); };
  const esperarCompra = { esperar: api => { const e = api.jogo(); return e.vez === 0 && e.fase === 'compra' && !!api.ui().aoComprar; } };

  // Ilustrações nas falas: o selo do dado e a régua de defesa (termômetro), iguais aos da partida, só que paradas,
  // e cartinhas iguais às da tela de Regras.
  const DADO = '<img class="dado-img" src="arte/icones/dado.webp" alt="" draggable="false">';
  const seloEx = (tipo, n, titulo, conta) => `<div class="selo-golpe ${tipo}"><span class="sg-dado">${DADO}<b>${n}</b></span>`
    + `<span class="sg-texto"><b class="sg-titulo">${titulo}</b>${conta ? `<span class="sg-conta">${conta}</span>` : ''}</span></div>`;
  const reguaEx = (atk, dano, resultado, titulo, faixas) => {
    const max = Math.max(atk * 1.6, (dano || 0) + 1, atk + 2), pct = v => Math.min(100, Math.max(0, (v / max) * 100));
    const metade = String(atk / 2).replace('.', faixas === FAIXAS[1] ? '.' : ','); // (as falas são montadas uma vez só, nos dois idiomas)
    return `<div class="regua-defesa caiu ${resultado || ''}">${titulo ? `<b class="rg-resultado">${titulo}</b>` : ''}<div class="rg-barra">`
      + `<i class="rg-ignora" style="width:${pct(atk / 2)}%"><span>${faixas[0]}</span></i><i class="rg-hit" style="width:${pct(atk) - pct(atk / 2)}%"><span>${faixas[1]}</span></i><i class="rg-pesado"><span>${faixas[2]}</span></i>`
      + `<em class="rg-marca" style="left:${pct(atk / 2)}%">${metade}</em><em class="rg-marca" style="left:${pct(atk)}%">${atk}</em>`
      + (dano != null ? `<span class="rg-seta" style="--ate:${pct(dano)}%"><b>${dano}</b></span>` : '') + '</div></div>';
  };
  const FAIXAS = [['IGNORA', '1 HIT', '2 HITS'], ['IGNORE', '1 HIT', '2 HITS']];
  const cartinha = (rank, naipe, rotulo) => `<span class="tut-cartinha"><span class="rg-c">${SS.Cartas.frente({ rank, naipe })}</span>${rotulo ? `<small>${rotulo}</small>` : ''}</span>`;
  const seta = '<i class="rg-op">→</i>';
  // A escada das figuras: o Valete entra direto, o Rei sacrifica 1 Valete, a Rainha sacrifica 1 Rei (ou 2 Valetes).
  const escada = en => `<div class="rg-linha tut-escada">${cartinha('J', 'espadas', en ? 'Jack · 2–4' : 'Valete · 2–4')}${seta}${cartinha('K', 'paus', en ? 'King · 2–7' : 'Rei · 2–7')}${seta}${cartinha('Q', 'paus', en ? 'Queen · 2–10' : 'Rainha · 2–10')}</div>`;

  // Cartas de Letras que ficam fora da abertura (voltam para o baralho depois que você escolhe as suas 3 figuras).
  let guardadas = [];
  const FIGURAS_ABERTURA = [['J', 'espadas'], ['J', 'ouros'], ['K', 'paus']];

  const AULAS = {
    1: {
      titulo: ['Tutorial', 'Tutorial'],
      palhacos: ['infartitte', 'paumol'],
      // Antes da abertura (o sorteio já foi): arruma os baralhos e faz a abertura do oponente.
      preparar(e) {
        const [eu, ele] = e.jogadores;
        guardadas = eu.letras.filter(c => !FIGURAS_ABERTURA.some(([r, n]) => c.rank === r && c.naipe === n));
        eu.letras = eu.letras.filter(c => !guardadas.includes(c));
        // Os 4 números da abertura e as compras dos próximos turnos, nesta ordem.
        empilhar(eu, 'numeros', [['4', 'copas'], ['7', 'espadas'], ['6', 'copas'], ['8', 'espadas'], ['9', 'ouros'], ['3', 'espadas'], ['10', 'paus'], ['A', 'espadas']]);
        empilhar(ele, 'numeros', [['3', 'espadas'], ['4', 'ouros'], ['6', 'copas'], ['7', 'espadas']]);
        const fig = (r, n) => ele.letras.find(c => c.rank === r && c.naipe === n).id;
        M.escolherFiguras(e, 1, [fig('J', 'copas'), fig('J', 'paus'), fig('K', 'espadas')]);
        M.confirmarAbertura(e, 1);
      },
      passos: [
        // ---------- A mesa e o sorteio de quem começa ----------
        { gancho: 'mesa', passos: [
          { fala: ['<b>Bem-vindo ao SENHORA E SENHORES!</b><br>Essa porcaria aqui é um card game inspirado em <i>Magic</i>, <i>Yu-Gi-Oh</i> e <i>Hearthstone</i>, sabe? Mas usando <b>unicamente cartas de um baralho comum</b>.',
            '<b>Welcome to LADY AND GENTLEMEN!</b><br>This piece of junk is a card game inspired by <i>Magic</i>, <i>Yu-Gi-Oh</i> and <i>Hearthstone</i>, you know? But using <b>only the cards of a regular deck</b>.'] },
          { foco: '#info-0 .heroi', fala: ['Cada jogador controla um <b>Palhaço</b>, um Joker. Cada Joker tem suas características próprias, que você vai descobrir <b>LENDO</b>, seu preguiçoso!!!',
            'Each player controls a <b>Jester</b>, a Joker. Each Joker has its own traits, which you will find out by <b>READING</b>, you lazy bum!!!'] },
          { foco: '#info-1 .heroi-pv', fala: ['O mais importante agora: cada Palhaço tem uma quantidade de <b>PV, pontos de vida</b>. O seu objetivo é <b>zerar o PV do adversário</b>.',
            'The most important thing now: each Jester has an amount of <b>HP, hit points</b>. Your goal is to <b>bring your opponent\'s HP down to zero</b>.'] },
          { fala: ['<i>“Ai, mas como faz isso?”</i><br>Batendo com os seus <b>Senhores e Senhoras</b>.', '<i>“Oh, but how do I do that?”</i><br>By hitting with your <b>Ladies and Gentlemen</b>.'] },
          { fala: ['<i>“E como eu bato? Não tô vendo nenhuma Senhora ou Senhor por aqui...”</i><br><b>CALMA!!!</b>', '<i>“And how do I hit? I don\'t see any Lady or Gentleman around here...”</i><br><b>EASY THERE!!!</b>'] },
          { foco: '#pilhas-0', fala: ['Cada Palhaço tem um baralho, dividido em cartas de <b>Letras</b> (as figuras: Valete, Rainha e Rei) e cartas de <b>Números</b>.',
            'Each Jester has a deck, split into <b>Face</b> cards (Jack, Queen and King) and <b>Number</b> cards.'] },
          { fala: ['Mas antes de tudo: quem começa a partida é decidido no <b>DADO</b>. Cada um joga o seu e quem tirar o <b>maior número</b> começa. Empatou? Joga de novo.',
            'But first things first: who starts the match is decided by the <b>DIE</b>. Each player rolls one, and the <b>highest number</b> starts. A tie? Roll again.'] },
        ] },
        { ate: 'depoisSorteio', permitir: '*', dado: true, fala: ['Pega o dado e <b>joga na mesa</b>! Boa sorte... (você vai precisar, hehehe)', 'Grab the die and <b>throw it on the table</b>! Good luck... (you will need it, hehehe)'] },
        { gancho: 'depoisSorteio', passos: [
          { foco: '#info-1 .heroi', fala: d => [`Você tirou <b>${d.dados[0]}</b> e o Paumol tirou <b>${d.dados[1]}</b>... <b>HAHAHAHAHAHAH</b>, perdeu!`, `You rolled a <b>${d.dados[0]}</b> and Paumol rolled a <b>${d.dados[1]}</b>... <b>HAHAHAHAHAHAH</b>, you lost!`] },
          { foco: '#info-1 .heroi', fala: ['Então quem começa é <b>ele</b>. Mas relaxa: quem começa <b>não compra carta</b> e <b>não pode atacar</b> no primeiro turno. É o preço de sair na frente.',
            'So <b>he</b> starts. But relax: whoever starts <b>doesn\'t draw a card</b> and <b>can\'t attack</b> on the first turn. That is the price of going first.'] },
        ] },
        // ---------- Abertura: 3 figuras + 4 números ----------
        { gancho: 'abertura', passos: [
          { fala: ['Antes do primeiro turno, cada jogador monta a sua mão: <b>escolhe 3 figuras</b> do baralho de Letras e <b>compra 4 cartas</b> do baralho de Números.',
            'Before the first turn, each player builds a hand: <b>picks 3 face cards</b> from the Faces deck and <b>draws 4 cards</b> from the Numbers deck.'] },
          { fala: ['Numa partida normal você escolhe entre todas as figuras do seu baralho. Aqui no tutorial eu já separei as suas: só tem 3, então é escolher <b>todas</b>, hehe.',
            'In a normal match you pick from every face card in your deck. Here in the tutorial I already set yours apart: there are only 3, so you pick <b>all of them</b>, hehe.'] },
        ] },
        { foco: '#modal .palco-fila', alvo: '#modal .palco-carta:not(.selecionada)', permitir: '*', semVeu: true, embaixo: true,
          fala: ['Clique nas <b>3 figuras</b> e depois em <b>Confirmar</b>.', 'Click the <b>3 face cards</b> and then <b>Confirm</b>.'],
          esperar: api => api.jogo().jogadores[0].abertura.figuras.length > 0 },
        { gancho: 'mulligan', passos: [
          { acao: api => { const eu = api.jogo().jogadores[0]; eu.letras.push(...guardadas); guardadas = []; empilhar(eu, 'letras', [['Q', 'paus']]); } },
          { espera: 700 },
        ] },
        { foco: '#modal .palco-fila', semVeu: true, travarModal: true, embaixo: true, fala: ['Essa é a sua mão: <b>3 figuras + 4 números</b>. Se os números vierem ruins, dá para fazer <b>Mulligan</b> uma vez: você troca os 4 números por <b>3</b> novos (sim, vem 1 a menos).',
          'This is your hand: <b>3 face cards + 4 numbers</b>. If the numbers are bad, you can <b>Mulligan</b> once: you swap the 4 numbers for <b>3</b> new ones (yes, one fewer).'] },
        { travarModal: true, semVeu: true, embaixo: true, foco: '#modal .palco-botoes', alvo: '#modal [data-m="manter"]', permitir: ['#modal [data-m="manter"]'],
          fala: ['A sua mão tá ótima. Clique em <b>Manter</b>.', 'Your hand is great. Click <b>Keep</b>.'],
          esperar: api => api.jogo().jogadores[0].abertura.pronto },
        // ---------- Turno 1 (o oponente começa: não compra e não ataca) ----------
        { gancho: 'turnoOponente', quando: () => turno() === 1, passos: [
          { foco: '#info-1 .heroi', fala: ['Primeiro turno do <b>OPONENTE</b>. Lembra: ele não compra e não ataca agora.', 'The <b>OPPONENT\'s</b> first turn. Remember: he doesn\'t draw and doesn\'t attack now.'] },
          { acao: api => { const j = api.jogo().jogadores[1]; aplicarPerto(api, x => x.tipo === 'sumonar' && x.figura === idNaMao(j, 'J', 'copas') && x.numero === idNaMao(j, '3', 'espadas')); } },
          { espera: 1200 },
          { foco: slotFig(1, 'J', 'copas'), fala: ['Olha só: ele invocou um <b>Senhor</b>, o <b>Valete de Copas com 3 de Espadas</b>.', 'Look: he summoned a <b>Gentleman</b>, the <b>Jack of Hearts with a 3 of Spades</b>.'] },
          { foco: slotFig(1, 'J', 'copas'), fala: ['Pra invocar um Senhor(a) você junta <b>1 carta de Letra + 1 carta de Número</b>. O <b>número</b> equipado é o <b>ataque</b> dele: esse Valete tem <b>3 de ataque</b>.',
            'To summon a Gentleman you put together <b>1 Face card + 1 Number card</b>. The equipped <b>number</b> is its <b>attack</b>: this Jack has <b>3 attack</b>.'] },
        ] },
        // ---------- Turno 2 (o seu primeiro): compra, invocar, o Ímpeto do Valete e o primeiro ataque ----------
        esperarCompra,
        { foco: '#info-0 .heroi', fala: ['Agora é o <b>seu turno</b>!', 'Now it is <b>your turn</b>!'] },
        { foco: '#pilhas-0', fala: ['No início de todo turno você precisa <b>comprar uma carta</b>: você escolhe se quer comprar uma carta de <b>Letra</b> ou uma de <b>Número</b>.',
          'At the start of every turn you have to <b>draw a card</b>: you choose whether to draw a <b>Face</b> card or a <b>Number</b> card.'] },
        { foco: '#pilhas-0', alvo: '[data-pilha="0:numeros"]', permitir: ['[data-pilha="0:numeros"]'], compra: true,
          fala: ['Vamos comprar um <b>Número</b>, já que figura você já tem de sobra.', 'Let\'s draw a <b>Number</b>, since you already have plenty of face cards.'],
          esperar: api => api.jogo().fase !== 'compra' },
        { espera: 800 },
        { foco: '#acoes', fala: ['Em cada turno você tem <b>3 ações</b> para fazer antes de se preparar para atacar.', 'Each turn you have <b>3 actions</b> to use before getting ready to attack.'] },
        { fala: ['<i>“E quais ações dá pra fazer por turno??”</i>', '<i>“And what actions can I do each turn??”</i>'] },
        { foco: '#campo-0', fala: ['Calma lá! Uma das ações que você pode fazer é <b>invocar um Senhor(a)</b>.', 'Easy there! One of the actions you can do is <b>summoning a Gentleman</b>.'] },
        { foco: ['#campo-0', '#mao-0'], alvo: maoSel(0, 'J', 'espadas'), permitir: [maoSel(0, 'J', 'espadas'), '#campo-0'],
          fala: ['Por exemplo: coloque esse <b>Valete de Espadas</b> no campo (arraste a carta até o campo).', 'For example: put this <b>Jack of Spades</b> on the field (drag the card onto the field).'],
          esperar: api => api.ui().sel.includes(idNaMao(api.jogo().jogadores[0], 'J', 'espadas')) || !!unidadeFig(api.jogo(), 0, 'J') },
        { foco: ['#campo-0', '#mao-0'], alvo: maoSel(0, '4', 'copas'), permitir: [maoSel(0, '4', 'copas'), maoSel(0, 'J', 'espadas'), '#campo-0', '[data-acao^="tipo:sumonar"]'],
          fala: ['Agora coloque esse <b>4 de Copas</b> junto com o Valete.', 'Now put this <b>4 of Hearts</b> together with the Jack.'],
          esperar: api => !!unidadeFig(api.jogo(), 0, 'J') },
        { espera: 900 },
        { foco: slotFig(0, 'J'), fala: ['<b>Tcharam!</b> Você acabou de invocar o seu primeiro Senhor. Viu como é fácil invocar um Senhor(a) em campo?', '<b>Ta-da!</b> You just summoned your first Gentleman. See how easy it is to summon a Gentleman onto the field?'] },
        { foco: ['#campo-0', '#mao-0'], alvo: maoSel(0, 'J', 'ouros'), permitir: ['#mao-0', '#campo-0'],
          fala: ['Vamos lá: invoque esse outro <b>Valete</b>.', 'Come on: summon this other <b>Jack</b>.'],
          esperar: api => api.ui().sel.includes(idNaMao(api.jogo().jogadores[0], 'J', 'ouros')), depois: 3500 },
        { tremer: true, fala: ['Não tá conseguindo?????', 'Can\'t do it?????'] },
        { acao: api => { const ui = api.ui(); ui.sel = []; ui.destino = null; api.render(); api.fixarDica(maoSel(0, 'J', 'ouros')(api)); } },
        { foco: ['#dica', maoSel(0, 'J', 'ouros')], circular: '#dica .dica-limite', fala: ['Bom, o <b>Valete</b> só pode ser combinado com cartas de <b>2 a 4</b>, e o seu único 4 já foi.', 'Well, the <b>Jack</b> can only be paired with cards from <b>2 to 4</b>, and your only 4 is already gone.'] },
        { tremer: true, fala: ['<b>E TEM MAIS:</b> por turno dá pra invocar só <b>1 Valete, 1 Rei e 1 Rainha</b>. O seu Valete de hoje você já invocou!', '<b>AND THERE\'S MORE:</b> each turn you can summon only <b>1 Jack, 1 King and 1 Queen</b>. You already summoned today\'s Jack!'] },
        { acao: api => api.fixarDica(maoSel(0, 'K', 'paus')(api)) },
        { foco: ['#dica', maoSel(0, 'K', 'paus')], circular: '#dica .dica-limite', fala: ['Já o <b>Rei</b> pode ser invocado com cartas de <b>2 a 7</b>.', 'The <b>King</b>, on the other hand, can be summoned with cards from <b>2 to 7</b>.'] },
        { fala: ['<i>“Mas e as cartas 8, 9 e 10?”</i>', '<i>“But what about the 8, 9 and 10?”</i>'] },
        { fala: ['Hehehehe, você consegue deduzir, né???', 'Hehehehe, you can figure it out, right???'] },
        { acao: api => api.soltarDica() },
        { foco: maoSel(0, 'K', 'paus'), fala: () => [`Só que o <b>Rei</b> não entra sozinho: ele <b>sacrifica um Valete</b> seu que já estava em campo <b>antes deste turno</b>, e fica no lugar dele. O seu Valete acabou de chegar, então o Rei fica pro próximo turno.${escada(false)}`,
          `But the <b>King</b> doesn't come in alone: he <b>sacrifices one of your Jacks</b> that was already on the field <b>before this turn</b>, and takes its place. Your Jack just got here, so the King waits for next turn.${escada(true)}`] },
        { foco: slotFig(0, 'J'), fala: ['Mas o Valete tem uma vantagem: o <b>ÍMPETO</b>. Ele <b>ataca no mesmo turno em que entra</b>. Os outros Senhores(as) têm que esperar um turno.',
          'But the Jack has an edge: <b>HASTE</b>. It <b>attacks on the same turn it enters</b>. The other Gentlemen have to wait a turn.'] },
        { foco: '#acoes', fala: ['Você não é obrigado a gastar as 3 ações. Só lembra que, depois de <b>preparar o ataque</b>, não dá mais pra usar ações neste turno.',
          'You don\'t have to spend all 3 actions. Just remember that once you <b>prepare the attack</b>, you can\'t use actions this turn anymore.'] },
        { foco: '[data-acao="ir-ataque"]', permitir: ['[data-acao="ir-ataque"]'],
          fala: ['Para atacar o seu oponente, clique na carta de ação <b>Preparar ataque</b>!', 'To attack your opponent, click the <b>Prepare attack</b> action card!'],
          esperar: api => api.jogo().fase === 'ataque' },
        { foco: slotFig(0, 'J'), permitir: [slotFig(0, 'J')],
          fala: ['Agora clique no <b>Valete</b> para mostrar que você quer agredir esse Palhaço na sua frente.', 'Now click the <b>Jack</b> to show you want to smack that Jester in front of you.'],
          esperar: api => api.ui().ataques.length > 0 },
        { foco: [slotFig(0, 'J'), '#info-1 .heroi'], pulsarSeta: true, fala: ['Tá vendo essa <b>setinha</b>? Quer dizer que você vai atacar o oponente.', 'See that <b>little arrow</b>? It means you are going to attack the opponent.'] },
        { foco: '[data-acao="confirmar-ataques"]', permitir: ['[data-acao="confirmar-ataques"]'],
          fala: ['Agora confirme o ataque!', 'Now confirm the attack!'],
          esperar: api => api.jogo().fase !== 'ataque' },
        { gancho: 'antesDado', quando: d => d.p === 0 && turno() === 2, passos: [
          { foco: slotFig(1, 'J', 'copas'), fala: ['O Valete dele está <b>ativo</b>, então ele até podia <b>defender</b>... mas o Paumol deixou passar. Mão de vaca até com os Senhores!',
            'His Jack is <b>ready</b>, so it could even <b>defend</b>... but Paumol let it through. A cheapskate even with his Gentlemen!'] },
          { fala: ['Não é porque você tem 4 de ataque que vai, obrigatoriamente, dar 4 de dano. Tudo depende do <b>DADO</b>!',
            'Having 4 attack doesn\'t mean you will always deal 4 damage. It all depends on the <b>DIE</b>!'] },
          { fala: [`<div class="tut-dados"><div><i>⚃ ⚄ ⚅</i><b>4 a 6</b><span>dano total: <b>4</b></span></div><div><i>⚁ ⚂</i><b>2 ou 3</b><span>metade (pra baixo): <b>2</b></span></div><div class="ruim"><i>⚀</i><b>1</b><span>errou!</span></div></div>
            Tirou <b>1</b>, errou: vale para <b>qualquer ataque</b>, até contra quem defende. Ninguém leva hit, que vergonha!`,
            `<div class="tut-dados"><div><i>⚃ ⚄ ⚅</i><b>4 to 6</b><span>full damage: <b>4</b></span></div><div><i>⚁ ⚂</i><b>2 or 3</b><span>half (rounded down): <b>2</b></span></div><div class="ruim"><i>⚀</i><b>1</b><span>miss!</span></div></div>
            Roll a <b>1</b> and you miss: it counts for <b>any attack</b>, even against a defender. Nobody takes a hit, shame on you!`] },
          { fala: [`<div class="tut-mas"><b class="tut-mas-titulo">MAS...</b>
            se você for ruim em matemática, é só ficar de olho nesse <b>selo</b>! Ele aparece assim que o dado para e já te mostra quanto vai ser o seu dano.
            <div class="tut-selos">${seloEx('cheio', 5, 'Dano cheio!', '⚔ 4')}${seloEx('metade', 3, 'Metade!', '<s>⚔ 4</s> → ⚔ 2')}${seloEx('errou', 1, 'Errou!')}</div></div>`,
            `<div class="tut-mas"><b class="tut-mas-titulo">BUT...</b>
            if you are bad at math, just keep an eye on this <b>badge</b>! It shows up as soon as the die stops and tells you how much damage you will deal.
            <div class="tut-selos">${seloEx('cheio', 5, 'Full damage!', '⚔ 4')}${seloEx('metade', 3, 'Half!', '<s>⚔ 4</s> → ⚔ 2')}${seloEx('errou', 1, 'Miss!')}</div></div>`] },
          { fala: ['Ah, e guarda isso: o <b>número</b> equipado no Senhor(a) é o ataque dele, e ele serve pra tudo: pra <b>atacar</b>, pra <b>defender</b> e pro <b>contra-ataque</b>.',
            'Oh, and remember this: the <b>number</b> equipped on a Gentleman is its attack, and it counts for everything: <b>attacking</b>, <b>defending</b> and the <b>counterattack</b>.'] },
        ] },
        { ate: 'depoisGolpe', quando: d => d.p === 0 && turno() === 2, permitir: '*', dado: true, fala: ['Vamo lá, <b>joga o dado!</b> (pegue o dado e jogue na mesa)', 'Come on, <b>roll the die!</b> (grab the die and throw it on the table)'] },
        { gancho: 'depoisGolpe', quando: d => d.p === 0 && turno() === 2, passos: [
          { foco: '#info-1 .heroi', fala: d => {
            const n = Math.max(...d.rolagens);
            if (n >= 4) return ['<b>BOUAAA!!!!</b> Acertou em cheio!', '<b>BOOYAAH!!!!</b> A direct hit!'];
            if (n >= 2) return ['É... tá bom, né?', 'Well... that\'s okay, I guess?'];
            return ['<b>HAHAHAHAHAHAH</b>', '<b>HAHAHAHAHAHAH</b>'];
          } },
        ] },
        { gancho: 'duelo', quando: d => d.p === 0 && turno() === 2, passos: [
          { foco: '#combate', fala: ['Tá vendo essa caixa aqui do lado? Ela é o <b>resumo do ataque</b>: quem atacou, quem recebeu e o que aconteceu (o dado que saiu, o dano e quanto PV sobrou).',
            'See this box over here? It is the <b>attack summary</b>: who attacked, who got hit and what happened (the die roll, the damage and how much HP is left).'] },
        ] },
        { gancho: 'fimDoTurno', quando: d => d.p === 0 && turno() === 3, passos: [
          { espera: 700 },
          { foco: slotFig(0, 'J'), fala: ['Depois de rodar o seu ataque, <b>o turno acaba</b>, e os Senhores(as) que atacaram ficam <b>virados para baixo</b>: inutilizáveis até o <b>seu próximo turno</b>.',
            'After your attack is rolled, <b>the turn ends</b>, and the Gentlemen who attacked are <b>turned face down</b>: unusable until <b>your next turn</b>.'] },
          { foco: slotFig(0, 'J'), fala: ['Ou seja: ele <b>não pode defender</b> no turno do oponente. Atacar tem preço, meu amigo!', 'In other words: it <b>can\'t defend</b> on the opponent\'s turn. Attacking has a price, my friend!'] },
        ] },
        // ---------- Turno 3 (oponente): você sem ninguém para defender ----------
        { gancho: 'turnoOponente', quando: () => turno() === 3, passos: [
          { foco: '#info-1 .heroi', fala: ['Agora é o turno do <b>OPONENTE</b>!', 'Now it is the <b>OPPONENT\'s</b> turn!'] },
          { acao: api => { api.ui().tutDado = 5; } }, // (o Valete dele tira 5)
          { foco: slotFig(1, 'J', 'copas'), fala: ['Agora ele vai <b>atacar</b>! E o seu Valete tá virado, então não tem ninguém pra defender... Vai na cara!', 'Now he is going to <b>attack</b>! And your Jack is face down, so there is nobody to defend... Right in the face!'] },
        ] },
        { gancho: 'depoisGolpe', quando: d => d.p === 1 && turno() === 3, passos: [
          { foco: '#info-0 .heroi-pv', fala: ['<b>AI!</b> Ele tirou 5 no dado: dano cheio, os <b>3</b> do Valete dele direto no seu PV.', '<b>OUCH!</b> He rolled a 5: full damage, his Jack\'s <b>3</b> straight into your HP.'] },
        ] },
        // ---------- Turno 4: o Rei (sacrificando o Valete), o segundo Valete, os recursos ----------
        esperarCompra,
        { foco: '#info-0 .heroi', fala: ['Legal, é o <b>seu turno</b> novamente!', 'Nice, it is <b>your turn</b> again!'] },
        { foco: slotFig(0, 'J', 'espadas'), fala: ['Olha: o seu Valete <b>acordou</b>. No começo do seu turno, quem estava virado volta a ficar ativo.', 'Look: your Jack <b>woke up</b>. At the start of your turn, whoever was face down becomes ready again.'] },
        { foco: '#pilhas-0', alvo: '[data-pilha="0:numeros"]', permitir: ['[data-pilha="0:numeros"]'], compra: true,
          fala: ['Compre um <b>Número</b> de novo.', 'Draw a <b>Number</b> again.'],
          esperar: api => api.jogo().fase !== 'compra' },
        { espera: 800 },
        { foco: [maoSel(0, 'K', 'paus'), slotFig(0, 'J', 'espadas')], fala: ['Agora sim: o seu Valete já estava em campo <b>antes deste turno</b>, então dá pra <b>sacrificar</b> ele pra invocar o <b>Rei</b>!',
          'Now we\'re talking: your Jack was already on the field <b>before this turn</b>, so you can <b>sacrifice</b> it to summon the <b>King</b>!'] },
        { foco: ['#campo-0', '#mao-0'], permitir: [maoSel(0, 'K', 'paus'), maoSel(0, '7', 'espadas'), '#campo-0', '[data-acao^="tipo:sumonar"]', slotFig(0, 'J', 'espadas')],
          alvo: api => { const ui = api.ui(), j = api.jogo().jogadores[0]; return ui.sel.length > 1 ? '[data-acao^="tipo:sumonar"]' : ui.sel.includes(idNaMao(j, 'K', 'paus')) ? maoSel(0, '7', 'espadas')(api) : maoSel(0, 'K', 'paus')(api); },
          fala: ['Selecione o <b>Rei</b> e o <b>7</b>, e depois a carta <b>Invocar</b>.', 'Select the <b>King</b> and the <b>7</b>, then the <b>Summon</b> card.'],
          esperar: api => !!(api.ui().pend && api.ui().pend.passos.includes('sacrificios')) || !!unidadeFig(api.jogo(), 0, 'K') },
        { foco: slotFig(0, 'J', 'espadas'), alvo: slotFig(0, 'J', 'espadas'), permitir: [slotFig(0, 'J', 'espadas')],
          fala: ['Clique no <b>Valete</b> para sacrificá-lo. O Rei entra no lugar dele.', 'Click the <b>Jack</b> to sacrifice it. The King takes its place.'],
          esperar: api => !!unidadeFig(api.jogo(), 0, 'K') },
        { espera: 1100 },
        { foco: slotFig(0, 'K'), fala: ['<b>Evoluiu!</b> O Valete virou um <b>Rei</b> com <b>7 de ataque</b>.', '<b>It evolved!</b> The Jack became a <b>King</b> with <b>7 attack</b>.'] },
        { foco: maoSel(0, 'J', 'ouros'), fala: ['E agora dá pra invocar aquele outro <b>Valete</b> também: hoje você ainda não invocou nenhum (o Rei conta como Rei, não como Valete).',
          'And now you can summon that other <b>Jack</b> too: you haven\'t summoned one today yet (the King counts as a King, not as a Jack).'] },
        { foco: ['#campo-0', '#mao-0'], permitir: [maoSel(0, 'J', 'ouros'), maoSel(0, '3', 'espadas'), '#campo-0', '[data-acao^="tipo:sumonar"]'],
          alvo: api => { const ui = api.ui(), j = api.jogo().jogadores[0]; return ui.sel.length > 1 ? '[data-acao^="tipo:sumonar"]' : ui.sel.includes(idNaMao(j, 'J', 'ouros')) ? maoSel(0, '3', 'espadas')(api) : maoSel(0, 'J', 'ouros')(api); },
          fala: ['Invoque o <b>Valete de Ouros</b> com esse <b>3</b>.', 'Summon the <b>Jack of Diamonds</b> with this <b>3</b>.'],
          esperar: api => !!unidadeFig(api.jogo(), 0, 'J', 'ouros') },
        { espera: 900 },
        { foco: '#acoes', fala: ['Você tem <b>mais uma ação</b> para fazer nesse turno!', 'You have <b>one more action</b> to use this turn!'] },
        { foco: '#mao-0', fala: ['Além de usar as cartas de número como ataque dos seus Senhores(as), você pode usar as cartas de número como <b>recursos</b>. Cada naipe faz uma coisa diferente.',
          'Besides using number cards as your Gentlemen\'s attack, you can use number cards as <b>resources</b>. Each suit does something different.'] },
        { acao: api => selecionar(api, '8', 'espadas') },
        { foco: [maoSel(0, '8', 'espadas'), '[data-acao^="tipo:espadas"]'], alvo: [maoSel(0, '8', 'espadas'), '[data-acao^="tipo:espadas"]'],
          fala: ['Cartas de <b>Espadas</b> podem ser trocadas por <b>+1 de ataque</b>, só por um turno, em um dos seus Senhores(as).', '<b>Spades</b> cards can be traded for <b>+1 attack</b>, for one turn only, on one of your Gentlemen.'] },
        { acao: api => selecionar(api, '6', 'copas') },
        { foco: [maoSel(0, '6', 'copas'), '[data-acao^="tipo:curar"]'], alvo: [maoSel(0, '6', 'copas'), '[data-acao^="tipo:curar"]'],
          fala: ['As cartas de <b>Copas</b> podem ser usadas para <b>curar o seu PV</b>: do Ás ao 5 curam <b>3 PV</b>, e de 6 a 10 curam <b>4 PV</b> (e o Infartitte ainda cura +1, porque tem coração forte).',
            '<b>Hearts</b> cards can be used to <b>heal your HP</b>: Ace to 5 heal <b>3 HP</b>, and 6 to 10 heal <b>4 HP</b> (and Infartitte heals +1 more, thanks to his strong heart).'] },
        { acao: api => selecionar(api, '9', 'ouros') },
        { foco: [maoSel(0, '9', 'ouros'), '[data-acao^="tipo:comprar"]', '[data-acao="dado-adicional"]'], alvo: [maoSel(0, '9', 'ouros'), '[data-acao="tipo:comprar/letras"]', '[data-acao="tipo:comprar/numeros"]', '[data-acao="dado-adicional"]'],
          fala: ['E as cartas de <b>Ouros</b> podem ser usadas para <b>comprar uma carta</b>, ou para <b>adicionar mais um dado</b> na rolagem de ataque. O dado que tirar o maior número é o que vale... Dãrr.',
            'And <b>Diamonds</b> cards can be used to <b>draw a card</b>, or to <b>add one more die</b> to an attack roll. The die with the highest number is the one that counts... Duh.'] },
        { foco: [maoSel(0, '9', 'ouros'), '[data-acao^="tipo:comprar"]'], alvo: '[data-acao="tipo:comprar/numeros"]', permitir: ['[data-acao="tipo:comprar/numeros"]'],
          fala: ['Use a carta de Ouros para <b>comprar uma carta de Número</b>.', 'Use the Diamonds card to <b>draw a Number card</b>.'],
          esperar: api => !!idNaMao(api.jogo().jogadores[0], '10', 'paus') },
        { espera: 1000 },
        { acao: api => { selecionar(api, '10', 'paus'); api.ui().tutCartaExtra = 'paus'; api.render(); } },
        { foco: [maoSel(0, '10', 'paus'), '[data-acao="tut-demo"]'], alvo: [maoSel(0, '10', 'paus'), '[data-acao="tut-demo"]'],
          fala: ['E a carta de <b>Paus</b> pode ser usada para deixar um Senhor(a) seu que está <b>ferido</b> em estado de <b>Berserk</b>: ele levanta e aguenta firme até o fim do próximo turno do oponente. Mas se levar hit nesse tempo, morre.',
            'And a <b>Clubs</b> card can put one of your <b>wounded</b> Gentlemen into <b>Berserk</b>: it stands back up and holds on until the end of the opponent\'s next turn. But if it takes a hit meanwhile, it dies.'] },
        { acao: api => { const ui = api.ui(); ui.tutCartaExtra = null; ui.sel = []; api.render(); } },
        { foco: '#acoes', fala: ['Ok: você invocou um Rei, invocou um Valete e usou o seu 9 de Ouros pra comprar uma carta nova. Não precisa ser um gênio pra perceber que você usou suas <b>3 ações</b>.',
          'Ok: you summoned a King, summoned a Jack and used your 9 of Diamonds to draw a new card. You don\'t need to be a genius to see you used your <b>3 actions</b>.'] },
        { foco: '[data-acao="ir-ataque"]', alvo: '[data-acao="ir-ataque"]', permitir: ['[data-acao="ir-ataque"]'],
          fala: ['Agora é hora de <b>preparar o ataque</b>!', 'Now it is time to <b>prepare the attack</b>!'],
          esperar: api => api.jogo().fase === 'ataque' },
        { acao: () => { T.marcas.rei = false; } },
        { foco: [slotFig(0, 'J', 'ouros'), slotFig(0, 'K')], permitir: [slotFig(0, 'J', 'ouros'), slotFig(0, 'K')],
          alvo: api => (api.ui().ataques.length ? slotFig(0, 'K')(api) : slotFig(0, 'J', 'ouros')(api)),
          clique: [{ em: slotFig(0, 'K'), faz: api => { if (api.ui().ataques.length) { T.marcas.rei = true; api.negar(slotFig(0, 'K')(api), '???'); } } }],
          fala: ['Selecione o <b>Valete</b> e o <b>Rei</b> para atacar.', 'Select the <b>Jack</b> and the <b>King</b> to attack.'],
          esperar: api => api.ui().ataques.length > 0 && T.marcas.rei, depois: 900 },
        { tremer: true, fala: ['Ué, não tá conseguindo???', 'Huh, can\'t do it???'] },
        { fala: ['Deve estar bugado...', 'Must be bugged...'] },
        { fala: ['...', '...'] },
        { foco: slotFig(0, 'K'), fala: ['Ah, é verdade: você <b>não consegue atacar com o Rei no mesmo turno em que invocou ele</b>. Só o Valete, com o Ímpeto, ataca assim que chega.',
          'Oh, right: you <b>can\'t attack with the King on the same turn you summoned him</b>. Only the Jack, with Haste, attacks right away.'] },
        { foco: slotFig(0, 'K'), fala: ['Mas tem um lado bom: como o Rei não atacou, ele continua <b>ativo</b> e vai poder <b>defender</b> no turno do oponente.',
          'But there is an upside: since the King didn\'t attack, he stays <b>ready</b> and will be able to <b>defend</b> on the opponent\'s turn.'] },
        { foco: '[data-acao="confirmar-ataques"]', alvo: '[data-acao="confirmar-ataques"]', permitir: ['[data-acao="confirmar-ataques"]'],
          fala: ['Ataque <b>apenas com o Valete</b>!', 'Attack <b>with the Jack only</b>!'],
          esperar: api => api.jogo().fase !== 'ataque' },
        { gancho: 'antesDado', quando: d => d.p === 0 && turno() === 4, passos: [
          { foco: slotFig(1, 'J', 'copas'), fala: ['O oponente não consegue se defender, porque ele atacou no último turno e agora está <b>virado para baixo</b>. Então não tem ninguém te segurando!', "The opponent can't defend, because he attacked last turn and is now <b>face down</b>. So nobody is holding you back!"] },
        ] },
        { ate: 'depoisGolpe', quando: d => d.p === 0 && turno() === 4, permitir: '*', dado: true, fala: ['Jogue o dado e, <b>PELO AMOR DE DEUS, NÃO TIRE 1!!</b>', "Roll the die and, <b>FOR THE LOVE OF GOD, DON'T ROLL A 1!!</b>"] },
        { gancho: 'depoisGolpe', quando: d => d.p === 0 && turno() === 4, passos: [
          { foco: '#info-1 .heroi', fala: d => (Math.max(...d.rolagens) >= 4 ? ['<b>BOUAAA!!!!</b>', '<b>BOOYAAH!!!!</b>'] : Math.max(...d.rolagens) >= 2 ? ['É... tá bom, né?', 'Well... okay, I guess?'] : ['<b>HAHAHAHAHAHAH</b>', '<b>HAHAHAHAHAHAH</b>']) },
        ] },
        // ---------- Turno 5 (oponente): outro Valete, cura e ataque com os dois; você defende com o Rei ----------
        { gancho: 'turnoOponente', quando: () => turno() === 5, passos: [
          { foco: '#info-1 .heroi', fala: ['Agora vamos ver o que esse <b>Palhaço</b> vai fazer...', "Now let's see what this <b>Jester</b> is going to do..."] },
          { acao: api => { const j = api.jogo().jogadores[1]; aplicarPerto(api, x => x.tipo === 'sumonar' && x.figura === idNaMao(j, 'J', 'paus') && x.numero === idNaMao(j, '4', 'ouros')); } },
          { espera: 1200 },
          { foco: slotFig(1, 'J', 'paus'), fala: ['Outro <b>Valete</b>... ok.', 'Another <b>Jack</b>... okay.'] },
          { acao: api => { const j = api.jogo().jogadores[1]; aplicarPerto(api, x => x.tipo === 'curar' && x.carta === idNaMao(j, '6', 'copas')); } },
          { espera: 2100 }, // (a carta de Copas dele aparece virando e vai para o cemitério)
          { foco: '#info-1 .heroi', fala: ['Ele usou uma carta de <b>Copas</b> para se curar. Interessante...', 'He used a <b>Hearts</b> card to heal. Interesting...'] },
          // (o Valete de 4 tira 5 no dado; o de 3, 2)
          { acao: api => { const u = unidadeFig(api.jogo(), 1, 'J', 'paus'); api.ui().tutDadoPor = at => (u && at.atacante === u.uid ? 5 : 2); } },
          { foco: '#campo-1', fala: ['Agora ele vai <b>atacar</b>...', 'Now he is going to <b>attack</b>...'] },
        ] },
        { gancho: 'bloqueio', quando: () => turno() === 5, passos: [
          { foco: slotFig(1, 'J', 'paus'), fala: ['<i>“Peraí!! Mas como ele vai atacar com os 2 Valetes, se ele acabou de invocar esse segundo Valete nesse turno???”</i>',
            '<i>“Wait!! How can he attack with both Jacks if he just summoned this second Jack this turn???”</i>'] },
          { acao: api => api.fixarDica(slotFig(1, 'J', 'paus')(api) + ' .unidade') },
          { foco: ['#dica', slotFig(1, 'J', 'paus')], circular: '#dica p:has(> .dica-hab)', fala: ['Lembra do <b>ÍMPETO</b>? O Valete dele também <b>ataca no mesmo turno</b> em que é invocado.', 'Remember <b>HASTE</b>? His Jack also <b>attacks on the same turn</b> it is summoned.'] },
          { acao: api => api.soltarDica() },
          { foco: [slotFig(0, 'K'), '#campo-1'], fala: ['Toda vez que rolar um ataque e tiver Senhores(as) ativos dos dois lados, você tem a oportunidade de <b>defender</b>.',
            'Every time an attack comes and there are ready Gentlemen on both sides, you get the chance to <b>defend</b>.'] },
        ] },
        { foco: [slotFig(0, 'K'), slotFig(1, 'J', 'paus')], alvo: api => (api.ui().bloqSel == null ? slotFig(0, 'K')(api) : slotFig(1, 'J', 'paus')(api)),
          permitir: [slotFig(0, 'K'), slotFig(1, 'J', 'paus')],
          fala: ['Clique no seu <b>Rei</b> e depois nesse <b>Valete</b> de 4, o vacilão: assim você escolhe <b>defender</b> o ataque dele. O seu Valete atacou no seu turno e tá virado, então o Rei é o único acordado. O de 3 vai passar.',
            'Click your <b>King</b> and then this 4-attack <b>Jack</b>, the sucker: that is how you choose to <b>defend</b> against its attack. Your Jack attacked on your turn and is face down, so the King is the only one awake. The 3 will get through.'],
          esperar: api => { const e = api.jogo(), at = ataqueDe(e, 1, 'J', 'paus'), k = unidadeFig(e, 0, 'K'); return !!at && !!k && (api.ui().bloqueios[at.n] || []).includes(k.uid); } },
        { foco: '[data-acao="confirmar-bloqueios"]', alvo: '[data-acao="confirmar-bloqueios"]', permitir: ['[data-acao="confirmar-bloqueios"]'],
          fala: ['Você declarou sua defesa! Agora clique na carta de ação <b>Defender</b>.', 'You declared your defense! Now click the <b>Defend</b> action card.'],
          esperar: api => api.jogo().fase !== 'bloqueio' },
        { ate: 'depoisGolpe', esconder: true, quando: d => d.p === 1 && turno() === 5 && ehAtaqueDe(d, 'J', 'paus') },
        { gancho: 'depoisGolpe', quando: d => d.p === 1 && turno() === 5 && ehAtaqueDe(d, 'J', 'paus'), passos: [
          { espera: 500 },
          { foco: slotFig(0, 'K'), semSetas: true, fala: ['Você defendeu, <b>boua!!</b> Ele tirou 5: dano cheio de 4. O seu Rei levou 1 hit e agora está <b>deitado</b>, porque levou dano.',
            'You defended, <b>nice!!</b> He rolled a 5: full damage of 4. Your King took 1 hit and is now <b>lying down</b>, because it took damage.'] },
          { foco: slotFig(0, 'K'), semSetas: true, pulsar: [vidaFig(0, 'K')], fala: ['Tá vendo esses <b>escudinhos</b> em cima de cada Senhor(a)? Eles são a <b>defesa</b> dele. De padrão, cada Senhor(a) aguenta <b>2 hits</b>. Quando leva um hit, um escudo se apaga e ele deita pra mostrar que tá machucado, tadinho :(',
            'See those <b>little shields</b> on each Gentleman? They are its <b>defense</b>. By default, each Gentleman takes <b>2 hits</b>. When it takes a hit, a shield goes dark and it lies down to show it is hurt, poor thing :('] },
          { foco: [slotFig(0, 'K'), slotFig(1, 'J', 'paus')], semSetas: true, pulsar: [vidaFig(1, 'J', 'paus')], fala: ['E olha o Valete dele: também levou 1 hit! Isso é o <b>contra-ataque</b>. Ele acontece quando o <b>número de quem ataca é MENOR</b> que o de quem defende.',
            'And look at his Jack: it took 1 hit too! That is the <b>counterattack</b>. It happens when the <b>attacker\'s number is LOWER</b> than the defender\'s.'] },
          { foco: [slotFig(0, 'K'), slotFig(1, 'J', 'paus')], semSetas: true, fala: ['Neste caso, o Valete dele tem <b>4</b> de ataque, e o seu Rei tem <b>7</b>... 4 é menor que 7, né? Então o contra-ataque acontece, sem precisar de dado (só um <b>1</b>, o erro, cancela tudo).',
            'Here, his Jack has <b>4</b> attack, and your King has <b>7</b>... 4 is lower than 7, right? So the counterattack happens, no die needed (only a <b>1</b>, the miss, cancels everything).'] },
          { semSetas: true, fala: [`E você só leva <b>HIT</b> defendendo se o ataque do oponente for minimamente forte. Pensa num <b>termômetro</b> feito com a <b>SUA carta equipada</b>:
            <ul class="tut-lista"><li class="verde">Se o dano do oponente <b>não chegar nem na METADE</b> da sua carta equipada, <b>não machuca</b>.</li>
            <li class="amarelo">Se chegar na metade, você leva <b>1 HIT</b>.</li><li class="vermelho">E se <b>passar</b> do valor da sua carta equipada, você leva <b>2 HITs</b>.</li></ul>
            <div class="tut-regua">${reguaEx(7, null, '', '', FAIXAS[0])}<small>o seu Rei: carta equipada 7</small></div>`,
            `And you only take a <b>HIT</b> when defending if the opponent's attack is at least somewhat strong. Think of a <b>thermometer</b> made from <b>YOUR equipped card</b>:
            <ul class="tut-lista"><li class="verde">If the opponent's damage <b>doesn't even reach HALF</b> of your equipped card, <b>it doesn't hurt</b>.</li>
            <li class="amarelo">If it reaches half, you take <b>1 HIT</b>.</li><li class="vermelho">And if it <b>goes over</b> your equipped card's value, you take <b>2 HITs</b>.</li></ul>
            <div class="tut-regua">${reguaEx(7, null, '', '', FAIXAS[1])}<small>your King: equipped card 7</small></div>`] },
          { semSetas: true, fala: [`Agora olha o que aconteceu: ele tirou <b>5</b>, dano cheio: <b>4</b>. A metade do seu 7 é 3,5: o 4 passou da metade, mas não passou do 7. Caiu no <b>amarelo</b>: 1 HIT!
            <div class="tut-regua">${reguaEx(7, 4, 'hit', '1 hit', FAIXAS[0])}</div>
            <p class="tut-ok">Na partida, esse termômetro aparece em cima de quem defende, pra você ver onde o dano caiu.</p>`,
            `Now look at what happened: he rolled a <b>5</b>, full damage: <b>4</b>. Half of your 7 is 3.5: the 4 went past half, but not past 7. It landed in the <b>yellow</b>: 1 HIT!
            <div class="tut-regua">${reguaEx(7, 4, 'hit', '1 hit', FAIXAS[1])}</div>
            <p class="tut-ok">During a match, this thermometer shows up over the defender so you can see where the damage landed.</p>`] },
          { semSetas: true, fala: ['Se ele tivesse tirado 2 ou 3, o ataque cairia pela metade (<b>2</b>), nem chegaria no 3,5, e o seu Rei <b>não levaria nada</b>. E o contra-ataque rolaria do mesmo jeito!',
            'Had he rolled a 2 or 3, his attack would be halved (<b>2</b>), not even reaching 3.5, and your King <b>would take nothing</b>. And the counterattack would happen all the same!'] },
          { fala: ['Parece meio complicado, mas eu juro que não é tão difícil de aprender (a não ser que você seja um bebezinho, hehehehe).', 'Looks a bit complicated, but I swear it is not that hard to learn (unless you are a little baby, hehehehe).'] },
        ] },
        // ---------- Turno 6: a Rainha na mão, o poder do Palhaço, a cura e a Ordem real do Rei ----------
        esperarCompra,
        { acao: api => { api.ui().tutDadoPor = null; } },
        { foco: '#info-0 .heroi', fala: ['Seu <b>turno</b> novamente!', 'Your <b>turn</b> again!'] },
        { foco: '#pilhas-0', alvo: '[data-pilha="0:letras"]', permitir: ['[data-pilha="0:letras"]'], compra: true,
          fala: ['Agora vamos comprar uma carta de <b>Letra</b>.', 'Now let\'s draw a <b>Face</b> card.'],
          esperar: api => api.jogo().fase !== 'compra' },
        { espera: 800 },
        { foco: maoSel(0, 'Q', 'paus'), alvo: maoSel(0, 'Q', 'paus'), fala: ['Olha!! Uma <b>Rainha</b>!!! A Rainha pode ser invocada com cartas de <b>2 até o 10</b>. A SENHORA Rainha é a mais forte do jogo!!',
          'Look!! A <b>Queen</b>!!! The Queen can be summoned with cards from <b>2 to 10</b>. MADAM Queen is the strongest in the game!!'] },
        { foco: maoSel(0, 'Q', 'paus'), fala: ['Mas ela também tem que fazer <b>sacrifícios</b>: <b>1 Rei</b> ou <b>2 Valetes</b> que já estavam em campo. Hoje o seu Rei ainda tem trabalho, então vamos deixar ela pro próximo turno.',
          'But she also needs <b>sacrifices</b>: <b>1 King</b> or <b>2 Jacks</b> that were already on the field. Your King still has work to do today, so let\'s leave her for the next turn.'] },
        { foco: '#info-0 .poder-naipe', fala: ['Outra coisa que você pode fazer como ação é usar o <b>Poder do Palhaço</b> (1 vez por turno).', 'Another thing you can do as an action is use the <b>Jester\'s Power</b> (once per turn).'] },
        { foco: '#info-0 .poder-naipe', fala: ['No caso do Infartitte, você pode trocar <b>2 PV</b> para <b>recuperar 1 defesa</b> de um Senhor(a) seu, ou trocar <b>4 PV</b> para <b>tirar 1 defesa</b> de um Senhor(a) inimigo.',
          'For Infartitte, you can trade <b>2 HP</b> to <b>restore 1 defense</b> of one of your Gentlemen, or trade <b>4 HP</b> to <b>remove 1 defense</b> from an enemy Gentleman.'] },
        { foco: ['#info-0 .poder-naipe', slotFig(0, 'K')], pulsar: [vidaFig(0, 'K')],
          fala: ['Nesta situação, vale mais a pena <b>recuperar a defesa do seu Rei</b>.', 'Right now, it is better to <b>restore your King\'s defense</b>.'] },
        { foco: ['#info-0 .poder-naipe', slotFig(0, 'K')], permitir: ['#info-0 .poder-naipe', slotFig(0, 'K')],
          alvo: api => (api.ui().pend && api.ui().pend.tipo === 'poder' ? slotFig(0, 'K')(api) : '#info-0 .poder-naipe'),
          fala: ['Clique no <b>naipe de Copas</b> e depois no seu <b>Rei magoado</b>.', 'Click the <b>Hearts suit</b> and then your <b>hurt King</b>.'],
          esperar: api => { const u = unidadeFig(api.jogo(), 0, 'K'); return !!u && u.hits === 0; } },
        { espera: 1300 },
        { foco: '#info-0 .heroi-pv', fala: ['Perceba que você <b>perdeu 2 de PV</b> pra curar o Rei. Mas calma, que a gente tá com uma carta de <b>Copas</b> na mão: se cure usando ela!',
          'Notice that you <b>lost 2 HP</b> to heal the King. But relax, we have a <b>Hearts</b> card in hand: heal yourself with it!'] },
        { semVeu: true, permitir: [maoSel(0, '6', 'copas'), '[data-acao^="tipo:curar"]', '#info-0'], alvo: maoSel(0, '6', 'copas'),
          fala: ['Use a carta de <b>Copas</b> para se curar.', 'Use the <b>Hearts</b> card to heal.'],
          esperar: api => !idNaMao(api.jogo().jogadores[0], '6', 'copas') },
        { espera: 1000 },
        { foco: '#acoes', fala: ['Tá sobrando uma <b>ação</b>, mas tá tudo bem: você tá com vantagem nessa situação. Vamos nos preparar para <b>atacar</b>!!', 'One <b>action</b> is left over, but that is fine: you have the upper hand here. Let\'s get ready to <b>attack</b>!!'] },
        { foco: '[data-acao="ir-ataque"]', alvo: '[data-acao="ir-ataque"]', permitir: ['[data-acao="ir-ataque"]'], fala: ['Clique em <b>Preparar ataque</b>.', 'Click <b>Prepare attack</b>.'],
          esperar: api => api.jogo().fase === 'ataque' },
        { foco: slotFig(0, 'K'), fala: ['Assim como o <b>Valete</b> tem a sua habilidade única, o <b>Rei</b> também tem: a <b>ORDEM REAL</b>! Ele pode atacar um <b>Senhor(a)</b> inimigo, que é <b>obrigado a defender</b>.',
          'Just like the <b>Jack</b> has its unique ability, the <b>King</b> has one too: the <b>ROYAL ORDER</b>! He can attack an enemy <b>Gentleman</b>, who <b>must defend</b>.'] },
        { foco: [slotFig(0, 'K'), slotFig(1, 'J', 'paus')], permitir: [slotFig(0, 'K'), slotFig(1, 'J', 'paus')],
          alvo: api => (api.ui().miraRei != null ? slotFig(1, 'J', 'paus')(api) : slotFig(0, 'K')(api)),
          fala: ['Vamos derrubar esse <b>Valete</b> machucado, coitado do inimigo: clique no seu <b>Rei</b> e mire o ataque nele.', 'Let\'s take down that hurt <b>Jack</b>, poor enemy: click your <b>King</b> and aim the attack at it.'],
          esperar: api => { const k = unidadeFig(api.jogo(), 0, 'K'), v = unidadeFig(api.jogo(), 1, 'J', 'paus'); return !!k && !!v && api.ui().ataques.some(a => a.atacante === k.uid && a.alvo === v.uid); } },
        { foco: slotFig(0, 'J', 'ouros'), alvo: slotFig(0, 'J', 'ouros'), permitir: [slotFig(0, 'J', 'ouros')],
          fala: ['E ataque livre com o seu <b>Valete</b>!', 'And attack freely with your <b>Jack</b>!'],
          esperar: api => { const v = unidadeFig(api.jogo(), 0, 'J', 'ouros'); return !!v && api.ui().ataques.some(a => a.atacante === v.uid); } },
        { foco: '[data-acao="confirmar-ataques"]', alvo: '[data-acao="confirmar-ataques"]', permitir: ['[data-acao="confirmar-ataques"]'],
          fala: ['Confirme o <b>ataque</b>!', 'Confirm the <b>attack</b>!'], esperar: api => api.jogo().fase !== 'ataque' },
        { ate: 'fimDoTurno', quando: d => d.p === 0 && turno() === 7, permitir: '*', dado: true, fala: ['Joga os <b>dados</b>!', 'Roll the <b>dice</b>!'] },
        { gancho: 'fimDoTurno', quando: d => d.p === 0 && turno() === 7, passos: [
          { foco: '#campo-1', fala: () => (unidadeFig(T.api.jogo(), 1, 'J', 'paus')
            ? ['Ih, o Valete dele escapou dessa... Tudo bem, até o Rei tem dia ruim.', 'Oops, his Jack got away this time... That\'s fine, even a King has bad days.']
            : ['<b>LEGAL!!!</b> O Valete machucado dele foi pro cemitério.', '<b>AWESOME!!!</b> His hurt Jack went to the graveyard.']) },
        ] },
        // ---------- Turno 7 (oponente): um Rei naipado de Espadas ----------
        { gancho: 'turnoOponente', quando: () => turno() === 7, passos: [
          { acao: api => { const j = api.jogo().jogadores[1]; aplicarPerto(api, x => x.tipo === 'sumonar' && x.figura === idNaMao(j, 'K', 'espadas') && x.numero === idNaMao(j, '7', 'espadas')); } },
          { espera: 1300 },
          { foco: slotFig(1, 'K', 'espadas'), fala: ['Olha, um <b>Rei</b>, que bonitinho! Ele sacrificou o Valete de Copas pra entrar. Você reparou que ele tem 7 de ataque, mas está mostrando que tem <b>8</b>?',
            'Look, a <b>King</b>, how cute! He sacrificed the Jack of Hearts to come in. Did you notice he has 7 attack, but it shows <b>8</b>?'] },
          { acao: api => api.fixarDica(slotFig(1, 'K', 'espadas')(api) + ' .unidade') },
          { foco: ['#dica', slotFig(1, 'K', 'espadas')], circular: '#dica p:has(> .naipe-espadas)',
            fala: ['Isso acontece porque esse é um <b>Rei naipado</b> de <b>Espadas</b>: quando a Letra e o Número do Senhor(a) são do mesmo naipe, ele ganha uma <b>passiva</b> de acordo com o naipe.',
              'That is because this is a <b>suited King</b> of <b>Spades</b>: when the Face and the Number of a Gentleman share a suit, it gets a <b>passive</b> based on that suit.'] },
          { foco: ['#dica', slotFig(1, 'K', 'espadas')], circular: '#dica p:has(> .naipe-espadas)',
            fala: ['No caso dos naipados de <b>Espadas</b>, ele ganha <b>+1 de ataque</b> bônus por ser naipado.', 'For <b>Spades</b>-suited ones, it gets a <b>+1 attack</b> bonus for being suited.'] },
          { acao: api => api.soltarDica() },
          { foco: '#campo-0', fala: ['Ainda bem que o <b>Rei</b> não ataca no turno em que entra, porque senão você ia se ferrar: os seus dois <b>Senhores</b> estão virados para baixo.',
            'Good thing the <b>King</b> can\'t attack on the turn he enters, otherwise you would be in trouble: your two <b>Gentlemen</b> are face down.'] },
        ] },
        // ---------- Turno 8: o Ás totem e a Rainha ----------
        esperarCompra,
        { foco: '#pilhas-0', alvo: '[data-pilha="0:numeros"]', permitir: ['[data-pilha="0:numeros"]'], compra: true,
          fala: ['Seu <b>turno</b>! Compre uma carta de <b>Número</b> dessa vez.', 'Your <b>turn</b>! Draw a <b>Number</b> card this time.'],
          esperar: api => api.jogo().fase !== 'compra' },
        { espera: 800 },
        { foco: maoSel(0, 'A', 'espadas'), alvo: maoSel(0, 'A', 'espadas'), fala: ['<i>“Mas peraí, o Ás não é um número??”</i>', '<i>“But wait, isn\'t the Ace a number??”</i>'] },
        { foco: maoSel(0, 'A', 'espadas'), fala: ['Sim! Mas não dá para invocar ele como <b>Senhor(a)</b>: ele funciona como um <b>TOTEM</b>.', 'Yes! But you can\'t summon it as a <b>Gentleman</b>: it works as a <b>TOTEM</b>.'] },
        { foco: [maoSel(0, 'A', 'espadas'), maoSel(0, '8', 'espadas')], fala: ['Para invocar ele, você precisa <b>sacrificar uma carta de número do mesmo naipe</b> dele.', 'To summon it, you have to <b>sacrifice a number card of the same suit</b>.'] },
        { foco: ['#campo-0', '#mao-0'], permitir: [maoSel(0, 'A', 'espadas'), maoSel(0, '8', 'espadas'), '#campo-0', '[data-acao^="tipo:invocarAs"]'],
          alvo: api => (api.ui().sel.includes(idNaMao(api.jogo().jogadores[0], 'A', 'espadas')) ? maoSel(0, '8', 'espadas')(api) : maoSel(0, 'A', 'espadas')(api)),
          fala: ['Arraste o <b>Ás</b> para o meio dos seus dois <b>Senhores</b> e depois junte a carta de <b>Espadas</b> com ele.', 'Drag the <b>Ace</b> between your two <b>Gentlemen</b>, then add the <b>Spades</b> card to it.'],
          esperar: api => api.jogo().jogadores[0].campo.some(u => u && u.tipo === 'as') },
        { espera: 900 },
        { foco: slotAs(0), fala: ['Cada totem <b>Ás</b> tem uma habilidade única, dependendo do naipe. Ele não ataca, não defende e morre com 1 golpe.', 'Each <b>Ace</b> totem has a unique ability, depending on its suit. It doesn\'t attack, doesn\'t defend and dies to 1 hit.'] },
        { foco: '#campo-0', fala: ['No caso de <b>Espadas</b>, ele dá <b>+1 de ataque</b> para os <b>Senhores</b> do lado dele.', 'For <b>Spades</b>, it gives <b>+1 attack</b> to the <b>Gentlemen</b> next to it.'] },
        { foco: [maoSel(0, 'Q', 'paus'), maoSel(0, '10', 'paus')], fala: ['Tá na hora de invocar uma <b>Rainha</b> naipada de <b>Paus</b>!', 'Time to summon a <b>Clubs</b>-suited <b>Queen</b>!'] },
        { foco: '#campo-0', fala: ['Lembra: a <b>Rainha</b> é bem forte, então ela pede <b>sacrifícios</b>: ou <b>2 Valetes</b> em campo, ou <b>1 Rei</b>. O seu Rei está aqui desde dois turnos atrás, então pode.',
          'Remember: the <b>Queen</b> is very strong, so she asks for <b>sacrifices</b>: either <b>2 Jacks</b> on the field, or <b>1 King</b>. Your King has been here for two turns, so he qualifies.'] },
        { foco: ['#campo-0', '#mao-0'], permitir: [maoSel(0, 'Q', 'paus'), maoSel(0, '10', 'paus'), '[data-acao^="tipo:sumonar"]'],
          alvo: api => { const ui = api.ui(), j = api.jogo().jogadores[0]; return ui.sel.length > 1 ? '[data-acao^="tipo:sumonar"]' : ui.sel.includes(idNaMao(j, 'Q', 'paus')) ? maoSel(0, '10', 'paus')(api) : maoSel(0, 'Q', 'paus')(api); },
          fala: ['Selecione o <b>10</b> e a <b>Rainha de Paus</b>, e depois a carta <b>Invocar</b>.', 'Select the <b>10</b> and the <b>Queen of Clubs</b>, then the <b>Summon</b> card.'],
          esperar: api => !!(api.ui().pend && api.ui().pend.passos.includes('sacrificios')) || !!unidadeFig(api.jogo(), 0, 'Q') },
        { foco: slotFig(0, 'K'), alvo: slotFig(0, 'K'), permitir: [slotFig(0, 'K')],
          fala: ['Clique no <b>Rei</b> para sacrificá-lo.', 'Click the <b>King</b> to sacrifice him.'],
          esperar: api => !!unidadeFig(api.jogo(), 0, 'Q') },
        { espera: 1100 },
        { foco: slotFig(0, 'Q'), fala: ['<b>Pronto!</b>', '<b>Done!</b>'] },
        { acao: api => api.fixarDica(slotFig(0, 'Q')(api) + ' .unidade') },
        { foco: ['#dica', slotFig(0, 'Q')], circular: '#dica p:has(> .dica-hab)',
          fala: ['A <b>Rainha</b> tem como habilidade <b>ATROPELAR</b>: se ela matar quem tentou defender, o dano que sobrar vai direto pro <b>Palhaço</b> oponente.',
            'The <b>Queen</b>\'s ability is <b>TRAMPLE</b>: if she kills whoever tried to block her, the leftover damage goes straight to the enemy <b>Jester</b>.'] },
        { foco: ['#dica', slotFig(0, 'Q')], circular: '#dica p:has(> .naipe-paus)', pulsar: [vidaFig(0, 'Q')],
          fala: ['A passiva dos naipados de <b>Paus</b> é ter <b>3 defesas</b> ao invés de 2. A bicha tá bruta!', 'The <b>Clubs</b>-suited passive is having <b>3 defense</b> instead of 2. She is a beast!'] },
        { acao: api => api.soltarDica() },
        { foco: '#acoes', permitir: '*', fala: ['Você tem mais uma <b>ação</b> para fazer nesse turno: escolhe aí o que você quer fazer...', 'You have one more <b>action</b> this turn: pick whatever you want to do...'] },
        { fala: ['TEM MUITA COISA PRA EXPLICAR AINDA (as <b>Pargias</b>, os pares do mesmo naipe, os outros Palhaços...), MAS POR ENQUANTO É ISSO: VOCÊ VAI ENTENDER AS COISAS JOGANDO O JOGO! E se bater dúvida, tá tudo na tela de <b>Regras</b>, no menu.',
          'THERE IS A LOT MORE TO EXPLAIN (the <b>Pairgics</b>, the same-suit pairs, the other Jesters...), BUT THAT IS IT FOR NOW: YOU WILL GET THE HANG OF IT BY PLAYING! And if you get stuck, it is all in the <b>Rules</b> screen, in the menu.'] },
        { foco: '[data-acao="opcoes-mesa"]', alvo: '[data-acao="opcoes-mesa"]', permitir: ['[data-acao="opcoes-mesa"]'],
          fala: ['Clique em <b>Opções</b>.', 'Click <b>Options</b>.'], esperar: () => !!document.querySelector('#modal [data-grupo="todasAcoes"]') },
        { foco: '#modal [data-grupo="todasAcoes"]', fala: ['Aqui você pode ativar este botão, e deixar <b>todas as cartas de ação</b> aparecendo direto.', 'Here you can turn on this button and keep <b>all the action cards</b> showing all the time.'] },
        { foco: '#modal [data-grupo="todasAcoes"]', fala: ['Pra quem tá começando, é uma mão na roda: em vez de lembrar qual combinação de cartas faz o quê, o jogo já mostra <b>todas as jogadas que a sua mão permite</b>. Você clica na ação que quer, as cartas certas brilham na mão, e clicando <b>2 vezes</b> ele joga sozinho. Assim você aprende as combinações vendo elas na tela!',
          'For beginners it is a lifesaver: instead of remembering which card combo does what, the game shows <b>every play your hand allows</b>. You click the action you want, the right cards glow in your hand, and with a <b>double click</b> it plays them for you. That way you learn the combos by seeing them on screen!'] },
        { fala: ['Agora é com você! Boa sorte, e não deixe o <b>Palhaço</b> te fazer de palhaço. 🎓', 'Now it is up to you! Good luck, and don\'t let the <b>Jester</b> make a clown out of you. 🎓'], botao: ['Continuar', 'Continue'], fim: true },
      ],
    },
  };

  // ---------- Motor do tutorial ----------

  // Termos do jogo aparecem em CAPS e vermelho (aplicado no texto, fora das tags HTML).
  const LETRA = '\\p{L}';
  const TERMOS = [
    // português
    'Palhaços?', 'Joker', 'PV', 'pontos de vida', 'Senhor(?:es)?(?:\\((?:a|as)\\))?', 'Senhoras?', 'oponentes?', 'advers[áa]rio',
    'contra-ataques?', 'preparar (?:o )?ataque', 'atac(?:ar|ou|a|am|aram|ando|aria)', 'ataques?', 'defend(?:er|eu|e|eria|em)', 'defesas?',
    'invoc(?:ar|ou|ado|ada|ados|ação|ações|ações|ar)', 'invoque', 'Valetes?', 'Rei', 'Rainha', 'Infartitte', 'Paumol', 'Berserk',
    'Espadas', 'Copas', 'Ouros', 'Paus', 'dados?', 'hits?', 'aç(?:ão|ões)', 'turnos?', 'Letras?', 'Números?',
    'Ímpeto', 'Ordem real', 'Atropelar', 'Mulligan', 'sacrif[ií]c(?:ios?|ar|ou|ando|ado|ados)', 'totem',
    // inglês
    'Jesters?', 'HP', 'hit points', 'Gentlem[ae]n', 'Lad(?:y|ies)', 'opponents?', 'counterattacks?', 'prepare (?:the )?attack',
    'attack(?:s|ed|ing)?', 'defen(?:d|ds|ded|se)', 'summon(?:s|ed|ing)?', 'Jacks?', 'King', 'Queen', 'Spades', 'Hearts', 'Diamonds', 'Clubs',
    'die', 'dice', 'actions?', 'turns?', 'Face', 'Numbers?', 'Haste', 'Royal order', 'Trample', 'sacrific(?:e|es|ed|ing)',
  ];
  // Letras e Números só com maiúscula (com minúscula é "número" comum: "o número equipado").
  const soMaiuscula = m => /^(letras?|números?|face|numbers?)$/i.test(m) && m[0] === m[0].toLowerCase();
  const reTermo = new RegExp(`(?<!${LETRA})(?:${TERMOS.join('|')})(?!${LETRA})`, 'giu');
  function realcar(html) {
    return html.split(/(<[^>]+>)/).map(parte => (parte.startsWith('<') ? parte
      : parte.replace(reTermo, m => (soMaiuscula(m) ? m : `<span class="termo">${m.toUpperCase()}</span>`)))).join('');
  }

  const T = { api: null, aula: null, passos: [], k: 0, ativo: false, pendentes: [], esperando: null, passo: null, timer: null, aoProximo: null, marcas: {} };

  function montarDom() {
    if ($('#tut')) return;
    const d = document.createElement('div');
    d.id = 'tut';
    d.innerHTML = `<div class="tut-veu"></div><div class="tut-foco"></div><div class="tut-seta">▼</div>
      <div class="tut-balao"><div class="tut-topo"><span class="tut-titulo"></span><button class="tut-pular"></button></div>
      <div class="tut-texto"></div><div class="tut-botoes"><button class="tut-proximo"></button></div></div>`;
    document.body.appendChild(d);
    d.querySelector('.tut-proximo').onclick = () => { if (T.aoProximo) T.aoProximo(); };
    d.querySelector('.tut-pular').onclick = () => { parar(); T.api && T.api.sair(); };
  }

  // Seletores do passo (strings ou funções que recebem a api) → elementos na tela.
  function elementos(lista) {
    if (!lista) return [];
    return [].concat(lista).map(s => (typeof s === 'function' ? s(T.api) : s)).filter(Boolean)
      .map(s => document.querySelector(s)).filter(Boolean);
  }

  function retanguloDe(els) {
    const rs = els.map(e => e.getBoundingClientRect()).filter(r => r.width || r.height);
    if (!rs.length) return null;
    const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top));
    const r = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom));
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
  }

  function furo(x, y, w, h, raio) {
    const W = innerWidth, H = innerHeight, k = Math.min(raio, w / 2, h / 2);
    return `path(evenodd, 'M0 0H${W}V${H}H0Z M${x + k} ${y}H${x + w - k}A${k} ${k} 0 0 1 ${x + w} ${y + k}V${y + h - k}A${k} ${k} 0 0 1 ${x + w - k} ${y + h}H${x + k}A${k} ${k} 0 0 1 ${x} ${y + h - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z')`;
  }

  // Guarda a posição de uma coisa do passo e só muda se ela andar de verdade (mais que 40 px): assim o balão,
  // o foco e a setinha não ficam "flutuando" atrás das cartas que sobem e descem.
  function estavel(p, chave, r) {
    if (!r) return null;
    const v = (p._pos || (p._pos = {}))[chave];
    if (v && Math.abs(v.left - r.left) < 40 && Math.abs(v.top - r.top) < 40 && Math.abs(v.width - r.width) < 40 && Math.abs(v.height - r.height) < 40) return v;
    p._pos[chave] = r;
    return r;
  }

  // Reposiciona o foco, a setinha e o balão (os elementos da mesa se mexem: animações, cartas subindo...).
  function posicionar() {
    const raiz = $('#tut');
    if (!raiz || !T.ativo) return;
    const p = T.passo;
    const visivel = !!(p && !p.esconder && (p.textoAtual != null));
    raiz.classList.toggle('mostrando', visivel);
    document.body.classList.toggle('tut-pulsa-seta', visivel && !!p.pulsarSeta);
    document.body.classList.toggle('tut-sem-setas', visivel && !!p.semSetas);
    document.body.classList.toggle('tut-dado', !!(p && p.dado)); // o dado passa por cima do balão
    document.body.classList.toggle('tut-compra', visivel && !!p.compra);
    // O que a fala aponta pulsa (os escudinhos de defesa, por exemplo).
    const pulsando = visivel ? elementos(p.pulsar) : [];
    document.querySelectorAll('.tut-pulsa').forEach(el => { if (!pulsando.includes(el)) el.classList.remove('tut-pulsa'); });
    pulsando.forEach(el => el.classList.add('tut-pulsa'));
    const circulados = visivel ? elementos(p.circular) : [];
    document.querySelectorAll('.tut-circula').forEach(el => { if (!circulados.includes(el)) el.classList.remove('tut-circula'); });
    circulados.forEach(el => el.classList.add('tut-circula'));
    // A carta que a aula quer que você jogue flutua (a classe volta a cada redesenho da mão).
    const destaques = visivel ? elementos(p.alvo) : [];
    document.querySelectorAll('.tut-destaque').forEach(el => { if (!destaques.includes(el)) el.classList.remove('tut-destaque'); });
    destaques.forEach(el => el.classList.add('tut-destaque'));
    if (!visivel) return;
    const foco = raiz.querySelector('.tut-foco'), seta = raiz.querySelector('.tut-seta'), balao = raiz.querySelector('.tut-balao'), veu = raiz.querySelector('.tut-veu');
    const r = estavel(p, 'r', retanguloDe(elementos(p.foco)));
    const folga = 10;
    // Véu escuro com um furo arredondado em volta do foco (clip-path com evenodd).
    veu.style.clipPath = r ? furo(r.left - folga, r.top - folga, r.width + folga * 2, r.height + folga * 2, 16) : 'none';
    veu.hidden = !!p.semVeu;
    foco.hidden = !r || !!p.semVeu;
    const ra = estavel(p, 'ra', retanguloDe(destaques.slice(0, 1)));
    seta.hidden = !(ra || (r && p.permitir && p.permitir !== '*'));
    raiz.classList.toggle('livre', p.permitir === '*');
    let bx, by;
    const bw = balao.offsetWidth, bh = balao.offsetHeight;
    if (p.embaixo) { // (em cima de uma janela: o balão fica no pé da tela, sem cobrir o título dela)
      if (r) Object.assign(foco.style, { left: r.left - folga + 'px', top: r.top - folga + 'px', width: r.width + folga * 2 + 'px', height: r.height + folga * 2 + 'px' });
      if (ra) Object.assign(seta.style, { left: ra.left + ra.width / 2 + 'px', top: ra.top - 40 + 'px' });
      bx = innerWidth / 2 - bw / 2;
      by = innerHeight - bh - 16;
    } else if (r) {
      Object.assign(foco.style, { left: r.left - folga + 'px', top: r.top - folga + 'px', width: r.width + folga * 2 + 'px', height: r.height + folga * 2 + 'px' });
      const rs = ra || r;
      Object.assign(seta.style, { left: rs.left + rs.width / 2 + 'px', top: rs.top - (ra ? 6 : folga) - 34 + 'px' });
      const embaixo = r.top + r.height / 2 < innerHeight * 0.5;
      by = embaixo ? r.bottom + folga + 22 : r.top - folga - 22 - bh - (seta.hidden ? 0 : 30);
      bx = r.left + r.width / 2 - bw / 2;
    } else {
      bx = innerWidth / 2 - bw / 2;
      by = innerHeight * 0.42 - bh / 2;
    }
    const pos = estavel(p, 'b', { left: Math.max(12, Math.min(innerWidth - bw - 12, bx)), top: Math.max(12, Math.min(innerHeight - bh - 12, by)), width: 0, height: 0 });
    balao.style.left = pos.left + 'px';
    balao.style.top = pos.top + 'px';
  }

  function mostrarPasso(p, dados) {
    montarDom();
    const raiz = $('#tut');
    T.passo = p;
    p._pos = null;
    const texto = typeof p.fala === 'function' ? p.fala(dados) : p.fala;
    p.textoAtual = texto != null ? tx(texto) : null;
    raiz.querySelector('.tut-titulo').textContent = tx(T.aula.titulo);
    raiz.querySelector('.tut-pular').textContent = L() ? 'Skip tutorial' : 'Pular tutorial';
    if (p.textoAtual != null) raiz.querySelector('.tut-texto').innerHTML = realcar(p.textoAtual);
    const prox = raiz.querySelector('.tut-proximo');
    const temBotao = !p.esperar && !p.ate;
    prox.hidden = !temBotao;
    prox.textContent = p.botao ? tx(p.botao) : (L() ? 'Next ▶' : 'Próximo ▶');
    const balao = raiz.querySelector('.tut-balao');
    balao.classList.remove('entra', 'treme');
    void balao.offsetWidth;
    balao.classList.add(p.tremer ? 'treme' : 'entra');
    posicionar();
  }

  const pausa = ms => new Promise(r => setTimeout(r, ms));
  // Espera um gancho da interface chegar (espiar: só vê se chegou, sem consumir).
  function esperarGancho(nome, espiar, quando) {
    return new Promise(r => {
      const tentar = () => {
        if (!T.ativo) return r(null);
        const k = T.pendentes.findIndex(g => g.nome === nome && (!quando || quando(g.dados)));
        if (k >= 0) return r(espiar ? T.pendentes[k] : T.pendentes.splice(k, 1)[0]);
        T.esperando = tentar;
      };
      tentar();
    });
  }

  async function executar(p, dados) {
    if (!T.ativo) return;
    if (p.espera) { esconderBalao(); return pausa(p.espera); } // (o balão sai enquanto a mesa se mexe)
    if (p.acao) { await p.acao(T.api, dados); return; }
    if (p.gancho) {
      const g = await esperarGancho(p.gancho, false, p.quando);
      if (!g) return;
      for (const sub of p.passos) { if (!T.ativo) break; await executar(sub, g.dados); }
      esconderBalao();
      g.liberar();
      return;
    }
    mostrarPasso(p, dados);
    if (p.ate) { await esperarGancho(p.ate, true, p.quando); return esconderBalao(); }
    if (p.esperar) {
      await new Promise(r => {
        const ver = () => { if (!T.ativo || p.esperar(T.api)) { clearInterval(iv); r(); } };
        const iv = setInterval(ver, 120);
        ver();
      });
      if (p.depois) await pausa(p.depois); // continua na tela um pouco depois (o jogador "tentando")
      return esconderBalao();
    }
    await new Promise(r => { T.aoProximo = () => { T.aoProximo = null; r(); }; });
    if (p.fim) return terminar();
  }

  function esconderBalao() {
    T.passo = null;
    const raiz = $('#tut');
    if (raiz) raiz.classList.remove('mostrando');
  }

  function terminar() {
    try { localStorage.setItem('ss-tutorial-' + T.n, '1'); } catch (e) { /* sem armazenamento */ }
    const api = T.api;
    parar();
    if (api) api.sair();
  }

  // Só deixa clicar no que o passo atual permite (e no balão). Fora de um passo, a mesa fica livre
  // enquanto a interface trabalha (animações, combate…), mas os cliques do jogador são barrados.
  function filtrar(ev) {
    if (!T.ativo) return;
    const p = T.passo;
    // (as janelas ficam livres, a não ser que o passo trave: ex. na abertura, só o botão Manter)
    if (ev.target.closest && (ev.target.closest('.tut-balao') || (ev.target.closest('#modal') && !(p && p.travarModal)))) return;
    // Cliques que a aula quer perceber (mesmo os que não fazem nada no jogo, como atacar com o Rei recém-invocado).
    if (p && p.clique && (ev.type === 'mousedown' || ev.type === 'touchstart')) {
      for (const c of p.clique) if (elementos(c.em).some(el => el.contains(ev.target))) c.faz(T.api);
    }
    if (p && p.permitir === '*') return;
    const ok = p && p.permitir && elementos(p.permitir).some(el => el.contains(ev.target));
    if (ok) return;
    ev.stopImmediatePropagation();
    ev.preventDefault();
  }
  ['mousedown', 'click', 'pointerdown', 'touchstart', 'dblclick'].forEach(tipo => addEventListener(tipo, filtrar, true));

  async function rodar() {
    for (T.k = 0; T.k < T.passos.length && T.ativo; T.k++) await executar(T.passos[T.k]);
  }

  function parar() {
    T.ativo = false;
    clearInterval(T.timer);
    T.pendentes.forEach(g => g.liberar());
    T.pendentes = [];
    if (T.esperando) { const f = T.esperando; T.esperando = null; f(); }
    if (T.aoProximo) T.aoProximo();
    const raiz = $('#tut');
    if (raiz) raiz.remove();
    document.body.classList.remove('tut-pulsa-seta', 'tut-sem-setas', 'tut-dado', 'tut-compra');
    document.querySelectorAll('.tut-pulsa, .tut-circula').forEach(el => el.classList.remove('tut-pulsa', 'tut-circula'));
    document.querySelectorAll('.tut-destaque').forEach(el => el.classList.remove('tut-destaque'));
    if (T.api && T.api.soltarDica) T.api.soltarDica();
  }

  SS.Tutorial = {
    aula: n => AULAS[n],
    feita: n => { try { return localStorage.getItem('ss-tutorial-' + n) === '1'; } catch (e) { return false; } },
    comecar(n, api) {
      parar();
      Object.assign(T, { api, n, aula: AULAS[n], passos: AULAS[n].passos, ativo: true, pendentes: [], passo: null, marcas: {} });
      montarDom();
      T.timer = setInterval(posicionar, 100);
      rodar();
    },
    parar,
    ativo: () => T.ativo,
    aposRender: () => posicionar(),
    // A interface chega num ponto de parada: se a aula ainda vai usar esse gancho, o jogo espera; senão segue.
    gancho(nome, dados) {
      if (!T.ativo) return Promise.resolve();
      const daqui = T.passos.slice(T.k);
      // (com "quando", o passo só segura o gancho certo: ex. o dado do SEU ataque, não o do oponente)
      if (!daqui.some(p => (p.gancho === nome || p.ate === nome) && (!p.quando || p.quando(dados || {})))) return Promise.resolve();
      return new Promise(liberar => {
        T.pendentes.push({ nome, dados, liberar });
        if (T.esperando) { const f = T.esperando; T.esperando = null; f(); }
      });
    },
  };
})(window.SS);
