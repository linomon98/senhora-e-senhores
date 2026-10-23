/* Sons e músicas. Os arquivos ficam em sons/ (veja sons/LEIA-ME.md), gravados com ferramentas/gravador.html:
   para trocar um som, basta salvar o arquivo novo por cima, com o mesmo nome. Som que não existe fica em silêncio.
   Variações (golpe-1.wav, golpe-2.wav…) são sorteadas a cada vez, sem repetir a anterior. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';
  const PASTA = 'sons/';
  // Mesma versão do script (?v=…): quando um som é trocado e o jogo publicado de novo, o navegador baixa o novo.
  const VERSAO = (() => { const s = document.currentScript && document.currentScript.src.match(/[?&]v=(\d+)/); return s ? '?v=' + s[1] : ''; })();
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
    'soltar-carta': 3, 'sumonar': 2, 'sumonar-rainha': 3, 'sumonar-valete': 3, 'sumonar-rei': 3, 'turno-oponente': 0, 'versus': 0, 'vitoria': 0,
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
    'sumonar': 0.75, 'sumonar-rainha': 0.8, 'sumonar-valete': 0.75, 'sumonar-rei': 0.8, 'as-espadas': 0.7, 'as-paus': 0.7, 'as-ouros': 0.7, 'as-copas': 0.7,
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
  // Música: um loop só (sons/musica.wav, cortado no compasso para emendar sem pulo), tocado pelo Web Audio
  // com loop exato. Menu e partida usam a mesma faixa por enquanto; trocar de tela não reinicia a música.
  const ARQ_MUSICA = 'musica.mp3', VOLUME_MUSICA = 0.7; // volume máximo da música (o slider das Opções vai de 0 a isso)
  let volumeMusica = 0.6; // slider "Música" das Opções (0–1), separado do volume dos efeitos

  let ligado = { efeitos: true, musica: true }, volume = 0.8;
  let ctx = null, mestre = null, carregado = false, musicaPedida = null;
  let bufMusica = null, fonteMusica = null, ganhoMusica = null;
  const buffers = {}; // nome → lista de AudioBuffer (as variações que carregaram)
  const ultimo = {}; // nome → índice da última variação tocada
  const canais = {}; // canal → { fonte, ganho } que está tocando (ex.: o dado rolando, para parar quando ele para)

  // Os sons vão em MP3 (6x menores que o WAV do gravador). O MP3 começa com ~46 ms de silêncio do codificador:
  // ao carregar, esse silêncio do começo é cortado (até 70 ms), para os sons não saírem atrasados.
  const arquivosDe = nome => (EFEITOS[nome] ? Array.from({ length: EFEITOS[nome] }, (_, k) => `${nome}-${k + 1}.mp3`) : [nome + '.mp3']);
  // Para o loop da música emendar sem pausa: corta também o enchimento que o MP3 deixa no fim.
  function semSilencioNoFim(buf) {
    const d = buf.getChannelData(0), min = Math.max(0, d.length - Math.round(buf.sampleRate * 0.1));
    let f = d.length;
    while (f > min && Math.abs(d[f - 1]) < 0.0005) f--;
    if (d.length - f < 8) return buf;
    const novo = ctx.createBuffer(buf.numberOfChannels, f, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) novo.copyToChannel(buf.getChannelData(c).subarray(0, f), c);
    return novo;
  }
  function semSilencioInicial(buf) {
    const d = buf.getChannelData(0), max = Math.min(d.length - 1, Math.round(buf.sampleRate * 0.07));
    let i = 0;
    while (i < max && Math.abs(d[i]) < 0.001) i++;
    i = Math.max(0, i - Math.round(buf.sampleRate * 0.002));
    if (i < 8) return buf;
    const novo = ctx.createBuffer(buf.numberOfChannels, buf.length - i, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) novo.copyToChannel(buf.getChannelData(c).subarray(i), c);
    return novo;
  }

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
        fetch(PASTA + arq + VERSAO).then(r => (r.ok ? r.arrayBuffer() : null))
          .then(b => (b ? new Promise((ok, erro) => ctx.decodeAudioData(b, ok, erro)) : null))
          .then(buf => { if (buf) buffers[nome].push(semSilencioInicial(buf)); })
          .catch(() => { /* arquivo faltando ou estragado: fica em silêncio */ });
      }
    }
    ganhoMusica = ctx.createGain();
    ganhoMusica.gain.value = VOLUME_MUSICA * volumeMusica;
    ganhoMusica.connect(ctx.destination); // fora do compressor dos efeitos (para a música não "bombear")
    if (ARQ_MUSICA) fetch(PASTA + ARQ_MUSICA + VERSAO).then(r => (r.ok ? r.arrayBuffer() : null))
      .then(b => (b ? new Promise((ok, erro) => ctx.decodeAudioData(b, ok, erro)) : null))
      .then(buf => { if (buf) { bufMusica = semSilencioNoFim(semSilencioInicial(buf)); tocarMusica(); } })
      .catch(() => { /* sem música */ });
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
    if (!ctx || !ganhoMusica) return;
    ganhoMusica.gain.setTargetAtTime(VOLUME_MUSICA * volumeMusica, ctx.currentTime, 0.05);
    const querTocar = ligado.musica && musicaPedida && bufMusica;
    if (querTocar && !fonteMusica) {
      if (ctx.state === 'suspended') ctx.resume();
      fonteMusica = ctx.createBufferSource();
      fonteMusica.buffer = bufMusica;
      fonteMusica.loop = true;
      fonteMusica.connect(ganhoMusica);
      // entra com um fade curtinho
      ganhoMusica.gain.setValueAtTime(0, ctx.currentTime);
      ganhoMusica.gain.linearRampToValueAtTime(VOLUME_MUSICA * volumeMusica, ctx.currentTime + 0.8);
      fonteMusica.start();
    } else if (!querTocar && fonteMusica) {
      const f = fonteMusica;
      fonteMusica = null;
      ganhoMusica.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      try { f.stop(ctx.currentTime + 0.8); } catch (e) { /* já parou */ }
      setTimeout(() => { if (!fonteMusica) ganhoMusica.gain.value = VOLUME_MUSICA * volumeMusica; }, 900);
    }
  }

  // nome: 'menu', 'partida' ou null (silêncio).
  function musica(nome) {
    musicaPedida = nome || null;
    tocarMusica();
  }

  // o: { efeitos, musica (liga/desliga), volume (0–100, efeitos), volumeMusica (0–100; 0 desliga a música) }
  function configurar(o) {
    volumeMusica = o.volumeMusica == null ? 0.6 : Math.max(0, Math.min(1, o.volumeMusica / 100));
    ligado = { efeitos: o.efeitos !== false, musica: o.musica !== false && volumeMusica > 0 };
    volume = o.volume == null ? 0.8 : Math.max(0, Math.min(1, o.volume / 100));
    if (mestre) mestre.gain.value = volume;
    if (!ligado.efeitos) Object.keys(canais).forEach(parar);
    tocarMusica();
  }

  // ---------- Sons feitos na hora (camadas por cima dos seus sons de vitória e derrota) ----------
  // Aplausos, vaia, fogos de artifício e tomate esborrachando: gerados com ruído e osciladores,
  // passam pelo mesmo volume geral dos efeitos.
  function saida(vol) {
    const g = ctx.createGain();
    g.gain.value = vol;
    g.connect(mestre);
    return g;
  }
  const pronto = () => ligado.efeitos && ctx && (ctx.state !== 'suspended' || (ctx.resume(), true));

  // Plateia batendo palmas: centenas de palminhas curtas de ruído, mais densas no meio.
  function aplausos(dur) {
    if (!pronto()) return;
    dur = dur || 4;
    const taxa = ctx.sampleRate, n = Math.round(taxa * dur), buf = ctx.createBuffer(2, n, taxa);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      const palmas = Math.round(dur * 70);
      for (let k = 0; k < palmas; k++) {
        const t = Math.random() * dur, env = Math.sin(Math.PI * Math.min(1, t / dur)) ** 0.6;
        if (Math.random() > env) continue;
        const ini = Math.round(t * taxa), len = Math.round(taxa * (0.006 + Math.random() * 0.012)), amp = 0.25 + Math.random() * 0.5;
        for (let i = 0; i < len * 4 && ini + i < n; i++) d[ini + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / len);
      }
    }
    const f = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter();
    f.buffer = buf;
    hp.type = 'highpass'; hp.frequency.value = 500;
    bp.type = 'peaking'; bp.frequency.value = 1800; bp.gain.value = 5; bp.Q.value = 0.8;
    f.connect(hp); hp.connect(bp); bp.connect(saida(0.55));
    f.start();
  }

  // Vaia: um coro de "buuuu" (vozes graves em "u", cada uma num tom, descendo) com um pouco de sopro.
  function vaia(dur) {
    if (!pronto()) return;
    dur = dur || 3.2;
    const agora = ctx.currentTime, mix = saida(0.5);
    const formante = ctx.createBiquadFilter(), passa = ctx.createBiquadFilter();
    formante.type = 'bandpass'; formante.frequency.value = 330; formante.Q.value = 1.4;
    passa.type = 'lowpass'; passa.frequency.value = 900;
    formante.connect(passa); passa.connect(mix);
    for (let v = 0; v < 9; v++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vibG = ctx.createGain();
      const f0 = 95 + Math.random() * 90, ini = agora + Math.random() * 0.35;
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, ini);
      o.frequency.linearRampToValueAtTime(f0 * 0.82, ini + dur);
      vib.frequency.value = 4 + Math.random() * 3; vibG.gain.value = f0 * 0.025;
      vib.connect(vibG); vibG.connect(o.frequency);
      g.gain.setValueAtTime(0, ini);
      g.gain.linearRampToValueAtTime(0.16, ini + 0.35);
      g.gain.setValueAtTime(0.16, ini + dur - 0.7);
      g.gain.linearRampToValueAtTime(0, ini + dur);
      o.connect(g); g.connect(formante);
      o.start(ini); vib.start(ini); o.stop(ini + dur + 0.05); vib.stop(ini + dur + 0.05);
    }
  }

  // Fogos: um estouro grave e um chiado de faíscas estalando.
  function fogos() {
    if (!pronto()) return;
    const taxa = ctx.sampleRate, n = Math.round(taxa * 1.1), buf = ctx.createBuffer(1, n, taxa), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / taxa;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t / 0.07) * 0.9; // estouro
      if (t > 0.08 && Math.random() < 0.004) d[i] += (Math.random() < 0.5 ? -1 : 1) * 0.8 * Math.exp(-(t - 0.08) / 0.5); // estalos
    }
    const f = ctx.createBufferSource(), lp = ctx.createBiquadFilter();
    f.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 2600;
    f.playbackRate.value = 0.8 + Math.random() * 0.5;
    f.connect(lp); lp.connect(saida(0.32));
    f.start();
  }

  // Tomate esborrachando na tela: um "plaft" abafado.
  function tomate() {
    if (!pronto()) return;
    const taxa = ctx.sampleRate, n = Math.round(taxa * 0.35), buf = ctx.createBuffer(1, n, taxa), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { const t = i / taxa; d[i] = ((Math.random() * 2 - 1) * 0.8 + Math.sin(2 * Math.PI * (140 - 200 * t) * t) * 0.6) * Math.exp(-t / 0.06); }
    const f = ctx.createBufferSource(), lp = ctx.createBiquadFilter();
    f.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 1100;
    f.playbackRate.value = 0.85 + Math.random() * 0.3;
    f.connect(lp); lp.connect(saida(0.6));
    f.start();
  }

  addEventListener('pointerdown', carregar, { once: true, capture: true });
  addEventListener('keydown', carregar, { once: true, capture: true });
  // Clique em qualquer botão do jogo (menus, ações, opções).
  addEventListener('click', ev => { if (ev.target.closest && ev.target.closest('button')) tocar('clique'); }, true);

  SS.Som = {
    tocar, parar, musica, configurar, aplausos, vaia, fogos, tomate,
    tem: nome => !!(buffers[nome] && buffers[nome].length), // o som já carregou (existe o arquivo)?
    // Para conferir pelo console quais arquivos o jogo achou e o que está tocando.
    depurar: () => ({ efeitos: Object.keys(EFEITOS).filter(n => buffers[n] && buffers[n].length).map(n => n + ' ×' + buffers[n].length), faltando: Object.keys(EFEITOS).filter(n => !buffers[n] || !buffers[n].length), musica: fonteMusica ? musicaPedida : null }),
  };
})(window.SS);
