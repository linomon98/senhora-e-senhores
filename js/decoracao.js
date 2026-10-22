/* Decorações do cenário (cantos da mesa), cada uma com sua animação:
   - Ratinhos vendo TV: as orelhas dão espasmos; a TV brilha e ilumina o contorno dos ratos. Clicar na TV
     troca a cor do brilho (as cores dos naipes).
   - Cinzeiro: fumaça saindo do cigarro sem parar.
   - Barata com isqueiro: antenas balançando e o corpo respirando. Clicar no isqueiro: 1 chance em 10 de
     acender; senão, só faíscas.
   - Formigas: anteninhas mexendo; clicar na espada faz ela tremer (sem sair da pedra).
   As partes que mexem foram recortadas das artes (arte/decoracao/); posições em % da própria decoração. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';
  const PASTA = 'arte/decoracao/';
  const MOV_REDUZIDO = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // l, t, w, h: lugar da parte (%); ox, oy: ponto de giro (% da parte)
  const DECORACOES = {
    ratos: {
      x: 69, y: 94, w: 288, prop: 2186 / 1758,
      partes: {
        silhueta: { l: 38.29, t: 17.97, w: 40.94, h: 44.94 },
        orelhaa: { l: 39.89, t: 36.18, w: 10.52, h: 11.09, ox: 80.4, oy: 71.8 },
        orelhab: { l: 51.10, t: 32.48, w: 8.23, h: 12.80, ox: 33.3, oy: 91.1 },
        orelhac: { l: 59.56, t: 24.80, w: 6.63, h: 14.22, ox: 82.8, oy: 86.0 },
        orelhad: { l: 68.94, t: 21.39, w: 8.46, h: 12.51, ox: 16.2, oy: 88.6 },
      },
      // tela da TV (em perspectiva): caixa + os 4 cantos dentro dela (%)
      tela: { l: 14.73, t: 28.5, w: 16.7, h: 25.77, cantos: '2.7% 28.7%, 89.3% 1.5%, 98.6% 84.8%, 4.9% 98.5%' },
    },
    cinzeiro: { x: 1236, y: 197, w: 251, prop: 2294 / 1742, brasa: [42.7, 45.8], partes: {} },
    barata: {
      x: 1319, y: 463, w: 138, prop: 1514 / 2564, chama: [10, 20.4],
      partes: {
        antenaesq: { l: 8.06, t: -1.25, w: 22.46, h: 13.26, ox: 86.8, oy: 100 },
        antenadir: { l: 56.94, t: 2.26, w: 43.33, h: 19.19, ox: 1.2, oy: 100 },
      },
      isqueiro: { l: 0, t: 12.8, w: 41, h: 73 },
    },
    formigas: {
      x: 39, y: 571, w: 330, prop: 2198 / 1300,
      partes: {
        a: { l: 47.86, t: 12.62, w: 3.87, h: 3.85, ox: 29.4, oy: 106 },
        b: { l: 4.64, t: 32.08, w: 3.73, h: 4.08, ox: 22, oy: 103.8 },
        c: { l: 36.49, t: 44.00, w: 3.55, h: 4.23, ox: 19.2, oy: 105.5 },
        d: { l: 88.13, t: 43.85, w: 2.73, h: 3.62, ox: 83.3, oy: 106.4 },
        e: { l: 39.90, t: 62.62, w: 4.09, h: 4.69, ox: 22.2, oy: 108.2 },
        f: { l: 46.27, t: 65.38, w: 5.00, h: 4.00, ox: 50, oy: 109.6 },
        g: { l: 56.28, t: 66.69, w: 3.64, h: 3.92, ox: 50, oy: 107.8 },
        h: { l: 40.04, t: 80.38, w: 3.37, h: 3.77, ox: 20.3, oy: 112.2 },
        espada: { l: 52.87, t: 2.85, w: 10.92, h: 25.00, ox: 33.3, oy: 104.6 },
      },
    },
  };
  // Cores do brilho da TV: as dos naipes (Espadas azul, Copas vermelho, Paus verde, Ouros dourado).
  const CORES_TV = ['#4d8dff', '#ff4a44', '#4fd34a', '#ffc531'];

  const el = (tag, cls, estilo) => { const e = document.createElement(tag); if (cls) e.className = cls; if (estilo) Object.assign(e.style, estilo); return e; };
  const pct = v => v + '%';

  function montarParte(raiz, nome, id, p) {
    const img = el('img', 'deco-parte deco-' + nome + '-' + id, { left: pct(p.l), top: pct(p.t), width: pct(p.w), height: pct(p.h), transformOrigin: `${p.ox == null ? 50 : p.ox}% ${p.oy == null ? 50 : p.oy}%` });
    img.src = PASTA + nome + id + '.webp';
    img.alt = '';
    img.draggable = false;
    raiz.appendChild(img);
    return img;
  }

  function montar(mesa) {
    if (!mesa || mesa.querySelector('.decoracoes')) return;
    const camada = el('div', 'decoracoes');
    camada.setAttribute('aria-hidden', 'true');
    mesa.appendChild(camada);
    const partes = {};
    for (const [nome, d] of Object.entries(DECORACOES)) {
      const raiz = el('div', 'deco deco-' + nome, { left: d.x + 'px', top: d.y + 'px', width: d.w + 'px', height: (d.w / d.prop).toFixed(1) + 'px' });
      const base = el('img', 'deco-base');
      base.src = PASTA + nome + 'base.webp';
      base.alt = '';
      base.draggable = false;
      raiz.appendChild(base);
      partes[nome] = {};
      for (const [id, p] of Object.entries(d.partes)) partes[nome][id] = montarParte(raiz, nome, id, p);
      camada.appendChild(raiz);
      d.raiz = raiz;
    }
    ratos(DECORACOES.ratos, partes.ratos);
    cinzeiro(DECORACOES.cinzeiro);
    barata(DECORACOES.barata);
    formigas(DECORACOES.formigas, partes.formigas);
  }

  // ---------- Ratinhos e TV ----------
  function ratos(d, partes) {
    const t = d.tela;
    // luz que sai da TV e se espalha pela sala (para o lado dos ratos)
    const luz = el('div', 'tv-luz', { left: pct(t.l - 6), top: pct(t.t - 14), width: pct(t.w * 3.2), height: pct(t.h * 1.7) });
    d.raiz.insertBefore(luz, d.raiz.querySelector('.deco-base').nextSibling);
    const brilho = el('div', 'tv-brilho', { left: pct(t.l), top: pct(t.t), width: pct(t.w), height: pct(t.h), clipPath: `polygon(${t.cantos})` });
    d.raiz.insertBefore(brilho, partes.silhueta);
    const botao = el('button', 'deco-clique tv-botao', { left: pct(t.l - 4), top: pct(t.t - 6), width: pct(t.w + 8), height: pct(t.h + 12) });
    botao.title = 'TV';
    d.raiz.appendChild(botao);
    let cor = 0;
    const aplicar = () => d.raiz.style.setProperty('--tv', CORES_TV[cor]);
    aplicar();
    botao.addEventListener('click', ev => {
      ev.stopPropagation();
      cor = (cor + 1) % CORES_TV.length;
      aplicar();
      for (const e of [brilho, luz]) { e.classList.remove('troca'); void e.offsetWidth; e.classList.add('troca'); }
    });
    // Espasmo de orelha de rato: rapidinho, às vezes duas vezes seguidas, em horas sorteadas.
    if (MOV_REDUZIDO) return;
    for (const id of ['orelhaa', 'orelhab', 'orelhac', 'orelhad']) {
      const orelha = partes[id];
      const proximo = () => setTimeout(() => {
        if (!document.hidden) {
          orelha.classList.remove('espasmo', 'espasmo2'); void orelha.offsetWidth;
          orelha.classList.add(Math.random() < 0.35 ? 'espasmo2' : 'espasmo');
        }
        proximo();
      }, 1400 + Math.random() * 4200);
      proximo();
    }
  }

  // ---------- Cinzeiro: fumaça contínua ----------
  function cinzeiro(d) {
    const origem = el('div', 'fumaca', { left: pct(d.brasa[0]), top: pct(d.brasa[1]) });
    d.raiz.appendChild(origem);
    if (MOV_REDUZIDO) return;
    const soltar = () => {
      if (!document.hidden && origem.childElementCount < 14) {
        const p = el('span', 'fumaca-puff');
        const lado = (Math.random() * 2 - 1);
        p.style.setProperty('--dx1', (lado * 10).toFixed(1) + 'px');
        p.style.setProperty('--dx2', (lado * -14 + 6).toFixed(1) + 'px');
        p.style.setProperty('--dx3', (lado * 18 + 10).toFixed(1) + 'px');
        p.style.animationDuration = (3.2 + Math.random() * 1.6).toFixed(2) + 's';
        p.addEventListener('animationend', () => p.remove());
        origem.appendChild(p);
      }
      setTimeout(soltar, 260 + Math.random() * 220);
    };
    soltar();
  }

  // ---------- Barata e isqueiro ----------
  function barata(d) {
    const iq = d.isqueiro;
    const botao = el('button', 'deco-clique isqueiro-botao', { left: pct(iq.l), top: pct(iq.t), width: pct(iq.w), height: pct(iq.h) });
    botao.title = 'Isqueiro';
    d.raiz.appendChild(botao);
    const ponto = el('div', 'isqueiro-ponto', { left: pct(d.chama[0]), top: pct(d.chama[1]) });
    d.raiz.appendChild(ponto);
    let acesoAte = 0;
    botao.addEventListener('click', ev => {
      ev.stopPropagation();
      if (SS.Som) SS.Som.tocar('dano-extra', { vol: 0.35 }); // o "clic" da pedra do isqueiro
      if (Date.now() < acesoAte) return;
      if (Math.random() < 0.1) {
        // Acendeu! Uma chama tremulando por uns segundos.
        acesoAte = Date.now() + 2600;
        const chama = el('div', 'isqueiro-chama');
        chama.innerHTML = '<i></i>';
        ponto.appendChild(chama);
        setTimeout(() => { chama.classList.add('apagando'); setTimeout(() => chama.remove(), 450); }, 2200);
      } else faiscas(ponto);
    });
  }

  function faiscas(ponto) {
    const flash = el('span', 'faisca-flash');
    ponto.appendChild(flash);
    setTimeout(() => flash.remove(), 220);
    for (let k = 0; k < 9; k++) {
      const f = el('span', 'faisca-isqueiro');
      const ang = -Math.PI / 2 + (Math.random() * 2 - 1) * 1.3, dist = 10 + Math.random() * 22;
      f.style.setProperty('--fx', (Math.cos(ang) * dist).toFixed(1) + 'px');
      f.style.setProperty('--fy', (Math.sin(ang) * dist).toFixed(1) + 'px');
      f.style.animationDelay = (Math.random() * 60).toFixed(0) + 'ms';
      f.addEventListener('animationend', () => f.remove());
      ponto.appendChild(f);
    }
  }

  // ---------- Formigas e espada ----------
  function formigas(d, partes) {
    const espada = partes.espada;
    espada.classList.add('deco-clique-img');
    espada.title = 'Espada';
    espada.addEventListener('click', ev => {
      ev.stopPropagation();
      if (SS.Som) SS.Som.tocar('dano-extra', { vol: 0.5 });
      espada.classList.remove('treme'); void espada.offsetWidth; espada.classList.add('treme');
    });
    // Cada antena num ritmo diferente.
    'abcdefgh'.split('').forEach((id, k) => {
      const a = partes[id];
      a.style.animationDuration = (0.9 + (k % 4) * 0.27).toFixed(2) + 's';
      a.style.animationDelay = (-k * 0.37).toFixed(2) + 's';
      a.classList.add('antena-formiga');
    });
  }

  SS.Decoracao = { montar };
})(window.SS);
