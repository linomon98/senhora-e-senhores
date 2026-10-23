// Bibliotecas de fora (dado 3D e jogo online) são grandes: em vez de travar a abertura da página,
// carregam depois que o menu aparece, ou na hora em que forem precisas. Cada uma tenta o cdnjs e,
// se falhar (rede ou extensão bloqueando), o jsDelivr.
(function (SS) {
  'use strict';
  const LIBS = {
    three: ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'],
    cannon: ['https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js', 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/build/cannon.min.js'],
    peer: ['https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js', 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'],
  };
  const PRONTA = { three: () => !!window.THREE, cannon: () => !!window.CANNON, peer: () => typeof window.Peer === 'function' };
  const pedidos = {};

  function script(url) {
    return new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = ok;
      s.onerror = () => { s.remove(); erro(); };
      document.head.appendChild(s);
    });
  }

  // Promessa que vale true quando a biblioteca está pronta (false se nenhum endereço deu certo).
  function carregar(nome) {
    if (PRONTA[nome]()) return Promise.resolve(true);
    if (!pedidos[nome]) {
      pedidos[nome] = LIBS[nome].reduce((p, url) => p.then(ok => ok || script(url).then(() => PRONTA[nome](), () => false)), Promise.resolve(false));
    }
    return pedidos[nome];
  }

  SS.Libs = {
    carregar,
    pronta: nome => PRONTA[nome](),
    // As duas do dado 3D (ele precisa das duas).
    dado: () => Promise.all([carregar('three'), carregar('cannon')]).then(r => r.every(Boolean)),
  };
})(window.SS = window.SS || {});
