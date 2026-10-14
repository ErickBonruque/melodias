# Melodias

Um estúdio de melodias que roda no navegador. Rascunhe uma ideia no piano roll, ouça na hora e guarde numa biblioteca local. Sem conta e sem servidor: tudo fica na sua máquina.

[English](README.md)

![O estúdio tocando uma melodia em Lá menor: notas coloridas por grau da escala, a faixa de cifras com o acorde da vez destacado, a tecla acesa no teclado lateral, a partitura acompanhando e a biblioteca à esquerda](docs/screenshots/estudio-escuro.png)

## O que tem de diferente

- **Cada grau da escala tem uma cor.** A tônica é dourada, a terça é rosa, a quinta é azul, e assim por diante. As mesmas cores aparecem nas notas, no teclado lateral, nas teclas que acendem ao tocar e nas miniaturas da biblioteca, então dá para ler o desenho da melodia de relance. Nota fora da escala fica cinza e hachurada.
- **As notas grudam na escala.** Escolha tonalidade e modo; as linhas fora da escala ficam esmaecidas, e criar ou arrastar notas anda por graus. Segure `Ctrl` para sair da escala.
- **O tempo é guardado em ticks, nunca em segundos.** Mude o andamento ou o compasso e nada quebra.
- **Funciona offline.** Os samples de piano e as fontes vêm junto com o app.

## O que dá para fazer

**Escrever**

- Piano roll em canvas: clique para criar a nota, arraste para esticar, mova, redimensione, selecione por retângulo, copie e cole, repita, apague, dê zoom nos dois eixos, role com suavidade.
- 12 tonalidades e 13 escalas e modos (maior, menor, modos gregos, menor harmônica e melódica, pentatônicas, blues, cromática).
- Grade de quantização: 1/4, 1/8, 1/16, 1/32 e tercinas.
- Desfazer e refazer completos, e a lista de atalhos na tecla `?`.

**Tocar e capturar**

- Toque com o mouse no teclado lateral, com o teclado do computador (`A S D F…`, como nas DAWs) ou com um teclado MIDI via Web MIDI.
- Grave o que você toca, com contagem de entrada, e quantize depois com força ajustável.
- Cantarole ou assobie: o app mostra a nota que você está cantando e a afinação, e grava na grade. Ou grave uma frase inteira e deixe o [Basic Pitch](https://github.com/spotify/basic-pitch-ts) transcrever. O modelo roda no navegador; o áudio não sai da sua máquina.

**Achar ideias**

- Gerador de ideias: uma melodia nova dentro da escala, moldada por contorno (arco, sobe, desce, vale, livre), densidade rítmica, tamanho dos saltos e nota de repouso. Não gostou? Gere de novo e ela troca a anterior.
- Variações: selecione um motivo e receba outro com o mesmo ritmo e intervalos sorteados do próprio motivo (uma pequena cadeia de Markov).
- Transformações: transpor por semitom, grau ou oitava, inverter, retrógrado, espelhar o contorno, dobrar ou reduzir o ritmo, humanizar.

**Ouvir em contexto**

- Acordes: peça uma sugestão que combine com a melodia, parta de uma progressão conhecida (escrita em graus, então se adapta ao modo) ou edite acorde por acorde. Toque em bloco ou arpejo.
- Análise: tonalidade mais provável, notas fora da escala, extensão, e um rótulo em cada nota com o nome, o grau ou o intervalo para a nota anterior.
- Partitura embaixo do piano roll, sincronizada com a reprodução. Clique numa figura da pauta para levar o cursor até ela.

**Guardar**

- Transport: tocar, pausar, parar, região de loop (arraste na régua), andamento, compasso, metrônomo, cursor animado.
- Biblioteca em IndexedDB: autosave, busca, tags, renomear, duplicar, apagar.
- Temas escuro e claro. Três timbres: piano de cauda com samples, um sintetizador suave e uma caixinha de música.

| Tema claro | Gerador de ideias, variações, gravação e cantarolar |
| --- | --- |
| ![Tema claro com algumas notas selecionadas](docs/screenshots/estudio-claro.png) | ![A aba Criar com os controles do gerador de ideias](docs/screenshots/criar.png) |

![Tela de atalhos de teclado](docs/screenshots/atalhos.png)

## Como rodar

Precisa de Node 24 ou mais novo.

```bash
git clone https://github.com/ErickBonruque/melodias.git
cd melodias
npm install
npm run dev
```

Abra http://localhost:5173 e clique na grade. O navegador só libera som depois do primeiro clique ou tecla.

Outros comandos:

```bash
npm test              # testes unitários da lógica musical (Vitest)
npm run build         # checagem de tipos e build de produção
npm run lint
npm run test:visual   # roteiros Playwright (precisa do ambiente Python abaixo)
```

Os testes visuais usam o Playwright para Python:

```bash
python3 -m venv .venv
.venv/bin/pip install playwright
.venv/bin/playwright install chromium
```

## Como é feito

Vite, React, TypeScript, Zustand e Tailwind no app; [Tone.js](https://tonejs.github.io/) no áudio; [tonal](https://github.com/tonaljs/tonal) na teoria musical; [Dexie](https://dexie.org/) na biblioteca; [abcjs](https://www.abcjs.net/) na partitura; [pitchy](https://github.com/ianprime0509/pitchy) e Basic Pitch na detecção de altura. As partes pesadas (partitura e transcrição) só carregam quando você abre.

```
src/
  music/   lógica musical pura: ticks, escalas, transformações, gerador, acordes, detecção de tonalidade, notação ABC (156 testes)
  audio/   o motor de áudio (único arquivo que encosta no Tone.js), microfone e transcrição
  input/   teclado do computador e Web MIDI
  store/   stores Zustand, comandos, gravador, autosave e a ponte entre estado e som
  ui/      componentes React e o piano roll em canvas (coords, render, controller)
```

O piano roll é um controlador comum, fora do React. Ele lê os stores, redesenha por `requestAnimationFrame` só quando algo mudou e transforma ponteiro e roda do mouse em edições. Arrastar e rolar nunca disparam renderização do React.

O [CLAUDE.md](CLAUDE.md) traz as notas completas de arquitetura, os tokens de design, as regras de interação e as armadilhas já encontradas. Foi escrito como contexto para agentes de IA que programam, e serve igualmente para pessoas. As skills de agente usadas no desenvolvimento estão em [.claude/skills](.claude/skills).

## Roadmap

- [x] Fase 1: piano roll, snap na escala, teclados, transport, desfazer, biblioteca
- [x] Fase 2: gravar tocando, cantarolar para criar, transformações, gerador de ideias, acompanhamento com acordes, detecção de tonalidade, partitura
- [ ] Fase 3: exportar MIDI, WAV e JSON, importar MIDI, compartilhar por link, histórico de versões, efeitos, PWA

## Adapte do seu jeito

O código tem licença MIT: use, mude, publique. Issues e pull requests são bem-vindos, e forks que levem o projeto para outro lado também.

Material de terceiros mantém a própria licença:

- Samples de piano: Salamander Grand Piano, de Alexander Holm, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Veja [public/samples/piano/LICENCA.md](public/samples/piano/LICENCA.md).
- Modelo de transcrição em `public/models/basic-pitch`: Basic Pitch, da Spotify, Apache 2.0.
- Skills de agente em `.claude/skills`: Anthropic, Apache 2.0.
- Fontes: Newsreader e Schibsted Grotesk, SIL Open Font License, instaladas pelo npm.

Referências de UX estudadas no caminho: [signal](https://github.com/ryohey/signal) e [BeepBox](https://github.com/johnnesky/beepbox).
