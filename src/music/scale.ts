import { Scale, Note as TonalNote } from 'tonal'

export const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const

export const SCALES: { id: string; label: string }[] = [
  { id: 'major', label: 'maior' },
  { id: 'minor', label: 'menor' },
  { id: 'dorian', label: 'dórico' },
  { id: 'phrygian', label: 'frígio' },
  { id: 'lydian', label: 'lídio' },
  { id: 'mixolydian', label: 'mixolídio' },
  { id: 'locrian', label: 'lócrio' },
  { id: 'harmonic minor', label: 'menor harmônica' },
  { id: 'melodic minor', label: 'menor melódica' },
  { id: 'major pentatonic', label: 'pentatônica maior' },
  { id: 'minor pentatonic', label: 'pentatônica menor' },
  { id: 'blues', label: 'blues' },
  { id: 'chromatic', label: 'cromática' },
]

export type ScaleInfo = {
  key: string
  scale: string
  tonic: number
  /** Classes de altura (0 a 11) na ordem da escala, a partir da tônica. */
  chromas: number[]
  /** Para cada classe de altura: número do grau (1 a 7) ou null se estiver fora da escala. */
  degrees: (number | null)[]
  /** Para cada classe de altura: nome da nota, com a grafia da escala quando ela pertence a ela. */
  names: string[]
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const cache = new Map<string, ScaleInfo>()

export function getScale(key: string, scale: string): ScaleInfo {
  const id = `${key} ${scale}`
  const hit = cache.get(id)
  if (hit) return hit

  let s = Scale.get(id)
  if (s.empty) s = Scale.get(`${key} major`)
  const tonic = TonalNote.chroma(key) ?? 0

  const useFlats = key.includes('b') || s.notes.some((n) => n.includes('b'))
  const names = [...(useFlats ? FLAT_NAMES : SHARP_NAMES)]
  const degrees: (number | null)[] = Array(12).fill(null)
  const chromas: number[] = []

  s.notes.forEach((name, i) => {
    const chroma = TonalNote.chroma(name)
    if (chroma == null || degrees[chroma] != null) return
    chromas.push(chroma)
    degrees[chroma] = parseInt(s.intervals[i], 10)
    names[chroma] = name
  })

  const info: ScaleInfo = { key, scale, tonic, chromas, degrees, names }
  cache.set(id, info)
  return info
}

export function chromaOf(pitch: number): number {
  return ((pitch % 12) + 12) % 12
}

export function isInScale(pitch: number, s: ScaleInfo): boolean {
  return s.degrees[chromaOf(pitch)] != null
}

/** Grau da nota na escala (1 = tônica) ou null se estiver fora dela. */
export function degreeOf(pitch: number, s: ScaleInfo): number | null {
  return s.degrees[chromaOf(pitch)]
}

/** Nota da escala mais próxima. No empate, `bias` decide se vai para baixo (-1) ou para cima (1). */
export function snapToScale(pitch: number, s: ScaleInfo, bias: -1 | 1 = -1): number {
  for (let d = 0; d <= 6; d++) {
    const first = pitch + d * bias
    const second = pitch - d * bias
    if (isInScale(first, s)) return first
    if (isInScale(second, s)) return second
  }
  return pitch
}

/** Índice absoluto do grau: conta os passos de escala desde a tônica da oitava 0. */
export function stepIndex(pitch: number, s: ScaleInfo): number {
  const rel = pitch - s.tonic
  const octave = Math.floor(rel / 12)
  const offset = ((rel % 12) + 12) % 12
  const idx = s.chromas.findIndex((c) => (c - s.tonic + 12) % 12 === offset)
  return octave * s.chromas.length + idx
}

export function pitchFromStepIndex(index: number, s: ScaleInfo): number {
  const n = s.chromas.length
  const octave = Math.floor(index / n)
  const idx = ((index % n) + n) % n
  return s.tonic + octave * 12 + ((s.chromas[idx] - s.tonic + 12) % 12)
}

/** Passos de escala entre duas notas que pertencem à escala. */
export function scaleStepsBetween(from: number, to: number, s: ScaleInfo): number {
  return stepIndex(to, s) - stepIndex(from, s)
}

/**
 * Move a nota por graus da escala. Uma nota fora da escala mantém a distância
 * que tinha da nota de escala logo abaixo dela.
 */
export function shiftDiatonic(pitch: number, steps: number, s: ScaleInfo): number {
  if (steps === 0) return pitch
  let base = pitch
  while (!isInScale(base, s) && pitch - base < 12) base--
  if (!isInScale(base, s)) return pitch
  return pitchFromStepIndex(stepIndex(base, s) + steps, s) + (pitch - base)
}

const SOLFEGE: Record<string, string> = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' }

function prettyAccidentals(acc: string): string {
  return acc.replace(/##/g, '𝄪').replace(/bb/g, '𝄫').replace(/#/g, '♯').replace(/b/g, '♭')
}

/** "Eb" → "Mi♭". */
export function pitchClassLabel(name: string): string {
  const letter = name[0]?.toUpperCase() ?? 'C'
  return (SOLFEGE[letter] ?? letter) + prettyAccidentals(name.slice(1))
}

/** Nome da nota com oitava, ex.: 63 em Dó dórico → "Mi♭4". */
export function pitchLabel(pitch: number, s: ScaleInfo): string {
  const name = s.names[chromaOf(pitch)]
  let octave = Math.floor(pitch / 12) - 1
  // Dó♭ e Si♯ atravessam a virada de oitava
  if (name.startsWith('Cb')) octave += 1
  if (name.startsWith('B#')) octave -= 1
  return pitchClassLabel(name) + octave
}

export function scaleLabel(key: string, scale: string): string {
  const found = SCALES.find((x) => x.id === scale)
  return `${pitchClassLabel(key)} ${found ? found.label : scale}`
}

const ORDINALS = ['', 'tônica', '2º grau', '3º grau', '4º grau', '5º grau', '6º grau', '7º grau']

export function degreeLabel(pitch: number, s: ScaleInfo): string {
  const d = degreeOf(pitch, s)
  if (d == null) return 'fora da escala'
  return ORDINALS[d] ?? `${d}º grau`
}
