/* Desenho das cartas: fundo creme liso (ou um fundo desenhado, se houver em FUNDOS), naipes desenhados (arte/naipes)
   nas posições clássicas do baralho. As figuras com arte própria (arte/cartas/senhores/<rank>-<naipe>.webp) usam o desenho
   no lugar do placeholder, com a letra e o naipe nos cantos como as outras cartas (o de cima, à esquerda, um pouco maior).
   Para usar a arte final de uma carta, registre a imagem em SS.ARTE (chave = rank-naipe), como as de baixo.
   A arte vem do arquivo de desenho do Leonardo (1792 × 2400): a tela toda vira a carta (600 × 830). Os desenhos mais estreitos
   que isso entram pela altura, sem esticar. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';

  SS.ARTE = SS.ARTE || {};
  SS.ARTE['J-espadas'] = 'arte/cartas/senhores/J-espadas.webp';
  SS.ARTE['J-copas'] = 'arte/cartas/senhores/J-copas.webp';
  SS.ARTE['J-paus'] = 'arte/cartas/senhores/J-paus.webp';
  SS.ARTE['J-ouros'] = 'arte/cartas/senhores/J-ouros.webp';
  SS.ARTE['K-copas'] = 'arte/cartas/senhores/K-copas.webp';
  SS.ARTE['K-paus'] = 'arte/cartas/senhores/K-paus.webp';
  SS.ARTE['K-espadas'] = 'arte/cartas/senhores/K-espadas.webp';
  SS.ARTE['K-ouros'] = 'arte/cartas/senhores/K-ouros.webp';
  SS.ARTE['Q-espadas'] = 'arte/cartas/senhores/Q-espadas.webp';
  SS.ARTE['Q-copas'] = 'arte/cartas/senhores/Q-copas.webp';
  SS.ARTE['Q-paus'] = 'arte/cartas/senhores/Q-paus.webp';
  SS.ARTE['Q-ouros'] = 'arte/cartas/senhores/Q-ouros.webp';

  // Cada naipe com a sua cor: Copas vermelho, Ouros amarelo, Paus verde, Espadas azul.
  const COR = { copas: '#d0202e', ouros: '#d49a06', paus: '#1c8a3a', espadas: '#1f55c8' };

  // Naipe desenhado (a imagem tem uma margem em volta do desenho, por isso sai um pouco maior que tam).
  function pip(naipe, cx, cy, tam, invertido) {
    const t = tam * 1.18, rot = invertido ? ` transform="rotate(180 ${cx} ${cy})"` : '';
    return `<image href="arte/naipes/${naipe}.webp${V_ARTE}" x="${(cx - t / 2).toFixed(1)}" y="${(cy - t / 2).toFixed(1)}" width="${t.toFixed(1)}" height="${t.toFixed(1)}"${rot}/>`;
  }

  // Borda preta na beirada da carta: a do desenho é fina demais (cerca de 1 px numa carta da mão) e sumia.
  const BORDA = '<rect x="2.2" y="2.2" width="195.6" height="275.6" rx="15" fill="none" stroke="#141414" stroke-width="4.5"/>';
  // Versão das imagens das cartas (trocar quando um arquivo mudar com o mesmo nome, para o navegador não usar o antigo).
  const V_ARTE = '?v=13';

  // Fundo da carta: o creme liso de sempre. Com fundos desenhados (arte/cartas/fundo-<letra>.webp, feitos no gabarito
  // arte/cartas/gabarito), ponha as letras deles aqui: cada carta pega sempre a mesma variação (rank + naipe).
  // (os fundos a–d de 27/10 continuam na pasta, fora de uso)
  const FUNDOS = [];
  const CREME = '<rect x="1.5" y="1.5" width="197" height="277" rx="14" fill="#fdfbf3" stroke="#bdb59f" stroke-width="2"/>';
  function fundo(chave) {
    if (!FUNDOS.length) return CREME;
    let h = 0;
    for (const ch of chave) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    // (o fundo vem do gabarito: a tela inteira de 1792 × 2400 vira a carta, e o canto da própria carta arredonda, pelo CSS)
    return `<image href="arte/cartas/fundo-${FUNDOS[h % FUNDOS.length]}.webp${V_ARTE}" x="0" y="0" width="200" height="280" preserveAspectRatio="none"/>`;
  }

  // Posições clássicas dos naipes no miolo (carta de 200 x 280).
  const E = 66, C = 100, D = 134;
  const LAYOUT = {
    2: [[C, 58], [C, 222]],
    3: [[C, 58], [C, 140], [C, 222]],
    4: [[E, 58], [D, 58], [E, 222], [D, 222]],
    5: [[E, 58], [D, 58], [C, 140], [E, 222], [D, 222]],
    6: [[E, 58], [D, 58], [E, 140], [D, 140], [E, 222], [D, 222]],
    7: [[E, 58], [D, 58], [C, 99], [E, 140], [D, 140], [E, 222], [D, 222]],
    8: [[E, 58], [D, 58], [C, 99], [E, 140], [D, 140], [C, 181], [E, 222], [D, 222]],
    9: [[E, 58], [D, 58], [E, 113], [D, 113], [C, 140], [E, 167], [D, 167], [E, 222], [D, 222]],
    10: [[E, 58], [D, 58], [C, 86], [E, 113], [D, 113], [E, 167], [D, 167], [C, 194], [E, 222], [D, 222]],
  };

  const FONTE = "Georgia,'Times New Roman',serif";

  function canto(c, arte) {
    const dez = c.rank === '10';
    if (!arte && !FUNDOS.length) {
      return `<text x="22" y="42" font-size="${dez ? 29 : 34}"${dez ? ' letter-spacing="-3"' : ''} text-anchor="middle" fill="${COR[c.naipe]}" font-family="${FONTE}" font-weight="700">${c.rank}</text>${pip(c.naipe, 22, 64, 26, false)}`;
    }
    // (nas cartas com arte ou fundo desenhado: na faixa lateral da moldura do fundo, logo abaixo da borda de cima: na pilha do Senhor, a figura cobre o número
    // abaixo de y ≈ 66, e o índice precisa aparecer inteiro acima disso)
    return `<text x="15" y="41" font-size="${dez ? 19 : 24}"${dez ? ' letter-spacing="-3"' : ''} text-anchor="middle" fill="${COR[c.naipe]}" font-family="${FONTE}" font-weight="700">${c.rank}</text>${pip(c.naipe, 15, 56, 17, false)}`;
  }

  // Índice das figuras com arte: o de cima, à esquerda, maior que o das outras cartas; o de baixo, do tamanho de sempre.
  // Um contorno creme na letra a separa do desenho que passa por baixo.
  function cantoArte(c, grande) {
    const [x, y, fs, py, pt] = grande ? [27, 50, 44, 78, 34] : [22, 42, 34, 64, 26];
    return `<text x="${x}" y="${y}" font-size="${fs}" text-anchor="middle" fill="${COR[c.naipe]}" font-family="${FONTE}" font-weight="700" stroke="#fdfbf3" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${c.rank}</text>${pip(c.naipe, x, py, pt, false)}`;
  }

  const GLIFO = { J: '♞', Q: '♛', K: '♚' };
  const nomeFace = rank => (SS.Idioma ? SS.Idioma.t('carta.face.' + rank) : rank);

  function figura(c) {
    const cor = COR[c.naipe];
    const metade = `<text x="100" y="104" font-size="66" text-anchor="middle" fill="${cor}" font-family="'Segoe UI Symbol','DejaVu Sans',serif">${GLIFO[c.rank]}</text>
      ${pip(c.naipe, 64, 64, 32, false)}
      <text x="136" y="71" font-size="26" text-anchor="middle" fill="${cor}" font-family="${FONTE}" font-weight="700">${c.rank}</text>
      <text x="100" y="129" font-size="11" letter-spacing="2" text-anchor="middle" fill="${cor}" opacity=".8" font-family="${FONTE}">${nomeFace(c.rank)}</text>`;
    const [x, w, a] = FUNDOS.length ? [38, 124, '.45'] : [34, 132, '1'];
    return `<rect x="${x}" y="34" width="${w}" height="212" rx="4" fill="#f1e4c3" fill-opacity="${a}" stroke="${cor}" stroke-width="2.5"/>
      <rect x="${x + 6}" y="40" width="${w - 12}" height="200" rx="2" fill="none" stroke="#d1b779" stroke-width="1.5"/>
      <line x1="${x + 6}" y1="140" x2="${x + w - 6}" y2="140" stroke="#d1b779" stroke-width="1.5"/>
      <g>${metade}</g><g transform="rotate(180 100 140)">${metade}</g>`;
  }

  const cache = {};

  function frente(c) {
    const chave = c.rank + '-' + c.naipe;
    const arte = SS.ARTE[chave];
    const ck = chave + (SS.Idioma ? ':' + SS.Idioma.atual() : '');
    if (!arte && cache[ck]) return cache[ck];
    let corpo;
    // (a arte não passa da carta: já vem convertida para caber inteira, sem corte)
    if (arte) corpo = `<image href="${arte}${V_ARTE}" x="0" y="0" width="200" height="280" preserveAspectRatio="none"/>`;
    else if (c.rank === 'J' || c.rank === 'Q' || c.rank === 'K') corpo = figura(c);
    else if (c.rank === 'A') corpo = pip(c.naipe, 100, 140, 92, false);
    else corpo = LAYOUT[c.rank].map(([x, y]) => pip(c.naipe, x, y, 34, y > 140)).join('');
    const svg = `<svg class="svg-carta" viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
      ${fundo(chave)}
      ${corpo}${arte || FUNDOS.length ? BORDA : ''}${arte ? `<g>${cantoArte(c, true)}</g><g transform="rotate(180 100 140)">${cantoArte(c, false)}</g>` : `<g>${canto(c, arte)}</g><g transform="rotate(180 100 140)">${canto(c, arte)}</g>`}</svg>`;
    if (!arte) cache[ck] = svg;
    return svg;
  }

  // Dorso clássico: treliça de losangos com rosetas, borda branca e medalhão central.
  const CORES_DORSO = {
    vermelho: ['#b5161f', '#7d0d14'],
    azul: ['#1f4aa8', '#13306f'],
    verde: ['#1e7a43', '#0f4a28'],
    dourado: ['#b8860b', '#7a5806'],
  };

  function dorso(cor) {
    const [base, escuro] = CORES_DORSO[cor] || CORES_DORSO.vermelho;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280" preserveAspectRatio="none">
<defs><pattern id="g" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45 100 140)">
<rect width="16" height="16" fill="${base}"/>
<path d="M0 8H16M8 0V16" stroke="#fff" stroke-opacity=".45" stroke-width="1.1"/>
<circle cx="8" cy="8" r="2.8" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1"/>
<circle cx="0" cy="0" r="1.5" fill="#fff" fill-opacity=".65"/><circle cx="16" cy="0" r="1.5" fill="#fff" fill-opacity=".65"/>
<circle cx="0" cy="16" r="1.5" fill="#fff" fill-opacity=".65"/><circle cx="16" cy="16" r="1.5" fill="#fff" fill-opacity=".65"/>
</pattern></defs>
<rect x="1.5" y="1.5" width="197" height="277" rx="14" fill="#fdfbf3" stroke="#bdb59f" stroke-width="2"/>
<rect x="11" y="11" width="178" height="258" rx="7" fill="${escuro}"/>
<rect x="15" y="15" width="170" height="250" rx="5" fill="url(#g)"/>
<rect x="15" y="15" width="170" height="250" rx="5" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2"/>
<g transform="translate(100 140)">
<rect x="-27" y="-27" width="54" height="54" transform="rotate(45)" fill="${escuro}" stroke="#fff" stroke-width="2.5"/>
<rect x="-17" y="-17" width="34" height="34" transform="rotate(45)" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/>
<circle r="9" fill="none" stroke="#fff" stroke-width="2"/><circle r="3.5" fill="#fff"/></g>
</svg>`;
  }

  const comoUrl = svg => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

  // Carpete: pontilhado fino escuro + fibras claras alongadas, sobre o verde da mesa.
  function texturaCarpete() {
    const pontos = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="n" x="0" y="0"><feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.01  0 0 0 0 0.10  0 0 0 0 0.04  0 0 0 1 -0.32"/></filter><rect width="200" height="200" filter="url(#n)"/></svg>`;
    const fibras = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="f" x="0" y="0"><feTurbulence type="fractalNoise" baseFrequency="0.9 2.6" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.80  0 0 0 0 0.50  1.1 0 0 0 -0.62"/></filter><rect width="240" height="240" filter="url(#f)"/></svg>`;
    return `${comoUrl(pontos)}, ${comoUrl(fibras)}`;
  }

  function aplicarTexturas() {
    const raiz = document.documentElement.style;
    for (const cor of Object.keys(CORES_DORSO)) raiz.setProperty('--dorso-' + cor, comoUrl(dorso(cor)));
    raiz.setProperty('--carpete', texturaCarpete());
  }

  SS.Cartas = { frente, aplicarTexturas };
})(window.SS);
