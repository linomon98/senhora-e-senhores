/* Sons e músicas. Os arquivos ficam em sons/ (veja sons/LEIA-ME.md), gravados com ferramentas/gravador.html:
   para trocar um som, basta salvar o arquivo novo por cima, com o mesmo nome. Som que não existe fica em silêncio.
   Variações (golpe-1.wav, golpe-2.wav…) são sorteadas a cada vez, sem repetir a anterior. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';
  const PASTA = 'sons/';
  // nome → quantas variações (0 = um arquivo só, sem número no nome)
  const EFEITOS = {
    'abrir-popup': 0, 'as-copas': 0, 'as-espadas': 0, 'as-ouros': 0, 'as-paus': 0, 'berserk': 0, 'bloquear': 2, 'buscar-as': 0,
    'clique': 3, 'cobra-chiado': 0, 'cobra-mordida': 3, 'comprar-carta': 3, 'cura': 2, 'dado-6': 0, 'dado-adicional': 0, 'dado-parou': 2,
    'dado-rolando': 3, 'dano-extra': 0, 'declarar-ataque': 2, 'defesa': 0, 'derrota': 0, 'descartar': 2, 'desistir': 0, 'embaralhar': 0,
    'escolher-palhaco': 0, 'fechar-popup': 0, 'golpe-ignorado': 2, 'golpe-no-vento': 0, 'hover-carta': 2, 'impacto-forte': 3,
    'impacto-fraco': 3, 'impacto-medio': 3, 'investida': 3, 'magia-par': 2, 'mira-seta': 2, 'palco-entra': 0, 'palco-sai': 0,
    'palhaco-dano': 3, 'palhaco-dano-forte': 2, 'passar-turno': 0, 'poder-cobranca': 0, 'poder-desafio': 0, 'poder-pronto': 0,
    'poder-sangria': 0, 'poder-transfusao': 0, 'poder-vigilia': 0, 'preparar-ataque': 0, 'pv-baixo': 0, 'que-vergonha': 2,
    'refletido': 0, 'refletir-de-volta': 0, 'refletir': 0, 'reviver': 0, 'selecionar-carta': 3, 'senhor-morre': 3, 'seu-turno': 0,
    'soltar-carta': 3, 'sumonar': 2, 'sumonar-rainha': 0, 'turno-oponente': 0, 'versus': 0, 'vitoria': 0,
  };
  // Mixagem: os arquivos já estão masterizados no mesmo loudness (-20 dB); aqui fica o volume de cada som
  // em relação ao geral. Interface e sons que tocam toda hora ficam no fundo; o combate fica na frente;
  // os momentos grandes (vitória, derrota, "que vergonha") por cima de tudo.
  const VOLUME = {
    // interface (no fundo)
    'hover-carta': 0, // mudo por enquanto (estava irritante); para voltar, ponha uns 0.15
    'clique': 0.4, 'selecionar-carta': 0.4, 'mira-seta': 0.35, 'abrir-popup': 0.35, 'fechar-popup': 0.3,
    'poder-pronto': 0.45, 'escolher-palhaco': 0.6, 'versus': 0.75, 'desistir': 0.6,
    // cartas
    'comprar-carta': 0.5, 'soltar-carta': 0.6, 'descartar': 0.5, 'embaralhar': 0.5, 'palco-entra': 0.45, 'palco-sai': 0.4,
    'sumonar': 0.75, 'sumonar-rainha': 0.8, 'as-espadas': 0.7, 'as-paus': 0.7, 'as-ouros': 0.7, 'as-copas': 0.7,
    // ações e magias
    'dano-extra': 0.7, 'berserk': 0.75, 'defesa': 0.7, 'cura': 0.65, 'dado-adicional': 0.6,
    'magia-par': 0.7, 'reviver': 0.75, 'buscar-as': 0.7, 'refletir': 0.8, 'refletido': 0.8, 'refletir-de-volta': 0.85,
    'poder-desafio': 0.8, 'poder-transfusao': 0.75, 'poder-sangria': 0.8, 'poder-vigilia': 0.75, 'poder-cobranca': 0.75,
    // combate (na frente)
    'preparar-ataque': 0.6, 'declarar-ataque': 0.75, 'bloquear': 0.7, 'investida': 0.55,
    'dado-rolando': 0.5, 'dado-parou': 0.55, 'dado-6': 0.75,
    'impacto-fraco': 0.75, 'impacto-medio': 0.88, 'impacto-forte': 1, 'golpe-ignorado': 0.65, 'golpe-no-vento': 0.7,
    'palhaco-dano': 0.8, 'palhaco-dano-forte': 0.95, 'senhor-morre': 0.8, 'pv-baixo': 0.5,
    // turno e momentos grandes
    'seu-turno': 0.55, 'turno-oponente': 0.45, 'passar-turno': 0.55, 'que-vergonha': 0.95, 'vitoria': 1, 'derrota': 1,
    // cobra (do jeito que estava)
    'cobra-mordida': 0.3, 'cobra-chiado': 0.15,
  };
  const MUSICAS = ['musica-menu', 'musica-partida'];
  const VOLUME_MUSICA = 0.45;

  let ligado = { efeitos: true, musica: true }, volume = 0.8;
  let ctx = null, mestre = null, carregado = false, musicaPedida = null, musicaAtual = null;
  const buffers = {}; // nome → lista de AudioBuffer (as variações que carregaram)
  const ultimo = {}; // nome → índice da última variação tocada
  const canais = {}; // canal → { fonte, ganho } que está tocando (ex.: o dado rolando, para parar quando ele para)
  const faixas = {}; // música → <audio> em loop

  const arquivosDe = nome => (EFEITOS[nome] ? Array.from({ length: EFEITOS[nome] }, (_, k) => `${nome}-${k + 1}.wav`) : [nome + '.wav']);

  // Só carrega depois do primeiro clique ou tecla: o navegador não deixa tocar nada antes disso.
  function carregar() {
    if (carregado) return;
    carregado = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // Saída: volume geral → compressor (segura quando muitos sons tocam juntos) → limitador (nunca estoura).
    mestre = ctx.createGain();
    mestre.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.18;
    const limite = ctx.createDynamicsCompressor();
    limite.threshold.value = -2; limite.knee.value = 0; limite.ratio.value = 20; limite.attack.value = 0.001; limite.release.value = 0.08;
    const ganhoFinal = ctx.createGain();
    ganhoFinal.gain.value = 1.25; // repõe o que o compressor tirou
    mestre.connect(comp);
    comp.connect(ganhoFinal);
    ganhoFinal.connect(limite);
    limite.connect(ctx.destination);
    for (const nome of Object.keys(EFEITOS)) {
      buffers[nome] = [];
      for (const arq of arquivosDe(nome)) {
        fetch(PASTA + arq).then(r => (r.ok ? r.arrayBuffer() : null))
          .then(b => (b ? new Promise((ok, erro) => ctx.decodeAudioData(b, ok, erro)) : null))
          .then(buf => { if (buf) buffers[nome].push(buf); })
          .catch(() => { /* arquivo faltando ou estragado: fica em silêncio */ });
      }
    }
    MUSICAS.forEach(nome => {
      const a = new Audio(PASTA + nome + '.mp3');
      a.loop = true;
      a.volume = VOLUME_MUSICA * volume;
      a.addEventListener('canplaythrough', () => { if (musicaPedida === nome) tocarMusica(); }, { once: true });
      a.addEventListener('error', () => { delete faixas[nome]; }, { once: true });
      faixas[nome] = a;
    });
  }

  // o: { vol (0–1, multiplica o volume do som), canal (um som por canal: o novo corta o anterior), atraso (ms) }
  function tocar(nome, o) {
    o = o || {};
    if (!ligado.efeitos || !ctx || !buffers[nome] || !buffers[nome].length || VOLUME[nome] === 0) return;
    if (o.atraso) return void setTimeout(() => tocar(nome, Object.assign({}, o, { atraso: 0 })), o.atraso);
    if (ctx.state === 'suspended') ctx.resume();
    const lista = buffers[nome];
    let k = Math.floor(Math.random() * lista.length);
    if (lista.length > 1 && k === ultimo[nome]) k = (k + 1) % lista.length; // não repete a mesma variação seguida
    ultimo[nome] = k;
    const fonte = ctx.createBufferSource(), ganho = ctx.createGain();
    fonte.buffer = lista[k];
    fonte.playbackRate.value = 0.96 + Math.random() * 0.08; // leve variação de tom: soa menos repetido
    ganho.gain.value = (VOLUME[nome] == null ? 1 : VOLUME[nome]) * (o.vol == null ? 1 : o.vol);
    fonte.connect(ganho);
    ganho.connect(mestre);
    if (o.canal) {
      parar(o.canal);
      canais[o.canal] = { fonte, ganho };
      fonte.onended = () => { if (canais[o.canal] && canais[o.canal].fonte === fonte) delete canais[o.canal]; };
    }
    fonte.start();
  }

  // Para o som de um canal com um fade curtinho.
  function parar(canal) {
    const c = canais[canal];
    if (!c || !ctx) return;
    delete canais[canal];
    const agora = ctx.currentTime;
    c.ganho.gain.setTargetAtTime(0, agora, 0.05);
    try { c.fonte.stop(agora + 0.25); } catch (e) { /* já parou */ }
  }

  function tocarMusica() {
    const nova = ligado.musica && musicaPedida ? faixas[musicaPedida] : null;
    if (musicaAtual && musicaAtual !== nova) musicaAtual.pause();
    musicaAtual = nova && nova.readyState >= 3 ? nova : null;
    if (!musicaAtual) return;
    musicaAtual.volume = VOLUME_MUSICA * volume;
    if (musicaAtual.paused) {
      musicaAtual.currentTime = 0;
      musicaAtual.play().catch(() => {});
    }
  }

  // nome: 'menu', 'partida' ou null (silêncio).
  function musica(nome) {
    musicaPedida = nome ? 'musica-' + nome : null;
    tocarMusica();
  }

  // o: { efeitos, musica (liga/desliga), volume (0–100) }
  function configurar(o) {
    ligado = { efeitos: o.efeitos !== false, musica: o.musica !== false };
    volume = o.volume == null ? 0.8 : Math.max(0, Math.min(1, o.volume / 100));
    if (mestre) mestre.gain.value = volume;
    if (!ligado.efeitos) Object.keys(canais).forEach(parar);
    tocarMusica();
  }

  addEventListener('pointerdown', carregar, { once: true, capture: true });
  addEventListener('keydown', carregar, { once: true, capture: true });
  // Clique em qualquer botão do jogo (menus, ações, opções).
  addEventListener('click', ev => { if (ev.target.closest && ev.target.closest('button')) tocar('clique'); }, true);

  SS.Som = {
    tocar, parar, musica, configurar,
    // Para conferir pelo console quais arquivos o jogo achou e o que está tocando.
    depurar: () => ({ efeitos: Object.keys(EFEITOS).filter(n => buffers[n] && buffers[n].length).map(n => n + ' ×' + buffers[n].length), faltando: Object.keys(EFEITOS).filter(n => !buffers[n] || !buffers[n].length), musica: musicaAtual && !musicaAtual.paused ? musicaPedida : null }),
  };
})(window.SS);
