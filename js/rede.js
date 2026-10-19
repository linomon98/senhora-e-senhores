/* Multiplayer entre amigos, direto de navegador para navegador (WebRTC via PeerJS).
   Quem cria a sala recebe um código; o amigo entra pelo link com esse código.
   As duas telas rodam a mesma partida ao mesmo tempo: cada jogada (e cada dado jogado)
   é mandada para o outro lado, e o sorteio do motor usa a mesma semente nos dois. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';

  const PREFIXO = 'senhora-e-senhores-v1-';
  const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0 e 1 (fáceis de confundir)
  // Mensagens tratadas na hora (não esperam a vez na fila da partida).
  const IMEDIATAS = ['ola', 'inicio', 'desistir', 'revanche', 'tchau'];

  let peer = null, conn = null, codigo = null, fila = [], esperas = [];
  const ouvintes = {};

  const novoCodigo = () => Array.from({ length: 5 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');

  function emitir(tipo, dados) {
    if (ouvintes[tipo]) ouvintes[tipo](dados);
  }

  function receber(m) {
    if (!m || typeof m.t !== 'string') return;
    if (IMEDIATAS.includes(m.t)) return emitir(m.t, m);
    fila.push(m);
    entregar();
  }

  // Entrega mensagens da fila para quem está esperando aquele tipo (na ordem em que chegaram).
  function entregar() {
    for (let k = 0; k < esperas.length; k++) {
      const w = esperas[k], i = fila.findIndex(m => w.tipos.includes(m.t));
      if (i < 0) continue;
      const m = fila.splice(i, 1)[0];
      esperas.splice(k, 1);
      k--;
      w.resolver(m);
    }
  }

  function ligar(c) {
    conn = c;
    c.on('data', receber);
    c.on('close', () => { if (conn === c) { conn = null; emitir('caiu'); } });
    c.on('error', () => { if (conn === c) { conn = null; emitir('caiu'); } });
  }

  function disponivel() {
    return typeof window.Peer === 'function';
  }

  // Se o PeerJS não veio do cdnjs (rede ou extensão bloqueando), tenta um segundo endereço.
  if (!disponivel()) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    document.head.appendChild(s);
  }

  // Cria a sala e espera o amigo. Devolve o código; o evento 'conectou' avisa quando ele entrar.
  function criarSala() {
    sair();
    return new Promise((resolver, rejeitar) => {
      if (!disponivel()) return rejeitar(new Error('PeerJS indisponível'));
      const tentar = n => {
        codigo = novoCodigo();
        peer = new window.Peer(PREFIXO + codigo);
        peer.on('open', () => resolver(codigo));
        peer.on('connection', c => {
          if (conn) return c.close(); // a sala é só para 2
          c.on('open', () => { ligar(c); emitir('conectou'); });
        });
        peer.on('error', err => {
          if (err.type === 'unavailable-id' && n < 3) { peer.destroy(); return tentar(n + 1); }
          if (!conn) rejeitar(err);
        });
      };
      tentar(0);
    });
  }

  function entrar(cod) {
    sair();
    codigo = String(cod || '').trim().toUpperCase();
    return new Promise((resolver, rejeitar) => {
      if (!disponivel()) return rejeitar(new Error('PeerJS indisponível'));
      peer = new window.Peer();
      let ok = false;
      const desistir = setTimeout(() => { if (!ok) rejeitar(new Error('tempo')); }, 15000);
      peer.on('open', () => {
        const c = peer.connect(PREFIXO + codigo, { reliable: true });
        c.on('open', () => { ok = true; clearTimeout(desistir); ligar(c); resolver(); });
      });
      peer.on('error', err => { if (!ok) { clearTimeout(desistir); rejeitar(err); } });
    });
  }

  function enviar(m) {
    if (conn && conn.open) conn.send(m);
  }

  // Espera a próxima jogada do amigo de um dos tipos dados (ex.: ['acao', 'declarar']).
  function esperar(tipos) {
    return new Promise(resolver => {
      esperas.push({ tipos, resolver });
      entregar();
    });
  }

  function limparFila() {
    fila = [];
    esperas = [];
  }

  function sair() {
    limparFila();
    if (conn) { const c = conn; conn = null; try { c.close(); } catch (err) { /* já fechada */ } }
    if (peer) { try { peer.destroy(); } catch (err) { /* já destruído */ } peer = null; }
    codigo = null;
  }

  // Gerador de números com semente (mulberry32): os dois lados sorteiam igual.
  function gerador(semente) {
    let a = semente >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Link de convite: a página atual com #sala=CÓDIGO.
  const link = cod => `${location.origin}${location.pathname}#sala=${cod}`;
  const codigoDoLink = () => {
    const m = /sala=([A-Za-z0-9]{4,8})/.exec(location.hash);
    return m ? m[1].toUpperCase() : null;
  };

  SS.Rede = {
    disponivel, criarSala, entrar, enviar, esperar, limparFila, sair, gerador, link, codigoDoLink,
    ao: (tipo, fn) => { ouvintes[tipo] = fn; },
    conectado: () => !!(conn && conn.open),
    codigo: () => codigo,
  };
})(window.SS);
