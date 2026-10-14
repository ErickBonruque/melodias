# Melodias: estúdio pessoal de melodias

App web de uso pessoal para criar, ouvir, experimentar e salvar melodias. Um único usuário, sem backend. A prioridade é experiência de uso, interatividade e prazer de usar; escala e multiusuário não importam.

Converse com o usuário em português. Textos da interface também em português.

## Estado atual

Fase 0 concluída (ambiente, skills, este arquivo). Fase 1 aguardando aprovação do plano. Ainda não existe código de produto.

## Stack

- Vite + React + TypeScript, estado com Zustand.
- Tailwind v4: os tokens de tema viram variáveis CSS, que o canvas do piano roll também lê, então tema claro/escuro fica num lugar só.
- Tone.js: motor de áudio, transport, BPM, metrônomo, sintetizadores, `Tone.Sampler` para instrumentos com samples.
- tonal: teoria musical (notas, intervalos, escalas, modos, acordes).
- Dexie (IndexedDB): biblioteca local de melodias.
- Fases seguintes: @tonejs/midi, abcjs, pitchy, @spotify/basic-pitch (lazy), @magenta/music (opcional, Web Worker + lazy).
- Vitest para lógica musical. Playwright (Python, via skill `webapp-testing`) para conferência visual.
- Gerenciador de pacotes: npm.

## Ambiente

- Ubuntu 24.04 no WSL2. Node 24 LTS via nvm; o default global do nvm é outro, então rode `nvm use` na raiz (há um `.nvmrc`).
- Python 3.12 com venv em `.venv/` (só para o Playwright). Chromium do Playwright já instalado.

## Comandos

Os scripts npm passam a existir no passo 1 da Fase 1.

```bash
nvm use                 # Node 24
npm run dev             # servidor de desenvolvimento em http://localhost:5173
npm run build           # checagem de tipos + build de produção
npm test                # Vitest (lógica musical)
npm run lint

# conferência visual: sobe o dev server, roda o script Playwright e derruba o server
.venv/bin/python .claude/skills/webapp-testing/scripts/with_server.py \
  --server "npm run dev" --port 5173 -- .venv/bin/python tests/visual/<script>.py
```

## Skills do projeto

Ficam em `.claude/skills/` e valem para o projeto inteiro:

- `frontend-design`: toda decisão visual e de UI. Antes de construir uma tela, escrever o plano de tokens (cor, tipo, layout, princípios), revisar contra os clichês listados na skill e só então codar. Textos de interface seguem a seção de escrita da skill.
- `webapp-testing`: depois de cada feature visual, abrir o app com Playwright, esperar `networkidle`, tirar screenshot, olhar o resultado e corrigir antes de seguir. Scripts ficam em `tests/visual/`, saídas em `tests/visual/out/` (ignorado pelo git).

## Arquitetura

```
src/
  music/   teoria e transformações: funções puras, sem React nem Tone (snap, quantização, transformações, ABC, MIDI)
  audio/   motor de áudio (Tone.js): transport, instrumentos, metrônomo, agendamento
  store/   estado Zustand: melodia atual, seleção, undo/redo, transport, preferências
  db/      Dexie: biblioteca de melodias, autosave
  ui/      componentes React e o piano roll em canvas
public/
  samples/ samples de instrumentos baixados (com arquivo de licença ao lado)
tests/visual/  scripts Playwright
```

Regras:

- `src/music` não importa nada de `audio`, `ui` nem `store`. É onde ficam os testes unitários.
- `src/ui` nunca chama Tone.js direto; passa pelo `src/audio`.
- O áudio só inicia depois de um gesto do usuário (`Tone.start()`), com aviso amigável.

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
- Notas são imutáveis: toda edição gera um novo array, o que mantém o undo/redo simples.
- Piano roll em Canvas 2D, com uma classe de transformação de coordenadas (tick ↔ x, pitch ↔ y) separada do desenho e dos gestos.
- Incrementos pequenos e funcionais, um commit por passo que funciona. Mensagens de commit em português.
- Samples e fontes ficam locais (app precisa funcionar offline). Conferir e registrar a licença de tudo que for baixado.
- Código de terceiros (signal, beepbox) serve de referência de UX; não copiar sem checar licença.

## Referências estudadas

- `ryohey/signal` (MIT): duas ferramentas no piano roll (lápis e seleção, teclas 1 e 2), gestos como handlers separados escolhidos no mousedown, arrastar com o botão do meio para rolar, seleção entra no undo, transformação de coordenadas isolada.
- `johnnesky/beepbox` (MIT): música inteira no hash da URL, empacotada em bits e codificada em base64 URL-safe, com deltas de altura e durações em tamanho variável. Base para o "compartilhar por link" da Fase 3.

## Roadmap

### Fase 1: MVP que já dá prazer de usar
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
