# Sons do jogo

Os efeitos ficam nesta pasta, em **.wav**, com os nomes da lista do gravador (`ferramentas/gravador.html`).
Para **trocar um som**, grave de novo no gravador e salve por cima do arquivo com o mesmo nome.
Som que não existe fica em silêncio.

- **Variações:** `clique-1.wav`, `clique-2.wav`, `clique-3.wav`. O jogo sorteia uma a cada vez, sem repetir a anterior,
  e muda o tom um tiquinho para soar menos repetido. Quantas variações cada som tem fica em `js/som.js` (`EFEITOS`).
- **Volume de cada som:** os que tocam muito (passar o mouse, clique, cobra…) já tocam mais baixo (`VOLUME` em `js/som.js`).
- **Música:** `musica.wav`, um loop de 6 compassos (130 BPM) cortado no tempo forte; o jogo repete sem pulo. Para trocar, salve outro loop com o mesmo nome.

Os arquivos que vieram do gravador (48 kHz) foram convertidos para 24 kHz mono para o jogo carregar mais rápido.
