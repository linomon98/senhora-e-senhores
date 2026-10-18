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
        <p>Reduzir os Pontos de Vida (PV) do oponente a <b>0</b>. Cada jogador começa com <b>${M.PV_INICIAL} PV</b>, e não existe máximo: a cura de Copas pode passar disso.</p>
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
          <li><b>Quem começa:</b> o Vermelho (a Senhora) sempre começa. No primeiro turno, quem começa <b>não compra e não ataca</b>.</li>
        </ul>
        <h3>Ordem do turno</h3>
        <ol>
          <li><b>Reativação:</b> seus Senhores virados para baixo voltam a ficar ativos.</li>
          <li><b>Compra:</b> compre 1 carta do baralho que escolher: Letras ou Números. Se os dois estiverem vazios, perca 2 PV.</li>
          <li><b>${M.ACOES_POR_TURNO} ações passivas</b>, em qualquer ordem: sumonar, invocar Ás, usar o efeito de uma carta numérica.</li>
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
          <tr><td><b>Rainha</b></td><td>2 a 10</td><td>${M.CUSTO_RAINHA} ações + sacrifício de 1 Senhor(a) seu que já estava em campo antes deste turno</td><td><b>Atropelar:</b> se matar quem bloqueou, o dano que sobra vai para o PV.</td></tr>
          <tr><td><b>Rei</b></td><td>2 a 7</td><td>1 ação</td><td><b>Guardião:</b> bloqueia até 2 atacantes por turno.</td></tr>
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
          <li>O alvo é o <b>jogador</b> oponente ou um <b>Ás</b> dele.</li>
          <li>Você escolhe a <b>ordem</b> dos ataques; eles são resolvidos um por vez.</li>
        </ul>
        <h3>Rolagem</h3>
        <table class="tabela-regras">
          <tr><th>Dado</th><th>Dano</th></tr>
          <tr><td>5 ou 6</td><td>Ataque cheio</td></tr>
          <tr><td>1 a 4</td><td>Metade do ataque, arredondada para baixo</td></tr>
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
          <li>Cada Senhor(a) <b>ativo(a)</b> bloqueia 1 atacante (o Rei, 2). Ases não bloqueiam.</li>
          <li>Dois ou mais Senhores podem bloquear <b>o mesmo atacante</b>: cada um recebe o dano inteiro.</li>
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
      id: 'deck', titulo: 'Montagem de deck',
      html: () => `
        <ul>
          <li>Baralho de Letras com exatamente <b>${R.letras}</b> figuras e baralho de Números com exatamente <b>${R.numeros}</b> cartas.</li>
          <li>Na montagem, você pode trocar o naipe de qualquer carta.</li>
          <li><b>Orçamento de poder:</b> a soma dos números (Ás = 1) vai até <b>${R.orcamento}</b>, que é a soma de um baralho comum.</li>
          <li>No máximo <b>${R.porFigura.J}</b> Valetes, <b>${R.porFigura.Q}</b> Rainhas e <b>${R.porFigura.K}</b> Reis.</li>
          <li>Até <b>${R.copiasFigura}</b> cópias da mesma figura e naipe e até <b>${R.copiasNumero}</b> do mesmo número e naipe.</li>
          <li>No máximo <b>${R.ases}</b> Ases.</li>
          <li>No máximo <b>${R.figurasMesmoNaipe}</b> figuras e <b>${R.numerosMesmoNaipe}</b> números de um mesmo naipe.</li>
        </ul>
        <p class="nota">O deck padrão (um baralho comum) sempre cumpre todas as regras.</p>`,
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
    const tema = TEMAS.find(t => t.id === atual);
    tela().innerHTML = `<div class="tela-caixa regras">
      <div class="tela-cabecalho"><h1>Regras do jogo</h1><button class="btn principal" data-regra-cmd="voltar">Voltar ao menu</button></div>
      <div class="deck-layout">
        <nav class="slots">${TEMAS.map(t => `<button class="slot${t.id === atual ? ' atual' : ''}" data-tema="${t.id}"><b>${t.titulo}</b></button>`).join('')}</nav>
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
