# Gabarito dos efeitos da mesa

Cada `<nome>-guia.png` desta pasta é o molde de uma peça dos efeitos de recursos, magias e Pargias.
Quando você salva o desenho como `arte/efeitos/<nome>.png` (uma pasta acima desta), o jogo passa a usar
o seu desenho no lugar do que é feito por código. Se o arquivo não existir, continua o desenho atual.

## Como desenhar

1. Abra o `<nome>-guia.png` no seu programa de desenho.
2. Desenhe numa camada nova, por cima.
3. Esconda ou apague a camada do guia. O fundo tem que ficar **transparente**.
4. Exporte como **PNG** com o mesmo tamanho em pixels do guia (ou o dobro, mantendo a proporção).
5. Salve em `jogo/arte/efeitos/<nome>.png`, por exemplo `jogo/arte/efeitos/meteoro.png`.

O que tem no guia:

- **Borda rosa:** o tamanho total da peça. Tudo o que ficar fora dela é cortado.
- **Cruz azul:** o ponto de encaixe, isto é, o ponto que o jogo coloca em cima do alvo (a carta, o Palhaço ou o chão).
- **Linhas tracejadas:** a direção do movimento ou do desenho.

Os guias estão no triplo do tamanho em que a peça aparece na mesa. O jogo diminui sozinho.

## As peças

| Arquivo | Na mesa | Guia | Onde aparece | Encaixe e dicas |
|---|---|---|---|---|
| `espada.png` | 74×74 | 222×222 | +1 de ataque (carta de Espadas): desce girando e corta o Senhor(a) | Centro. Desenhe a espada **na diagonal**: cabo embaixo à esquerda, ponta em cima à direita (linha tracejada). O jogo gira a espada. |
| `corte.png` | 180×24 | 540×72 | O risco do corte da espada | Centro. Um risco **na horizontal**: o jogo inclina e estica. |
| `brasa.png` | 24×24 | 72×72 | Brasas/chamas que sobem no Berserk e no Meteoro | Centro. Uma brasa ou labareda pequena. O jogo usa vários tamanhos e mistura muitas. |
| `coluna.png` | 120×560 | 360×1680 | Magia de Copas (reviver): coluna de luz | **Base no meio da borda de baixo**. A luz sobe; mais forte embaixo e sumindo em cima fica bonito. |
| `seta-sobe.png` | 30×36 | 90×108 | Magia de Espadas/Paus no seu Senhor(a) (+1): setas subindo | Meio da borda de cima. Seta para cima. Já desenhe com a cor que quiser (vale para os dois naipes). |
| `seta-desce.png` | 30×36 | 90×108 | Magia de Espadas/Paus no inimigo (−1): setas caindo | Meio da borda de cima. Seta para baixo. |
| `racha.png` | 90×120 | 270×360 | Magia no inimigo (−1): a carta racha | Centro. O tracejado mostra onde fica a carta. |
| `vento.png` | 120×14 | 360×42 | Sai daqui!: as rajadas do redemoinho | Centro. Uma rajada **na horizontal**: o jogo gira 9 delas em volta da carta. |
| `meteoro.png` | 240×240 | 720×720 | Meteoro!: a bola de fogo que cai em cada Senhor(a) | **A cruz é o centro da bola de fogo** (o círculo tracejado é o tamanho dela hoje). A cauda vai para **cima à direita**, pela linha tracejada, porque ele cai vindo dessa direção. |
| `cratera.png` | 130×70 | 390×210 | Meteoro!: a marca no chão depois do impacto | Centro. Vista de cima e meio achatada (a elipse tracejada). |
| `raio.png` | 80×400 | 240×1200 | Trovão: o raio que cai do topo da mesa no alvo | Cruz de cima = topo da mesa; cruz de baixo = o alvo. O jogo **estica na altura** até a distância certa, então desenhe o raio de ponta a ponta, na vertical. |

## O que continua por código

Estes efeitos não usam sprite e continuam por código:

- **Clarão:** a tela branca do Trovão.
- **Ondas e faíscas:** são as mesmas do combate.
- **Textos:** "+3", "BERSERK!", "−1 ⚔" e os outros.
- **Corações, naipes e moedas:** já usam a arte dos naipes, de `arte/naipes`.

Se quiser trocar algum desses também, é só pedir.
