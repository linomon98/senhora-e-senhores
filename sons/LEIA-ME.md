# Sons do jogo

Os efeitos ficam nesta pasta em **.mp3** (64 kbps, mono), com os nomes da lista do gravador (`ferramentas/gravador.html`).
O gravador salva em .wav: os arquivos passam pela limpeza (ruído de fundo) e masterização e depois viram MP3,
que é 6x menor. Som que não existe fica em silêncio.

- **Variações:** `clique-1.mp3`, `clique-2.mp3`, `clique-3.mp3`. O jogo sorteia uma a cada vez, sem repetir a anterior,
  e muda o tom um tiquinho para soar menos repetido. Quantas variações cada som tem fica em `js/som.js` (`EFEITOS`).
- **Volume de cada som:** a mixagem fica em `VOLUME`, em `js/som.js` (`hover-carta` está mudo por enquanto).
- **Atraso do MP3:** o codificador põe ~46 ms de silêncio no começo; o jogo corta esse silêncio ao carregar.
- **Música:** `musica.mp3` e `musica-2.mp3` (96 kbps estéreo, no mesmo volume), tocando uma depois da outra, alternando; volume próprio nas Opções. Para trocar, salve outra com o mesmo nome (ou acrescente o arquivo na lista FAIXAS do som.js).
