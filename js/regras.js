/* Regras do jogo, divididas por tema, para a tela "Regras do jogo" do menu.
   Os números (PV, limites, custos) vêm do motor, então ficam sempre iguais às regras em uso. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';
  const M = SS.Motor;
  const R = M.REGRAS_DECK;

  const TEMAS = [
    {
      id: 'visao', titulo: 'Visão geral',
      html: () => `
        <h3>Objetivo</h3>
        <p>Reduzir os Pontos de Vida (PV) do oponente a <b>0</b>. Cada jogador começa com <b>${M.PV_INICIAL} PV</b> (alguns Palhaços mudam isso), e não existe máximo: a cura de Copas pode passar disso.</p>
        <h3>Componentes</h3>
        <ul>
          <li><b>Baralho de Letras</b> (${R.letras} cartas): Valetes, Rainhas e Reis. São as <b>figuras</b>.</li>
          <li><b>Baralho de Números</b> (${R.numeros} cartas): Ás a 10.</li>
          <li><b>Campo</b>: uma fileira de <b>${M.ESPACOS} espaços</b> para cada jogador. Uma carta colocada nunca muda de espaço.</li>
          <li><b>Cemitério</b>: cartas usadas, sacrificadas e mortas.</li>
          <li>Dado de 6 faces.</li>
        </ul>
        <h3>A ideia</h3>
        <p>Você junta <b>1 figura + 1 número</b> para criar um <b>Senhor(a)</b>, a criatura do jogo. O número é o ataque dele(a). As cartas numéricas também podem ser usadas sozinhas, como magias, pelo efeito do naipe. Os <b>Ases</b> viram totens que fortalecem os vizinhos.</p>`,
    },
    {
      id: 'turno', titulo: 'Preparação e turno',
      html: () => `
        <h3>Preparação</h3>
        <ul>
          <li>Cada jogador escolhe <b>3 figuras</b> do baralho de Letras para a mão e compra <b>4 cartas</b> do baralho de Números.</li>
          <li><b>Mulligan</b> (uma vez): devolve as 4 cartas numéricas, embaralha e compra 3. As figuras escolhidas ficam.</li>
          <li><b>Quem começa:</b> sempre no dado: cada jogador joga o seu e começa quem tirar mais (empate, joga de novo). No primeiro turno, quem começa <b>não compra e não ataca</b>.</li>
        </ul>
        <h3>Ordem do turno</h3>
        <ol>
          <li><b>Reativação:</b> seus Senhores virados para baixo voltam a ficar ativos.</li>
          <li><b>Compra:</b> compre <b>1 carta</b> do baralho que escolher: Letras ou Números. Se os dois estiverem vazios, perca 2 PV. O <b>Ourinhos</b> não escolhe: compra sozinho 1 Letra e 1 Número.</li>
          <li><b>${M.ACOES_POR_TURNO} ações passivas</b>, em qualquer ordem: sumonar, invocar Ás, usar o efeito de uma carta numérica. No máximo <b>${M.SENHORES_POR_TURNO} Senhor(a)</b> sumonado(a) e <b>${M.ASES_POR_TURNO} Ás</b> invocado por turno.</li>
          <li><b>Ação ofensiva:</b> ataque com os Senhores aptos.</li>
          <li><b>Fim do turno:</b> quem atacou vira para baixo, os efeitos de "1 turno" acabam e, com mais de ${M.LIMITE_MAO} cartas na mão, você descarta o excesso.</li>
        </ol>`,
    },
    {
      id: 'senhores', titulo: 'Senhores e Senhoras',
      html: () => `
        <h3>Sumonar (1 ação)</h3>
        <p>Junte 1 figura + 1 número (2 a 10) num espaço vazio. O <b>número é o ataque</b>.</p>
        <table class="tabela-regras">
          <tr><th>Figura</th><th>Equipa</th><th>Custo</th><th>Habilidade</th></tr>
          <tr><td><b>Valete</b></td><td>2 a 5</td><td>1 ação</td><td><b>Ímpeto:</b> ataca no mesmo turno em que entra.</td></tr>
          <tr><td><b>Rainha</b></td><td>2 a 10</td><td>${M.CUSTO_RAINHA} ação + sacrifício de ${M.SACRIFICIOS_RAINHA} Senhores seus que já estavam em campo antes deste turno</td><td><b>Atropelar:</b> se matar quem bloqueou, o dano que sobra vai para o PV.</td></tr>
          <tr><td><b>Rei</b></td><td>2 a 7</td><td>1 ação</td><td><b>Ordem real:</b> ao atacar, pode escolher como alvo um Senhor(a) inimigo. O alvo é obrigado a defender, e outros Senhores ativos do dono podem entrar junto para ajudar.</td></tr>
        </table>
        <h3>Vida e posição da carta</h3>
        <p>Um Senhor(a) comum aguenta <b>2 hits</b>. A posição da carta mostra quanto falta:</p>
        <ul>
          <li><b>Vertical:</b> saudável.</li>
          <li><b>Diagonal:</b> ferido(a), mas aguenta mais de 1 hit (só com Naipado de Paus ou Ás de Paus vizinho).</li>
          <li><b>Horizontal:</b> o próximo hit mata.</li>
          <li><b>Virado para baixo:</b> atacou e não pode bloquear até o próximo turno do dono.</li>
        </ul>
        <table class="tabela-regras">
          <tr><th>Situação</th><th>Hits para morrer</th></tr>
          <tr><td>Padrão</td><td>2</td></tr>
          <tr><td>Ao lado de um Ás de Paus</td><td>3</td></tr>
          <tr><td>Naipado de Paus</td><td>3</td></tr>
          <tr><td>Naipado de Paus ao lado de um Ás de Paus</td><td>4</td></tr>
        </table>`,
    },
    {
      id: 'naipados', titulo: 'Naipados',
      html: () => `
        <p>Quando a figura e o número têm o <b>mesmo naipe</b>, nasce um(a) <b>Senhor(a) Naipado(a)</b>, com um poder extra:</p>
        <table class="tabela-regras">
          <tr><th>Naipe</th><th>Poder</th></tr>
          <tr><td>♣ Paus</td><td>Aguenta 3 hits (4 ao lado de um Ás de Paus).</td></tr>
          <tr><td>♠ Espadas</td><td>+1 de ataque fixo.</td></tr>
          <tr><td>♥ Copas</td><td><b>Ferida:</b> depois que ele(a) causa dano no PV do oponente, o oponente não pode curar acima do PV que ficou, enquanto ele(a) viver.</td></tr>
          <tr><td>♦ Ouros</td><td>Ataca 2 vezes por turno (os dois ataques são declarados juntos).</td></tr>
        </table>
        <p class="exemplo"><b>Exemplo:</b> Rei de Copas + 7 de Copas vira um Rei Naipado de Copas com ataque 7.</p>`,
    },
    {
      id: 'ataque', titulo: 'Ataque',
      html: () => `
        <ul>
          <li>Cada Senhor(a) apto(a) ataca <b>1 vez por turno</b> (o Naipado de Ouros, 2). Só ataca quem entrou em turno anterior, exceto o Valete.</li>
          <li>O alvo é o <b>jogador</b> oponente ou um <b>Ás</b> dele. O <b>Rei</b> também pode mirar um <b>Senhor(a)</b> inimigo: o alvo é obrigado a defender, com as regras de bloqueio e contra-ataque (mesmo se estiver virado), e outros Senhores ativos do dono podem entrar junto para ajudar.</li>
          <li>Você escolhe a <b>ordem</b> dos ataques; eles são resolvidos um por vez.</li>
        </ul>
        <h3>Rolagem</h3>
        <table class="tabela-regras">
          <tr><th>Dado</th><th>Dano</th></tr>
          <tr><td>${M.DADO_ATAQUE_TOTAL} a 6</td><td>Ataque cheio</td></tr>
          <tr><td>1 a ${M.DADO_ATAQUE_TOTAL - 1}</td><td>Metade do ataque, arredondada para baixo</td></tr>
        </table>
        <ul>
          <li><b>Ouros no ataque:</b> cada Ouros gasto dá +1 dado; vale o maior resultado.</li>
          <li><b>Espadas:</b> +1 de ataque no turno; se o dado der 6, o bônus vira metade do valor da carta de Espadas (crítico).</li>
          <li><b>Sem bloqueio:</b> o dano vai direto no PV. Se o alvo era um Ás, ele é destruído.</li>
        </ul>
        <p class="exemplo"><b>Exemplo:</b> Rainha com 8 ataca e ninguém bloqueia. Rolou 3 = meio ataque = <b>4 de dano</b> no PV.</p>
        <p>Quem atacou fica <b>virado para baixo no fim do turno</b> e não pode bloquear no turno seguinte do oponente.</p>`,
    },
    {
      id: 'defesa', titulo: 'Defesa e contra-ataque',
      html: () => `
        <h3>Bloqueio</h3>
        <ul>
          <li>Cada Senhor(a) <b>ativo(a)</b> bloqueia 1 atacante. Ases não bloqueiam.</li>
          <li>Dois ou mais Senhores podem bloquear <b>o mesmo atacante</b>: cada defensor a mais <b>tira 1 do ataque</b> dele (2 defensores: −1; 3: −2). Cada defensor recebe o dano inteiro (já reduzido) e o compara com o próprio ataque.</li>
          <li>No ataque do Rei contra um Senhor(a), o <b>alvo defende obrigatoriamente</b>, e outros Senhores ativos podem entrar para <b>ajudar</b> (cada ajudante tira 1 do ataque do Rei, e os ataques de todos somam no contra-ataque).</li>
        </ul>
        <h3>O golpe contra quem bloqueia</h3>
        <p>Compare o <b>dano</b> com o <b>ataque do bloqueador</b>. Para um bloqueador com ataque 6:</p>
        <table class="tabela-regras">
          <tr><th>Dano</th><th>Resultado</th></tr>
          <tr><td>0 a 2 (menos da metade)</td><td>Golpe <b>ignorado</b></td></tr>
          <tr><td>3 a 6</td><td>Leva <b>1 hit</b></td></tr>
          <tr><td>7 ou mais (passou do ataque dele)</td><td><b>Morre na hora</b></td></tr>
        </table>
        <h3>Contra-ataque (não usa dado)</h3>
        <p>Se o <b>número do atacante for menor</b> que o do bloqueador (ou a soma dos bloqueadores), o atacante leva <b>1 hit</b>. Bônus fixos e Espadas contam.</p>
        <p class="exemplo"><b>Exemplo:</b> Valete com 4 ataca, Rei com 6 bloqueia. Mesmo que o golpe seja ignorado, 4 é menor que 6, então o Valete leva 1 hit.</p>
        <h3>Atropelar (Rainha)</h3>
        <p>Se a Rainha matar quem bloqueou, o PV recebe <b>dano − ataque do bloqueador</b>.</p>
        <p class="exemplo"><b>Exemplo:</b> Rainha com 10 rola 5 (10 de dano) contra Rei com 6: o Rei morre e passam <b>4</b> para o PV.</p>`,
    },
    {
      id: 'efeitos', titulo: 'Efeitos dos naipes',
      html: () => `
        <p>Uma carta numérica usada sozinha gasta <b>1 ação</b> e vai para o cemitério.</p>
        <table class="tabela-regras">
          <tr><th>Naipe</th><th>Efeito</th></tr>
          <tr><td>♥ Copas</td><td>Cura PV: 2–3 cura 1, 4–7 cura 2, 8–10 cura 3. Pode passar de ${M.PV_INICIAL}.</td></tr>
          <tr><td>♦ Ouros</td><td>Descarte 1 para comprar 1 carta (do baralho que escolher) ou 2 para recuperar 1 carta do cemitério. No ataque, +1 dado.</td></tr>
          <tr><td>♠ Espadas</td><td>+1 de ataque a um Senhor(a) até o fim do turno; no 6, vira metade do valor da carta.</td></tr>
          <tr><td>♣ Paus</td><td><b>Berserk:</b> um Senhor(a) ferido(a) volta à vertical até o fim do próximo turno do oponente. Se levar 1 hit nesse tempo, morre quando o efeito acabar; com 2 hits, morre na hora.</td></tr>
        </table>`,
    },
    {
      id: 'ases', titulo: 'Ases (totens)',
      html: () => `
        <ul>
          <li><b>Invocação (1 ação):</b> sacrifique 1 carta numérica do mesmo naipe do Ás.</li>
          <li>O Ás ocupa 1 espaço e afeta os <b>vizinhos</b> (esquerda e direita).</li>
          <li><b>Empurrar:</b> o Ás pode entrar no lugar de uma carta da sua fileira, empurrando as cartas para o lado do espaço vazio mais próximo (precisa haver um espaço vazio). Assim dá para colocá-lo entre dois Senhores.</li>
          <li>Não ataca, não bloqueia e morre com <b>1 golpe</b>. Um Senhor(a) do dono pode bloquear para protegê-lo.</li>
        </ul>
        <table class="tabela-regras">
          <tr><th>Ás</th><th>Efeito</th></tr>
          <tr><td>♣ Paus</td><td>Vizinhos ganham +1 de resistência (cria o estado diagonal).</td></tr>
          <tr><td>♠ Espadas</td><td>Vizinhos ganham +1 de ataque fixo.</td></tr>
          <tr><td>♦ Ouros</td><td>Vale 1 Ouros extra por turno.</td></tr>
          <tr><td>♥ Copas</td><td><b>Vampiro:</b> vizinho que causar dano ao PV do oponente cura 1 PV seu.</td></tr>
        </table>`,
    },
    {
      id: 'palhacos', titulo: 'Palhaços',
      html: () => `
        <p>Cada jogador escolhe um <b>Palhaço</b>, que é o seu "herói": ele fica no centro da mesa, mostra o seu PV e é o alvo dos ataques diretos. Cada um tem uma <b>passiva</b> (vale a partida toda) e um <b>poder</b> (1 ação, 1 vez por turno, botão ao lado do Palhaço).</p>
        <table class="tabela-regras">
          <tr><th>Palhaço</th><th>Passiva</th><th>Poder</th></tr>
          ${SS.Palhacos.LISTA.map(p => `<tr><td><b>${M.SIMBOLO[p.naipe]} ${p.nome}</b><br><small>${p.titulo}</small></td><td><b>${p.passiva.nome}:</b> ${p.passiva.texto}</td>
            <td>${p.poder ? `<b>${p.poder.nome}:</b> ${p.poder.texto}` : `<b>${p.custo.nome}:</b> ${p.custo.texto}`}</td></tr>`).join('')}
        </table>
        <p><b>Quem começa:</b> sempre no dado. Cada jogador joga o seu e começa quem tirar mais.</p>
        <p class="nota">Cada Palhaço tem um deck temático do seu naipe, que pode ser trocado por um deck montado por você.</p>`,
    },
    {
      id: 'deck', titulo: 'Montagem de deck',
      html: () => `
        <ul>
          <li>Baralho de Letras com <b>no máximo ${R.letras}</b> figuras e baralho de Números com <b>no máximo ${R.numeros}</b> cartas. Não há mínimo: um deck menor deixa as melhores cartas mais frequentes, mas acaba antes (comprar de baralho vazio custa 2 PV por carta).</li>
          <li>Na montagem, você pode trocar o naipe de qualquer carta.</li>
          <li>Até <b>${R.copias} cópias</b> da mesma carta (mesmo valor e naipe), e qualquer mistura de naipes.</li>
        </ul>
        <p class="nota">Em "Montar decks" estão o deck padrão (um baralho comum) e os decks de cada Palhaço, prontos para servir de base.</p>`,
    },
    {
      id: 'fim', titulo: 'Fim de jogo e limites',
      html: () => `
        <ul>
          <li>Quem chegar a <b>0 PV</b> perde.</li>
          <li><b>Baralhos vazios:</b> se precisar comprar e os dois estiverem vazios, perca 2 PV por compra.</li>
          <li><b>Limite de mão:</b> ${M.LIMITE_MAO} cartas no fim do turno; o excesso vai para o cemitério.</li>
          <li>Você pode <b>desistir</b> a qualquer momento pelo botão no topo do painel.</li>
        </ul>`,
    },
  ];

  const TEMAS_EN = [
    {
      id: 'visao', titulo: 'Overview',
      html: () => `
        <h3>Goal</h3>
        <p>Reduce your opponent's Hit Points (HP) to <b>0</b>. Each player starts with <b>${M.PV_INICIAL} HP</b> (some Jesters change this), and there is no maximum: Hearts healing can go above it.</p>
        <h3>Components</h3>
        <ul>
          <li><b>Faces deck</b> (${R.letras} cards): Jacks, Queens and Kings. These are the <b>face cards</b>.</li>
          <li><b>Numbers deck</b> (${R.numeros} cards): Ace to 10.</li>
          <li><b>Field</b>: a row of <b>${M.ESPACOS} slots</b> for each player. A card placed there never changes slot.</li>
          <li><b>Graveyard</b>: used, sacrificed and dead cards.</li>
          <li>A 6-sided die.</li>
        </ul>
        <h3>The idea</h3>
        <p>You combine <b>1 face card + 1 number</b> to create a <b>Gentleman</b>, the game's creature. The number is its attack. Number cards can also be played alone, like spells, for their suit effect. <b>Aces</b> become totems that strengthen their neighbors.</p>`,
    },
    {
      id: 'turno', titulo: 'Setup and turn',
      html: () => `
        <h3>Setup</h3>
        <ul>
          <li>Each player chooses <b>3 face cards</b> from the Faces deck for their hand and draws <b>4 cards</b> from the Numbers deck.</li>
          <li><b>Mulligan</b> (once): return the 4 number cards, shuffle and draw 3. The chosen face cards stay.</li>
          <li><b>Who goes first:</b> always by the die: each player throws one and the higher roll goes first (on a tie, roll again). On the first turn, the first player <b>doesn't draw and doesn't attack</b>.</li>
        </ul>
        <h3>Turn order</h3>
        <ol>
          <li><b>Ready:</b> your face-down Gentlemen become ready again.</li>
          <li><b>Draw:</b> draw <b>1 card</b> from the deck of your choice: Faces or Numbers. If both are empty, lose 2 HP. <b>Ourinhos</b> does not choose: it automatically draws 1 Face and 1 Number.</li>
          <li><b>${M.ACOES_POR_TURNO} passive actions</b>, in any order: summon, invoke an Ace, use a number card's effect. At most <b>${M.SENHORES_POR_TURNO} Gentleman</b> summoned and <b>${M.ASES_POR_TURNO} Ace</b> invoked per turn.</li>
          <li><b>Offensive action:</b> attack with your ready Gentlemen.</li>
          <li><b>End of turn:</b> attackers flip face down, "1 turn" effects end and, with more than ${M.LIMITE_MAO} cards in hand, you discard the extra.</li>
        </ol>`,
    },
    {
      id: 'senhores', titulo: 'Gentlemen',
      html: () => `
        <h3>Summon (1 action)</h3>
        <p>Put 1 face card + 1 number (2 to 10) into an empty slot. The <b>number is the attack</b>.</p>
        <table class="tabela-regras">
          <tr><th>Face card</th><th>Equips</th><th>Cost</th><th>Ability</th></tr>
          <tr><td><b>Jack</b></td><td>2 to 5</td><td>1 action</td><td><b>Haste:</b> attacks the same turn it enters.</td></tr>
          <tr><td><b>Queen</b></td><td>2 to 10</td><td>${M.CUSTO_RAINHA} action + sacrifice ${M.SACRIFICIOS_RAINHA} of your Gentlemen that were already on the field before this turn</td><td><b>Trample:</b> if it kills its blocker, the leftover damage goes to HP.</td></tr>
          <tr><td><b>King</b></td><td>2 to 7</td><td>1 action</td><td><b>Royal Order:</b> when attacking, may target an enemy Gentleman. The target must defend, and its owner's other ready Gentlemen can join to help.</td></tr>
        </table>
        <h3>Health and card position</h3>
        <p>A regular Gentleman survives <b>2 hits</b>. The card's position shows how much is left:</p>
        <ul>
          <li><b>Upright:</b> healthy.</li>
          <li><b>Diagonal:</b> wounded, but survives more than 1 hit (only with Suited Clubs or a neighboring Ace of Clubs).</li>
          <li><b>Sideways:</b> the next hit kills.</li>
          <li><b>Face down:</b> attacked and can't block until its owner's next turn.</li>
        </ul>
        <table class="tabela-regras">
          <tr><th>Situation</th><th>Hits to die</th></tr>
          <tr><td>Default</td><td>2</td></tr>
          <tr><td>Next to an Ace of Clubs</td><td>3</td></tr>
          <tr><td>Suited Clubs</td><td>3</td></tr>
          <tr><td>Suited Clubs next to an Ace of Clubs</td><td>4</td></tr>
        </table>`,
    },
    {
      id: 'naipados', titulo: 'Suited Gentlemen',
      html: () => `
        <p>When the face card and the number share the <b>same suit</b>, a <b>Suited Gentleman</b> is born, with an extra power:</p>
        <table class="tabela-regras">
          <tr><th>Suit</th><th>Power</th></tr>
          <tr><td>♣ Clubs</td><td>Survives 3 hits (4 next to an Ace of Clubs).</td></tr>
          <tr><td>♠ Spades</td><td>+1 permanent attack.</td></tr>
          <tr><td>♥ Hearts</td><td><b>Wound:</b> after it deals damage to the opponent's HP, the opponent can't heal above the HP they were left with, while it lives.</td></tr>
          <tr><td>♦ Diamonds</td><td>Attacks twice per turn (both attacks are declared together).</td></tr>
        </table>
        <p class="exemplo"><b>Example:</b> King of Hearts + 7 of Hearts becomes a Suited King of Hearts with attack 7.</p>`,
    },
    {
      id: 'ataque', titulo: 'Attack',
      html: () => `
        <ul>
          <li>Each ready Gentleman attacks <b>once per turn</b> (Suited Diamonds, twice). Only Gentlemen that entered on an earlier turn can attack, except the Jack.</li>
          <li>The target is the opposing <b>player</b> or one of their <b>Aces</b>. The <b>King</b> can also target an enemy <b>Gentleman</b>: the target must defend, with the block and counterattack rules (even if face down), and its owner's other ready Gentlemen can join to help.</li>
          <li>You choose the <b>order</b> of the attacks; they are resolved one at a time.</li>
        </ul>
        <h3>Roll</h3>
        <table class="tabela-regras">
          <tr><th>Die</th><th>Damage</th></tr>
          <tr><td>${M.DADO_ATAQUE_TOTAL} to 6</td><td>Full attack</td></tr>
          <tr><td>1 to ${M.DADO_ATAQUE_TOTAL - 1}</td><td>Half the attack, rounded down</td></tr>
        </table>
        <ul>
          <li><b>Diamonds on attack:</b> each Diamond spent gives +1 die; the highest result counts.</li>
          <li><b>Spades:</b> +1 attack this turn; if the die shows 6, the bonus becomes half the Spades card's value (critical).</li>
          <li><b>Unblocked:</b> the damage goes straight to HP. If the target was an Ace, it is destroyed.</li>
        </ul>
        <p class="exemplo"><b>Example:</b> a Queen with 8 attacks and no one blocks. Rolled 3 = half attack = <b>4 damage</b> to HP.</p>
        <p>Attackers flip <b>face down at the end of the turn</b> and can't block on the opponent's next turn.</p>`,
    },
    {
      id: 'defesa', titulo: 'Defense and counterattack',
      html: () => `
        <h3>Blocking</h3>
        <ul>
          <li>Each <b>ready</b> Gentleman blocks 1 attacker. Aces don't block.</li>
          <li>Two or more Gentlemen can block <b>the same attacker</b>: each extra defender <b>lowers its attack by 1</b> (2 defenders: −1; 3: −2). Each defender takes the full (already reduced) damage and compares it with its own attack.</li>
          <li>When the King attacks a Gentleman, the <b>target must defend</b>, and other ready Gentlemen can join to <b>help</b> (each helper lowers the King's attack by 1, and all their attacks add up for the counterattack).</li>
        </ul>
        <h3>The blow against the blocker</h3>
        <p>Compare the <b>damage</b> with the <b>blocker's attack</b>. For a blocker with attack 6:</p>
        <table class="tabela-regras">
          <tr><th>Damage</th><th>Result</th></tr>
          <tr><td>0 to 2 (less than half)</td><td>Blow <b>ignored</b></td></tr>
          <tr><td>3 to 6</td><td>Takes <b>1 hit</b></td></tr>
          <tr><td>7 or more (more than its attack)</td><td><b>Dies instantly</b></td></tr>
        </table>
        <h3>Counterattack (no die)</h3>
        <p>If the <b>attacker's number is lower</b> than the blocker's (or the blockers' sum), the attacker takes <b>1 hit</b>. Permanent bonuses and Spades count.</p>
        <p class="exemplo"><b>Example:</b> a Jack with 4 attacks, a King with 6 blocks. Even if the blow is ignored, 4 is less than 6, so the Jack takes 1 hit.</p>
        <h3>Trample (Queen)</h3>
        <p>If the Queen kills its blocker, HP takes <b>damage − blocker's attack</b>.</p>
        <p class="exemplo"><b>Example:</b> a Queen with 10 rolls 5 (10 damage) against a King with 6: the King dies and <b>4</b> goes through to HP.</p>`,
    },
    {
      id: 'efeitos', titulo: 'Suit effects',
      html: () => `
        <p>A number card played alone costs <b>1 action</b> and goes to the graveyard.</p>
        <table class="tabela-regras">
          <tr><th>Suit</th><th>Effect</th></tr>
          <tr><td>♥ Hearts</td><td>Heals HP: 2–3 heals 1, 4–7 heals 2, 8–10 heals 3. Can go above ${M.PV_INICIAL}.</td></tr>
          <tr><td>♦ Diamonds</td><td>Discard 1 to draw 1 card (from the deck of your choice) or 2 to recover 1 card from the graveyard. On attack, +1 die.</td></tr>
          <tr><td>♠ Spades</td><td>+1 attack to a Gentleman until end of turn; on a 6, it becomes half the card's value.</td></tr>
          <tr><td>♣ Clubs</td><td><b>Berserk:</b> a wounded Gentleman returns upright until the end of the opponent's next turn. If it takes 1 hit in that time, it dies when the effect ends; with 2 hits, it dies instantly.</td></tr>
        </table>`,
    },
    {
      id: 'ases', titulo: 'Aces (totems)',
      html: () => `
        <ul>
          <li><b>Invocation (1 action):</b> sacrifice 1 number card of the same suit as the Ace.</li>
          <li>The Ace takes 1 slot and affects its <b>neighbors</b> (left and right).</li>
          <li><b>Push:</b> the Ace can enter in place of a card in your row, pushing cards toward the nearest empty slot (there must be an empty slot). This way you can place it between two Gentlemen.</li>
          <li>It doesn't attack, doesn't block and dies to <b>1 blow</b>. One of its owner's Gentlemen can block to protect it.</li>
        </ul>
        <table class="tabela-regras">
          <tr><th>Ace</th><th>Effect</th></tr>
          <tr><td>♣ Clubs</td><td>Neighbors get +1 toughness (creates the diagonal state).</td></tr>
          <tr><td>♠ Spades</td><td>Neighbors get +1 permanent attack.</td></tr>
          <tr><td>♦ Diamonds</td><td>Counts as 1 extra Diamond per turn.</td></tr>
          <tr><td>♥ Hearts</td><td><b>Vampire:</b> a neighbor that damages the opponent's HP heals you 1 HP.</td></tr>
        </table>`,
    },
    {
      id: 'palhacos', titulo: 'Jesters',
      html: () => `
        <p>Each player chooses a <b>Jester</b>, their "hero": it sits in the middle of the table, shows your HP and is the target of direct attacks. Each one has a <b>passive</b> (lasts the whole match) and a <b>power</b> (1 action, once per turn, button next to the Jester).</p>
        <table class="tabela-regras">
          <tr><th>Jester</th><th>Passive</th><th>Power</th></tr>
          ${SS.Palhacos.LISTA.map(p => `<tr><td><b>${M.SIMBOLO[p.naipe]} ${p.nome}</b><br><small>${p.titulo}</small></td><td><b>${p.passiva.nome}:</b> ${p.passiva.texto}</td>
            <td>${p.poder ? `<b>${p.poder.nome}:</b> ${p.poder.texto}` : `<b>${p.custo.nome}:</b> ${p.custo.texto}`}</td></tr>`).join('')}
        </table>
        <p><b>Who goes first:</b> always by the die. Each player throws one and the higher roll goes first.</p>
        <p class="nota">Each Jester has a themed deck of its suit, which you can swap for a deck you build.</p>`,
    },
    {
      id: 'deck', titulo: 'Deck building',
      html: () => `
        <ul>
          <li>A Faces deck with <b>at most ${R.letras}</b> face cards and a Numbers deck with <b>at most ${R.numeros}</b> cards. There is no minimum: a smaller deck makes your best cards show up more often, but runs out sooner (drawing from an empty deck costs 2 HP per card).</li>
          <li>When building, you can change the suit of any card.</li>
          <li>Up to <b>${R.copias} copies</b> of the same card (same value and suit), and any mix of suits.</li>
        </ul>
        <p class="nota">In "Build decks" you will find the default deck (a standard deck of cards) and each Jester's deck, ready to use as a base.</p>`,
    },
    {
      id: 'fim', titulo: 'Game end and limits',
      html: () => `
        <ul>
          <li>Whoever reaches <b>0 HP</b> loses.</li>
          <li><b>Empty decks:</b> if you have to draw and both are empty, lose 2 HP per draw.</li>
          <li><b>Hand limit:</b> ${M.LIMITE_MAO} cards at end of turn; the extra goes to the graveyard.</li>
          <li>You can <b>concede</b> at any time with the button at the top of the panel.</li>
        </ul>`,
    },
  ];

  const temas = () => (SS.Idioma && SS.Idioma.atual() === 'en' ? TEMAS_EN : TEMAS);

  let atual = 'visao', aoVoltar = null;

  function tela() {
    let el = document.getElementById('tela-regras');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tela-regras';
      el.className = 'tela';
      document.body.appendChild(el);
      el.addEventListener('click', aoClicar);
    }
    return el;
  }

  function desenhar() {
    const lista = temas(), tr = SS.Idioma.t;
    const tema = lista.find(t => t.id === atual);
    tela().innerHTML = `<div class="tela-caixa regras">
      <div class="tela-cabecalho"><h1>${tr('menu.regras')}</h1><button class="btn principal" data-regra-cmd="voltar">${tr('btn.voltarMenu')}</button></div>
      <div class="deck-layout">
        <nav class="slots">${lista.map(t => `<button class="slot${t.id === atual ? ' atual' : ''}" data-tema="${t.id}"><b>${t.titulo}</b></button>`).join('')}</nav>
        <section class="editor texto-regras"><h2>${tema.titulo}</h2>${tema.html()}</section>
      </div></div>`;
  }

  function aoClicar(ev) {
    if (ev.target.closest('[data-regra-cmd="voltar"]')) {
      tela().hidden = true;
      tela().innerHTML = '';
      if (aoVoltar) aoVoltar();
      return;
    }
    const b = ev.target.closest('[data-tema]');
    if (b) {
      atual = b.dataset.tema;
      desenhar();
    }
  }

  function abrir(voltar) {
    aoVoltar = voltar;
    desenhar();
    tela().hidden = false;
  }

  SS.Regras = { abrir };
})(window.SS);
