/* Desenho das cartas: placeholders no padrão clássico de baralho.
   Para usar a arte final de uma carta, registre a imagem em SS.ARTE
   (chave = rank-naipe), por exemplo no fim deste arquivo:
     SS.ARTE['Q-copas'] = 'arte/rainha-de-copas.png';
   A imagem ocupa o miolo da carta; os índices dos cantos continuam desenhados. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';

  SS.ARTE = SS.ARTE || {};

  const COR = { copas: '#c41e2a', ouros: '#c41e2a', paus: '#17171f', espadas: '#17171f' };
  const FORMA = {
    copas: '<path d="M50 92C22 70 4 52 4 31 4 15 16 5 29 5c10 0 17 6 21 14 4-8 11-14 21-14 13 0 25 10 25 26 0 21-18 39-46 61z"/>',
    ouros: '<path d="M50 3 88 50 50 97 12 50z"/>',
    espadas: '<path d="M50 4C63 24 96 40 96 63c0 13-10 22-22 22-9 0-16-4-20-10 1 10 5 17 13 23H33c8-6 12-13 13-23-4 6-11 10-20 10C14 85 4 76 4 63 4 40 37 24 50 4z"/>',
    paus: '<circle cx="50" cy="27" r="20"/><circle cx="25" cy="57" r="20"/><circle cx="75" cy="57" r="20"/><path d="M45 50c0 22-5 36-13 46h36c-8-10-13-24-13-46z"/>',
  };

  function pip(naipe, cx, cy, tam, invertido) {
    const rot = invertido ? ` rotate(180 ${tam / 2} ${tam / 2})` : '';
    return `<g transform="translate(${cx - tam / 2} ${cy - tam / 2})${rot} scale(${tam / 100})" fill="${COR[naipe]}">${FORMA[naipe]}</g>`;
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

  function canto(c) {
    const dez = c.rank === '10';
    return `<text x="22" y="42" font-size="${dez ? 29 : 34}"${dez ? ' letter-spacing="-3"' : ''} text-anchor="middle" fill="${COR[c.naipe]}" font-family="${FONTE}" font-weight="700">${c.rank}</text>${pip(c.naipe, 22, 62, 22, false)}`;
  }

  const GLIFO = { J: '♞', Q: '♛', K: '♚' };
  const NOME = { J: 'VALETE', Q: 'RAINHA', K: 'REI' };

  function figura(c) {
    const cor = COR[c.naipe];
    const metade = `<text x="100" y="104" font-size="66" text-anchor="middle" fill="${cor}" font-family="'Segoe UI Symbol','DejaVu Sans',serif">${GLIFO[c.rank]}</text>
      ${pip(c.naipe, 64, 62, 24, false)}
      <text x="136" y="71" font-size="26" text-anchor="middle" fill="${cor}" font-family="${FONTE}" font-weight="700">${c.rank}</text>
      <text x="100" y="129" font-size="11" letter-spacing="2" text-anchor="middle" fill="${cor}" opacity=".8" font-family="${FONTE}">${NOME[c.rank]}</text>`;
    return `<rect x="34" y="34" width="132" height="212" rx="4" fill="#f1e4c3" stroke="${cor}" stroke-width="2.5"/>
      <rect x="40" y="40" width="120" height="200" rx="2" fill="none" stroke="#d1b779" stroke-width="1.5"/>
      <line x1="40" y1="140" x2="160" y2="140" stroke="#d1b779" stroke-width="1.5"/>
      <g>${metade}</g><g transform="rotate(180 100 140)">${metade}</g>`;
  }

  const cache = {};

  function frente(c) {
    const chave = c.rank + '-' + c.naipe;
    const arte = SS.ARTE[chave];
    if (!arte && cache[chave]) return cache[chave];
    let corpo;
    if (arte) corpo = `<image href="${arte}" x="34" y="34" width="132" height="212" preserveAspectRatio="xMidYMid slice"/>`;
    else if (c.rank === 'J' || c.rank === 'Q' || c.rank === 'K') corpo = figura(c);
    else if (c.rank === 'A') corpo = pip(c.naipe, 100, 140, 92, false);
    else corpo = LAYOUT[c.rank].map(([x, y]) => pip(c.naipe, x, y, 34, y > 140)).join('');
    const svg = `<svg class="svg-carta" viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="197" height="277" rx="14" fill="#fdfbf3" stroke="#bdb59f" stroke-width="2"/>
      ${corpo}<g>${canto(c)}</g><g transform="rotate(180 100 140)">${canto(c)}</g></svg>`;
    if (!arte) cache[chave] = svg;
    return svg;
  }

  // Dorso clássico: treliça de losangos com rosetas, borda branca e medalhão central.
  function dorso(cor) {
    const base = cor === 'azul' ? '#1f4aa8' : '#b5161f';
    const escuro = cor === 'azul' ? '#13306f' : '#7d0d14';
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
    raiz.setProperty('--dorso-vermelho', comoUrl(dorso('vermelho')));
    raiz.setProperty('--dorso-azul', comoUrl(dorso('azul')));
    raiz.setProperty('--carpete', texturaCarpete());
  }

  SS.Cartas = { frente, aplicarTexturas };
})(window.SS);
