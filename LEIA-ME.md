# Senhora e Senhores: protótipo de navegador

## Como jogar
Dê dois cliques em `index.html` para abrir no Chrome (ou Edge/Firefox).
O dado 3D carrega duas bibliotecas da internet (Three.js e Cannon.js). Sem internet, o jogo funciona com um dado 2D simples.

No menu:
- **Jogar contra o bot**: Fácil, Médio ou Difícil.
- **Assistir bot × bot**: os dois lados jogam sozinhos.
- **Montar decks**: até 4 decks próprios, com auto-build do deck padrão. Ficam salvos neste navegador.
- **Regras do jogo**: todas as regras, separadas por tema.
- **Simular partidas**: roda centenas de partidas sem animação e mostra as estatísticas (quem vence, se começar é vantagem, duração média). Serve para testar o equilíbrio das regras.

## Arquivos
| Arquivo | O que faz |
|---|---|
| `js/motor.js` | Todas as regras (Regras v2). Não depende da tela, então pode ir para um servidor no futuro multiplayer. |
| `js/bot.js` | A inteligência do bot e a simulação de partidas. |
| `js/cartas.js` | Desenho das cartas, dos dorsos e da textura da mesa. |
| `js/dados3d.js` | Dado 3D com física (arremessado com o mouse). |
| `js/decks.js` | Montagem de decks: 4 espaços salvos no navegador e checagem das regras de limite. |
| `js/regras.js` | Tela "Regras do jogo", dividida por temas. |
| `js/interface.js` | Tela, cliques e fluxo dos turnos. |
| `estilo.css` | Visual da mesa. |

## Colocando a arte final das cartas
As cartas são placeholders no padrão clássico. Para trocar uma carta pela arte final, coloque a imagem numa pasta `arte/` e registre no fim de `js/cartas.js`:

```js
SS.ARTE['Q-copas'] = 'arte/rainha-de-copas.png';
SS.ARTE['7-espadas'] = 'arte/7-de-espadas.png';
```

A chave é `rank-naipe`. Os ranks são A, 2–10, J, Q e K; os naipes são copas, ouros, paus e espadas. A imagem ocupa o miolo da carta (proporção 132 × 212) e os índices dos cantos continuam desenhados.
