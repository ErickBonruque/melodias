import type { Melody, Note } from './types'
import { PPQ } from './types'
import { ticksPerBar } from './time'

export const MIN_PITCH = 21 // Lá0
export const MAX_PITCH = 108 // Dó8

export function newId(): string {
  return crypto.randomUUID()
}

export function clampPitch(pitch: number): number {
  return Math.min(MAX_PITCH, Math.max(MIN_PITCH, Math.round(pitch)))
}

export function createNote(fields: Omit<Note, 'id' | 'velocity'> & { velocity?: number }): Note {
  return {
    id: newId(),
    pitch: clampPitch(fields.pitch),
    start: Math.max(0, Math.round(fields.start)),
    duration: Math.max(1, Math.round(fields.duration)),
    velocity: fields.velocity ?? 0.8,
  }
}

export function createMelody(fields: Partial<Melody> = {}): Melody {
  const now = Date.now()
  return {
    id: newId(),
    title: '',
    tags: [],
    bpm: 96,
    timeSignature: [4, 4],
    key: 'C',
    scale: 'major',
    instrument: 'piano',
    notes: [],
    createdAt: now,
    updatedAt: now,
    ...fields,
  }
}

/** Tick em que a última nota termina. */
export function notesEnd(notes: Note[]): number {
  let end = 0
  for (const n of notes) end = Math.max(end, n.start + n.duration)
  return end
}

/** Fim da melodia arredondado para o compasso seguinte (no mínimo um compasso). */
export function melodyEnd(m: Pick<Melody, 'notes' | 'timeSignature'>): number {
  const bar = ticksPerBar(m.timeSignature)
  return Math.max(bar, Math.ceil(notesEnd(m.notes) / bar) * bar)
}

/**
 * Move as notas indicadas no tempo e na altura. O grupo anda junto: se alguma
 * nota bateria no início da linha do tempo ou no limite do teclado, o movimento
 * inteiro é contido naquele eixo.
 */
export function moveNotes(
  notes: Note[],
  ids: ReadonlySet<string>,
  dTick: number,
  mapPitch: (pitch: number) => number = (p) => p,
): Note[] {
  let minStart = Infinity
  let pitchOk = true
  for (const n of notes) {
    if (!ids.has(n.id)) continue
    minStart = Math.min(minStart, n.start)
    const p = mapPitch(n.pitch)
    if (p < MIN_PITCH || p > MAX_PITCH) pitchOk = false
  }
  if (minStart === Infinity) return notes
  const dt = Math.max(dTick, -minStart)
  return notes.map((n) => {
    if (!ids.has(n.id)) return n
    const pitch = pitchOk ? mapPitch(n.pitch) : n.pitch
    if (dt === 0 && pitch === n.pitch) return n
    return { ...n, start: n.start + dt, pitch }
  })
}

/** Estica ou encolhe as notas por uma das bordas, respeitando a duração mínima. */
export function resizeNotes(
  notes: Note[],
  ids: ReadonlySet<string>,
  dTick: number,
  edge: 'left' | 'right',
  minDuration = PPQ / 8,
): Note[] {
  return notes.map((n) => {
    if (!ids.has(n.id)) return n
    if (edge === 'right') {
      const duration = Math.max(Math.min(minDuration, n.duration), n.duration + dTick)
      return duration === n.duration ? n : { ...n, duration }
    }
    const end = n.start + n.duration
    const start = Math.min(end - Math.min(minDuration, n.duration), Math.max(0, n.start + dTick))
    return start === n.start ? n : { ...n, start, duration: end - start }
  })
}

export function removeNotes(notes: Note[], ids: ReadonlySet<string>): Note[] {
  return notes.filter((n) => !ids.has(n.id))
}

/** Copia as notas com ids novos, deslocando o conjunto para começar em `atTick`. */
export function cloneNotesAt(source: Note[], atTick: number): Note[] {
  if (source.length === 0) return []
  const origin = Math.min(...source.map((n) => n.start))
  return source.map((n) => ({ ...n, id: newId(), start: n.start - origin + atTick }))
}

/** Ids das notas que tocam o retângulo (ticks × alturas, limites inclusivos na altura). */
export function notesInRect(notes: Note[], t0: number, t1: number, p0: number, p1: number): string[] {
  const [ta, tb] = t0 <= t1 ? [t0, t1] : [t1, t0]
  const [pa, pb] = p0 <= p1 ? [p0, p1] : [p1, p0]
  return notes
    .filter((n) => n.pitch >= pa && n.pitch <= pb && n.start < tb && n.start + n.duration > ta)
    .map((n) => n.id)
}

/** Nota sob o ponto. Quando há sobreposição, vale a que foi criada por último. */
export function noteAt(notes: Note[], tick: number, pitch: number): Note | undefined {
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i]
    if (n.pitch === pitch && tick >= n.start && tick < n.start + n.duration) return n
  }
  return undefined
}
