/** Cores do piano roll, lidas das variáveis CSS do tema (ver ui/styles.css). */
export type Palette = {
  ink: string
  inkDim: string
  bronze: string
  rollIn: string
  rollOut: string
  rollTonic: string
  rollLine: string
  rollOctave: string
  rollBar: string
  rollBeat: string
  rollSub: string
  rollRuler: string
  keyWhite: string
  keyWhiteEdge: string
  keyBlack: string
  keyInk: string
  /** Cor de cada grau; o índice é o número do grau (1 a 7). */
  deg: string[]
  degOut: string
  noteInk: string
  noteSelected: string
}

export function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return {
    ink: v('--ink'),
    inkDim: v('--ink-dim'),
    bronze: v('--bronze'),
    rollIn: v('--roll-in'),
    rollOut: v('--roll-out'),
    rollTonic: v('--roll-tonic'),
    rollLine: v('--roll-line'),
    rollOctave: v('--roll-octave'),
    rollBar: v('--roll-bar'),
    rollBeat: v('--roll-beat'),
    rollSub: v('--roll-sub'),
    rollRuler: v('--roll-ruler'),
    keyWhite: v('--key-white'),
    keyWhiteEdge: v('--key-white-edge'),
    keyBlack: v('--key-black'),
    keyInk: v('--key-ink'),
    deg: ['', 1, 2, 3, 4, 5, 6, 7].map((d) => (d === '' ? '' : v(`--deg-${d}`))),
    degOut: v('--deg-out'),
    noteInk: v('--note-ink'),
    noteSelected: v('--note-selected'),
  }
}
