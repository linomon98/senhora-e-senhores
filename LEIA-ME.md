# Senhora e Senhores: protótipo de navegador

## Como jogar
Dê dois cliques em `index.html` para abrir no Chrome (ou Edge/Firefox).
O dado 3D carrega duas bibliotecas da internet (Three.js e Cannon.js). Sem internet, o jogo funciona com um dado 2D simples.

No menu:
- **Jogar contra o bot**: Fácil, Médio, Difícil ou Profissional. Os três últimos usam pesos aprendidos por autojogo (`ferramentas/treino.js` → `js/pesos.js`): o Médio fica no meio do caminho, o Difícil usa a 1ª rodada de treino e o Profissional uma 2ª rodada, treinada contra o Difícil.
- **Jogar com um amigo** (online): um cria a sala e manda o link; o outro abre o link e entra. A partida roda direto entre os dois navegadores (WebRTC, pela biblioteca PeerJS), sem cadastro e sem servidor próprio. Em algumas redes (por exemplo, certas redes de celular ou de empresa) a conexão direta pode não funcionar.
- **Assistir bot × bot**: os dois lados jogam sozinhos.
- **Montar decks**: até 4 decks próprios, com auto-build do deck padrão. Ficam salvos neste navegador.
- **Regras do jogo**: todas as regras, separadas por tema.
- **Simular partidas**: roda centenas de partidas sem animação e mostra as estatísticas (quem vence, se começar é vantagem, duração média). Serve para testar o equilíbrio das regras.
- **Idioma**: English (padrão) ou Português, no canto do menu. A escolha fica salva neste navegador.

## Segurança no online
- **Tudo o que chega do outro jogador é conferido:** o deck só pode ter cartas que existem, e cada jogada, bloqueio, descarte, compra e dado precisa ser uma jogada válida pelas regras naquele momento. Se não for (trapaça ou mensagem quebrada), a partida é encerrada e a conexão é cortada.
- **Política de Segurança de Conteúdo (CSP)** no `index.html`: só rodam scripts deste site e das bibliotecas (cdnjs e jsdelivr), e a rede só fala com o servidor do PeerJS. Se uma biblioteca nova for adicionada, inclua o endereço dela na CSP.
- **Limite de mensagens:** mensagens grandes demais ou em excesso cortam a conexão.
- **Privacidade:** a partida é direta entre os navegadores, então cada jogador pode ver o endereço IP do outro. A tela do online avisa isso.
- **Limite conhecido:** quem souber usar o console do navegador consegue ver a mão do oponente (as duas telas rodam a mesma partida).

## Arquivos
| Arquivo | O que faz |
|---|---|
| `js/idioma.js` | Todos os textos do jogo em inglês e português (`SS.t('chave')`). Para mudar um texto, edite aqui. |
| `js/motor.js` | Todas as regras (Regras v2). Não depende da tela, então pode ir para um servidor no futuro multiplayer. |
| `js/bot.js` | A inteligência do bot (níveis) e a simulação de partidas. |
| `js/pesos.js` | Pesos aprendidos pelo treino (usados do Médio ao Profissional). |
| `ferramentas/treino.js` | Treino do bot por autojogo (rodar no console do navegador; não é carregado pelo jogo). |
| `js/cartas.js` | Desenho das cartas, dos dorsos e da textura da mesa. |
| `arte/` | Artes: `palhacos/` (Palhaços na mesa), `cartas/` (cartas do menu), `naipes/` (botões de poder), `acoes/` (cartas de ação), `mesa/` (grama). |
| `fontes/` | Fonte dos títulos (Seventy Money). |
| `js/dados3d.js` | Dado 3D com física (arremessado com o mouse). |
| `js/decks.js` | Montagem de decks: 4 espaços salvos no navegador e checagem das regras de limite. |
| `js/regras.js` | Tela "Regras do jogo", dividida por temas. |
| `js/rede.js` | Multiplayer: cria e entra em salas, manda as jogadas para o amigo. As duas telas rodam a mesma partida com a mesma semente de sorteio. |
| `js/interface.js` | Tela, cliques e fluxo dos turnos. |
| `estilo.css` | Visual da mesa. |

## Colocando a arte final das cartas
As cartas são placeholders no padrão clássico. Para trocar uma carta pela arte final, coloque a imagem numa pasta `arte/` e registre no fim de `js/cartas.js`:

```js
SS.ARTE['Q-copas'] = 'arte/rainha-de-copas.png';
SS.ARTE['7-espadas'] = 'arte/7-de-espadas.png';
```

A chave é `rank-naipe`. Os ranks são A, 2–10, J, Q e K; os naipes são copas, ouros, paus e espadas. A imagem ocupa o miolo da carta (proporção 132 × 212) e os índices dos cantos continuam desenhados.
