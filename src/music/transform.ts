import { MAX_PITCH, MIN_PITCH } from './notes'
import { scaleStepsBetween, shiftDiatonic, snapToScale, type ScaleInfo } from './scale'
import type { Note } from './types'

/** Gerador de números entre 0 e 1. Passar um com semente torna o resultado reproduzível. */
export type Rng = () => number

export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Aplica a troca de altura a todas as notas, ou a nenhuma se alguma sairia do teclado. */
function mapPitches(notes: Note[], fn: (pitch: number) => number): Note[] {
  const next = notes.map((n) => fn(n.pitch))
  if (next.some((p) => p < MIN_PITCH || p > MAX_PITCH)) return notes
  return notes.map((n, i) => (next[i] === n.pitch ? n : { ...n, pitch: next[i] }))
}

function bounds(notes: Note[]): { start: number; end: number } {
  let start = Infinity
  let end = 0
  for (const n of notes) {
    start = Math.min(start, n.start)
    end = Math.max(end, n.start + n.duration)
  }
  return { start: start === Infinity ? 0 : start, end }
}

export function transposeChromatic(notes: Note[], semitones: number): Note[] {
  return mapPitches(notes, (p) => p + semitones)
}

/** Sobe ou desce por graus da escala; o desenho da melodia se adapta ao modo. */
export function transposeDiatonic(notes: Note[], steps: number, scale: ScaleInfo): Note[] {
  return mapPitches(notes, (p) => shiftDiatonic(p, steps, scale))
}

/** Primeira nota no tempo (a mais grave, em caso de empate). */
function firstPitch(notes: Note[]): number {
  let first = notes[0]
  for (const n of notes) {
    if (n.start < first.start || (n.start === first.start && n.pitch < first.pitch)) first = n
  }
  return first.pitch
}

/**
 * Inverte os intervalos em torno da primeira nota: o que subia passa a descer.
 * Com escala, a inversão é por graus e o resultado continua dentro dela.
 */
export function invert(notes: Note[], scale?: ScaleInfo | null): Note[] {
  if (notes.length === 0) return notes
  const pivot = firstPitch(notes)
  if (!scale) return mapPitches(notes, (p) => 2 * pivot - p)
  const anchor = snapToScale(pivot, scale)
  return mapPitches(notes, (p) => shiftDiatonic(anchor, -scaleStepsBetween(anchor, snapToScale(p, scale), scale), scale))
}

/**
 * Espelha o contorno dentro da própria tessitura: a nota mais aguda vira a mais
 * grave e vice-versa, e a melodia continua ocupando a mesma região.
 */
export function mirrorContour(notes: Note[], scale?: ScaleInfo | null): Note[] {
  if (notes.length === 0) return notes
  const low = Math.min(...notes.map((n) => n.pitch))
  const high = Math.max(...notes.map((n) => n.pitch))
  if (!scale) return mapPitches(notes, (p) => low + high - p)
  const lowS = snapToScale(low, scale)
  const highS = snapToScale(high, scale)
  return mapPitches(notes, (p) => shiftDiatonic(lowS, scaleStepsBetween(snapToScale(p, scale), highS, scale), scale))
}

/** Toca de trás para a frente, ocupando o mesmo trecho de tempo. */
export function retrograde(notes: Note[]): Note[] {
  const { start, end } = bounds(notes)
  return notes.map((n) => ({ ...n, start: start + end - (n.start + n.duration) }))
}

/** Estica (fator 2) ou comprime (fator 0,5) o ritmo a partir do início do trecho. */
export function scaleRhythm(notes: Note[], factor: number, minDuration = 30): Note[] {
  const { start } = bounds(notes)
  return notes.map((n) => ({
    ...n,
    start: Math.round(start + (n.start - start) * factor),
    duration: Math.max(minDuration, Math.round(n.duration * factor)),
  }))
}

/** Tira a rigidez: desloca cada início em até `timing` ticks e varia a intensidade em até `velocity`. */
export function humanize(notes: Note[], amount: { timing: number; velocity: number }, rng: Rng = Math.random): Note[] {
  return notes.map((n) => ({
    ...n,
    start: Math.max(0, n.start + Math.round((rng() * 2 - 1) * amount.timing)),
    velocity: Math.min(1, Math.max(0.05, n.velocity + (rng() * 2 - 1) * amount.velocity)),
  }))
}
