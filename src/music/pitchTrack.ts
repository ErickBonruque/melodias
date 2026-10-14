import { newId } from './notes'
import { secondsToTicks } from './time'
import type { Note } from './types'

export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}

export type PitchFrame = {
  /** Instante da leitura, em milissegundos. */
  time: number
  freq: number
  /** Confiança do detector, de 0 a 1. */
  clarity: number
  /** Volume do sinal (RMS). */
  level: number
}

export type TrackerEvent = { type: 'on' | 'off'; pitch: number }

export type TrackerOptions = {
  minClarity: number
  minLevel: number
  minMidi: number
  maxMidi: number
  /** Quanto tempo uma altura nova precisa durar para virar nota. */
  attackMs: number
  /** Quanto silêncio encerra a nota. */
  releaseMs: number
  /** Desvio (em semitons) que ainda conta como a mesma nota: segura vibrato e afinação solta. */
  stickiness: number
}

export const TRACKER_DEFAULTS: TrackerOptions = {
  minClarity: 0.88,
  minLevel: 0.012,
  minMidi: 36,
  maxMidi: 96,
  attackMs: 45,
  releaseMs: 110,
  stickiness: 0.65,
}

/**
 * Transforma a leitura contínua de altura (voz, assobio) em notas ligadas e desligadas.
 * `map` permite ajustar a nota cantada, por exemplo levando-a para a escala.
 */
export class PitchTracker {
  /** Nota soando agora (já ajustada pelo `map`), ou null. */
  current: number | null = null
  private raw: number | null = null
  private candidate: { pitch: number; since: number } | null = null
  private lastVoiced = 0
  private o: TrackerOptions

  constructor(
    options: Partial<TrackerOptions> = {},
    private map: (pitch: number) => number = (p) => p,
  ) {
    this.o = { ...TRACKER_DEFAULTS, ...options }
  }

  push(frame: PitchFrame): TrackerEvent[] {
    const exact = frame.freq > 0 ? freqToMidi(frame.freq) : NaN
    const voiced =
      frame.clarity >= this.o.minClarity && frame.level >= this.o.minLevel && exact >= this.o.minMidi && exact <= this.o.maxMidi

    if (!voiced) {
      this.candidate = null
      if (this.current != null && frame.time - this.lastVoiced > this.o.releaseMs) return this.release()
      return []
    }
    this.lastVoiced = frame.time

    const pitch = this.raw != null && Math.abs(exact - this.raw) <= this.o.stickiness ? this.raw : Math.round(exact)
    if (pitch === this.raw) {
      this.candidate = null
      return []
    }
    if (this.candidate?.pitch !== pitch) {
      this.candidate = { pitch, since: frame.time }
      return []
    }
    if (frame.time - this.candidate.since < this.o.attackMs) return []

    this.candidate = null
    this.raw = pitch
    const next = this.map(pitch)
    if (next === this.current) return []
    const events: TrackerEvent[] = []
    if (this.current != null) events.push({ type: 'off', pitch: this.current })
    events.push({ type: 'on', pitch: next })
    this.current = next
    return events
  }

  release(): TrackerEvent[] {
    const events: TrackerEvent[] = this.current != null ? [{ type: 'off', pitch: this.current }] : []
    this.current = null
    this.raw = null
    this.candidate = null
    return events
  }
}

export type TranscribedNote = { pitch: number; start: number; duration: number; velocity: number }

/**
 * Arruma a saída de um transcritor de áudio (tempos em segundos) para virar melodia:
 * converte para ticks, começa em `at`, descarta notas curtas demais e desfaz
 * sobreposições, ficando sempre com a nota mais forte.
 */
export function cleanTranscription(
  events: TranscribedNote[],
  bpm: number,
  at = 0,
  opts: { minTicks?: number; map?: (pitch: number) => number } = {},
): Note[] {
  const minTicks = opts.minTicks ?? 60
  const sorted = events
    .filter((e) => e.duration > 0)
    .map((e) => ({ ...e, start: secondsToTicks(e.start, bpm), duration: secondsToTicks(e.duration, bpm) }))
    .filter((e) => e.duration >= minTicks)
    .sort((a, b) => a.start - b.start || b.velocity - a.velocity)
  if (sorted.length === 0) return []

  const kept: typeof sorted = []
  for (const e of sorted) {
    const prev = kept[kept.length - 1]
    if (!prev || e.start >= prev.start + prev.duration) {
      kept.push(e)
      continue
    }
    // sobrepõe a anterior: a mais forte fica inteira, a outra cede espaço
    if (e.velocity > prev.velocity && e.start - prev.start >= minTicks) {
      prev.duration = e.start - prev.start
      kept.push(e)
    } else if (e.velocity > prev.velocity) {
      kept[kept.length - 1] = e
    } else {
      const end = e.start + e.duration
      const prevEnd = prev.start + prev.duration
      if (end - prevEnd >= minTicks) kept.push({ ...e, start: prevEnd, duration: end - prevEnd })
    }
  }

  const origin = kept[0].start
  return kept.map((e) => ({
    id: newId(),
    pitch: (opts.map ?? ((p: number) => p))(Math.round(e.pitch)),
    start: at + e.start - origin,
    duration: e.duration,
    velocity: Math.min(1, Math.max(0.3, e.velocity)),
  }))
}
