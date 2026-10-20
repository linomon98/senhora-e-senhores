/* "Cérebro" do bot num Web Worker. O Profissional simula várias jogadas antes de decidir (pode levar alguns
   segundos); aqui ele pensa sem travar a tela, e as animações continuam rodando.
   Recebe { id, fn, args } e devolve { id, r } (ou { id, erro }). Só as decisões da partida são aceitas. */
self.window = self;
const versao = self.location.search;
importScripts(...['idioma', 'motor', 'palhacos', 'pesos', 'bot'].map(f => f + '.js' + versao));
const PERMITIDAS = ['proximaAcao', 'declararAtaques', 'bloquear'];
self.onmessage = ev => {
  const { id, fn, args } = ev.data || {};
  try {
    if (!PERMITIDAS.includes(fn)) throw new Error('função não permitida');
    self.postMessage({ id, r: self.SS.Bot[fn](...args) });
  } catch (erro) {
    self.postMessage({ id, erro: String(erro) });
  }
};
