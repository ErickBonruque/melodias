import { Chord } from 'tonal'
import { chromaOf, getScale, type ScaleInfo } from './scale'
import { ticksPerBeat } from './time'
import type { ChordEvent, Note, TimeSignature } from './types'

export type DiatonicChord = {
  /** Grau da escala em que o acorde nasce (1 a 7). */
  degree: number
  /** Cifra: "C", "Am", "Bdim". */
  symbol: string
  /** Numeral romano: maiúsculo para maior, minúsculo para menor, ° para diminuto. */
  roman: string
  /** Classes de altura do acorde, a fundamental primeiro. */
  chromas: number[]
}

/** Escalas de cinco, seis ou doze notas pegam a harmonia da escala de sete de onde vêm. */
const PARENT: Record<string, string> = {
  'major pentatonic': 'major',
  'minor pentatonic': 'minor',
  blues: 'minor',
  chromatic: 'major',
}

export function harmonyScale(key: string, scale: string): ScaleInfo {
  return getScale(key, PARENT[scale] ?? scale)
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/** As sete tríades da escala, uma em cada grau, empilhando terças dentro da própria escala. */
export function diatonicChords(key: string, scale: string): DiatonicChord[] {
  const s = harmonyScale(key, scale)
  const n = s.chromas.length
  return s.chromas.map((root, i) => {
    const third = s.chromas[(i + 2) % n]
    const fifth = s.chromas[(i + 4) % n]
    const t = (third - root + 12) % 12
    const f = (fifth - root + 12) % 12
    const quality = t === 4 && f === 7 ? '' : t === 3 && f === 7 ? 'm' : t === 3 && f === 6 ? 'dim' : t === 4 && f === 8 ? 'aug' : null
    const numeral = ROMAN[i] ?? String(i + 1)
    const roman =
      quality === 'm' ? numeral.toLowerCase() : quality === 'dim' ? `${numeral.toLowerCase()}°` : quality === 'aug' ? `${numeral}+` : numeral
    return { degree: i + 1, symbol: s.names[root] + (quality ?? ''), roman, chromas: [root, third, fifth] }
  })
}

/** Notas MIDI de uma cifra: baixo na oitava 2 e o acorde fechado a partir da oitava 3. */
export function chordPitches(symbol: string): number[] {
  const chord = Chord.get(symbol)
  if (chord.empty || chord.notes.length === 0) return []
  const chromas = chord.notes.map((name) => chromaOfName(name))
  const root = 48 + chromas[0]
  const pitches = [root - 12]
  let last = root - 1
  for (const c of chromas) {
    let p = 48 + c
    while (p <= last) p += 12
    pitches.push(p)
    last = p
  }
  return pitches
}

function chromaOfName(name: string): number {
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  let c = base[name[0]] ?? 0
  for (const ch of name.slice(1)) c += ch === '#' ? 1 : ch === 'b' ? -1 : 0
  return ((c % 12) + 12) % 12
}

/** Progressões comuns, por graus. Valem para qualquer escala de sete notas: o modo decide as qualidades. */
export const PROGRESSIONS: { id: string; degrees: number[] }[] = [
  { id: 'pop', degrees: [1, 5, 6, 4] },
  { id: 'anos-50', degrees: [1, 6, 4, 5] },
  { id: 'dois-cinco-um', degrees: [2, 5, 1, 1] },
  { id: 'ida-e-volta', degrees: [1, 4, 5, 4] },
  { id: 'descida', degrees: [1, 7, 6, 5] },
  { id: 'sexta-primeiro', degrees: [6, 4, 1, 5] },
]

/** Repete a progressão, um acorde por espaço de `slot` ticks, até cobrir `total`. */
export function fillProgression(degrees: number[], key: string, scale: string, slot: number, total: number): ChordEvent[] {
  const chords = diatonicChords(key, scale)
  const out: ChordEvent[] = []
  for (let i = 0; i * slot < total; i++) {
    const chord = chords[(degrees[i % degrees.length] - 1) % chords.length]
    out.push({ start: i * slot, duration: slot, symbol: chord.symbol })
  }
  return out
}

const PREFERENCE = [0.05, 0.01, 0, 0.04, 0.04, 0.02, 0]

/**
 * Sugere um acorde da escala para cada espaço, olhando as notas da melodia que soam
 * nele: quanto mais tempo a melodia passa em notas do acorde, melhor ele se encaixa.
 */
export function suggestChords(notes: Note[], key: string, scale: string, slot: number, total: number): ChordEvent[] {
  const chords = diatonicChords(key, scale)
  const out: ChordEvent[] = []
  const slots = Math.max(1, Math.ceil(total / slot))
  let previous = chords[0]

  for (let i = 0; i < slots; i++) {
    const from = i * slot
    const to = from + slot
    const weight: number[] = Array(12).fill(0)
    let sum = 0
    for (const n of notes) {
      const overlap = Math.min(to, n.start + n.duration) - Math.max(from, n.start)
      if (overlap <= 0) continue
      // a nota que cai no começo do espaço pesa mais: é ela que o ouvido prende ao acorde
      const w = overlap * (n.start >= from && n.start < from + slot / 8 ? 1.6 : 1)
      weight[chromaOf(n.pitch)] += w
      sum += w
    }

    let best = previous
    if (sum > 0) {
      let bestScore = -Infinity
      for (const chord of chords) {
        let score = 0
        for (let c = 0; c < 12; c++) score += weight[c] * (chord.chromas.includes(c) ? 1 : -0.4)
        if (chord.roman.includes('°')) score -= sum * 0.2
        // no empate, vence o acorde mais estrutural: I, depois IV e V, depois vi e ii
        score += sum * PREFERENCE[chord.degree - 1]
        if (chord.degree === 1 && (i === 0 || i === slots - 1)) score += sum * 0.15
        if (chord === previous) score -= sum * 0.03
        if (score > bestScore) {
          bestScore = score
          best = chord
        }
      }
    }
    out.push({ start: from, duration: slot, symbol: best.symbol })
    previous = best
  }
  return out
}

export type BackingStyle = 'block' | 'arp'

/** Transforma as cifras em notas de acompanhamento: acorde sustentado ou arpejo em colcheias. */
export function backingNotes(chords: ChordEvent[], style: BackingStyle, ts: TimeSignature): Omit<Note, 'id'>[] {
  const out: Omit<Note, 'id'>[] = []
  const step = ticksPerBeat(ts) / (ts[1] === 8 ? 1 : 2)
  for (const chord of chords) {
    const pitches = chordPitches(chord.symbol)
    if (pitches.length === 0) continue
    if (style === 'block') {
      for (const pitch of pitches) out.push({ pitch, start: chord.start, duration: chord.duration, velocity: 0.55 })
      continue
    }
    const [bass, ...upper] = pitches
    out.push({ pitch: bass, start: chord.start, duration: chord.duration, velocity: 0.6 })
    const pattern = [...upper, ...upper.slice(1, -1).reverse()]
    for (let t = 0, i = 0; t < chord.duration; t += step, i++) {
      out.push({ pitch: pattern[i % pattern.length], start: chord.start + t, duration: step, velocity: i === 0 ? 0.6 : 0.48 })
    }
  }
  return out
}
