/* Idiomas do jogo: inglês (padrão) e português.
   t('chave', { parametros }) devolve o texto no idioma atual. Um texto pode ser uma string
   com {marcadores} ou uma função que recebe os parâmetros (para plurais e frases variáveis).
   A escolha do idioma fica salva no navegador. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';
  const CHAVE = 'senhora-e-senhores:idioma';
  const IDIOMAS = ['en', 'pt'];
  let atual = 'en';
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (IDIOMAS.includes(salvo)) atual = salvo;
  } catch (err) { /* sem armazenamento: fica no padrão */ }

  const s = n => (n === 1 ? '' : 's');

  const D = { pt: {}, en: {} };

  // Acrescenta textos aos dois idiomas: { chave: [português, inglês] }.
  function adicionar(tabela) {
    for (const k in tabela) {
      D.pt[k] = tabela[k][0];
      D.en[k] = tabela[k][1];
    }
  }

  // ---------- Termos básicos ----------
  adicionar({
    'carta.A': ['Ás', 'Ace'],
    'carta.J': ['Valete', 'Jack'],
    'carta.Q': ['Rainha', 'Queen'],
    'carta.K': ['Rei', 'King'],
    'carta.J.pl': ['Valetes', 'Jacks'],
    'carta.Q.pl': ['Rainhas', 'Queens'],
    'carta.K.pl': ['Reis', 'Kings'],
    'carta.face.J': ['VALETE', 'JACK'],
    'carta.face.Q': ['RAINHA', 'QUEEN'],
    'carta.face.K': ['REI', 'KING'],
    'naipe.copas': ['Copas', 'Hearts'],
    'naipe.ouros': ['Ouros', 'Diamonds'],
    'naipe.paus': ['Paus', 'Clubs'],
    'naipe.espadas': ['Espadas', 'Spades'],
    'baralho.letras': ['Letras', 'Faces'],
    'baralho.numeros': ['Números', 'Numbers'],
    'e': ['e', 'and'],
    'nivel.facil': ['Fácil', 'Easy'],
    'nivel.medio': ['Médio', 'Medium'],
    'nivel.dificil': ['Difícil', 'Hard'],
  });

  // ---------- Registro da partida (motor) ----------
  adicionar({
    'mot.resistencia': ['resistência perdida', 'lost toughness'],
    'mot.golpeado': ['golpeado', 'struck'],
    'mot.berserk': ['berserk', 'berserk'],
    'mot.hits': ['hits', 'hits'],
    'mot.sacrificio': ['sacrifício', 'sacrificed'],
    'mot.atacado': ['atacado', 'attacked'],
    'mot.fatal': ['golpe fatal', 'fatal blow'],
    'mot.fimBerserk': ['fim do berserk', 'berserk ended'],
    'log.mulligan': ['{j} fez mulligan.', '{j} took a mulligan.'],
    'log.venceu': ['{j} venceu a partida!', '{j} won the game!'],
    'log.semCartas': ['{j} não tem cartas para comprar e perde {n} PV.', '{j} has no cards to draw and loses {n} HP.'],
    'log.morreu': [p => `${p.u} de ${p.j} morreu${p.m ? ` (${p.m})` : ''}.`, p => `${p.j}'s ${p.u} died${p.m ? ` (${p.m})` : ''}.`],
    'log.hitBerserk': ['{u} levou 1 hit em berserk.', '{u} took 1 hit while berserk.'],
    'log.hit': ['{u} levou 1 hit.', '{u} took 1 hit.'],
    'log.perdeuPV': ['{j} perdeu {n} PV.', '{j} lost {n} HP.'],
    'log.ferida': ['Ferida de Copas: {j} não pode curar acima de {n} PV enquanto {u} viver.', "Hearts wound: {j} can't heal above {n} HP while {u} lives."],
    'log.vampiro': ['Ás de Copas (vampiro): {j} cura 1 PV.', 'Ace of Hearts (vampire): {j} heals 1 HP.'],
    'log.turno': ['— Turno {n}: {j} —', '— Turn {n}: {j} —'],
    'log.primeiroTurno': ['{j} começa: não compra nem ataca neste turno.', '{j} goes first: no draw and no attack this turn.'],
    'log.juros': ['Juros compostos: {j} comprou 1 Letra e 1 Número.', 'Compound Interest: {j} drew 1 Face and 1 Number.'],
    'log.comprou': ['{j} comprou do baralho de {b}.', '{j} drew from the {b} deck.'],
    'log.sacrifica': ['{j} sacrifica {us} para a Rainha.', '{j} sacrifices {us} for the Queen.'],
    'log.sumonou': [
      p => `${p.j} sumonou ${p.u} com ataque ${p.a}${p.nai ? ` — Naipado de ${p.nai}!` : '.'}`,
      p => `${p.j} summoned ${p.u} with attack ${p.a}${p.nai ? ` — Suited ${p.nai}!` : '.'}`,
    ],
    'log.invocouAs': [
      p => `${p.j} invocou o ${p.as} sacrificando ${p.c}${p.emp ? ' e empurrou as cartas para o lado' : ''}.`,
      p => `${p.j} summoned the ${p.as} by sacrificing ${p.c}${p.emp ? ' and pushed the cards aside' : ''}.`,
    ],
    'log.desafio': ['{j} usa Desafio!: {u} terá de bloquear o primeiro ataque.', '{j} uses Challenge!: {u} must block the first attack.'],
    'log.transfusao': ['{j} usa Transfusão: paga {n} PV e tira 1 hit de {u}.', '{j} uses Transfusion: pays {n} HP and removes 1 hit from {u}.'],
    'log.vigilia': ['{j} usa Vigília: {u} não vira para baixo no fim do turno.', "{j} uses Vigil: {u} won't flip face down at the end of the turn."],
    'log.curou': ['{j} usou {c} e curou {n} PV.', '{j} used {c} and healed {n} HP.'],
    'log.espadas': ['{j} usou {c}: {u} ganha +1 de ataque (crítico no 6: +{n}).', '{j} used {c}: {u} gets +1 attack (critical on a 6: +{n}).'],
    'log.paus': ['{j} usou {c}: {u} entra em berserk.', '{j} used {c}: {u} goes berserk.'],
    'log.ourosCompra': ['{j} gastou 1 Ouros para comprar 1 carta de {b}.', '{j} spent 1 Diamond to draw 1 {b} card.'],
    'log.reviver': ['{j} gastou 2 Ouros e recuperou {c} do cemitério.', '{j} spent 2 Diamonds and recovered {c} from the graveyard.'],
    'log.naoAtacou': ['{j} não atacou.', "{j} didn't attack."],
    'log.declara': [
      p => `Ataque ${p.n}: ${p.u} → ${p.alvo}${p.d > 1 ? ` (${p.d} dados)` : ''}.`,
      p => `Attack ${p.n}: ${p.u} → ${p.alvo}${p.d > 1 ? ` (${p.d} dice)` : ''}.`,
    ],
    'log.desafioBloqueio': ['Desafio!: {u} é obrigado(a) a bloquear o ataque {n}.', 'Challenge!: {u} is forced to block attack {n}.'],
    'log.bloqueado': ['Ataque {n} bloqueado por {us}.', 'Attack {n} blocked by {us}.'],
    'log.cancelado': ['Ataque {n} cancelado: o atacante não está mais em campo.', 'Attack {n} cancelled: the attacker is no longer on the field.'],
    'log.rolou': [
      p => `Ataque ${p.n}: ${p.u} rolou ${p.r} → ${p.cheio ? 'ataque total' : 'meio ataque'}${p.crit ? ' com crítico de Espadas' : ''}: ${p.d} de dano.`,
      p => `Attack ${p.n}: ${p.u} rolled ${p.r} → ${p.cheio ? 'full attack' : 'half attack'}${p.crit ? ' with a Spades critical' : ''}: ${p.d} damage.`,
    ],
    'log.alvoSumiu': ['O alvo já não está em campo.', 'The target is no longer on the field.'],
    'log.casca': ['Casca grossa: o dano em {u} cai para {n}.', 'Thick Bark: damage to {u} drops to {n}.'],
    'log.ignorou': ['{u} ignorou o golpe (dano menor que metade do seu ataque).', '{u} shrugged off the blow (damage below half its attack).'],
    'log.atropelar': ['Atropelar! {n} de dano passa para {j}.', 'Trample! {n} damage goes through to {j}.'],
    'log.contra': ['Contra-ataque! {u} leva 1 hit.', 'Counterattack! {u} takes 1 hit.'],
    'log.vigiliaPe': ['Vigília: {u} continua de pé.', 'Vigil: {u} stays up.'],
    'log.fimBerserk': ['O berserk de {u} acabou.', "{u}'s berserk ended."],
    'log.descartou': [p => `${p.j} descartou ${p.n} carta${s(p.n)} pelo limite de mão.`, p => `${p.j} discarded ${p.n} card${s(p.n)} for the hand limit.`],
    'log.desistiu': ['{j} desistiu da partida.', '{j} resigned.'],
  });

  // ---------- Montagem de deck (validação) ----------
  adicionar({
    'deck.erroLetras': ['O baralho de Letras precisa ter exatamente {a} figuras (tem {b}).', 'The Faces deck must have exactly {a} face cards (it has {b}).'],
    'deck.erroNumeros': ['O baralho de Números precisa ter exatamente {a} cartas (tem {b}).', 'The Numbers deck must have exactly {a} cards (it has {b}).'],
    'deck.erroCopias': ['{c}: no máximo {a} cópias (tem {b}).', '{c}: at most {a} copies (it has {b}).'],
    'deck.erroFigura': ['No máximo {a} {f} (tem {b}).', 'At most {a} {f} (it has {b}).'],
    'deck.erroAses': ['No máximo {a} Ases (tem {b}).', 'At most {a} Aces (it has {b}).'],
    'deck.erroSoma': ['A soma dos números passou do orçamento: {a} de {b}.', 'The numbers go over the power budget: {a} of {b}.'],
    'deck.erroFigNaipe': ['No máximo {a} figuras de {n} (tem {b}).', 'At most {a} {n} face cards (it has {b}).'],
    'deck.erroNumNaipe': ['No máximo {a} números de {n} (tem {b}).', 'At most {a} {n} number cards (it has {b}).'],
  });

  // ---------- Interface: poderes, efeitos e estados das cartas ----------
  adicionar({
    'fig.J': ['Valete — Ímpeto: ataca no mesmo turno em que entra. Só equipa números de 2 a 5.',
      'Jack — Haste: attacks on the same turn it enters. Only equips numbers 2 to 5.'],
    'fig.Q': ['Rainha — Atropelar: se matar quem bloqueou, o dano que sobra (dano − ataque do bloqueador) vai para o PV do oponente. Para entrar: 1 ação e o sacrifício de 2 Senhores seus que já estavam em campo antes deste turno.',
      "Queen — Trample: if she kills the blocker, the leftover damage (damage − blocker's attack) goes to the opponent's HP. To enter: 1 action and sacrifice 2 of your Lords that were already on the field before this turn."],
    'fig.K': ['Rei — Ordem real: ao atacar, pode escolher como alvo um Senhor(a) inimigo. Esse ataque não pode ser bloqueado por outro: o alvo se defende sozinho. Só equipa números de 2 a 7.',
      'King — Royal Order: when attacking, may target an enemy Lord. That attack cannot be blocked by anyone else: the target defends alone. Only equips numbers 2 to 7.'],
    'naipado.paus': ['Aguenta 3 hits (4 se estiver ao lado de um Ás de Paus).', 'Takes 3 hits (4 next to an Ace of Clubs).'],
    'naipado.espadas': ['+1 de ataque fixo.', '+1 permanent attack.'],
    'naipado.copas': ['Ferida: depois que ele(a) causa dano no PV do oponente, o oponente não pode curar acima do PV que ficou, enquanto ele(a) viver.',
      "Wound: after it deals damage to the opponent's HP, the opponent can't heal above the HP left, while it lives."],
    'naipado.ouros': ['Ataca 2 vezes por turno.', 'Attacks twice per turn.'],
    'as.paus': ['Senhores vizinhos ganham +1 de resistência (passam a aguentar 3 hits).', 'Neighboring Lords get +1 toughness (they take 3 hits).'],
    'as.espadas': ['Senhores vizinhos ganham +1 de ataque fixo.', 'Neighboring Lords get +1 permanent attack.'],
    'as.ouros': ['Vale 1 carta de Ouros extra por turno (comprar, reviver ou dado extra).', 'Counts as 1 extra Diamond card per turn (draw, revive or extra die).'],
    'as.copas': ['Vampiro: quando um Senhor(a) vizinho causa dano ao PV do oponente, você cura 1 PV.', "Vampire: when a neighboring Lord deals damage to the opponent's HP, you heal 1 HP."],
    'efeito.copas': ['Usada sozinha (1 ação): cura {cura} PV (pode passar de {pv}).', 'Played alone (1 action): heals {cura} HP (can go above {pv}).'],
    'efeito.espadas': ['Usada sozinha (1 ação): +1 de ataque a um Senhor(a) seu neste turno. Se o dado do ataque der 6, o bônus vira +{crit} (crítico).',
      'Played alone (1 action): +1 attack to one of your Lords this turn. If the attack die shows 6, the bonus becomes +{crit} (critical).'],
    'efeito.paus': ['Usada sozinha (1 ação): um Senhor(a) ferido(a) entra em berserk e volta à vertical até o fim do próximo turno do oponente. Se levar 1 hit nesse período, morre quando o efeito acabar.',
      "Played alone (1 action): a wounded Lord goes berserk and stands upright until the end of the opponent's next turn. If it takes 1 hit meanwhile, it dies when the effect ends."],
    'efeito.ouros': ['Usada sozinha (1 ação): descarte 1 Ouros para comprar 1 carta (do baralho que escolher), ou 2 Ouros para recuperar 1 carta do cemitério. No ataque, cada Ouros dá +1 dado (vale o maior).',
      'Played alone (1 action): discard 1 Diamond to draw 1 card (from the deck you choose), or 2 Diamonds to recover 1 card from the graveyard. When attacking, each Diamond gives +1 die (the highest counts).'],
    'postura.vertical': ['saudável (vertical)', 'healthy (upright)'],
    'postura.diagonal': ['ferido(a), mas ainda aguenta mais de 1 hit (diagonal)', 'wounded, but can still take more than 1 hit (diagonal)'],
    'postura.horizontal': ['ferido(a): o próximo hit mata (horizontal)', 'wounded: the next hit kills (sideways)'],
  });

  // ---------- Interface: ações da mão e instruções ----------
  adicionar({
    'acao.rainha': ['♛ Sumonar Rainha ({n} sacrifícios)', '♛ Summon Queen ({n} sacrifices)'],
    'acao.sumonar': ['⚔ Sumonar', '⚔ Summon'],
    'acao.as': ['✦ Invocar Ás', '✦ Summon Ace'],
    'acao.curar': ['♥ Curar {n} PV', '♥ Heal {n} HP'],
    'acao.espadas': ['♠ +1 de ataque', '♠ +1 attack'],
    'acao.paus': ['♣ Berserk', '♣ Berserk'],
    'acao.comprarLetra': ['♦ Comprar uma Letra', '♦ Draw a Face'],
    'acao.comprarNumero': ['♦ Comprar um Número', '♦ Draw a Number'],
    'acao.reviver': ['♦♦ Reviver do cemitério', '♦♦ Revive from graveyard'],
    'dica.semAcoes': ['Suas ações deste turno acabaram.', 'You have no actions left this turn.'],
    'dica.limiteFigura': ['{c} só pode ser equipado(a) com cartas de 2 a {n}.', '{c} can only equip cards from 2 to {n}.'],
    'dica.rainhaSacrificio': ['A Rainha precisa sacrificar {n} Senhores seus que já estavam em campo antes deste turno.', 'The Queen needs to sacrifice {n} of your Lords that were already on the field before this turn.'],
    'dica.rainhaSemSenhores': ['A Rainha precisa de {n} Senhores seus em campo desde o turno anterior para sacrificar.', 'The Queen needs {n} of your Lords on the field since last turn to sacrifice.'],
    'dica.fileiraCheia': ['Sua fileira está cheia.', 'Your row is full.'],
    'dica.asMesmoNaipe': ['Para invocar o Ás, sacrifique uma carta numérica do mesmo naipe.', 'To summon the Ace, sacrifice a number card of the same suit.'],
    'dica.selecioneNumero': ['Selecione também uma carta numérica (2 a 10) para sumonar.', 'Also select a number card (2 to 10) to summon.'],
    'dica.selecioneNumeroAs': ['Selecione também uma carta numérica do mesmo naipe para invocar o Ás.', 'Also select a number card of the same suit to summon the Ace.'],
    'dica.nenhumaAcao': ['Nenhuma ação com essa seleção.', 'No action with this selection.'],
    'passo.slot': ['Clique num espaço livre da sua fileira.', 'Click an empty slot in your row.'],
    'passo.slotAs': ['Clique num espaço livre, ou numa carta para colocar o Ás no lugar dela (as cartas são empurradas para o lado).', 'Click an empty slot, or a card to put the Ace in its place (the cards are pushed aside).'],
    'passo.sacrificios': ['Clique nos {total} Senhores que serão sacrificados para a Rainha ({n}/{total}).', 'Click the {total} Lords to sacrifice for the Queen ({n}/{total}).'],
    'passo.espadas': ['Clique no Senhor(a) que recebe +1 de ataque neste turno.', 'Click the Lord that gets +1 attack this turn.'],
    'passo.paus': ['Clique no Senhor(a) ferido(a) que entra em berserk.', 'Click the wounded Lord that goes berserk.'],
    'passo.poder': ['{nome} — {texto} Clique no alvo.', '{nome} — {texto} Click the target.'],
  });

  // ---------- Interface: caixas de dica ----------
  adicionar({
    'dc.figura': ['Figura', 'Face card'],
    'dc.figuraComo': ['Junte com 1 carta numérica para sumonar um Senhor(a). O número define o ataque.', 'Pair it with 1 number card to summon a Lord. The number sets the attack.'],
    'dc.figuraNaipado': ['Com um número de {n}, vira Naipado(a) de {n}: {poder}', 'With a {n} number, it becomes a Suited {n} Lord: {poder}'],
    'dc.totem': ['Totem de suporte', 'Support totem'],
    'dc.asInvocar': ['Para invocar (1 ação): sacrifique 1 carta numérica de {n}.', 'To summon (1 action): sacrifice 1 {n} number card.'],
    'dc.asOcupa': ['Ocupa um espaço da fileira, não ataca, não bloqueia e morre com 1 golpe.', "Takes a slot in the row, doesn't attack, doesn't block and dies to 1 hit."],
    'dc.numero': ['Carta numérica de {n}', '{n} number card'],
    'dc.numeroAtaque': ['Equipada numa figura: ataque {v}.', 'Equipped on a face card: attack {v}.'],
    'dc.asNaoAtaca': ['Não ataca, não bloqueia e morre com 1 golpe.', "Doesn't attack, doesn't block and dies to 1 hit."],
    'dc.asAlvo': ['Pode ser alvo de ataques; um Senhor(a) do dono pode bloquear para protegê-lo.', "Can be attacked; one of its owner's Lords can block to protect it."],
    'du.numero': ['número {v}', 'number {v}'],
    'du.naipadoEspadas': ['+1 Naipado de Espadas', '+1 Suited Spades'],
    'du.asEspadas': ['+1 Ás de Espadas vizinho', '+1 neighboring Ace of Spades'],
    'du.bonusEspadas': ['+{n} Espadas neste turno (no 6: +{crit})', '+{n} Spades this turn (on a 6: +{crit})'],
    'du.naipadoPaus': ['Naipado de Paus', 'Suited Clubs'],
    'du.asPaus': ['Ás de Paus vizinho', 'neighboring Ace of Clubs'],
    'du.ataque': ['<b>Ataque {a}</b>: {partes}.', '<b>Attack {a}</b>: {partes}.'],
    'du.berserk': [
      p => `<b>Berserk</b>: está na vertical até o fim do turno do oponente. ${p.levou ? 'Já levou 1 hit: morre quando o efeito acabar.' : 'Se levar 1 hit nesse período, morre quando o efeito acabar.'}`,
      p => `<b>Berserk</b>: stands upright until the end of the opponent's turn. ${p.levou ? 'Already took 1 hit: dies when the effect ends.' : 'If it takes 1 hit meanwhile, it dies when the effect ends.'}`,
    ],
    'du.vida': ['<b>Vida</b>: {v} de {r} hits{fontes}. Estado: {estado}.', '<b>Life</b>: {v} of {r} hits{fontes}. State: {estado}.'],
    'du.naipado': ['<b>Naipado de {n}</b>: {poder}', '<b>Suited {n}</b>: {poder}'],
    'du.asCopas': ['Ás de Copas vizinho: se causar dano ao PV do oponente, o dono cura 1 PV.', "Neighboring Ace of Hearts: if it damages the opponent's HP, its owner heals 1 HP."],
    'du.vigilia': ['<b>Vigília</b> (Paumol): não vira para baixo no fim deste turno.', "<b>Vigil</b> (Paumol): won't flip face down at the end of this turn."],
    'du.desafiado': ['<b>Desafiado</b> (Lançalotte): terá de bloquear o primeiro ataque.', '<b>Challenged</b> (Lançalotte): must block the first attack.'],
    'du.atacou': ['Já atacou neste turno: vira para baixo no fim do turno.', 'Already attacked this turn: flips face down at the end of the turn.'],
    'du.desativado': ['<b>Desativado</b> (virado): atacou e não pode bloquear até o próximo turno do dono.', "<b>Exhausted</b> (face down): it attacked and can't block until its owner's next turn."],
    'du.pronto': [p => `Pronto para atacar${p.n > 1 ? ` (${p.n} vezes)` : ''}.`, p => `Ready to attack${p.n > 1 ? ` (${p.n} times)` : ''}.`],
    'du.entrou': ['Entrou neste turno: só ataca no próximo.', 'Entered this turn: can only attack next turn.'],
    'du.regraBloqueio': ['Ao bloquear: dano menor que metade do ataque dele é ignorado; dano maior que o ataque dele mata na hora.', 'When blocking: damage below half its attack is ignored; damage above its attack kills it outright.'],
    'du.subNaipado': ['Senhor(a) Naipado(a) de {n}', 'Suited {n} Lord'],
    'du.sub': ['Senhor(a)', 'Lord'],
    'dp.tokenTitulo': ['Ouros extra', 'Extra Diamond'],
    'dp.tokenSub': ['Ás de Ouros', 'Ace of Diamonds'],
    'dp.token': ['Vale 1 carta de Ouros neste turno: selecione junto com outras cartas para comprar, reviver ou dar +1 dado num ataque.', 'Counts as 1 Diamond card this turn: select it with other cards to draw, revive or give +1 die to an attack.'],
    'dp.passivaDe': ['Passiva de {n}', "{n}'s passive"],
    'dp.semPoder': ['Este Palhaço não tem poder ativo.', 'This Jester has no active power.'],
    'dp.poderDe': ['Poder de {n} · 1 ação · 1 vez por turno', "{n}'s power · 1 action · once per turn"],
    'dp.passiva': ['<b>Passiva — {nome}:</b> {texto}', '<b>Passive — {nome}:</b> {texto}'],
    'dp.poder': ['<b>Poder — {nome}</b> (1 ação, 1 vez por turno): {texto}', '<b>Power — {nome}</b> (1 action, once per turn): {texto}'],
    'dp.estado': ['<b>{pv} PV</b> · mão: {mao} · Letras: {l} · Números: {n} · cemitério: {c}.', '<b>{pv} HP</b> · hand: {mao} · Faces: {l} · Numbers: {n} · graveyard: {c}.'],
    'dp.ferida': ['Ferida de Copas: só pode curar até {n} PV enquanto o Naipado de Copas inimigo viver.', 'Hearts wound: can only heal up to {n} HP while the enemy Suited Hearts Lord lives.'],
    'dp.palhaco': ['Palhaço {n}', 'Jester {n}'],
    'dp.baralho': ['Baralho de {b}', '{b} deck'],
    'dp.restantes': [p => `${p.n} carta${s(p.n)} restante${s(p.n)}.`, p => `${p.n} card${s(p.n)} left.`],
    'dp.soFiguras': ['Só figuras: Valete, Rainha e Rei.', 'Face cards only: Jack, Queen and King.'],
    'dp.soNumeros': ['Só números: Ás a 10.', 'Numbers only: Ace to 10.'],
    'dp.cemiterio': ['{n} cartas. Clique para ver todas.', '{n} cards. Click to see them all.'],
    'ui.cemiterio': ['Cemitério', 'Graveyard'],
  });

  // ---------- Interface: mesa, chips, faixa central ----------
  adicionar({
    'tag.ataque': ['{n}º ataque', 'attack #{n}'],
    'tag.bloqueia': ['bloqueia {n}º', 'blocks #{n}'],
    'ui.voce': ['você', 'you'],
    'ui.usado': ['usado', 'used'],
    'ui.umaAcao': ['1 ação', '1 action'],
    'ui.passiva': ['passiva', 'passive'],
    'ui.pontosVida': ['Pontos de vida', 'Hit points'],
    'ui.feridaCopas': ['Ferida de Copas', 'Hearts wound'],
    'ui.curaAte': ['cura até {n}', 'heals up to {n}'],
    'ui.totem': ['Totem', 'Totem'],
    'ui.acoesPassivas': ['Ações passivas', 'Passive actions'],
    'ui.vezDe': ['vez de {j}', "{j}'s turn"],
    'chip.foraDeCampo': ['(fora de campo)', '(off the field)'],
    'chip.resultado': [' · dado {r} → {d} de dano', ' · die {r} → {d} damage'],
    'chip.ordem': ['{n}º', '#{n}'],
    'chip.direto': ['direto, sem bloqueio', 'direct, unblockable'],
    'chip.dados': ['{n} dados', '{n} dice'],
    'chip.antes': ['Atacar antes', 'Attack earlier'],
    'chip.depois': ['Atacar depois', 'Attack later'],
    'chip.devolverOuros': ['Devolver o Ouros', 'Return the Diamond'],
    'chip.gastarOuros': ['Gastar 1 Ouros: +1 dado (vale o maior)', 'Spend 1 Diamond: +1 die (the highest counts)'],
    'chip.maisDado': ['+ dado', '+ die'],
    'chip.cancelar': ['Cancelar este ataque', 'Cancel this attack'],
    'faixa.turno': ['Turno {n} · vez de {j}', "Turn {n} · {j}'s turn"],
    'faixa.fim': ['Fim de jogo', 'Game over'],
    'faixa.venceu': ['{j} venceu!', '{j} wins!'],
    'faixa.abertura': ['Abertura', 'Opening'],
    'faixa.escolhendoMaos': ['Escolhendo as mãos iniciais…', 'Choosing starting hands…'],
    'faixa.compra': ['Compra', 'Draw'],
    'faixa.compreUma': [
      p => `<b>Compre 1 carta:</b> clique num dos seus baralhos pulsando (embaixo, à direita). Letras traz figuras, Números traz Ás a 10. Na mão: ${p.f} figura${s(p.f)} e ${p.n} número${s(p.n)}.`,
      p => `<b>Draw 1 card:</b> click one of your pulsing decks (bottom right). Faces gives face cards, Numbers gives Ace to 10. In hand: ${p.f} face card${s(p.f)} and ${p.n} number${s(p.n)}.`,
    ],
    'faixa.botComprando': ['{j} está escolhendo de qual baralho comprar…', '{j} is choosing which deck to draw from…'],
    'faixa.botJogando': ['{j} está jogando…', '{j} is playing…'],
    'faixa.escolhaAcao': ['Escolha o que fazer com a seleção.', 'Choose what to do with the selection.'],
    'faixa.comoJogar': ['Clique nas cartas da mão: 1 figura + 1 número para sumonar, ou 1 número para usar o efeito do naipe. Passe o mouse para ver o que cada carta faz.',
      'Click cards in your hand: 1 face card + 1 number to summon, or 1 number to use its suit effect. Hover to see what each card does.'],
    'faixa.semAcoes': ['Suas ações acabaram. Vá para o ataque.', 'No actions left. Go to attack.'],
    'faixa.ataque': ['Ataque', 'Attack'],
    'faixa.dicaAs': ['para atacar um Ás, arraste até ele', 'to attack an Ace, drag onto it'],
    'faixa.dicaRei': ['o Rei pode ser arrastado até um Senhor(a) inimigo (esse ataque não pode ser bloqueado)', 'the King can be dragged onto an enemy Lord (that attack cannot be blocked)'],
    'faixa.primeiroNaoAtaca': ['Quem começa não ataca no primeiro turno.', "The first player can't attack on the first turn."],
    'faixa.ninguemApto': ['Nenhum Senhor(a) apto(a) a atacar.', 'No Lord is ready to attack.'],
    'faixa.comoAtacar': [
      p => `Clique nos Senhores brilhando para atacar o oponente (clique de novo para desfazer)${p.extra ? '. Dica: ' + p.extra : ''}. A ordem abaixo é a ordem dos ataques (◀ ▶ muda).`,
      p => `Click your glowing Lords to attack the opponent (click again to undo)${p.extra ? '. Tip: ' + p.extra : ''}. The order below is the attack order (◀ ▶ changes it).`,
    ],
    'faixa.ataquesDeclarados': ['Ataques declarados. Ajuste a ordem e confirme.', 'Attacks declared. Adjust the order and confirm.'],
    'faixa.botDeclarando': ['{j} está declarando ataques…', '{j} is declaring attacks…'],
    'faixa.bloqueio': ['Bloqueio', 'Block'],
    'faixa.solteBloqueio': ['Arraste a seta até o atacante que ele(a) vai bloquear e solte. Esc cancela.', "Drag the arrow onto the attacker it will block and release. Esc cancels."],
    'faixa.comoBloquear': ['Arraste de um Senhor(a) seu ativo até um atacante para bloquear. Ataque sem bloqueio vai direto no seu PV.', 'Drag from one of your ready Lords onto an attacker to block. Unblocked attacks hit your HP directly.'],
    'faixa.desafio': ['<b>Desafio!</b> {u} é obrigado(a) a bloquear o primeiro ataque.', '<b>Challenge!</b> {u} is forced to block the first attack.'],
    'faixa.botBloqueando': ['{j} está decidindo os bloqueios…', '{j} is deciding blocks…'],
    'faixa.combate': ['Combate', 'Combat'],
    'faixa.descarte': ['Limite de {n} cartas na mão: descarte o excesso.', 'Hand limit of {n} cards: discard the extra.'],
    'btn.cancelar': ['Cancelar', 'Cancel'],
    'btn.cancelarSelecao': ['Cancelar seleção', 'Clear selection'],
    'btn.irAtaque': ['⚔ Ir para o ataque', '⚔ Go to attack'],
    'btn.confirmarAtaques': [p => `Confirmar ${p.n} ataque${s(p.n)}`, p => `Confirm ${p.n} attack${s(p.n)}`],
    'btn.encerrarSemAtacar': ['Encerrar sem atacar', 'End without attacking'],
    'btn.encerrarTurno': ['Encerrar turno', 'End turn'],
    'btn.confirmarBloqueios': ['Confirmar bloqueios', 'Confirm blocks'],
    'btn.limpar': ['Limpar', 'Clear'],
  });

  // ---------- Interface: pop-ups, janelas, menu, simulação ----------
  adicionar({
    'selo.morreu': ['✖ morreu', '✖ died'],
    'selo.hit': ['+1 hit', '+1 hit'],
    'selo.ileso': ['sem dano', 'no damage'],
    'selo.contra': ['(contra-ataque)', '(counterattack)'],
    'duelo.bloqueadoPor': ['bloqueado por', 'blocked by'],
    'duelo.atropelar': ['Atropelar!', 'Trample!'],
    'duelo.alvo': ['alvo', 'target'],
    'duelo.direto': ['Ataque direto', 'Direct attack'],
    'duelo.topo': ['{n}º ataque de {total}', 'Attack {n} of {total}'],
    'duelo.dados': ['{n} dados (vale o maior)', '{n} dice (the highest counts)'],
    'duelo.golpe': ['Golpe certeiro: +{n} de ataque', 'True Strike: +{n} attack'],
    'btn.continuar': ['Continuar ▸', 'Continue ▸'],
    'ui.ouEnter': ['ou Enter', 'or Enter'],
    'ui.oponente': ['oponente', 'opponent'],
    'inicio.comeca': ['começa', 'goes first'],
    'inicio.quem': ['Quem começa?', 'Who goes first?'],
    'inicio.mesmaCor': ['Os dois Palhaços são da mesma cor: cada um rolou um dado e começa quem tirou mais.', 'Both Jesters are the same color: each rolled a die and the higher roll goes first.'],
    'inicio.preto': ['Palhaço preto (♠ ♣) começa contra Palhaço vermelho (♥ ♦).', 'A black Jester (♠ ♣) goes first against a red Jester (♥ ♦).'],
    'anuncio.vaiAtacar': [
      p => `${p.j} vai atacar ${p.n > 1 ? `com ${p.n} ataques, nesta ordem` : ''}`,
      p => `${p.j} attacks${p.n > 1 ? ` with ${p.n} attacks, in this order` : ''}`,
    ],
    'ab.escolha': ['Escolha {n} figuras para a sua mão inicial', 'Choose {n} face cards for your starting hand'],
    'ab.nota': ['Passe o mouse em cima de uma carta para ver o que ela faz. Depois você compra 4 cartas do baralho de Números.', 'Hover over a card to see what it does. Then you draw 4 cards from the Numbers deck.'],
    'btn.confirmar': ['Confirmar', 'Confirm'],
    'ab.suaMao': ['Sua mão inicial', 'Your starting hand'],
    'ab.mulliganNota': ['Mulligan (uma vez): devolve as 4 cartas compradas, embaralha e compra 3. As figuras escolhidas ficam.', 'Mulligan (once): return the 4 drawn cards, shuffle and draw 3. The chosen face cards stay.'],
    'ab.manter': ['Manter mão', 'Keep hand'],
    'desc.titulo': [p => `Limite de mão: descarte ${p.n} carta${s(p.n)}`, p => `Hand limit: discard ${p.n} card${s(p.n)}`],
    'desc.btn': ['Descartar', 'Discard'],
    'cem.reviver': ['Reviver: escolha uma carta do cemitério', 'Revive: choose a card from the graveyard'],
    'cem.de': ['Cemitério de {j}', "{j}'s graveyard"],
    'cem.vazio': ['Vazio.', 'Empty.'],
    'btn.fechar': ['Fechar', 'Close'],
    'btn.voltar': ['Voltar', 'Back'],
    'log.inicioDados': ['Os dois Palhaços são da mesma cor: {a} rolou {da} e {b} rolou {db}. {j} começa.', 'Both Jesters are the same color: {a} rolled {da} and {b} rolled {db}. {j} goes first.'],
    'log.inicioPreto': ['{j} tem Palhaço preto e começa.', '{j} has a black Jester and goes first.'],
    'log.semBloqueadores': ['{j} não tem Senhores ativos para bloquear.', '{j} has no ready Lords to block.'],
    'log.reiNaoBloqueia': ['Ataques do Rei contra Senhores não podem ser bloqueados.', "The King's attacks against Lords can't be blocked."],
    'fim.vitoria': ['Vitória!', 'Victory!'],
    'fim.derrota': ['Derrota', 'Defeat'],
    'fim.turno': ['Partida encerrada no turno {n}.', 'Match ended on turn {n}.'],
    'fim.denovo': ['Jogar de novo', 'Play again'],
    'fim.ver': ['Ver a mesa', 'View the table'],
    'fim.menu': ['Menu', 'Menu'],
    'conf.encerrarTitulo': ['Encerrar esta partida?', 'End this match?'],
    'conf.encerrarNota': ['A partida entre os bots termina agora.', 'The bot match ends now.'],
    'conf.encerrarBtn': ['Encerrar', 'End'],
    'conf.desistirTitulo': ['Desistir da partida?', 'Concede the match?'],
    'conf.desistirNota': ['O oponente vence e a partida termina agora.', 'Your opponent wins and the match ends now.'],
    'conf.desistirBtn': ['Desistir', 'Concede'],
    'conf.continuar': ['Continuar jogando', 'Keep playing'],
    'conf.reiniciarTitulo': ['Reiniciar a partida?', 'Restart the match?'],
    'conf.reiniciarNota': ['Começa uma partida nova com as mesmas opções.', 'Starts a new match with the same options.'],
    'conf.reiniciarBtn': ['Reiniciar', 'Restart'],
    'conf.menuTitulo': ['Abandonar a partida?', 'Leave the match?'],
    'conf.menuBtn': ['Ir para o menu', 'Go to menu'],
    'menu.deckPalhaco': ['Deck do Palhaço', "Jester's deck"],
    'menu.passiva': ['Passiva:', 'Passive:'],
    'menu.poder': ['Poder:', 'Power:'],
    'menu.aleatorio': ['Aleatório', 'Random'],
    'menu.sub': ['Protótipo · Regras v2', 'Prototype · Rules v2'],
    'menu.escolhaPalhaco': ['Escolha seu Palhaço', 'Choose your Jester'],
    'menu.notaInicio': ['Palhaço preto (♠ ♣) começa contra vermelho (♥ ♦). Dois da mesma cor: ganha quem tirar o dado maior.', 'A black Jester (♠ ♣) goes first against a red one (♥ ♦). Same color: the higher die roll goes first.'],
    'menu.palhacoBot': ['Palhaço do bot', "Bot's Jester"],
    'menu.dificuldade': ['Dificuldade do bot', 'Bot difficulty'],
    'menu.seuDeck': ['Seu deck', 'Your deck'],
    'menu.deckTematico': ['Deck temático de {p}: {plano}', "{p}'s themed deck: {plano}"],
    'menu.monteDecks': ['Monte seus decks em "Montar decks" para escolher aqui.', 'Build your decks in "Build decks" to choose them here.'],
    'menu.jogar': ['Jogar contra o bot', 'Play against the bot'],
    'menu.assistir': ['Assistir bot × bot', 'Watch bot vs bot'],
    'menu.decks': ['Montar decks', 'Build decks'],
    'menu.regras': ['Regras do jogo', 'Game rules'],
    'menu.simular': ['Simular partidas', 'Simulate matches'],
    'sim.titulo': ['Simular partidas (bot × bot)', 'Simulate matches (bot vs bot)'],
    'sim.nota': ['Roda partidas completas sem animação para testar o equilíbrio das regras.<br>Os Palhaços se enfrentam em rodízio, cada um com o seu deck, e quem começa segue a regra do jogo. O nível Difícil é bem mais lento.',
      'Runs full matches without animation to test the balance of the rules.<br>The Jesters face each other in rotation, each with their own deck, and who goes first follows the game rule. Hard level is much slower.'],
    'sim.partidas': ['Partidas', 'Matches'],
    'sim.vitBot': ['Vitórias do Bot {b} ({n})', 'Bot {b} wins ({n})'],
    'sim.porPalhaco': ['<b>Vitórias por Palhaço</b> (cada um com o seu deck)', '<b>Wins per Jester</b> (each with their own deck)'],
    'sim.primeiro': ['Quem começou venceu', 'First player won'],
    'sim.mediaTurnos': ['Média de turnos', 'Average turns'],
    'sim.empates': ['Sem vencedor (limite de 200 turnos)', 'No winner (200-turn limit)'],
    'sim.erros': ['Partidas com erro', 'Matches with errors'],
    'sim.rodando': ['Rodando…', 'Running…'],
    'sim.rodar': ['Rodar', 'Run'],
  });

  // ---------- Montar decks, barra do painel, dado ----------
  adicionar({
    'btn.voltarMenu': ['Voltar ao menu', 'Back to menu'],
    'dk.padrao': ['Deck padrão', 'Default deck'],
    'dk.salvo': ['Salvo automaticamente', 'Saved automatically'],
    'dk.naoSalvo': ['Não foi possível salvar neste navegador', "Couldn't save in this browser"],
    'dk.celula': ['clique: +1 · botão direito: −1', 'click: +1 · right-click: −1'],
    'dk.regrasLimite': ['Regras de limite', 'Deck limits'],
    'dk.rLetras': ['Letras: exatamente <b>{n}</b> figuras <em>({v})</em>', 'Faces: exactly <b>{n}</b> face cards <em>({v})</em>'],
    'dk.rNumeros': ['Números: exatamente <b>{n}</b> cartas <em>({v})</em>', 'Numbers: exactly <b>{n}</b> cards <em>({v})</em>'],
    'dk.rSoma': ['Orçamento de poder: a soma dos números (Ás = 1) vai até <b>{n}</b> <em>({v})</em>', 'Power budget: the sum of the numbers (Ace = 1) goes up to <b>{n}</b> <em>({v})</em>'],
    'dk.rFiguras': ['No máximo <b>{j}</b> Valetes, <b>{q}</b> Rainhas e <b>{k}</b> Reis <em>({v})</em>', 'At most <b>{j}</b> Jacks, <b>{q}</b> Queens and <b>{k}</b> Kings <em>({v})</em>'],
    'dk.rCopiasFig': ['Até <b>{n}</b> cópias da mesma figura e naipe', 'Up to <b>{n}</b> copies of the same face card and suit'],
    'dk.rCopiasNum': ['Até <b>{n}</b> cópias do mesmo número e naipe', 'Up to <b>{n}</b> copies of the same number and suit'],
    'dk.rAses': ['No máximo <b>{n}</b> Ases <em>({v})</em>', 'At most <b>{n}</b> Aces <em>({v})</em>'],
    'dk.rFigNaipe': ['No máximo <b>{n}</b> figuras de um mesmo naipe', 'At most <b>{n}</b> face cards of the same suit'],
    'dk.rNumNaipe': ['No máximo <b>{n}</b> números de um mesmo naipe', 'At most <b>{n}</b> numbers of the same suit'],
    'dk.porQue': ['Por que esses limites?', 'Why these limits?'],
    'dk.porQueTexto': [
      `<p><b>Orçamento de poder:</b> sem ele, o melhor deck seria só de 9 e 10. Com 220 (a soma de um baralho comum), cada carta forte custa uma fraca.</p>
        <p><b>Rainhas:</b> são as figuras mais fortes (equipam até 10 e atropelam), então têm limite menor.</p>
        <p><b>Naipe:</b> deck de um naipe só faria quase todo Senhor virar Naipado. O limite deixa esse plano possível, mas não garantido.</p>
        <p><b>Ases:</b> totens fortes demais em massa travariam a fileira.</p>`,
      `<p><b>Power budget:</b> without it, the best deck would be all 9s and 10s. With 220 (the sum of a standard deck), every strong card costs a weak one.</p>
        <p><b>Queens:</b> they are the strongest face cards (equip up to 10 and trample), so they have a lower limit.</p>
        <p><b>Suit:</b> a single-suit deck would make almost every Lord Suited. The limit keeps that plan possible, but not guaranteed.</p>
        <p><b>Aces:</b> too many strong totems would lock up the row.</p>`,
    ],
    'dk.vazio': ['vazio', 'empty'],
    'dk.pronto': ['pronto para jogar', 'ready to play'],
    'dk.incompleto': ['incompleto', 'incomplete'],
    'dk.espaco': ['Espaço {n}', 'Slot {n}'],
    'dk.espacoVazio': ['Espaço {n} vazio', 'Slot {n} is empty'],
    'dk.comece': ['Comece pelo deck padrão (um baralho comum) e vá trocando as cartas, ou monte do zero.', 'Start from the default deck (a standard deck of cards) and swap cards, or build from scratch.'],
    'dk.autoPadrao': ['Auto-build: deck padrão', 'Auto-build: default deck'],
    'dk.zero': ['Começar do zero', 'Start from scratch'],
    'dk.nome': ['Nome do deck', 'Deck name'],
    'dk.autoTitulo': ['Volta ao baralho comum: uma de cada carta', 'Reset to a standard deck: one of each card'],
    'dk.auto': ['Auto-build (padrão)', 'Auto-build (default)'],
    'dk.apagar': ['Apagar espaço', 'Delete slot'],
    'dk.problemas': [p => `${p.n} problema${s(p.n)}`, p => `${p.n} problem${s(p.n)}`],
    'dk.prontoBtn': ['Pronto para jogar', 'Ready to play'],
    'dk.baralhoLetras': ['Baralho de Letras', 'Faces deck'],
    'dk.baralhoNumeros': ['Baralho de Números', 'Numbers deck'],
    'dk.soma': ['soma', 'sum'],
    'dk.ajuda': ['Clique numa carta para adicionar, botão direito para tirar. O bot usa o deck do Palhaço dele.', "Click a card to add it, right-click to remove it. The bot uses its Jester's deck."],
    'barra.reiniciar': ['⟲ Reiniciar', '⟲ Restart'],
    'barra.reiniciarT': ['Começar de novo com as mesmas opções', 'Start over with the same options'],
    'barra.desistir': ['⚑ Desistir', '⚑ Concede'],
    'barra.desistirT': ['Encerrar esta partida agora', 'End this match now'],
    'barra.menu': ['☰ Menu', '☰ Menu'],
    'barra.menuT': ['Voltar ao menu', 'Back to menu'],
    'barra.registro': ['Registro', 'Log'],
    'dado.aviso': [p => (p.n > 1 ? `Pegue os ${p.n} dados e jogue na mesa` : 'Pegue o dado e jogue na mesa'), p => (p.n > 1 ? `Grab the ${p.n} dice and throw them on the table` : 'Grab the die and throw it on the table')],
  });

  function t(chave, p) {
    let txt = D[atual][chave];
    if (txt === undefined) txt = D.pt[chave];
    if (txt === undefined) return chave;
    if (typeof txt === 'function') return txt(p || {});
    return p ? txt.replace(/\{(\w+)\}/g, (_, k) => (p[k] != null ? p[k] : '')) : txt;
  }

  // Textos fixos do HTML: data-i18n (conteúdo) e data-i18n-title (dica do mouse).
  function aplicarEstaticos() {
    document.documentElement.lang = atual === 'en' ? 'en' : 'pt-BR';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  }

  function definir(idioma) {
    if (!IDIOMAS.includes(idioma)) return;
    atual = idioma;
    try { localStorage.setItem(CHAVE, idioma); } catch (err) { /* ignora */ }
    aplicarEstaticos();
  }

  SS.Idioma = { t, definir, adicionar, aplicarEstaticos, atual: () => atual, IDIOMAS };
  SS.t = t;
})(window.SS);
