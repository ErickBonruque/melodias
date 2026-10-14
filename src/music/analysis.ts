import { KEYS, chromaOf, isInScale, pitchLabel, type ScaleInfo } from './scale'
import type { Note } from './types'

export type KeyGuess = { key: string; scale: 'major' | 'minor'; score: number }

// perfis de Krumhansl e Kessler: o peso de cada grau cromático numa tonalidade maior e numa menor
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function correlation(a: number[], b: number[]): number {
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  const ma = mean(a)
  const mb = mean(b)
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db)
}

/**
 * Tonalidades mais prováveis para as notas, da melhor para a pior. Compara quanto
 * tempo a melodia passa em cada nota com o perfil típico de cada tonalidade.
 */
export function detectKey(notes: Note[]): KeyGuess[] {
  const histogram: number[] = Array(12).fill(0)
  for (const n of notes) histogram[chromaOf(n.pitch)] += n.duration
  if (histogram.every((x) => x === 0)) return []

  const guesses: KeyGuess[] = []
  for (let tonic = 0; tonic < 12; tonic++) {
    const rotated = histogram.map((_, i) => histogram[(i + tonic) % 12])
    guesses.push({ key: KEYS[tonic], scale: 'major', score: correlation(rotated, MAJOR) })
    guesses.push({ key: KEYS[tonic], scale: 'minor', score: correlation(rotated, MINOR) })
  }
  return guesses.sort((a, b) => b.score - a.score)
}

/** Duas escalas "combinam" quando têm exatamente as mesmas notas (Dó maior e Lá menor, por exemplo). */
export function sameNotes(a: ScaleInfo, b: ScaleInfo): boolean {
  return a.chromas.length === b.chromas.length && a.chromas.every((c) => b.degrees[c] != null)
}

export function outOfScale(notes: Note[], scale: ScaleInfo): Note[] {
  return notes.filter((n) => !isInScale(n.pitch, scale))
}

const INTERVAL_NAMES = ['uníssono', '2ª menor', '2ª maior', '3ª menor', '3ª maior', '4ª justa', 'trítono', '5ª justa', '6ª menor', '6ª maior', '7ª menor', '7ª maior', '8ª']
const INTERVAL_SHORT = ['=', '2m', '2M', '3m', '3M', '4J', 'TT', '5J', '6m', '6M', '7m', '7M', '8J']

/** "3ª maior acima", "2ª menor abaixo", "mesma nota". */
export function intervalLabel(semitones: number): string {
  const size = Math.abs(semitones)
  if (size === 0) return 'mesma nota'
  const name = size <= 12 ? INTERVAL_NAMES[size] : `8ª + ${INTERVAL_NAMES[size % 12 || 12]}`
  return `${name} ${semitones > 0 ? 'acima' : 'abaixo'}`
}

/** Forma curta para caber dentro da nota: "+3M", "−2m", "=". */
export function intervalShort(semitones: number): string {
  const size = Math.abs(semitones)
  if (size === 0) return '='
  const name = size <= 12 ? INTERVAL_SHORT[size] : `${size}st`
  return `${semitones > 0 ? '+' : '−'}${name}`
}

/**
 * Para cada nota, a nota anterior da melodia (pela ordem de início). A primeira
 * não entra. Em notas simultâneas, todas apontam para a anterior ao acorde.
 */
export function previousNotes(notes: Note[]): Map<string, Note> {
  const ordered = [...notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch)
  const out = new Map<string, Note>()
  let prev: Note | null = null
  let group: Note[] = []
  for (const n of ordered) {
    if (group.length > 0 && n.start !== group[0].start) {
      prev = group[group.length - 1]
      group = []
    }
    if (prev) out.set(n.id, prev)
    group.push(n)
  }
  return out
}

/** Nota mais grave e mais aguda, por extenso: "Mi4 a Dó5". */
export function rangeLabel(notes: Note[], scale: ScaleInfo): string {
  if (notes.length === 0) return ''
  const low = Math.min(...notes.map((n) => n.pitch))
  const high = Math.max(...notes.map((n) => n.pitch))
  return low === high ? pitchLabel(low, scale) : `${pitchLabel(low, scale)} a ${pitchLabel(high, scale)}`
}

