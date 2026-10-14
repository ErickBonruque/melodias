import { MAX_PITCH, MIN_PITCH, newId } from './notes'
import { degreeOf, pitchFromStepIndex, snapToScale, stepIndex, type ScaleInfo } from './scale'
import { ticksPerBeat } from './time'
import type { Rng } from './transform'
import type { Note, TimeSignature } from './types'

export type Contour = 'rise' | 'fall' | 'arch' | 'valley' | 'wander'

export const CONTOURS: { id: Contour; label: string }[] = [
  { id: 'arch', label: 'Arco' },
  { id: 'rise', label: 'Sobe' },
  { id: 'fall', label: 'Desce' },
  { id: 'valley', label: 'Vale' },
  { id: 'wander', label: 'Livre' },
]

export type GenerateOptions = {
  scale: ScaleInfo
  timeSignature: TimeSignature
  bars: number
  contour: Contour
  /** 0 = notas longas e espaçadas, 1 = muitas notas curtas. */
  density: number
  /** Maior salto permitido entre notas vizinhas, em graus da escala (1 = só grau conjunto). */
  leap: number
  /** Grau em que a melodia repousa no fim: 1 (tônica), 3 ou 5. */
  rest: number
  /** Altura em torno da qual a melodia se move. */
  center?: number
  start?: number
  rng?: Rng
}

/** Altura do contorno em cada ponto do percurso (t de 0 a 1), de -1 (grave) a 1 (agudo). */
function contourAt(contour: Contour, t: number): number {
  switch (contour) {
    case 'rise':
      return -1 + 2 * t
    case 'fall':
      return 1 - 2 * t
    case 'arch':
      return Math.sin(Math.PI * t) * 1.7 - 0.7
    case 'valley':
      return 0.7 - Math.sin(Math.PI * t) * 1.7
    case 'wander':
      return 0
  }
}

/** Divisões de um tempo, com o peso de cada uma conforme a densidade. O 2 ocupa dois tempos. */
function pickPattern(density: number, rng: Rng): number[] {
  const d = density
  const options: [number[], number][] = [
    [[2], (1 - d) * (1 - d) * 1.6],
    [[1], (1 - d) * 2 + 0.25],
    [[0.5, 0.5], 0.5 + d * 1.3],
    [[0.75, 0.25], d * 0.7],
    [[0.5, 0.25, 0.25], d * d * 1.1],
    [[0.25, 0.25, 0.5], d * d * 0.9],
    [[0.25, 0.25, 0.25, 0.25], d * d * d * 1.3],
  ]
  let roll = rng() * options.reduce((sum, [, w]) => sum + w, 0)
  for (const [pattern, weight] of options) {
    roll -= weight
    if (roll <= 0) return pattern
  }
  return [1]
}

/** Melodia nova dentro da escala, seguindo um contorno e terminando numa nota de repouso. */
export function generateMelody(o: GenerateOptions): Note[] {
  const rng = o.rng ?? Math.random
  const beat = ticksPerBeat(o.timeSignature)
  const totalBeats = Math.max(1, o.bars) * o.timeSignature[0]
  const finalBeats = Math.min(totalBeats, o.timeSignature[0] >= 3 ? 2 : 1)
  const start = o.start ?? 0
  const leap = Math.max(1, Math.round(o.leap))

  // 1. ritmo: preenche tempo a tempo e guarda o fim para a nota de repouso
  const slots: { at: number; length: number }[] = []
  let at = 0
  const bodyBeats = totalBeats - finalBeats
  while (at < bodyBeats - 1e-9) {
    let pattern = pickPattern(o.density, rng)
    if (pattern[0] === 2 && at + 2 > bodyBeats) pattern = [1]
    const silent = at > 0 && rng() < (1 - o.density) * 0.12
    let offset = 0
    for (const length of pattern) {
      if (!silent) slots.push({ at: at + offset, length })
      offset += length
    }
    at += offset
  }
  slots.push({ at: bodyBeats, length: finalBeats })

  // 2. alturas: um passeio por graus da escala, puxado pelo contorno
  const base = stepIndex(snapToScale(o.center ?? 67, o.scale), o.scale)
  const reach = 3 + leap * 0.5
  const pitchAt = (offset: number) => pitchFromStepIndex(base + offset, o.scale)
  const inRange = (offset: number) => {
    const p = pitchAt(offset)
    return p >= MIN_PITCH + 12 && p <= MAX_PITCH - 12
  }

  let position = Math.round(contourAt(o.contour, 0) * reach)
  const notes: Note[] = slots.map((slot, i) => {
    const last = i === slots.length - 1
    if (i > 0) {
      const t = slot.at / Math.max(1, totalBeats - finalBeats)
      const target = contourAt(o.contour, Math.min(1, t)) * reach
      let move = Math.round((target - position) * 0.5 + (rng() * 2 - 1) * leap * 0.8)
      move = Math.max(-leap, Math.min(leap, move))
      if (move === 0 && rng() < 0.65) move = target >= position ? 1 : -1
      if (!inRange(position + move)) move = -move
      position += move
    }
    if (last) {
      // repouso: o grau pedido mais próximo de onde a melodia chegou
      const wanted = [o.rest, 1].find((d) => o.scale.degrees.includes(d)) ?? 1
      for (let d = 0; d <= 7; d++) {
        const hit = [position - d, position + d].find((x) => degreeOf(pitchAt(x), o.scale) === wanted && inRange(x))
        if (hit != null) {
          position = hit
          break
        }
      }
    }
    const onBeat = Math.abs(slot.at - Math.round(slot.at)) < 1e-9
    const downbeat = onBeat && Math.round(slot.at) % o.timeSignature[0] === 0
    const accent = downbeat ? 0.9 : onBeat ? 0.8 : 0.68
    return {
      id: newId(),
      pitch: pitchAt(position),
      start: start + Math.round(slot.at * beat),
      duration: Math.max(30, Math.round(slot.length * beat * (last ? 1 : 0.95))),
      velocity: Math.min(1, Math.max(0.3, accent + (rng() * 2 - 1) * 0.05)),
    }
  })
  return notes
}

/**
 * Variação de um motivo: mantém o ritmo e sorteia novos intervalos com uma cadeia
 * de Markov de primeira ordem montada sobre os intervalos (em graus) do próprio motivo.
 */
export function generateVariation(motif: Note[], scale: ScaleInfo, start: number, rng: Rng = Math.random): Note[] {
  const ordered = [...motif].sort((a, b) => a.start - b.start || a.pitch - b.pitch)
  if (ordered.length < 2) return []
  const steps = ordered.map((n) => stepIndex(snapToScale(n.pitch, scale), scale))
  const intervals = steps.slice(1).map((s, i) => s - steps[i])

  const chain = new Map<number, number[]>()
  intervals.slice(1).forEach((next, i) => {
    const from = intervals[i]
    chain.set(from, [...(chain.get(from) ?? []), next])
  })
  const pick = <T>(list: T[]): T => list[Math.floor(rng() * list.length)]

  const low = Math.min(...steps) - 3
  const high = Math.max(...steps) + 3
  let result: number[] = steps
  for (let attempt = 0; attempt < 8; attempt++) {
    const walk = [steps[0]]
    let prev: number | null = null
    for (let i = 0; i < intervals.length; i++) {
      const options: number[] = prev != null ? (chain.get(prev) ?? intervals) : intervals
      let interval = pick(options)
      // se sairia da região do motivo, tenta outro intervalo do vocabulário que caiba
      const fits = (x: number) => walk[i] + x >= low && walk[i] + x <= high
      if (!fits(interval)) interval = intervals.filter(fits).length > 0 ? pick(intervals.filter(fits)) : 0
      walk.push(walk[i] + interval)
      prev = interval
    }
    result = walk
    if (walk.some((s, i) => s !== steps[i])) break
  }

  const origin = ordered[0].start
  return ordered.map((n, i) => ({
    ...n,
    id: newId(),
    pitch: Math.min(MAX_PITCH, Math.max(MIN_PITCH, pitchFromStepIndex(result[i], scale))),
    start: start + (n.start - origin),
  }))
}
