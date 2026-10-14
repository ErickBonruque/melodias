# Melodias: estúdio pessoal de melodias

App web de uso pessoal para criar, ouvir, experimentar e salvar melodias. Um único usuário, sem backend. A prioridade é experiência de uso, interatividade e prazer de usar; escala e multiusuário não importam.

Converse com o usuário em português. Textos da interface também em português.

## Estado atual

Fase 1 concluída: piano roll editável, snap na escala, teclado virtual, teclado do computador, Web MIDI, transport com loop e metrônomo, desfazer/refazer, atalhos e biblioteca com autosave. Próxima: Fase 2 (ferramentas de criação).

## Stack

- Vite 8 + React 19 + TypeScript 6, estado com Zustand.
- Tailwind v4: os tokens de tema viram variáveis CSS, que o canvas do piano roll também lê, então tema claro/escuro fica num lugar só (`src/ui/styles.css`).
- Tone.js: motor de áudio, transport, BPM, metrônomo, sintetizadores, `Tone.Sampler` para o piano.
- tonal: teoria musical (notas, intervalos, escalas, modos, acordes).
- Dexie (IndexedDB): biblioteca local de melodias.
- Fases seguintes: @tonejs/midi, abcjs, pitchy, @spotify/basic-pitch (lazy), @magenta/music (opcional, Web Worker + lazy).
- Vitest para lógica musical. Playwright (Python, via skill `webapp-testing`) para conferência visual.
- Gerenciador de pacotes: npm.

Versões presas de propósito:

- `tonal` em 6.4.2: a 6.5.0 foi publicada com `main` e `types` apontando para arquivos que não existem, e quebra o Vitest e o tsc.
- `typescript` em ~6.0: o typescript-eslint ainda não aceita o TypeScript 7.

## Ambiente

- Ubuntu 24.04 no WSL2. Node 24 LTS via nvm; o default global do nvm é outro, então rode `nvm use` na raiz (há um `.nvmrc`).
- Python 3.12 com venv em `.venv/` (só para o Playwright). Chromium do Playwright já instalado.

## Comandos

```bash
nvm use                 # Node 24
npm run dev             # servidor de desenvolvimento em http://localhost:5173
npm run build           # checagem de tipos + build de produção
npm test                # Vitest (lógica musical)
npm run lint
npm run test:visual     # sobe o dev server e roda todos os scripts de tests/visual

# um script visual só
.venv/bin/python .claude/skills/webapp-testing/scripts/with_server.py \
  --server "npm run dev" --port 5173 -- .venv/bin/python tests/visual/02_edicao.py
```

Os scripts visuais gravam screenshots em `tests/visual/out/` (ignorado pelo git). Depois de rodar, abra as imagens e olhe: os asserts conferem comportamento, não aparência.

## Skills do projeto

Ficam em `.claude/skills/` e valem para o projeto inteiro:

- `frontend-design`: toda decisão visual e de UI. Antes de construir uma tela, escrever o plano de tokens (cor, tipo, layout, princípios), revisar contra os clichês listados na skill e só então codar. Textos de interface seguem a seção de escrita da skill.
- `webapp-testing`: depois de cada feature visual, abrir o app com Playwright, esperar `networkidle`, tirar screenshot, olhar o resultado e corrigir antes de seguir. Scripts ficam em `tests/visual/`, saídas em `tests/visual/out/` (ignorado pelo git).

## Arquitetura

```
src/
  music/   teoria e operações sobre notas: funções puras, sem React nem Tone
           types (PPQ, Note, Melody), time (grade, snap, quantização), scale (escala, graus, nomes), notes
  audio/   engine.ts: o único arquivo que importa o Tone.js
  input/   teclado do computador (keyboard), Web MIDI (midi, midiMessage)
  store/   Zustand
           doc (melodia, seleção, histórico), view (ferramenta, grade, zoom, tema; persiste em localStorage),
           transport (tocando, cursor, loop, metrônomo), library (Dexie + autosave),
           commands (ações que cruzam stores), bindAudio (estado → motor de áudio)
  db/      Dexie
  ui/      componentes React, styles.css (tokens), shortcuts.ts
    pianoroll/  coords (tick ↔ x, altura ↔ y), render (desenho), controller (gestos e laço de quadros), palette
public/
  samples/piano/  Salamander Grand Piano, CC BY 3.0 (ver LICENCA.md na pasta)
tests/visual/     scripts Playwright; common.py tem os helpers
```

Regras:

- `src/music` não importa nada de `audio`, `ui` nem `store`. É onde ficam os testes unitários.
- Só `src/audio/engine.ts` importa o Tone.js. A interface muda o estado nos stores e o `bindAudio` transforma estado em som; para tocar uma nota avulsa, a UI chama `engine.preview` / `noteOn` / `noteOff`.
- O áudio só inicia depois de um gesto do usuário (`engine.start()`, disparado no primeiro clique ou tecla).
- O piano roll é um controlador fora do React (`PianoRollController`): lê os stores com `getState`/`subscribe` e redesenha por `requestAnimationFrame` só quando algo mudou. Não passe notas, rolagem nem cursor por props ou estado do React.
- Edições que entram no desfazer passam por `useDoc.edit` (ou `beginGesture` / `live` / `commitGesture` durante um arrasto). Título, tags e instrumento usam `setMeta` e ficam fora do histórico.
- Em modo dev, `window.__melodias` (stores e engine) e `window.__roll` (controlador, com `pointFor(tick, pitch)`) existem para os testes visuais.

## Modelo de dados

```ts
type Note = { id: string; pitch: number /* MIDI */; start: number /* ticks */; duration: number /* ticks */; velocity: number };
type Melody = {
  id: string; title: string; tags: string[];
  bpm: number; timeSignature: [number, number];
  key: string; scale: string;          // ex.: "C", "dorian"
  instrument: string;
  notes: Note[];
  chords?: { start: number; duration: number; symbol: string }[];
  createdAt: number; updatedAt: number;
  versions?: { at: number; notes: Note[] }[];
};
```

Tempo interno sempre em ticks inteiros, 480 por semínima (PPQ = 480, divisível por tercinas e por 1/32). Nunca guardar segundos: a conversão para segundos acontece só na hora de agendar o áudio.

## Convenções

- TypeScript estrito. Funções puras em `src/music`, com teste Vitest para cada uma (snap na escala, transformações, quantização, conversões MIDI e ABC).
- Notas são imutáveis: toda edição gera um novo array, o que mantém o desfazer simples.
- Código e identificadores em inglês; comentários, textos da interface e mensagens de commit em português.
- Incrementos pequenos e funcionais, um commit por passo que funciona.
- Samples e fontes ficam locais (app precisa funcionar offline). Conferir e registrar a licença de tudo que for baixado.
- Código de terceiros (signal, beepbox) serve de referência de UX; não copiar sem checar licença.

## Design

Direção aprovada: o interior de um piano. Interface quieta e quase monocromática; a cor fica reservada para as notas.

- Tokens em `src/ui/styles.css`: `ground` (jacarandá), `panel`, `raised`, `line`, `ink` (marfim), `ink-dim`, `bronze` (acento: cursor, foco, estado ligado), `felt` (apagar, gravar). No Tailwind: `bg-panel`, `text-ink-dim`, `border-line` etc.
- Cada grau da escala tem uma cor (`--deg-1` a `--deg-7`); nota fora da escala é cinza hachurada (`--deg-out`). As mesmas cores aparecem nas notas, nas bolinhas do teclado lateral, nas teclas acesas, nos botões da escala e nas miniaturas da biblioteca. Não use essas cores para outra coisa.
- Tipografia: Newsreader itálica (`font-score`) para título da melodia, andamento, compasso e nome da escala, como as indicações de uma partitura; Schibsted Grotesk (`font-sans`) para o resto. Sem fonte monoespaçada e sem rótulos em caixa alta.
- `tabular-nums` só em elementos que são apenas número: nessa fonte ele também alarga ponto e vírgula, e aplicado ao texto corrido deixa um buraco antes da pontuação.
- Variáveis lidas pelo canvas precisam ser cores resolvidas (hex), sem `var()` nem `color-mix()`.
- Textos: frases em caixa normal, verbo dizendo o que acontece, estado vazio convidando a agir.

## Interação no piano roll

- Lápis (`1`): clique cria a nota com a última duração usada; arrastar estica. Seleção (`2`): arrastar marca um retângulo. `Shift`+arrastar faz o retângulo com qualquer ferramenta.
- Com "grudar na escala" ligado, criar e mover andam por graus; `Ctrl` (ou `Cmd`) deixa a nota sair da escala. A grade de tempo tem o próprio botão.
- `Alt`+arrastar leva uma cópia. Botão direito apaga. Botão do meio arrasta a grade.
- Roda: rola; `Shift`+roda: lados; `Ctrl`+roda: zoom horizontal; `Alt`+roda: zoom vertical.
- Atalhos de letra não podem colidir com as teclas que tocam notas (A W S E D F T G Y H U J K O L P ; e Z X para oitava). Livres hoje: Q R I B N V.

## Armadilhas já encontradas

- Tone: para tocar a partir de um tick, use `transport.start(undefined, "<tick>i")`. A sequência stop → `ticks = n` → start no mesmo instante às vezes parte do zero.
- Tone: `transport.ticks` lido direto está adiantado pelo lookahead; a posição do que se ouve é `getTicksAtTime(Tone.immediate())`.
- Testes Playwright: depois de qualquer coisa que mova o cursor (colar, stop), a grade rola com animação. Espere uns 500 ms antes de calcular um ponto com `pointFor`.

## Referências estudadas

- `ryohey/signal` (MIT): duas ferramentas no piano roll (lápis e seleção, teclas 1 e 2), gestos como handlers separados escolhidos no mousedown, arrastar com o botão do meio para rolar, seleção entra no undo, transformação de coordenadas isolada.
- `johnnesky/beepbox` (MIT): música inteira no hash da URL, empacotada em bits e codificada em base64 URL-safe, com deltas de altura e durações em tamanho variável. Base para o "compartilhar por link" da Fase 3.

## Roadmap

### Fase 1: MVP que já dá prazer de usar (concluída)
- Piano roll em canvas: criar, mover, redimensionar, seleção por retângulo, copiar/colar, deletar, zoom horizontal e vertical, scroll suave.
- Snap na escala (tonalidade e modo, linhas fora da escala esmaecidas) e grade de quantização (1/4, 1/8, 1/16, tercinas).
- Teclado virtual na lateral, que toca ao clicar e acende durante a reprodução.
- Tocar pelo teclado do computador (layout tipo DAW) e Web MIDI.
- Transport: play/pause/stop, loop de região, BPM, metrônomo, cursor animado.
- Undo/redo completo e atalhos de teclado, com tela de atalhos em `?`.
- Biblioteca: salvar, renomear, duplicar, deletar, buscar, tags, autosave.

### Fase 2: ferramentas de criação
- Gravar tocando, com metrônomo, contagem e quantização de força ajustável.
- Cantarolar para criar: ao vivo com pitchy; gravar e transcrever com basic-pitch.
- Transformações na seleção: transpor (cromático e diatônico), inverter, retrógrado, aumentar/diminuir ritmo, humanizar, espelhar contorno.
- Gerador de ideias: melodia aleatória na escala com controles de contorno, densidade, saltos e nota de repouso; variações de um motivo (Markov sobre intervalos).
- Acompanhamento: progressões de acordes (presets e editor), sugestão de acordes via tonal.
- Análise: tonalidade provável, grau e intervalo de cada nota, notas fora da escala.
- Partitura (abcjs) sincronizada com a reprodução.

### Fase 3: extras
- Exportar MIDI, WAV (`Tone.Offline`) e JSON; importar MIDI.
- Compartilhar por link (melodia compactada na URL).
- Histórico de versões com comparação.
- Troca de instrumento e efeitos simples (reverb, delay).
- Magenta "continuar melodia" (opcional).
- PWA para instalar e usar offline.
