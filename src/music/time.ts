import { PPQ, type GridValue, type Note, type TimeSignature } from './types'

export const GRID_TICKS: Record<GridValue, number> = {
  '1/4': PPQ,
  '1/8': PPQ / 2,
  '1/16': PPQ / 4,
  '1/32': PPQ / 8,
  '1/8T': PPQ / 3,
  '1/16T': PPQ / 6,
}

export const GRID_OPTIONS: { value: GridValue; label: string }[] = [
  { value: '1/4', label: '1/4' },
  { value: '1/8', label: '1/8' },
  { value: '1/16', label: '1/16' },
  { value: '1/32', label: '1/32' },
  { value: '1/8T', label: '1/8 tercina' },
  { value: '1/16T', label: '1/16 tercina' },
]

export function ticksPerBeat(ts: TimeSignature): number {
  return (PPQ * 4) / ts[1]
}

export function ticksPerBar(ts: TimeSignature): number {
  return ts[0] * ticksPerBeat(ts)
}

export type SnapMode = 'round' | 'floor' | 'ceil'

export function snapTick(tick: number, step: number, mode: SnapMode = 'round'): number {
  if (step <= 0) return Math.round(tick)
  const q = tick / step
  const n = mode === 'floor' ? Math.floor(q) : mode === 'ceil' ? Math.ceil(q) : Math.round(q)
  return n * step
}

/** Posição musical com compasso e tempo começando em 1. */
export function positionOf(tick: number, ts: TimeSignature): { bar: number; beat: number; sixteenth: number } {
  const bar = ticksPerBar(ts)
  const beat = ticksPerBeat(ts)
  const t = Math.max(0, Math.floor(tick))
  const inBar = t % bar
  return {
    bar: Math.floor(t / bar) + 1,
    beat: Math.floor(inBar / beat) + 1,
    sixteenth: Math.floor((inBar % beat) / (PPQ / 4)) + 1,
  }
}

export function formatPosition(tick: number, ts: TimeSignature): string {
  const p = positionOf(tick, ts)
  return `${p.bar}.${p.beat}.${p.sixteenth}`
}

export function ticksToSeconds(ticks: number, bpm: number): number {
  return (ticks / PPQ) * (60 / bpm)
}

export function secondsToTicks(seconds: number, bpm: number): number {
  return Math.round((seconds * bpm * PPQ) / 60)
}

/**
 * Quantiza o início das notas para a grade. `strength` vai de 0 (não mexe) a 1 (cola na grade).
 * Com `ends`, o fim da nota também é puxado para a grade, sem deixar a duração zerar.
 */
export function quantizeNotes(
  notes: Note[],
  step: number,
  strength = 1,
  opts: { ends?: boolean; ids?: ReadonlySet<string> } = {},
): Note[] {
  const s = Math.min(1, Math.max(0, strength))
  return notes.map((n) => {
    if (opts.ids && !opts.ids.has(n.id)) return n
    const start = Math.max(0, Math.round(n.start + (snapTick(n.start, step) - n.start) * s))
    let duration = n.duration
    if (opts.ends) {
      const end = n.start + n.duration
      const qEnd = Math.round(end + (snapTick(end, step) - end) * s)
      duration = Math.max(Math.min(step, n.duration), qEnd - start)
    }
    if (start === n.start && duration === n.duration) return n
    return { ...n, start, duration }
  })
}
