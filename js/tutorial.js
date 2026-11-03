// Tutorial em aulas (no estilo do Hearthstone): uma partida de verdade, com as regras oficiais, um balão que conversa
// com o jogador e um foco que escurece o resto da mesa e só deixa clicar no que a aula pede. No fim do roteiro a mesa
// fica livre e o jogador termina o duelo sozinho, contra um Ourinhos que se cura e joga na defensiva.
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

  // Poder do Ourinhos feito pela aula: rouba esta carta da sua mão (no jogo normal, a carta é sorteada).
  function roubar(api, rank, naipe) {
    const mao = api.jogo().jogadores[0].mao, k = mao.findIndex(c => c.rank === rank && c.naipe === naipe), rng = M.rngAtual();
    M.definirRng(() => (Math.max(k, 0) + 0.5) / mao.length);
    api.aplicar({ tipo: 'poder' });
    M.definirRng(rng);
  }
  // O Senhor(a) está do lado do Ás?
  const aoLadoDoAs = (e, p, u) => { const c = e.jogadores[p].campo, i = c.indexOf(u); return !!u && [i - 1, i + 1].some(k => c[k] && c[k].tipo === 'as'); };
  // O Valete que o seu Rei escolheu defender (copas é o de 4; ouros, o de 3).
  const valeteDefendido = api => slotFig(1, 'J', T.marcas.bloqueou)(api);
  const defendeuForte = () => T.marcas.bloqueou === 'copas';

  // A caixa do dano ignorado: o Valete bateu no Rei que defendeu e nem chegou na metade do número dele.
  function falaIgnorado(d) {
    const def = d.res.defesas.find(x => x.dano < Math.floor(x.atk / 2)), n = Math.max(...d.rolagens), metade = Math.floor(def.atk / 2);
    return [`Se o <b>DANO</b> não chegar nem na <b>METADE</b> do número do seu Senhor, você <b>IGNORA</b> o dano. Tipo agora: o <b>Valete</b> tirou <b>${n}</b> no dado e deu <b>${def.dano}</b> de dano, sua defesa é <b>${def.atk}</b> e metade de ${def.atk} é <b>${metade}</b> (arredondado pra baixo), então ele só se fodeu mesmo.`,
      `If the <b>DAMAGE</b> doesn't even reach <b>HALF</b> of your Gentleman's number, you <b>IGNORE</b> the damage. Like right now: the <b>Jack</b> rolled a <b>${n}</b> and dealt <b>${def.dano}</b> damage, your defense is <b>${def.atk}</b> and half of ${def.atk} is <b>${metade}</b> (rounded down), so he just screwed himself.`];
  }

  // Cartinhas iguais às da tela de Regras, para as ilustrações nas falas.
  const cartinha = (rank, naipe) => `<span class="tut-cartinha"><span class="rg-c">${SS.Cartas.frente({ rank, naipe })}</span></span>`;
  const cartaAcao = (arte, titulo) => `<span class="rg-acao"><img src="arte/acoes/${arte}.webp" alt="" draggable="false"><b>${titulo}</b></span>`;
  const recurso = (rank, naipe, nome, acoes, texto) => `<div><span class="tut-rec-cartas">${cartinha(rank, naipe)}${acoes}</span><b>${nome}</b><span>${texto}</span></div>`;

  // Cartas de Letras que ficam fora da abertura (voltam para o baralho depois que você escolhe as suas 3 figuras).
  let guardadas = [];
  const FIGURAS_ABERTURA = [['J', 'paus'], ['J', 'copas'], ['K', 'paus']];
  const AVISO_INVOCAR = ['NÃO DÁ PRA INVOCAR 2 CARTAS IGUAIS NO MESMO TURNO, NEM SACRIFICAR UMA CARTA QUE ACABOU DE SER INVOCADA!!!!', 'YOU CAN\'T SUMMON 2 OF THE SAME CARD IN THE SAME TURN, OR SACRIFICE A CARD THAT WAS JUST SUMMONED!!!!'];
  const AVISO_RAINHA = ['AAAAH, esqueci: a <b>Rainha</b> só pode entrar em campo se você <b>sacrificar 1 Rei OUUU 2 Valetes</b> em campo, e ela pode ser combinada até com a carta de número <b>10</b>.', 'AAAAH I forgot, the <b>Queen</b> can only enter the field if you <b>sacrifice 1 King ORRR 2 Jacks</b> on the field, and she can be paired up to number card <b>10</b>.'];

  const AVISO_PARGIA = ['Opa! Você tem <b>2 cartas do mesmo naipe ou do mesmo número</b> na mão. Duas cartas assim formam uma <b>Pargia</b>, uma magia! Vou abrir a <b>colinha</b> pra você ver o que cada uma faz.', 'Hey! You have <b>2 cards of the same suit or the same number</b> in hand. Two cards like that make a <b>Pairgic</b>, a spell! I\'ll open the <b>crib sheet</b> so you can see what each one does.'];

  const AULAS = {
    1: {
      titulo: ['Tutorial', 'Tutorial'],
      palhacos: ['infartitte', 'ourinhos'],
      // Antes da abertura (o sorteio já foi): arruma os baralhos e faz a abertura do oponente.
      preparar(e) {
        const [eu, ele] = e.jogadores;
        guardadas = eu.letras.filter(c => !FIGURAS_ABERTURA.some(([r, n]) => c.rank === r && c.naipe === n));
        eu.letras = eu.letras.filter(c => !guardadas.includes(c));
        // Os 4 números da abertura e as compras dos próximos turnos, nesta ordem.
        empilhar(eu, 'numeros', [['4', 'copas'], ['7', 'ouros'], ['6', 'copas'], ['8', 'ouros'], ['10', 'espadas'], ['9', 'paus'], ['A', 'espadas'], ['5', 'paus'], ['3', 'espadas']]);
        // (depois da abertura, muitas Copas: na parte livre, ele se cura bastante)
        empilhar(ele, 'numeros', [['3', 'espadas'], ['A', 'ouros'], ['7', 'ouros'], ['4', 'ouros'], ['9', 'copas'], ['5', 'copas'], ['8', 'copas'], ['6', 'copas'], ['10', 'copas'], ['2', 'copas'], ['7', 'copas'], ['3', 'copas']]);
        const fig = (r, n) => ele.letras.find(c => c.rank === r && c.naipe === n).id;
        M.escolherFiguras(e, 1, [fig('J', 'ouros'), fig('J', 'paus'), fig('K', 'ouros')]);
        M.confirmarAbertura(e, 1);
      },
      passos: [
        // ---------- Boas-vindas e o sorteio de quem começa ----------
        { gancho: 'mesa', passos: [
          { fala: ['<b>Bem-vindos ao Senhora e Senhores!</b><br>Um jogo sobre duelos de <b>Palhaço</b>. Cada jogador controla um <b>Palhaço/Joker</b>, dá na mesma...',
            '<b>Welcome to Lady and Gentlemen!</b><br>A game about <b>Jester</b> duels. Each player controls a <b>Jester/Joker</b>, same thing....'] },
          { fala: ['Essa porcaria aqui é um card game inspirado nos joguinhos de TCG, <i>Magic</i>, <i>Yu-Gi-Oh!</i>, <i>Hearthstone</i>, mas com o diferencial de que aqui a gente só usa <b>cartas de um baralho comum</b>.',
            'This piece of junk is a card game inspired by those little TCGs, <i>Magic</i>, <i>Yu-Gi-Oh!</i>, <i>Hearthstone</i>, except that here we only use <b>cards from a regular deck</b>.'] },
          { foco: '#info-1 .heroi-pv', fala: ['O objetivo do jogo é <b>zerar os pontos de vida (PV)</b> do oponente, e você faz isso batendo com <b>Senhoras e Senhores</b>, mas a gente já chega lá...',
            'The goal of the game is to <b>bring the opponent\'s hit points (HP) down to zero</b>, and you do that by hitting with <b>Ladies and Gentlemen</b>, but we\'ll get there...'] },
        ] },
        { ate: 'depoisSorteio', permitir: '*', dado: true, fala: ['No começo de todas as partidas, você precisa <b>rolar o dado</b> pra ver quem começa.', 'At the start of every match you have to <b>roll the die</b> to see who goes first.'] },
        { gancho: 'depoisSorteio', passos: [
          { foco: '#info-1 .heroi', fala: ['Começamos bem, hehehehe...', 'Off to a great start hehehehe....'] },
        ] },
        // ---------- Abertura: 3 realezas + 4 números ----------
        { gancho: 'abertura', passos: [
          { fala: ['Depois de definir quem começa, é hora de escolher <b>3 cartas realezas</b> do baralho.', 'Once you know who goes first, it\'s time to pick <b>3 royal cards</b> from the deck.'] },
        ] },
        { foco: '#modal .palco-fila', alvo: '#modal .palco-carta:not(.selecionada)', permitir: '*', semVeu: true, embaixo: true,
          fala: ['Clique nessas 3 que eu já deixei separadinhas pra você :)', 'Click these 3 that I set aside just for you :)'],
          esperar: api => api.jogo().jogadores[0].abertura.figuras.length > 0 },
        { gancho: 'mulligan', passos: [
          { acao: api => { const eu = api.jogo().jogadores[0]; eu.letras.push(...guardadas); guardadas = []; empilhar(eu, 'letras', [['J', 'espadas'], ['Q', 'paus'], ['J', 'ouros'], ['K', 'espadas'], ['K', 'copas'], ['K', 'ouros']]); } },
          { espera: 700 },
        ] },
        { travarModal: true, semVeu: true, embaixo: true, foco: '#modal .palco-fila', alvo: '#modal [data-m="manter"]', permitir: ['#modal [data-m="manter"]'], permitirTodos: '#modal .palco-carta',
          clique: [{ em: '#modal [data-m="trocar"]', faz: () => avisar(['Eu já selecionei as cartas pra começar, NÃO FODE!', 'I already picked the cards for you to start with, DON\'T SCREW THIS UP!']) }],
          fala: ['Agora vem a parte de comprar <b>4 cartas de número</b>. Você pode selecionar as cartas de que não gostou e trocar até <b>3 vezes</b>.', 'Now comes the part where you draw <b>4 number cards</b>. You can select the cards you didn\'t like and swap them up to <b>3 times</b>.'],
          esperar: api => api.jogo().jogadores[0].abertura.pronto },
        // ---------- Turno 1 (o oponente começa: não compra e não ataca) ----------
        { gancho: 'turnoOponente', quando: () => turno() === 1, passos: [
          { espera: 500 },
          { foco: ['#campo-0', '#campo-1'], fala: ['Esse aqui é o <b>tabuleiro</b>, onde o duelo vai acontecer.', 'This here is the <b>board</b>, where the duel happens.'] },
          { foco: '#cobra', fala: ['Tá vendo essa cobrinha?? Ela não faz porra nenhuma, só divide o campo mesmo...', 'See that little snake?? It does jack shit, it just splits the field...'] },
          { foco: '#info-1 .heroi', fala: ['Quem começa é o <b>oponente</b>. A desvantagem de começar é que você <b>não compra carta</b> e também <b>não pode atacar</b> no turno 1.', 'The <b>opponent</b> goes first. The downside of going first is that you <b>don\'t draw a card</b> and also <b>can\'t attack</b> on turn 1.'] },
          { acao: api => { const j = api.jogo().jogadores[1]; aplicarPerto(api, x => x.tipo === 'sumonar' && x.figura === idNaMao(j, 'J', 'ouros') && x.numero === idNaMao(j, '3', 'espadas')); } },
          { espera: 1200 },
          { foco: slotFig(1, 'J', 'ouros'), fala: ['Olha só, ele invocou um <b>Valete</b> com <b>3</b> de ataque, que corajoso... e já passou o turno.', 'Look at that, he summoned a <b>Jack</b> with <b>3</b> attack, how brave... and he already ended his turn.'] },
        ] },
        // ---------- Turno 2: comprar, invocar, atacar ----------
        esperarCompra,
        { tremer: true, foco: '#info-0 .heroi', fala: ['<b>É A SUA VEZ!!!</b>', '<b>IT\'S YOUR TURN!!!</b>'] },
        { foco: '#pilhas-0', fala: ['No começo de todo turno, você compra <b>2 cartas</b>. Seu baralho é dividido em dois montes, o das cartas de <b>número</b> e o das cartas de <b>realeza</b>. Eles não gostam de se misturar, arrombados!',
          'At the start of every turn you draw <b>2 cards</b>. Your deck is split into two piles, the <b>number</b> cards and the <b>royal</b> cards. They don\'t like to mix, the bastards!'] },
        { foco: '#pilhas-0', alvo: '[data-pilha="0:numeros"]', permitir: ['[data-pilha="0:numeros"]'], compra: true,
          fala: ['Compre <b>2 cartas de número</b>, porque você já tá com 3 cartas de realeza na mão.', 'Draw <b>2 number cards</b>, you already have 3 royal cards in hand.'],
          esperar: api => api.jogo().fase !== 'compra' },
        { espera: 800 },
        { foco: '#acoes', fala: ['Em todo turno você tem <b>3 ações passivas</b> para fazer.', 'Every turn you have <b>3 passive actions</b> to do.'] },
        { foco: '#campo-0', fala: ['Vamos invocar um <b>Senhor</b> também!!', 'Let\'s summon a <b>Gentleman</b> too!!'] },
        { foco: ['#campo-0', '#mao-0'], permitir: [maoSel(0, 'J', 'paus'), maoSel(0, '4', 'copas'), '#campo-0', '[data-acao^="tipo:sumonar"]'],
          alvo: api => { const ui = api.ui(), j = api.jogo().jogadores[0]; return ui.sel.includes(idNaMao(j, 'J', 'paus')) ? (ui.sel.includes(idNaMao(j, '4', 'copas')) ? '#campo-0' : maoSel(0, '4', 'copas')(api)) : maoSel(0, 'J', 'paus')(api); },
          fala: ['Selecione o <b>Valete</b> e esse <b>4</b> e arraste para o campo de batalha.', 'Select the <b>Jack</b> and this <b>4</b> and drag them to the battlefield.'],
          esperar: api => !!unidadeFig(api.jogo(), 0, 'J', 'paus') },
        { espera: 900 },
        { foco: slotFig(0, 'J', 'paus'), fala: ['<b>PARABÉNS, ENERGÚMENO</b>, você aprendeu a invocar um Senhor!', '<b>CONGRATULATIONS, YOU NITWIT</b>, you learned how to summon a Gentleman!'] },
        { acao: api => api.fixarDica(slotFig(0, 'J', 'paus')(api) + ' .unidade') },
        { acao: api => api.fixarDica(slotFig(0, 'J', 'paus')(api) + ' .unidade') },
        { foco: ['#dica', slotFig(0, 'J', 'paus')], fala: ['Cada Senhor tem uma propriedade única, que você descobre passando o mouse por cima e <b>LENDO!!</b>', 'Each Gentleman has a unique property, you find out by hovering over it and <b>READING!!</b>'] },
        { foco: ['#dica', slotFig(0, 'J', 'paus')], circular: '#dica p:has(> .dica-hab)', fala: ['O <b>Valete</b> pode atacar no mesmo turno em que entra. Bacana, legal, né?', 'The <b>Jack</b> can attack on the same turn it enters, neat, cool, right?'] },
        { acao: api => api.soltarDica() },
        { acao: api => api.soltarDica() },
        { foco: slotFig(0, 'J', 'paus'), fala: ['O número equipado no Valete determina a <b>força</b> e a <b>resistência</b> dele.', 'The number equipped on the Jack determines its <b>strength</b> and its <b>toughness</b>.'] },
        { foco: '#acoes', fala: ['Você ainda tem <b>2 ações</b> pra fazer, masss isso é um tutorial, então vamos com calma.', 'You still have <b>2 actions</b> to do, buuut this is a tutorial, so let\'s take it easy.'] },
        { foco: ['[data-acao="passar-turno"]', '[data-acao="ir-ataque"]'], alvo: '[data-acao="ir-ataque"]', permitir: ['[data-acao="ir-ataque"]'],
          clique: [{ em: '[data-acao="passar-turno"]', faz: () => avisar(['PARA AGORA, SEU BURRO, é pra preparar o ataque!!!', 'STOP RIGHT NOW, YOU MORON, you\'re supposed to prepare the attack!!!']) }],
          fala: ['Você pode <b>encerrar o turno</b>, caso seja um tonto, ou <b>preparar um ataque</b> e... atacar o oponente.', 'You can <b>end the turn</b>, in case you\'re a fool, or <b>prepare an attack</b> and... attack the opponent.'],
          esperar: api => api.jogo().fase === 'ataque' },
        { foco: slotFig(0, 'J', 'paus'), alvo: slotFig(0, 'J', 'paus'), permitir: [slotFig(0, 'J', 'paus')],
          fala: ['Show, agora você vai selecionar qual <b>Senhor</b> vai atacar.', 'Great, now you\'re going to select which <b>Gentleman</b> will attack.'],
          impaciente: { ms: 5000, fala: ['TÁ ESPERANDO O QUÊ?! CLICA NA PORRA DO VALETE', 'WHAT ARE YOU WAITING FOR?! CLICK THE DAMN JACK'] },
          esperar: api => api.ui().ataques.length > 0 },
        { foco: [slotFig(0, 'J', 'paus'), '#info-1 .heroi'], pulsarSeta: true, fala: ['Tá vendo essa <b>seta vermelha</b>? Ela mostra a sua intenção de ataque.', 'See that <b>red arrow</b>? It shows your intention to attack.'] },
        { foco: '[data-acao="confirmar-ataques"]', alvo: '[data-acao="confirmar-ataques"]', permitir: ['[data-acao="confirmar-ataques"]'],
          fala: ['Confirma esse ataque!', 'Confirm that attack!'],
          esperar: api => api.jogo().fase !== 'ataque' },
        { gancho: 'antesDado', quando: d => d.p === 0 && turno() === 2, passos: [
          { fala: ['Não é porque o seu Valete tem 4 de força que ele vai dar 4 de dano obrigatoriamente.', 'Just because your Jack has 4 strength doesn\'t mean it will necessarily deal 4 damage.'] },
          { fala: ['O que determina isso é o <b>DADO DE DANO</b>.', 'What determines that is the <b>DAMAGE DIE</b>.'] },
          { tremer: true, fala: ['<b>DADO DE DANO DADO DE DANO DADO DE DANO</b>', '<b>DAMAGE DIE DAMAGE DIE DAMAGE DIE</b>'] },
          { fala: ['Nossa, repetir isso 3 vezes é divertido.', 'Wow, repeating that 3 times is fun.'] },
          { fala: [`<div class="tut-dados"><div><i>⚃ ⚄ ⚅</i><b>4 a 6</b><span>dano cheio, igual à sua força</span></div><div><i>⚁ ⚂</i><b>2 ou 3</b><span>metade, arredondado para baixo</span></div><div class="ruim"><i>⚀</i><b>1</b><span>você erra</span></div></div>`,
            `<div class="tut-dados"><div><i>⚃ ⚄ ⚅</i><b>4 to 6</b><span>full damage, equal to your strength</span></div><div><i>⚁ ⚂</i><b>2 or 3</b><span>half, rounded down</span></div><div class="ruim"><i>⚀</i><b>1</b><span>you miss</span></div></div>`] },
        ] },
        { ate: 'depoisGolpe', quando: d => d.p === 0 && turno() === 2, permitir: '*', dado: true, fala: ['Vai, <b>JOGA LOGO ESSE DADO!!</b>', 'Go on, <b>ROLL THAT DIE ALREADY!!</b>'] },
        { gancho: 'depoisGolpe', quando: d => d.p === 0 && turno() === 2, passos: [
          { foco: '#info-1 .heroi', fala: d => {
            const n = Math.max(...d.rolagens);
            T.marcas.errou = n < 2;
            if (n >= 4) return ['<b>BOOOOOOOUAAA, CAMPEÃO!!</b>', '<b>BOOOOOOOYAAH, CHAMP!!</b>'];
            if (n >= 2) return ['Meh... tá bom.', 'Meh... fine.'];
            return ['<b>AHAHAHAHAHAHAHAHAHAHAHAHDHHAHAHAHAHAHAHAHAHAHAHAHAHHHSAHHSHSHSH</b>', '<b>AHAHAHAHAHAHAHAHAHAHAHAHDHHAHAHAHAHAHAHAHAHAHAHAHAHHHSAHHSHSHSH</b>'];
          } },
        ] },
        { gancho: 'fimDoTurno', quando: d => d.p === 0 && turno() === 3, passos: [
          { espera: 700 },
          { foco: slotFig(0, 'J', 'paus'), fala: ['Depois do ataque, o Senhor que atacou fica <b>virado para baixo</b>.', 'After the attack, the Gentleman who attacked ends up <b>face down</b>.'] },
          { foco: slotFig(0, 'J', 'paus'), fala: () => (T.marcas.errou ? ['Apanhar machuca e errar cansa.', 'Getting hit hurts and missing is tiring.'] : ['Apanhar machuca e bater cansa.', 'Getting hit hurts and hitting is tiring.']) },
        ] },
        // ---------- Turno 3 (oponente): o Ás de Ouros, o roubo e o ataque ----------
        { gancho: 'turnoOponente', quando: () => turno() === 3, passos: [
          { foco: '#info-1 .heroi', fala: ['É a vez dele de novo.', 'It\'s his turn again.'] },
          { acao: api => { const j = api.jogo().jogadores[1]; aplicarPerto(api, x => x.tipo === 'invocarAs' && x.as === idNaMao(j, 'A', 'ouros') && x.custo === idNaMao(j, '7', 'ouros')); } },
          { espera: 1200 },
          { foco: slotAs(1), fala: ['Ele abaixou um <b>Ás de Ouros</b>, hmmm, interessante.', 'He put down an <b>Ace of Diamonds</b>, hmmm, interesting.'] },
          { foco: slotAs(1), fala: ['Os <b>Ases</b> nesse jogo são como <b>totens</b>, eles não atacam, servem mais como suporte. O Ás de Ouros dá mais <b>1 dado</b> na rolagem de ataque dos Senhores ao lado dele, para ajudar a garantir o dano cheio.',
            '<b>Aces</b> in this game are like <b>totems</b>, they don\'t attack, they\'re more for support. The Ace of Diamonds gives <b>1 more die</b> to the attack roll of the Gentlemen next to it, to help guarantee full damage.'] },
          { acao: api => roubar(api, '8', 'ouros') },
          { espera: 1500 },
          { tremer: true, foco: '#info-1 .heroi', fala: ['Nossaaa...!! Esse gordinho safado <b>roubou uma carta sua!!</b> Que arrombado.', 'Whoaaa...!! That sneaky fatso <b>stole one of your cards!!</b> What a bastard.'] },
          { foco: '#info-1 .heroi', fala: ['Na verdade isso é da natureza dele...', 'Actually, that\'s just his nature...'] },
          { foco: '#info-1 .heroi', fala: ['Cada <b>Palhaço</b> tem uma <b>habilidade passiva</b> e um <b>Poder de Palhaço</b> que você descobre, adivinha como?? Isso aí, <b>LENDO</b>. Dá pra ver quando você passa o mouse por cima de cada Palhaço.',
            'Each <b>Jester</b> has a <b>passive ability</b> and a <b>Jester power</b> that you find out, guess how?? That\'s right, by <b>READING</b>. You can see them when you hover over each Jester.'] },
          { foco: '#info-1 .heroi', fala: ['Por exemplo, a passiva do <b>Ourinhos</b> (hehe) é comprar uma carta quando um Senhor der dano no oponente (1 carta por turno).', 'For example, <b>Ourinhos\'s</b> passive (hehe) is drawing a card when a Gentleman damages the opponent (1 card per turn).'] },
          { foco: '#info-1 .heroi', fala: ['E o Poder de Palhaço dele é roubar uma carta da sua mão... Hoje em dia estão chamando crime de Poder de Palhaço... Que Deus nos acuda.', 'And his Jester power is stealing a card from your hand... These days they call crime a Jester power... God help us.'] },
          { acao: api => { api.ui().tutDado = 5; } },
          { foco: slotFig(1, 'J', 'ouros'), fala: ['Além de roubar, ele vai te agredir, gordinho do caralho!!', 'On top of stealing he\'s going to beat you up, that damn fatso!!'] },
          { foco: slotFig(0, 'J', 'paus'), fala: ['E você nem pode se defender, porque o seu Valete tá cansadinho, virado pra baixo.', 'And you can\'t even defend because your Jack is all tired out, face down.'] },
        ] },
        // ---------- Turno 4: o Valete que não entra, o Rei, o Ás de Espadas, os recursos e a cura ----------
        esperarCompra,
        { foco: '#pilhas-0', alvo: '[data-pilha="0:numeros"]', permitir: ['[data-pilha="0:numeros"]'], compra: true,
          fala: ['Sua vez de novo. Compre mais <b>2 cartas de número</b>.', 'Your turn again. Draw <b>2 more number cards</b>.'],
          esperar: api => api.jogo().fase !== 'compra' },
        { espera: 800 },
        { acao: api => selecionar(api, 'J', 'copas') },
        { foco: ['#campo-0', '#mao-0'], permitir: ['#mao-0', '#campo-0'],
          fala: ['Vamos invocar outro <b>Valete</b>.', 'Let\'s summon another <b>Jack</b>.'],
          esperar: api => api.ui().sel.length > 0, depois: 4000 },
        { tremer: true, fala: ['Ué, não tá conseguindo????', 'Huh, can\'t do it????'] },
        { acao: api => { const ui = api.ui(); ui.sel = []; ui.destino = null; api.render(); api.fixarDica(maoSel(0, 'J', 'copas')(api)); } },
        { foco: ['#dica', maoSel(0, 'J', 'copas')], circular: '#dica .dica-limite', fala: ['<b>SE VOCÊ TIVESSE LIDO</b>, ia ver que o Valete só pode ser combinado com cartas de <b>2 a 4</b>.', '<b>IF YOU HAD READ</b> you would have seen that the Jack can only be paired with cards from <b>2 to 4</b>.'] },
        { acao: api => api.fixarDica(maoSel(0, 'K', 'paus')(api)) },
        { foco: ['#dica', maoSel(0, 'K', 'paus')], circular: '#dica .dica-limite', fala: ['Já o <b>Rei</b> pode ser combinado com cartas de <b>2 a 7</b>, maaas é necessário <b>SACRIFICAR UM VALETE EM CAMPO</b> para ele entrar.', 'The <b>King</b>, on the other hand, can be paired with cards from <b>2 to 7</b>, buuut you must <b>SACRIFICE A JACK ON THE FIELD</b> for him to enter.'] },
        { acao: api => api.soltarDica() },
        { foco: ['#campo-0', '#mao-0'], permitir: [maoSel(0, 'K', 'paus'), maoSel(0, '7', 'ouros'), '#campo-0', '[data-acao^="tipo:sumonar"]'],
          alvo: api => { const ui = api.ui(), j = api.jogo().jogadores[0]; return ui.pend ? slotFig(0, 'J', 'paus')(api) : !ui.sel.includes(idNaMao(j, 'K', 'paus')) ? maoSel(0, 'K', 'paus')(api) : !ui.sel.includes(idNaMao(j, '7', 'ouros')) ? maoSel(0, '7', 'ouros')(api) : slotFig(0, 'J', 'paus')(api); },
          fala: ['Selecione o <b>Rei</b> e esse <b>7</b> e coloque em cima de onde o <b>Valete</b> está.', 'Select the <b>King</b> and this <b>7</b> and place him on top of where the <b>Jack</b> is.'],
          esperar: api => !!unidadeFig(api.jogo(), 0, 'K') },
        { espera: 1100 },
        { foco: slotFig(0, 'K'), fala: ['Bom garoto!!', 'Good boy!!'] },
        { foco: '#acoes', fala: ['Você ainda tem <b>2 ações</b> para fazer e, dessa vez, vamos fazer mais coisas.', 'You still have <b>2 actions</b> to do and this time we\'ll do more stuff.'] },
        { foco: [maoSel(0, 'A', 'espadas'), maoSel(0, '10', 'espadas')], fala: ['Vamos invocar esse <b>Ás de Espadas</b>. Para invocar um Ás, você precisa <b>sacrificar uma carta do mesmo naipe</b> dele.', 'Let\'s summon this <b>Ace of Spades</b>. To summon an Ace, you must <b>sacrifice a card of the same suit</b> as the Ace.'] },
        { foco: ['#campo-0', '#mao-0'], permitir: [maoSel(0, 'A', 'espadas'), maoSel(0, '10', 'espadas'), '#campo-0', '[data-acao^="tipo:invocarAs"]'],
          alvo: api => { const ui = api.ui(), j = api.jogo().jogadores[0]; return !ui.sel.includes(idNaMao(j, 'A', 'espadas')) ? maoSel(0, 'A', 'espadas')(api) : !ui.sel.includes(idNaMao(j, '10', 'espadas')) ? maoSel(0, '10', 'espadas')(api) : '#campo-0'; },
          fala: ['Selecione esse <b>Ás</b> e esse <b>10 de Espadas</b> e coloque do ladinho do <b>Rei</b>.', 'Select this <b>Ace</b> and this <b>10 of Spades</b> and place them right next to the <b>King</b>.'],
          esperar: api => api.jogo().jogadores[0].campo.some(u => u && u.tipo === 'as') },
        { espera: 1000 },
        { foco: [slotAs(0), slotFig(0, 'K')], fala: ['O <b>Ás de Espadas</b> dá mais <b>1 de ataque</b> para os Senhores ao seu lado.', 'The <b>Ace of Spades</b> gives <b>1 more attack</b> to the Gentlemen next to it.'] },
        { foco: slotFig(0, 'K'), fala: () => (aoLadoDoAs(T.api.jogo(), 0, unidadeFig(T.api.jogo(), 0, 'K'))
          ? ['Agora seu Rei está com <b>8 de força</b>, empolganteeee!', 'Now your King has <b>8 strength</b>, how exciiiiting!']
          : ['Eu falei <b>DO LADINHO</b>! Seu Rei podia estar com 8 de força, mas continua com 7. Parabéns.', 'I said <b>RIGHT NEXT TO HIM</b>! Your King could have 8 strength, but he\'s still at 7. Congratulations.']) },
        { foco: '#acoes', fala: ['Você ainda tem <b>1 ação</b> para fazer nesse turno.', 'You still have <b>1 action</b> to do this turn.'] },
        { foco: '#mao-0', fala: ['As cartas de número também podem ser usadas como <b>recursos</b>, de acordo com seu naipe.', 'Number cards can also be used as <b>resources</b>, according to their suit.'] },
        { largo: true, fala: () => [`<div class="tut-recursos">${recurso('8', 'espadas', 'Espadas', cartaAcao('dano', '+1 Ataque'), 'Sacrifique para ceder <b>+1 de ataque</b> a um Senhor seu (só por 1 turno).')}${recurso('8', 'paus', 'Paus', cartaAcao('berserk', 'Berserk'), 'Deixa um Senhor ferido em modo <b>Berserk</b>: ele levanta até o fim do próximo turno do oponente. Se levar hit, morre.')}${recurso('8', 'ouros', 'Ouros', cartaAcao('comprar', 'Comprar') + cartaAcao('dado', 'Dado adicional'), '<b>Compra</b> mais cartas ou <b>adiciona dados</b>.')}${recurso('8', 'copas', 'Copas', cartaAcao('cura', 'Curar'), '<b>Cura</b> o seu PV.')}</div>`,
          `<div class="tut-recursos">${recurso('8', 'espadas', 'Spades', cartaAcao('dano', '+1 Attack'), 'Sacrifice it to give <b>+1 attack</b> to one of your Gentlemen (for 1 turn only).')}${recurso('8', 'paus', 'Clubs', cartaAcao('berserk', 'Berserk'), 'Puts a wounded Gentleman in <b>Berserk</b> mode: it stands up until the end of the opponent\'s next turn. If it takes a hit, it dies.')}${recurso('8', 'ouros', 'Diamonds', cartaAcao('comprar', 'Draw') + cartaAcao('dado', 'Extra die'), '<b>Draws</b> more cards or <b>adds dice</b>.')}${recurso('8', 'copas', 'Hearts', cartaAcao('cura', 'Heal'), '<b>Heals</b> your HP.')}</div>`] },
        { semVeu: true, permitir: [maoSel(0, '6', 'copas'), '[data-acao^="tipo:curar"]', '#info-0'], alvo: maoSel(0, '6', 'copas'),
          fala: ['Se cure da porrada que você levou no turno passado: use essa carta de <b>Copas</b>.', 'Heal from the beating you took last turn: use this <b>Hearts</b> card.'],
          esperar: api => !idNaMao(api.jogo().jogadores[0], '6', 'copas') },
        { espera: 1000 },
        { foco: '[data-acao="passar-turno"]', alvo: '[data-acao="passar-turno"]', permitir: ['[data-acao="passar-turno"]'],
          fala: ['Seu <b>Rei</b> foi invocado esse turno e ainda não pode atacar, então vamos passar o turno.', 'Your <b>King</b> was summoned this turn and can\'t attack yet, so let\'s end the turn.'],
          esperar: api => api.jogo().vez !== 0 },
        // ---------- Turno 5 (oponente): rouba o Valete, invoca e ataca; você defende ----------
        { gancho: 'turnoOponente', quando: () => turno() === 5, passos: [
          { acao: api => roubar(api, 'J', 'copas') },
          { espera: 1500 },
          { acao: api => { const j = api.jogo().jogadores[1]; aplicarPerto(api, x => x.tipo === 'sumonar' && x.figura === idNaMao(j, 'J', 'copas') && x.numero === idNaMao(j, '4', 'ouros')); } },
          { espera: 1300 },
          // O de 3, se o Rei defender, tira 2 e o dano nem chega na metade; os outros golpes tiram 5 (acertam em cheio).
          { acao: api => { const v3 = unidadeFig(api.jogo(), 1, 'J', 'ouros'); api.ui().tutDadoPor = at => (v3 && at.atacante === v3.uid && T.marcas.bloqueou === 'ouros' ? 2 : 5); } },
          { foco: '#campo-1', fala: ['Nossa, ele tá puto, hein: <b>roubou o seu Valete</b> e invocou. Vai atacar com os dois Valetes.', 'Wow, he\'s pissed, huh: he <b>stole your Jack</b> and summoned it. He\'s going to attack with both Jacks.'] },
        ] },
        { gancho: 'bloqueio', quando: () => turno() === 5, passos: [
          { tremer: true, fala: ['Agora vou te ensinar o tutorial da <b>DEFESA!!</b>', 'Now I\'m going to teach you the <b>DEFENSE</b> tutorial!!'] },
          { foco: [slotFig(0, 'K'), '#campo-1'], fala: ['Quando o oponente prepara um ataque, você tem a oportunidade de <b>defender</b> ou deixar passar.', 'When the opponent prepares an attack you get the chance to <b>defend</b> or let it through.'] },
        ] },
        { foco: [slotFig(0, 'K'), slotFig(1, 'J', 'copas'), slotFig(1, 'J', 'ouros')], alvo: api => (api.ui().bloqSel == null ? slotFig(0, 'K')(api) : [slotFig(1, 'J', 'copas')(api), slotFig(1, 'J', 'ouros')(api)]),
          permitir: [slotFig(0, 'K'), slotFig(1, 'J', 'copas'), slotFig(1, 'J', 'ouros')],
          fala: ['Clique no seu <b>Rei</b> e arraste a defesa até um dos 2 <b>Valetes</b>.', 'Click your <b>King</b> and drag the defense onto one of the 2 <b>Jacks</b>.'],
          esperar: api => {
            const e = api.jogo(), k = unidadeFig(e, 0, 'K');
            const n = ['copas', 'ouros'].find(x => { const at = ataqueDe(e, 1, 'J', x); return !!at && !!k && (api.ui().bloqueios[at.n] || []).includes(k.uid); });
            T.marcas.bloqueou = n;
            return !!n;
          } },
        { foco: [slotFig(0, 'K'), valeteDefendido], pulsarSeta: true, fala: ['Essa <b>seta azul</b> é a sua intenção de defesa.', 'This <b>blue arrow</b> is your intention to defend.'] },
        { foco: '[data-acao="confirmar-bloqueios"]', alvo: '[data-acao="confirmar-bloqueios"]', permitir: ['[data-acao="confirmar-bloqueios"]'],
          fala: ['Clique em <b>Defender</b>: agora ele vai rolar os dados.', 'Click <b>Defend</b>, now he\'s going to roll the dice.'],
          esperar: api => api.jogo().fase !== 'bloqueio' },
        { acao: api => api.soltarDica() }, // (a dica do arrasto da defesa não fica cobrindo a mesa)
        { ate: 'depoisGolpe', esconder: true, quando: d => d.p === 1 && turno() === 5 && ehAtaqueDe(d, 'J', T.marcas.bloqueou) },
        { gancho: 'depoisGolpe', quando: d => d.p === 1 && turno() === 5 && ehAtaqueDe(d, 'J', T.marcas.bloqueou), passos: [
          { espera: 500 },
          { se: defendeuForte, foco: slotFig(0, 'K'), semSetas: true, fala: ['Ele acertou em cheio o Rei, mas você defendeu com sucesso. Tá vendo que o seu Rei tá deitadinho? Quer dizer que ele tá machucado :(', 'He hit the King dead on, but you defended successfully. See how your King is lying down? That means he\'s hurt :('] },
          { se: () => !defendeuForte(), largo: true, foco: slotFig(0, 'K'), semSetas: true, fala: falaIgnorado },
          { foco: slotFig(0, 'K'), semSetas: true, pulsar: [vidaFig(0, 'K')], fala: ['Se ele perder os <b>2 escudinhos</b>, ele morre.', 'If he loses both <b>little shields</b> he dies.'] },
          { foco: [slotFig(0, 'K'), valeteDefendido], semSetas: true, pulsar: [api => { const s = valeteDefendido(api); return s && s + ' .selo-vida'; }], fala: ['Mas tá vendo que o <b>Valete</b> também se machucou??', 'But see how the <b>Jack</b> got hurt too??'] },
          { foco: [slotFig(0, 'K'), valeteDefendido], semSetas: true, fala: ['Isso aconteceu por causa do <b>contra-ataque</b>. O contra-ataque acontece quando o número equipado no defensor é <b>maior</b> que o número equipado no atacante.', 'That happened because of the <b>counterattack</b>. A counterattack happens when the number equipped on the defender is <b>higher</b> than the number equipped on the attacker.'] },
        ] },
        // ---------- Turno 6: o Naipado, o Poder do Palhaço, a Ordem real; depois, jogo livre ----------
        esperarCompra,
        { acao: api => { api.ui().tutDadoPor = null; } },
        { foco: '#pilhas-0', permitir: [api => (idNaMao(api.jogo().jogadores[0], 'J', 'espadas') ? null : '[data-pilha="0:letras"]'), api => (idNaMao(api.jogo().jogadores[0], '3', 'espadas') ? null : '[data-pilha="0:numeros"]')],
          alvo: [api => (idNaMao(api.jogo().jogadores[0], 'J', 'espadas') ? null : '[data-pilha="0:letras"]'), api => (idNaMao(api.jogo().jogadores[0], '3', 'espadas') ? null : '[data-pilha="0:numeros"]')], compra: true,
          fala: ['Dessa vez compre uma carta <b>realeza</b> e uma <b>numérica</b>.', 'This time draw one <b>royal</b> card and one <b>number</b> card.'],
          esperar: api => api.jogo().fase !== 'compra' },
        { espera: 800 },
        { tremer: true, foco: [maoSel(0, 'J', 'espadas'), maoSel(0, '3', 'espadas')], fala: ['<b>PERFEITO!!!</b>', '<b>PERFECT!!!</b>'] },
        { foco: ['#campo-0', '#mao-0'], permitir: [maoSel(0, 'J', 'espadas'), maoSel(0, '3', 'espadas'), '#campo-0', '[data-acao^="tipo:sumonar"]'],
          alvo: api => { const ui = api.ui(), j = api.jogo().jogadores[0]; return !ui.sel.includes(idNaMao(j, 'J', 'espadas')) ? maoSel(0, 'J', 'espadas')(api) : !ui.sel.includes(idNaMao(j, '3', 'espadas')) ? maoSel(0, '3', 'espadas')(api) : '#campo-0'; },
          fala: ['Invoca esse <b>Valete</b> aí.', 'Summon that <b>Jack</b> over there.'],
          esperar: api => !!unidadeFig(api.jogo(), 0, 'J', 'espadas') },
        { espera: 1000 },
        { foco: slotFig(0, 'J', 'espadas'), fala: ['Acho que você nem percebeu, MAS ACABOU DE invocar um <b>Senhor Naipado</b>.', 'I don\'t think you even noticed, BUT YOU JUST summoned a <b>Suited Gentleman</b>.'] },
        { foco: slotFig(0, 'J', 'espadas'), fala: ['Quando a realeza e a carta numérica são do mesmo naipe, o Senhor ganha uma <b>propriedade especial</b>. No caso do Naipado de Espadas, você ganha <b>+1 de ataque</b>.', 'When the royal card and the number card share a suit, the Gentleman gets a <b>special property</b>. For the Spades Suited, you get <b>+1 attack</b>.'] },
        { foco: slotFig(0, 'J', 'espadas'), fala: () => (aoLadoDoAs(T.api.jogo(), 0, unidadeFig(T.api.jogo(), 0, 'J', 'espadas'))
          ? ['Agora você tem mais <b>2 de ataque</b>: +1 por ser Naipado e +1 por estar do lado do Ás.', 'Now you have <b>2 more attack</b>: +1 for being Suited and +1 for being next to the Ace.']
          : ['Se você fosse <b>INTELIGENTE</b> e tivesse colocado o Valete do lado do Ás, teria um bônus de <b>+2 de ataque</b>.', 'If you were <b>SMART</b> and had placed the Jack next to the Ace, you would have a <b>+2 attack</b> bonus.']) },
        { foco: '#info-0 .poder-naipe', fala: ['Tá na hora de você descobrir o que o <b>Poder de Palhaço</b> do <b>Infartitte</b> faz: ele pode <b>curar um hit</b> de um Senhor sacrificando <b>2 de PV</b> ouuu <b>dar 1 hit</b> em um inimigo sacrificando <b>4 de PV</b>.',
          'Time for you to find out what <b>Infartitte\'s</b> <b>Jester Power</b> does: he can <b>heal a hit</b> from a Gentleman by sacrificing <b>2 HP</b> orrr <b>deal 1 hit</b> to an enemy by sacrificing <b>4 HP</b>.'] },
        { semVeu: true, embaixo: true, permitir: ['#info-0 .poder-naipe', '#campo-0', '#campo-1'], alvo: api => (api.ui().pend ? null : '#info-0 .poder-naipe'),
          fala: ['Clique no naipe e faça a escolha certa!', 'Click the suit and make the right choice!'],
          esperar: api => !!api.jogo().poderUsado },
        { espera: 1300 },
        { tremer: true, fala: ['...lamentável', '...pathetic'] },
        { foco: '[data-acao="ir-ataque"]', alvo: '[data-acao="ir-ataque"]', permitir: ['[data-acao="ir-ataque"]'], fala: ['Vamos preparar o ataque, vai!', 'Let\'s prepare the attack, come on!'],
          esperar: api => api.jogo().fase === 'ataque' },
        { foco: slotFig(0, 'K'), fala: ['A habilidade única do <b>Rei</b> é que ele pode <b>escolher quem vai atacar</b>. Isso é bem bom, pra falar a verdade.', 'The <b>King\'s</b> unique ability is that he can <b>choose who he attacks</b>, which is pretty good, to be honest.'] },
        { foco: [slotFig(0, 'K'), '#campo-1'], permitir: [slotFig(0, 'K'), slotFig(1, 'J', 'copas'), slotFig(1, 'J', 'ouros')],
          alvo: api => (api.ui().miraRei != null ? (valeteDefendido(api) || slotFig(1, 'J', 'copas')(api) || slotFig(1, 'J', 'ouros')(api)) : slotFig(0, 'K')(api)),
          fala: ['Clique no <b>Rei</b> e mire o ataque nesse <b>Valete</b>.', 'Click the <b>King</b> and aim the attack at this <b>Jack</b>.'],
          esperar: api => { const k = unidadeFig(api.jogo(), 0, 'K'); return !!k && api.ui().ataques.some(a => a.atacante === k.uid); } },
        { foco: slotAs(1), fala: ['Quando tem um <b>Ás</b> no campo adversário, <b>QUALQUER SENHOR OU SENHORA PODE MIRAR NELE OU NO OPONENTE</b>.', 'When there\'s an <b>Ace</b> on the enemy field, <b>ANY LADY OR GENTLEMAN CAN AIM AT IT OR AT THE OPPONENT</b>.'] },
        { fala: ['Agora eu vou ficar quieto na minha. <b>Vença esse duelo</b>, eu sei que você não é tão burro assim.', 'I\'m going to keep quiet now, <b>win this duel</b>, I know you\'re not that dumb.'] },
        { acao: () => document.body.classList.remove('tut-sem-colinha') },
        { foco: '#acoes .colinha', alvo: '#acoes .colinha', fala: ['Se precisar de ajuda, é só clicar na <b>colinha</b>: lá tem tudo bem resumido pra você.', 'If you need some help just click the <b>crib sheet</b>, it has everything nicely summarized for you.'], botao: ['Continuar', 'Continue'] },
        { liberar: true },
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
    'Ourinhos', 'Pargias?', 'realezas?', 'Naipados?', 'Ás', 'Ases', 'totens', 'Espadas', 'Copas', 'Ouros', 'Paus', 'dados?', 'hits?', 'aç(?:ão|ões)', 'turnos?', 'Letras?', 'Números?',
    'Ímpeto', 'Ordem real', 'Atropelar', 'Mulligan', 'sacrif[ií]c(?:ios?|ar|ou|ando|ado|ados)', 'totem',
    // inglês
    'Pairgics?', 'royal', 'Suited', 'Aces?', 'totems', 'Jesters?', 'HP', 'hit points', 'Gentlem[ae]n', 'Lad(?:y|ies)', 'opponents?', 'counterattacks?', 'prepare (?:the )?attack',
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

  const T = { api: null, aula: null, passos: [], k: 0, ativo: false, pendentes: [], esperando: null, passo: null, timer: null, aoProximo: null, marcas: {}, livre: false };

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
    return [].concat(lista).flatMap(s => (typeof s === 'function' ? s(T.api) : s)).filter(Boolean)
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
    balao.classList.toggle('largo', !!p.largo);
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
    if (!T.ativo || (p.se && !p.se())) return;
    if (p.liberar) return liberar();
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
      // (o jogador demorou: o balão perde a paciência)
      const bronca = p.impaciente && setTimeout(() => { if (T.passo === p) falarDeNovo(p.impaciente.fala); }, p.impaciente.ms);
      await new Promise(r => {
        const ver = () => { if (!T.ativo || p.esperar(T.api)) { clearInterval(iv); clearTimeout(bronca); r(); } };
        const iv = setInterval(ver, 120);
        ver();
      });
      if (p.depois) await pausa(p.depois); // continua na tela um pouco depois (o jogador "tentando")
      return esconderBalao();
    }
    await new Promise(r => { T.aoProximo = () => { T.aoProximo = null; r(); }; });
  }

  // Troca o texto do balão aberto, sacudindo.
  function falarDeNovo(fala) {
    const raiz = $('#tut');
    if (!raiz) return;
    T.passo.textoAtual = tx(fala);
    raiz.querySelector('.tut-texto').innerHTML = realcar(T.passo.textoAtual);
    const balao = raiz.querySelector('.tut-balao');
    balao.classList.remove('entra', 'treme');
    void balao.offsetWidth;
    balao.classList.add('treme');
  }

  // Bronca rápida por cima de tudo (até das janelas), quando o jogador clica no que a aula não quer.
  function avisar(fala) {
    let el = $('#tut-aviso');
    if (el) el.remove();
    el = document.createElement('div');
    el.id = 'tut-aviso';
    el.innerHTML = realcar(tx(fala));
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // Fim do roteiro: a mesa fica livre e o jogador termina o duelo sozinho.
  function liberar() {
    T.livre = true;
    esconderBalao();
  }

  // Fala na parte livre: não trava a mesa, só espera o Continuar.
  function dizer(fala) {
    mostrarPasso({ fala, semVeu: true, permitir: '*', botao: ['Continuar', 'Continue'] });
    T.aoProximo = () => { T.aoProximo = null; esconderBalao(); };
  }

  // Na parte livre, a aula só reage: à Rainha que chegou na mão e à invocação que não pode.
  function vigiar() {
    if (!T.livre || T.passo) return;
    const e = T.api.jogo(), ui = T.api.ui(), j = e.jogadores[0];
    if (!T.marcas.rainha && j.mao.some(c => c.rank === 'Q')) {
      T.marcas.rainha = true;
      return dizer(AVISO_RAINHA);
    }
    if (e.vez !== 0 || e.fase !== 'principal' || e.acoes <= 0) return;
    const numeros = j.mao.filter(M.ehSacrificavel);
    if (!T.marcas.pargia && numeros.some((a, k) => numeros.some((b, i) => i > k && (a.naipe === b.naipe || a.rank === b.rank)))) {
      T.marcas.pargia = true;
      dizer(AVISO_PARGIA);
      const fim = T.aoProximo;
      T.aoProximo = () => { fim(); T.api.abrirColinha(); };
      return;
    }
    const fig = [...ui.sel, ui.arrasto && ui.arrasto.moveu && ui.arrasto.id].map(id => j.mao.find(c => c.id === id)).find(c => c && M.ehFigura(c));
    if (!fig) return;
    const senhores = j.campo.filter(u => u && u.tipo === 'senhor' && !u.sapo);
    const velhos = r => senhores.filter(u => u.figura.rank === r && u.entrou < e.turno).length, novos = senhores.some(u => u.entrou >= e.turno);
    const semSacrificio = (fig.rank === 'K' && !velhos('J')) || (fig.rank === 'Q' && !velhos('K') && velhos('J') < 2);
    if (M.podeInvocar(e, fig.rank) && !(semSacrificio && novos)) return;
    const chave = e.turno + fig.rank;
    if (T.marcas.invocar === chave) return;
    T.marcas.invocar = chave;
    dizer(AVISO_INVOCAR);
  }

  // Turno do Ourinhos na parte livre: se ainda não tem Senhor(a), invoca; depois se cura o quanto puder.
  async function jogarLivre() {
    const api = T.api, e = api.jogo();
    const invocar = () => {
      const j = e.jogadores[1], num = a => { const c = j.mao.find(x => x.id === a.numero); return c ? M.valor(c) : 0; };
      const melhor = M.acoesLegais(e).filter(x => x.tipo === 'sumonar').sort((a, b) => num(b) - num(a))[0];
      if (melhor) aplicarPerto(api, x => x.tipo === 'sumonar' && x.figura === melhor.figura && x.numero === melhor.numero);
      return !!melhor;
    };
    // (até 2 curas por turno e só abaixo do PV inicial: senão o duelo não acaba nunca)
    let curas = 0;
    const curar = () => {
      const pode = curas < 2 && e.jogadores[1].pv < M.pvInicial('ourinhos') && M.acoesLegais(e).some(x => x.tipo === 'curar');
      if (pode) { curas++; aplicarPerto(api, x => x.tipo === 'curar'); }
      return pode;
    };
    while (T.ativo && e.acoes > 0) {
      const temSenhor = e.jogadores[1].campo.some(u => u && u.tipo === 'senhor');
      if (!(temSenhor ? curar() || invocar() : invocar() || curar())) break;
      await pausa(1500);
    }
  }

  function esconderBalao() {
    T.passo = null;
    const raiz = $('#tut');
    if (raiz) raiz.classList.remove('mostrando');
  }

  // Só deixa clicar no que o passo atual permite (e no balão). Fora de um passo, a mesa fica livre
  // enquanto a interface trabalha (animações, combate…), mas os cliques do jogador são barrados.
  function filtrar(ev) {
    if (!T.ativo || T.livre) return;
    const p = T.passo;
    // (as janelas ficam livres, a não ser que o passo trave: ex. na abertura, só o botão Manter)
    if (ev.target.closest && (ev.target.closest('.tut-balao') || (ev.target.closest('#modal') && !(p && p.travarModal)))) return;
    // Cliques que a aula quer perceber (mesmo os que não fazem nada no jogo, como atacar com o Rei recém-invocado).
    if (p && p.clique && ev.type === 'pointerdown') {
      for (const c of p.clique) if (elementos(c.em).some(el => el.contains(ev.target))) c.faz(T.api);
    }
    if (p && p.permitir === '*') return;
    if (ev.target.closest && ev.target.closest('.canto-tela-cheia')) return; // (a tela cheia vale em qualquer passo)
    const ok = p && ((p.permitir && elementos(p.permitir).some(el => el.contains(ev.target))) || (p.permitirTodos && ev.target.closest(p.permitirTodos)));
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
    T.livre = false;
    clearInterval(T.timer);
    T.pendentes.forEach(g => g.liberar());
    T.pendentes = [];
    if (T.esperando) { const f = T.esperando; T.esperando = null; f(); }
    if (T.aoProximo) T.aoProximo();
    const raiz = $('#tut');
    if (raiz) raiz.remove();
    document.body.classList.remove('tut-pulsa-seta', 'tut-sem-setas', 'tut-dado', 'tut-compra', 'tut-sem-colinha');
    document.querySelectorAll('.tut-pulsa, .tut-circula').forEach(el => el.classList.remove('tut-pulsa', 'tut-circula'));
    document.querySelectorAll('.tut-destaque').forEach(el => el.classList.remove('tut-destaque'));
    if (T.api && T.api.soltarDica) T.api.soltarDica();
  }

  SS.Tutorial = {
    aula: n => AULAS[n],
    feita: n => { try { return localStorage.getItem('ss-tutorial-' + n) === '1'; } catch (e) { return false; } },
    comecar(n, api) {
      parar();
      Object.assign(T, { api, n, aula: AULAS[n], passos: AULAS[n].passos, ativo: true, pendentes: [], passo: null, marcas: {}, livre: false });
      montarDom();
      document.body.classList.add('tut-sem-colinha'); // (a colinha só aparece quando a aula fala dela)
      T.timer = setInterval(() => { posicionar(); vigiar(); }, 100);
      rodar();
    },
    parar,
    ativo: () => T.ativo,
    livre: () => T.ativo && T.livre,
    jogarLivre,
    // Fim do duelo: o tutorial acaba aqui; vencendo, conta como feito.
    concluir(venceu) {
      if (venceu) try { localStorage.setItem('ss-tutorial-' + T.n, '1'); } catch (e) { /* sem armazenamento */ }
      parar();
    },
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
