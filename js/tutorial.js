// Tutorial em aulas (no estilo do Hearthstone): uma partida montada, um balão que conversa com o jogador,
// um foco que escurece o resto da mesa e só deixa clicar no que a aula pede.
// A interface chama SS.Tutorial.gancho(nome) nos pontos em que a aula pode precisar parar o jogo
// (antes e depois do dado, na defesa, no fim do turno, no turno do oponente).
(function (SS) {
  'use strict';
  const M = SS.Motor;
  const L = () => (SS.Idioma && SS.Idioma.atual() === 'en' ? 1 : 0);
  const tx = v => (typeof v === 'string' ? v : Array.isArray(v) ? v[L()] : '');
  const $ = s => document.querySelector(s);

  // ---------- Aulas ----------

  // Tira uma carta específica do baralho certo (Letras ou Números) e põe na mão.
  function darNaMao(j, rank, naipe) {
    const pilha = ['J', 'Q', 'K'].includes(rank) ? j.letras : j.numeros;
    const k = pilha.findIndex(c => c.rank === rank && c.naipe === naipe);
    if (k >= 0) j.mao.push(pilha.splice(k, 1)[0]);
  }
  const idNaMao = (j, rank, naipe) => (j.mao.find(c => c.rank === rank && c.naipe === naipe) || {}).id;
  const maoSel = (p, rank, naipe) => api => `#mao-${p} [data-mao="${idNaMao(api.jogo().jogadores[p], rank, naipe)}"]`;
  const unidadeDe = (e, p) => e.jogadores[p].campo.findIndex(u => u && u.tipo === 'senhor');
  const slotDe = p => api => { const i = unidadeDe(api.jogo(), p); return i >= 0 ? `[data-slot="${p}:${i}"]` : null; };
  // Senhor(a) em campo pela figura (e naipe da figura, se precisar) e o espaço dele.
  const unidadeFig = (e, p, rank, naipe) => e.jogadores[p].campo.find(u => u && u.tipo === 'senhor' && u.figura.rank === rank && (!naipe || u.figura.naipe === naipe));
  const slotFig = (p, rank, naipe) => api => { const e = api.jogo(), u = unidadeFig(e, p, rank, naipe); return u ? `[data-slot="${p}:${e.jogadores[p].campo.indexOf(u)}"]` : null; };
  // Seleciona uma carta da mão só para mostrar as cartas de ação dela.
  const selecionar = (api, rank, naipe) => { const ui = api.ui(); ui.sel = [idNaMao(api.jogo().jogadores[0], rank, naipe)].filter(Boolean); ui.destino = null; api.render(); };

  const AULAS = {
    1: {
      titulo: ['Tutorial', 'Tutorial'],
      palhacos: ['infartitte', 'paumol'],
      montar(e) {
        const [eu, ele] = e.jogadores;
        for (const [r, n] of [['J', 'espadas'], ['4', 'copas'], ['J', 'ouros'], ['K', 'paus'], ['7', 'espadas'], ['6', 'copas'], ['9', 'ouros']]) darNaMao(eu, r, n);
        for (const [r, n] of [['J', 'copas'], ['3', 'espadas'], ['8', 'paus'], ['K', 'ouros'], ['6', 'copas']]) darNaMao(ele, r, n);
        for (const j of e.jogadores) j.abertura = { figuras: [], mulligan: false, pronto: true };
        // (turno 2: no turno 1 quem começa não pode atacar, e a aula precisa do ataque)
        Object.assign(e, { turno: 2, vez: 0, fase: 'principal', acoes: M.ACOES_POR_TURNO, sumonados: 0, asesTurno: 0, poderUsado: false });
      },
      passos: [
        { fala: ['<b>Bem-vindo ao Senhora e Senhores!</b><br>Essa porcaria aqui é um card game inspirado em <i>Magic</i>, <i>Yu-Gi-Oh</i> e <i>Hearthstone</i>, sabe? Mas usando <b>unicamente cartas de um baralho comum</b>.',
          '<b>Welcome to Lady and Gentlemen!</b><br>This piece of junk is a card game inspired by <i>Magic</i>, <i>Yu-Gi-Oh</i> and <i>Hearthstone</i>, you know? But using <b>only the cards of a regular deck</b>.'] },
        { foco: '#info-0 .heroi', fala: ['Cada jogador controla um <b>Palhaço</b>, um Joker. Cada Joker tem suas características próprias, que você vai descobrir <b>LENDO</b>, seu preguiçoso!!!',
          'Each player controls a <b>Jester</b>, a Joker. Each Joker has its own traits, which you will find out by <b>READING</b>, you lazy bum!!!'] },
        { foco: '#info-1 .heroi-pv', fala: ['O mais importante agora: cada Palhaço tem uma quantidade de <b>PV, pontos de vida</b>. O seu objetivo é <b>zerar o PV do adversário</b>.',
          'The most important thing now: each Jester has an amount of <b>HP, hit points</b>. Your goal is to <b>bring your opponent\'s HP down to zero</b>.'] },
        { fala: ['<i>“Ai, mas como faz isso?”</i><br>Batendo com os seus <b>Senhores e Senhoras</b>.', '<i>“Oh, but how do I do that?”</i><br>By hitting with your <b>Ladies and Gentlemen</b>.'] },
        { fala: ['<i>“E como eu bato? Não tô vendo nenhuma Senhora ou Senhor por aqui...”</i><br><b>CALMA!!!</b>', '<i>“And how do I hit? I don\'t see any Lady or Gentleman around here...”</i><br><b>EASY THERE!!!</b>'] },
        { foco: '#pilhas-0', fala: ['Cada Palhaço tem um baralho, dividido em cartas de <b>Letras</b> (as figuras: Valete, Rainha e Rei) e cartas de <b>Números</b>.',
          'Each Jester has a deck, split into <b>Face</b> cards (Jack, Queen and King) and <b>Number</b> cards.'] },
        { foco: '#mao-0', fala: ['Você começa a partida com <b>7 cartas na mão</b>.', 'You start the match with <b>7 cards in your hand</b>.'] },
        { foco: '#campo-0', fala: ['Para invocar um Senhor(a) no campo, você precisa de <b>1 carta de Letra + 1 carta de Número</b>.', 'To summon a Gentleman onto the field, you need <b>1 Face card + 1 Number card</b>.'] },
        { foco: ['#campo-0', '#mao-0'], alvo: maoSel(0, 'J', 'espadas'), permitir: [maoSel(0, 'J', 'espadas'), '#campo-0'],
          fala: ['Por exemplo: coloque esse <b>Valete de Espadas</b> no campo (arraste a carta até o campo).', 'For example: put this <b>Jack of Spades</b> on the field (drag the card onto the field).'],
          esperar: api => api.ui().sel.includes(idNaMao(api.jogo().jogadores[0], 'J', 'espadas')) || unidadeDe(api.jogo(), 0) >= 0 },
        { foco: ['#campo-0', '#mao-0'], alvo: maoSel(0, '4', 'copas'), permitir: [maoSel(0, '4', 'copas'), maoSel(0, 'J', 'espadas'), '#campo-0', '[data-acao^="tipo:sumonar"]'],
          fala: ['Agora coloque esse <b>4 de Copas</b> junto com o Valete.', 'Now put this <b>4 of Hearts</b> together with the Jack.'],
          esperar: api => unidadeDe(api.jogo(), 0) >= 0 },
        { espera: 900 },
        { foco: slotDe(0), fala: ['<b>Tcharam!</b> Você acabou de invocar o seu primeiro Senhor. Viu como é fácil invocar um Senhor em campo?', '<b>Ta-da!</b> You just summoned your first Gentleman. See how easy it is to summon a Gentleman onto the field?'] },
        { tremer: true, fala: ['<b>ATENÇÃO!</b> Nas partidas pra valer, <b>NÃO é permitido atacar no primeiro turno</b>.', '<b>WARNING!</b> In real matches, <b>you can NOT attack on the first turn</b>.'] },
        { fala: ['MASSS isso é o <b>TUTORIAL</b>, então tá tudo bem.', 'BUUUT this is the <b>TUTORIAL</b>, so it is all fine.'] },
        { foco: slotDe(0), fala: ['O <b>ataque</b> do seu Senhor é definido pelo <b>número</b> equipado nele. O seu Valete tem <b>4 de ataque</b>.',
          'Your Gentleman\'s <b>attack</b> is set by the <b>number</b> equipped on it. Your Jack has <b>4 attack</b>.'] },
        { foco: '[data-acao="ir-ataque"]', permitir: ['[data-acao="ir-ataque"]'],
          fala: ['Para atacar o seu oponente, clique na carta de ação <b>Preparar ataque</b>!', 'To attack your opponent, click the <b>Prepare attack</b> action card!'],
          esperar: api => api.jogo().fase === 'ataque' },
        { foco: slotDe(0), permitir: [slotDe(0)],
          fala: ['Agora clique no <b>Valete</b> para mostrar que você quer agredir esse Palhaço na sua frente.', 'Now click the <b>Jack</b> to show you want to smack that Jester in front of you.'],
          esperar: api => api.ui().ataques.length > 0 },
        { foco: [slotDe(0), '#info-1 .heroi'], pulsarSeta: true, fala: ['Tá vendo essa <b>setinha</b>? Quer dizer que você vai atacar o oponente.', 'See that <b>little arrow</b>? It means you are going to attack the opponent.'] },
        { foco: '[data-acao="confirmar-ataques"]', permitir: ['[data-acao="confirmar-ataques"]'],
          fala: ['Agora confirme o ataque!', 'Now confirm the attack!'],
          esperar: api => api.jogo().fase !== 'ataque' },
        { gancho: 'antesDado', quando: d => d.p === 0, passos: [
          { fala: ['Não é porque você tem 4 de ataque que vai, obrigatoriamente, dar 4 de dano. Tudo depende do <b>DADO</b>!',
            'Having 4 attack doesn\'t mean you will always deal 4 damage. It all depends on the <b>DIE</b>!'] },
          { fala: [`<div class="tut-dados"><div><i>⚃ ⚄ ⚅</i><b>4 a 6</b><span>dano total: <b>4</b></span></div><div><i>⚁ ⚂</i><b>2 ou 3</b><span>metade (pra baixo): <b>2</b></span></div><div class="ruim"><i>⚀</i><b>1</b><span>errou!</span></div></div>
            Esse lance de <b>errar quando tira 1</b> só vale quando você ataca o oponente <b>diretamente</b> (daqui a pouco eu te explico).`,
            `<div class="tut-dados"><div><i>⚃ ⚄ ⚅</i><b>4 to 6</b><span>full damage: <b>4</b></span></div><div><i>⚁ ⚂</i><b>2 or 3</b><span>half (rounded down): <b>2</b></span></div><div class="ruim"><i>⚀</i><b>1</b><span>miss!</span></div></div>
            That <b>missing on a 1</b> thing only counts when you attack the opponent <b>directly</b> (I will explain in a bit).`] },
        ] },
        { ate: 'depoisGolpe', permitir: '*', fala: ['Vamo lá, <b>joga o dado!</b> (pegue o dado e jogue na mesa)', 'Come on, <b>roll the die!</b> (grab the die and throw it on the table)'] },
        { gancho: 'depoisGolpe', passos: [
          { foco: '#info-1 .heroi', fala: d => {
            const n = Math.max(...d.rolagens);
            if (n >= 4) return ['<b>BOUAAA!!!!</b> Acertou em cheio!', '<b>BOOYAAH!!!!</b> A direct hit!'];
            if (n >= 2) return ['É... tá bom, né?', 'Well... that\'s okay, I guess?'];
            return ['<b>HAHAHAHAHAHAH</b>', '<b>HAHAHAHAHAHAH</b>'];
          } },
        ] },
        { gancho: 'fimDoTurno', passos: [
          { acao: api => api.render() }, // a carta vira para baixo
          { espera: 900 },
          { foco: slotDe(0), fala: ['Depois de rodar o seu ataque, <b>o turno acaba</b>, e os Senhores que atacaram ficam <b>virados para baixo</b>: inutilizáveis até o <b>seu próximo turno</b>.',
            'After your attack is rolled, <b>the turn ends</b>, and the Gentlemen who attacked are <b>turned face down</b>: unusable until <b>your next turn</b>.'] },
          { acao: api => { const e = api.jogo(), i = unidadeDe(e, 0); if (i >= 0) e.jogadores[0].campo[i].ativo = true; api.render(); } }, // e vira de volta
          { espera: 900 },
          { foco: slotDe(0), fala: ['MAAAS, como a gente tá num tutorial ainda, eu vou deixar o seu Valete <b>ativo</b>. É só dessa vez, hein?!',
            'BUUUT since we are still in a tutorial, I will keep your Jack <b>active</b>. Just this once, okay?!'] },
        ] },
        { gancho: 'turnoOponente', passos: [
          { foco: '#info-1 .heroi', fala: ['Agora é o turno do <b>OPONENTE</b>!', 'Now it is the <b>OPPONENT\'s</b> turn!'] },
          { acao: api => {
            const e = api.jogo(), j = e.jogadores[1];
            const a = M.acoesLegais(e).find(x => x.tipo === 'sumonar' && x.figura === idNaMao(j, 'J', 'copas') && x.numero === idNaMao(j, '3', 'espadas'));
            if (a) api.aplicar(a);
          } },
          { espera: 1200 },
          { foco: slotDe(1), fala: ['Olha só: ele desceu um Valete também (<b>Valete de Copas com 3 de Espadas</b>).', 'Look: he played a Jack too (<b>Jack of Hearts with a 3 of Spades</b>).'] },
          { foco: slotDe(1), fala: ['Agora ele vai <b>atacar</b>!', 'Now he is going to <b>attack</b>!'] },
        ] },
        { gancho: 'bloqueio', passos: [
          { foco: [slotDe(0), slotDe(1)], fala: ['Toda vez que rolar um ataque e tiver Senhores ativos dos dois lados, você tem a oportunidade de <b>defender</b>.',
            'Every time an attack comes and there are ready Gentlemen on both sides, you get the chance to <b>defend</b>.'] },
        ] },
        { foco: [slotDe(0), slotDe(1)], alvo: slotDe(0), permitir: [slotDe(0), slotDe(1)],
          fala: ['Clique no <b>seu Valete</b> e depois no <b>Valete inimigo</b>: assim você escolhe que quer <b>defender</b> o ataque dele.', 'Click <b>your Jack</b> and then the <b>enemy Jack</b>: that is how you choose to <b>defend</b> against its attack.'],
          esperar: api => Object.values(api.ui().bloqueios || {}).some(l => l.length) },
        { acao: api => { api.ui().tutDado = 5; } },
        { foco: '[data-acao="confirmar-bloqueios"]', permitir: ['[data-acao="confirmar-bloqueios"]'],
          fala: ['Você declarou sua defesa! Agora clique na carta de ação <b>Defender</b>.', 'You declared your defense! Now click the <b>Defend</b> action card.'],
          esperar: api => api.jogo().fase !== 'bloqueio' },
        { ate: 'depoisGolpe', esconder: true },
        { gancho: 'depoisGolpe', passos: [
          { espera: 500 },
          { foco: slotDe(0), semSetas: true, fala: ['Você defendeu, <b>boua!!</b> Ele tirou 5: dano total de 3. Agora o seu Valete está <b>deitado</b>, porque levou dano.',
            'You defended, <b>nice!!</b> He rolled a 5: full damage of 3. Now your Jack is <b>lying down</b>, because it took damage.'] },
          { foco: [slotDe(0), slotDe(1)], semSetas: true, pulsar: [api => slotDe(0)(api) && slotDe(0)(api) + ' .selo-vida', api => slotDe(1)(api) && slotDe(1)(api) + ' .selo-vida'], fala: ['Tá vendo essas <b>bolinhas</b> em cima de cada Senhor? Elas são a <b>defesa</b> dele. De padrão, cada Senhor aguenta <b>2 hits</b>. Quando leva um hit, ele deita pra mostrar que tá machucado, tadinho :(',
            'See those <b>little dots</b> on each Gentleman? They are its <b>defense</b>. By default, each Gentleman takes <b>2 hits</b>. When it takes a hit, it lies down to show it is hurt, poor thing :('] },
          { foco: [slotDe(0), slotDe(1)], semSetas: true, fala: ['E olha o Valete dele: também levou 1 hit! Isso é o <b>contra-ataque</b>. Ele acontece quando você defende com um Senhor que tem o ataque <b>MAIOR</b> que o do Senhor(a) que atacou.',
            'And look at his Jack: it took 1 hit too! That is the <b>counterattack</b>. It happens when you defend with a Gentleman whose attack is <b>HIGHER</b> than the attacking Gentleman\'s.'] },
          { foco: [slotDe(0), slotDe(1)], semSetas: true, fala: ['Neste caso, o Valete do oponente tem <b>3</b> de ataque, e o seu tem <b>4</b>... 4 é maior que 3, né? Então o contra-ataque acontece!',
            'Here, the opponent\'s Jack has <b>3</b> attack, and yours has <b>4</b>... 4 is higher than 3, right? So the counterattack happens!'] },
        ] },
        // ---------- Seu segundo turno: compra, ações, limites das figuras, poder, recursos ----------
        { esperar: api => { const e = api.jogo(); return e.vez === 0 && e.fase === 'compra' && !!api.ui().aoComprar; } },
        { acao: api => {
          // As próximas compras do baralho de Números: o 8 de Espadas agora e o 10 de Paus (com o Ouros) depois.
          const j = api.jogo().jogadores[0];
          for (const [r, n] of [['10', 'paus'], ['8', 'espadas']]) {
            const k = j.numeros.findIndex(c => c.rank === r && c.naipe === n);
            if (k >= 0) j.numeros.push(j.numeros.splice(k, 1)[0]);
          }
        } },
        { foco: '#info-0 .heroi', fala: ['Legal, é o <b>seu turno</b> novamente!', 'Nice, it is <b>your turn</b> again!'] },
        { foco: '#pilhas-0', fala: ['No início de todo turno você precisa <b>comprar uma carta</b>: você escolhe se quer comprar uma carta de <b>Letra</b> ou uma de <b>Número</b>.',
          'At the start of every turn you have to <b>draw a card</b>: you choose whether to draw a <b>Face</b> card or a <b>Number</b> card.'] },
        { foco: '#pilhas-0', alvo: '[data-pilha="0:numeros"]', permitir: ['[data-pilha="0:numeros"]'],
          fala: ['Vamos comprar um <b>Número</b>, já que a gente ainda tem 2 cartas de Letra na mão.', 'Let\'s draw a <b>Number</b>, since we still have 2 Face cards in hand.'],
          esperar: api => api.jogo().fase !== 'compra' },
        { espera: 800 },
        { foco: '#acoes', fala: ['Em cada turno você tem <b>3 ações</b> para fazer antes de se preparar para atacar.', 'Each turn you have <b>3 actions</b> to use before getting ready to attack.'] },
        { fala: ['<i>“E quais ações dá pra fazer por turno??”</i>', '<i>“And what actions can I do each turn??”</i>'] },
        { foco: '#campo-0', fala: ['Calma lá! Uma das ações que você pode fazer é <b>invocar um Senhor</b>.', 'Easy there! One of the actions you can do is <b>summoning a Gentleman</b>.'] },
        { tremer: true, fala: ['<b>ATENÇÃO!</b> Só é possível invocar <b>um Senhor(a) por turno</b>.', '<b>WARNING!</b> You can only summon <b>one Gentleman per turn</b>.'] },
        { foco: ['#campo-0', '#mao-0'], alvo: maoSel(0, 'J', 'ouros'), permitir: ['#mao-0', '#campo-0'],
          fala: ['Vamos lá: invoque esse outro <b>Valete</b>.', 'Come on: summon this other <b>Jack</b>.'],
          esperar: api => api.ui().sel.includes(idNaMao(api.jogo().jogadores[0], 'J', 'ouros')), depois: 3500 },
        { tremer: true, fala: ['Não tá conseguindo?????', 'Can\'t do it?????'] },
        { acao: api => { const ui = api.ui(); ui.sel = []; ui.destino = null; api.render(); api.fixarDica(maoSel(0, 'J', 'ouros')(api)); } },
        { foco: ['#dica', maoSel(0, 'J', 'ouros')], circular: '#dica .dica-limite', fala: ['Bom, o <b>Valete</b> só pode ser combinado com cartas de <b>2 a 4</b>.', 'Well, the <b>Jack</b> can only be paired with cards from <b>2 to 4</b>.'] },
        { acao: api => api.fixarDica(maoSel(0, 'K', 'paus')(api)) },
        { foco: ['#dica', maoSel(0, 'K', 'paus')], circular: '#dica .dica-limite', fala: ['Já o <b>Rei</b> pode ser invocado com cartas de <b>2 a 7</b>.', 'The <b>King</b>, on the other hand, can be summoned with cards from <b>2 to 7</b>.'] },
        { fala: ['<i>“Mas e as cartas 8, 9 e 10?”</i>', '<i>“But what about the 8, 9 and 10?”</i>'] },
        { fala: ['Hehehehe, você consegue deduzir, né???', 'Hehehehe, you can figure it out, right???'] },
        { acao: api => api.soltarDica() },
        { foco: ['#campo-0', '#mao-0'], alvo: maoSel(0, 'K', 'paus'), permitir: [maoSel(0, 'K', 'paus'), maoSel(0, '7', 'espadas'), '#campo-0', '[data-acao^="tipo:sumonar"]'],
          fala: ['Invoque o <b>Rei</b> com esse <b>7</b>.', 'Summon the <b>King</b> with this <b>7</b>.'],
          esperar: api => api.ui().sel.includes(idNaMao(api.jogo().jogadores[0], 'K', 'paus')) || !!unidadeFig(api.jogo(), 0, 'K') },
        { foco: ['#campo-0', '#mao-0'], alvo: api => (unidadeFig(api.jogo(), 0, 'K') ? null : api.ui().sel.length > 1 ? '[data-acao^="tipo:sumonar"]' : maoSel(0, '7', 'espadas')(api)),
          permitir: [maoSel(0, 'K', 'paus'), maoSel(0, '7', 'espadas'), '#campo-0', '[data-acao^="tipo:sumonar"]'],
          fala: ['Agora o <b>7</b>!', 'Now the <b>7</b>!'],
          esperar: api => !!unidadeFig(api.jogo(), 0, 'K') },
        { espera: 900 },
        { foco: '#info-0 .poder-naipe', fala: ['Outra coisa que você pode fazer como ação é usar o <b>Poder do Palhaço</b>.', 'Another thing you can do as an action is use the <b>Jester\'s Power</b>.'] },
        { foco: '#info-0 .poder-naipe', fala: ['No caso do Infartitte, você pode trocar <b>2 PV</b> para <b>recuperar 1 defesa</b> de um Senhor(a) seu, ou trocar <b>4 PV</b> para <b>tirar 1 defesa</b> de um Senhor inimigo.',
          'For Infartitte, you can trade <b>2 HP</b> to <b>restore 1 defense</b> of one of your Gentlemen, or trade <b>4 HP</b> to <b>remove 1 defense</b> from an enemy Gentleman.'] },
        { foco: ['#info-0 .poder-naipe', slotFig(0, 'J', 'espadas')], pulsar: [api => slotFig(0, 'J', 'espadas')(api) && slotFig(0, 'J', 'espadas')(api) + ' .selo-vida'],
          fala: ['Nesta situação, vale mais a pena <b>recuperar a defesa do seu Valete</b>.', 'Right now, it is better to <b>restore your Jack\'s defense</b>.'] },
        { foco: ['#info-0 .poder-naipe', slotFig(0, 'J', 'espadas')], permitir: ['#info-0 .poder-naipe', slotFig(0, 'J', 'espadas')],
          alvo: api => (api.ui().pend && api.ui().pend.tipo === 'poder' ? slotFig(0, 'J', 'espadas')(api) : '#info-0 .poder-naipe'),
          fala: ['Clique no <b>naipe de Copas</b> e depois no seu <b>Valete magoado</b>.', 'Click the <b>Hearts suit</b> and then your <b>hurt Jack</b>.'],
          esperar: api => { const u = unidadeFig(api.jogo(), 0, 'J', 'espadas'); return !!u && u.hits === 0; } },
        { espera: 1300 },
        { foco: '#acoes', fala: ['Você tem <b>mais uma ação</b> para fazer nesse turno!', 'You have <b>one more action</b> to use this turn!'] },
        { foco: '#mao-0', fala: ['Além de usar as cartas de número como ataque dos seus Senhores, você pode usar as cartas de número como <b>recursos</b>. Cada naipe faz uma coisa diferente.',
          'Besides using number cards as your Gentlemen\'s attack, you can use number cards as <b>resources</b>. Each suit does something different.'] },
        { acao: api => selecionar(api, '8', 'espadas') },
        { foco: [maoSel(0, '8', 'espadas'), '[data-acao^="tipo:espadas"]'], alvo: maoSel(0, '8', 'espadas'),
          fala: ['Cartas de <b>Espadas</b> podem ser trocadas por <b>+1 de ataque</b>, só por um turno, em um dos seus Senhores.', '<b>Spades</b> cards can be traded for <b>+1 attack</b>, for one turn only, on one of your Gentlemen.'] },
        { acao: api => selecionar(api, '6', 'copas') },
        { foco: [maoSel(0, '6', 'copas'), '[data-acao^="tipo:curar"]'], alvo: maoSel(0, '6', 'copas'),
          fala: [`As cartas de <b>Copas</b> podem ser usadas para <b>curar o seu PV</b>: de 1 a 5 curam <b>3 PV</b>, e de 6 a 10 curam <b>4 PV</b> (e o Infartitte ainda cura +1, porque tem coração forte). A cura vai no máximo até ${M.PV_MAX_CURA} PV.`,
            `<b>Hearts</b> cards can be used to <b>heal your HP</b>: 1 to 5 heal <b>3 HP</b>, and 6 to 10 heal <b>4 HP</b> (and Infartitte heals +1 more, thanks to his strong heart). Healing goes up to ${M.PV_MAX_CURA} HP at most.`] },
        { acao: api => selecionar(api, '9', 'ouros') },
        { foco: [maoSel(0, '9', 'ouros'), '[data-acao^="tipo:comprar"]', '[data-acao="dado-adicional"]'], alvo: maoSel(0, '9', 'ouros'),
          fala: ['E as cartas de <b>Ouros</b> podem ser usadas para <b>comprar uma carta</b>, ou para <b>adicionar mais um dado</b> na rolagem de ataque. O dado que tirar o maior número é o que vale... Dãrr.',
            'And <b>Diamonds</b> cards can be used to <b>draw a card</b>, or to <b>add one more die</b> to an attack roll. The die with the highest number is the one that counts... Duh.'] },
        { foco: [maoSel(0, '9', 'ouros'), '[data-acao^="tipo:comprar"]'], alvo: '[data-acao="tipo:comprar/numeros"]', permitir: ['[data-acao="tipo:comprar/numeros"]'],
          fala: ['Use a carta de Ouros para <b>comprar uma carta de Número</b>.', 'Use the Diamonds card to <b>draw a Number card</b>.'],
          esperar: api => !!idNaMao(api.jogo().jogadores[0], '10', 'paus') },
        { espera: 1000 },
        { foco: maoSel(0, '10', 'paus'), alvo: maoSel(0, '10', 'paus'),
          fala: ['E a carta de <b>Paus</b> pode ser usada para deixar um Senhor seu que está <b>ferido</b> em estado de <b>Berserk</b>: ele levanta e aguenta firme até o fim do turno do oponente.',
            'And a <b>Clubs</b> card can put one of your <b>wounded</b> Gentlemen into <b>Berserk</b>: it stands back up and holds on until the end of the opponent\'s turn.'] },
        { foco: '#acoes', fala: ['Ok: você invocou um Rei, usou sua <b>palhaçada</b> pra curar seu Valete e usou seu 9 de Ouros pra comprar uma carta nova. Não precisa ser um gênio pra perceber que você usou suas <b>3 ações</b>.',
          'Ok: you summoned a King, used your <b>clownery</b> to heal your Jack and used your 9 of Diamonds to draw a new card. You don\'t need to be a genius to see you used your <b>3 actions</b>.'] },
        { foco: '[data-acao="ir-ataque"]', alvo: '[data-acao="ir-ataque"]', permitir: ['[data-acao="ir-ataque"]'],
          fala: ['Agora é hora de <b>preparar o ataque</b>!', 'Now it is time to <b>prepare the attack</b>!'],
          esperar: api => api.jogo().fase === 'ataque' },
        { acao: () => { T.marcas.rei = false; } },
        { foco: [slotFig(0, 'J', 'espadas'), slotFig(0, 'K')], permitir: [slotFig(0, 'J', 'espadas'), slotFig(0, 'K')],
          alvo: api => (api.ui().ataques.length ? slotFig(0, 'K')(api) : slotFig(0, 'J', 'espadas')(api)),
          clique: [{ em: slotFig(0, 'K'), faz: api => { if (api.ui().ataques.length) { T.marcas.rei = true; api.negar(slotFig(0, 'K')(api), '???'); } } }],
          fala: ['Selecione o <b>Valete</b> e o <b>Rei</b> para atacar.', 'Select the <b>Jack</b> and the <b>King</b> to attack.'],
          esperar: api => api.ui().ataques.length > 0 && T.marcas.rei, depois: 900 },
        { tremer: true, fala: ['Ué, não tá conseguindo???', 'Huh, can\'t do it???'] },
        { fala: ['Deve estar bugado...', 'Must be bugged...'] },
        { fala: ['...', '...'] },
        { foco: slotFig(0, 'K'), fala: ['Ah, é verdade: você <b>não consegue atacar com o Rei no mesmo turno em que invocou ele</b>.', 'Oh, right: you <b>can\'t attack with the King on the same turn you summoned him</b>.'] },
        { foco: '[data-acao="confirmar-ataques"]', alvo: '[data-acao="confirmar-ataques"]', permitir: ['[data-acao="confirmar-ataques"]'],
          fala: ['Ataque <b>apenas com o Valete</b>!', 'Attack <b>with the Jack only</b>!'],
          esperar: api => api.jogo().fase !== 'ataque' },
        { gancho: 'antesDado', quando: d => d.p === 0, passos: [
          { foco: slotDe(1), fala: ['O oponente não consegue se defender, porque ele atacou no último turno e agora está <b>virado para baixo</b>. Então não tem ninguém te segurando!', "The opponent can't defend, because he attacked last turn and is now <b>face down</b>. So nobody is holding you back!"] },
        ] },
        { ate: 'depoisGolpe', permitir: '*', fala: ['Jogue o dado e, <b>PELO AMOR DE DEUS, NÃO TIRE 1!!</b>', "Roll the die and, <b>FOR THE LOVE OF GOD, DON'T ROLL A 1!!</b>"] },
        { gancho: 'depoisGolpe', passos: [
          { foco: '#info-1 .heroi', fala: d => (Math.max(...d.rolagens) >= 4 ? ['<b>BOUAAA!!!!</b>', '<b>BOOYAAH!!!!</b>'] : Math.max(...d.rolagens) >= 2 ? ['É... tá bom, né?', 'Well... okay, I guess?'] : ['<b>HAHAHAHAHAHAH</b>', '<b>HAHAHAHAHAHAH</b>']) },
        ] },
        { fala: ['Por enquanto é isso! O tutorial continua em breve. 🎓', 'That is it for now! The tutorial continues soon. 🎓'], botao: ['Continuar', 'Continue'], fim: true },
      ],
    },
  };
  /* (fica guardado para a continuação: a explicação de defender sem levar dano)

          { fala: ['Mas existe a chance de você defender e <b>não levar dano</b>.<br><b>PRESTA ATENÇÃO!!!</b>', 'But there is a chance you defend and <b>take no damage</b>.<br><b>PAY ATTENTION!!!</b>'] },
          { fala: [`Se o dano do oponente for <b>menor que a METADE do seu ataque</b>, você defende e não leva dano.
            <div class="tut-conta"><div><small>se ele tirasse 1 a 3</small><b>3 ÷ 2 = 1</b><small>dano dele</small></div><span>&lt;</span><div><small>o seu Valete</small><b>4 ÷ 2 = 2</b><small>metade do seu ataque</small></div></div>
            <p class="tut-ok">🛡 1 é menor que 2: defendeu sem levar dano!</p>`,
            `If the opponent's damage is <b>lower than HALF of your attack</b>, you defend and take no damage.
            <div class="tut-conta"><div><small>if he rolled 1 to 3</small><b>3 ÷ 2 = 1</b><small>his damage</small></div><span>&lt;</span><div><small>your Jack</small><b>4 ÷ 2 = 2</b><small>half your attack</small></div></div>
            <p class="tut-ok">🛡 1 is lower than 2: blocked with no damage!</p>`] },
          { fala: ['Por exemplo: se ele tivesse tirado 1 a 3 no dado, o ataque dele cairia pela metade: a metade de 3 é <b>1</b> (sempre arredondado pra baixo). E a metade do seu ataque é <b>2</b>. Então você defenderia e não levaria dano!',
            'For example: had he rolled 1 to 3, his attack would be halved: half of 3 is <b>1</b> (always rounded down). And half of your attack is <b>2</b>. So you would block and take no damage!'] },
          { fala: ['<b>COMPLICADO, NÉ?</b> ...mas eu sei que você não é burro.', '<b>COMPLICATED, HUH?</b> ...but I know you are not dumb.'] },
  */

  // ---------- Motor do tutorial ----------

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

  // Reposiciona o foco, a setinha e o balão (os elementos da mesa se mexem: animações, cartas subindo...).
  function posicionar() {
    const raiz = $('#tut');
    if (!raiz || !T.ativo) return;
    const p = T.passo;
    const visivel = !!(p && !p.esconder && (p.textoAtual != null));
    raiz.classList.toggle('mostrando', visivel);
    document.body.classList.toggle('tut-pulsa-seta', visivel && !!p.pulsarSeta);
    document.body.classList.toggle('tut-sem-setas', visivel && !!p.semSetas);
    // O que a fala aponta pulsa (as bolinhas de defesa, por exemplo).
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
    const r = retanguloDe(elementos(p.foco));
    const folga = 10;
    // Véu escuro com um furo arredondado em volta do foco (clip-path com evenodd).
    veu.style.clipPath = r ? furo(r.left - folga, r.top - folga, r.width + folga * 2, r.height + folga * 2, 16) : 'none';
    foco.hidden = !r;
    const ra = retanguloDe(destaques);
    seta.hidden = !(ra || (r && p.permitir && p.permitir !== '*'));
    raiz.classList.toggle('livre', p.permitir === '*');
    let bx, by;
    const bw = balao.offsetWidth, bh = balao.offsetHeight;
    if (r) {
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
    balao.style.left = Math.max(12, Math.min(innerWidth - bw - 12, bx)) + 'px';
    balao.style.top = Math.max(12, Math.min(innerHeight - bh - 12, by)) + 'px';
  }

  function mostrarPasso(p, dados) {
    montarDom();
    const raiz = $('#tut');
    T.passo = p;
    const texto = typeof p.fala === 'function' ? p.fala(dados) : p.fala;
    p.textoAtual = texto != null ? tx(texto) : null;
    raiz.querySelector('.tut-titulo').textContent = tx(T.aula.titulo);
    raiz.querySelector('.tut-pular').textContent = L() ? 'Skip tutorial' : 'Pular tutorial';
    if (p.textoAtual != null) raiz.querySelector('.tut-texto').innerHTML = p.textoAtual;
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
    if (p.espera) return pausa(p.espera);
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
    if (ev.target.closest && ev.target.closest('.tut-balao, #modal')) return;
    const p = T.passo;
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
    document.body.classList.remove('tut-pulsa-seta', 'tut-sem-setas');
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
