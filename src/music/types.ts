/** Ticks por semínima. Todo tempo interno é em ticks inteiros, nunca em segundos. */
export const PPQ = 480

export type Note = {
  id: string
  /** Altura MIDI (60 = Dó4). */
  pitch: number
  /** Início em ticks. */
  start: number
  /** Duração em ticks. */
  duration: number
  /** Intensidade de 0 a 1. */
  velocity: number
}

export type ChordEvent = { start: number; duration: number; symbol: string }

export type TimeSignature = [number, number]

export type Melody = {
  id: string
  title: string
  tags: string[]
  bpm: number
  timeSignature: TimeSignature
  /** Tônica, ex.: "C", "Eb". */
  key: string
  /** Nome da escala no tonal, ex.: "dorian". */
  scale: string
  instrument: string
  notes: Note[]
  chords?: ChordEvent[]
  createdAt: number
  updatedAt: number
  versions?: { at: number; notes: Note[] }[]
}

export type GridValue = '1/4' | '1/8' | '1/16' | '1/32' | '1/8T' | '1/16T'
