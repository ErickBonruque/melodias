import { describe, expect, it } from 'vitest'
import { PPQ, type Note } from './types'
import {
  GRID_TICKS,
  formatPosition,
  positionOf,
  quantizeNotes,
  secondsToTicks,
  snapTick,
  ticksPerBar,
  ticksPerBeat,
  ticksToSeconds,
} from './time'

const note = (start: number, duration = 240): Note => ({ id: `n${start}`, pitch: 60, start, duration, velocity: 0.8 })

describe('grade', () => {
  it('todos os valores de grade são ticks inteiros', () => {
    for (const v of Object.values(GRID_TICKS)) expect(Number.isInteger(v)).toBe(true)
  })
  it('tercinas dividem a semínima em três', () => {
    expect(GRID_TICKS['1/8T'] * 3).toBe(PPQ)
    expect(GRID_TICKS['1/16T'] * 6).toBe(PPQ)
  })
})

describe('compasso', () => {
  it('4/4 tem 4 semínimas', () => {
    expect(ticksPerBeat([4, 4])).toBe(480)
    expect(ticksPerBar([4, 4])).toBe(1920)
  })
  it('6/8 conta colcheias', () => {
    expect(ticksPerBeat([6, 8])).toBe(240)
    expect(ticksPerBar([6, 8])).toBe(1440)
  })
  it('3/4', () => {
    expect(ticksPerBar([3, 4])).toBe(1440)
  })
})

describe('snapTick', () => {
  it('arredonda para o passo mais próximo', () => {
    expect(snapTick(130, 120)).toBe(120)
    expect(snapTick(190, 120)).toBe(240)
  })
  it('floor e ceil', () => {
    expect(snapTick(239, 120, 'floor')).toBe(120)
    expect(snapTick(121, 120, 'ceil')).toBe(240)
  })
  it('funciona com tercinas', () => {
    expect(snapTick(170, GRID_TICKS['1/8T'])).toBe(160)
  })
})

describe('posição', () => {
  it('começa em 1.1.1', () => {
    expect(positionOf(0, [4, 4])).toEqual({ bar: 1, beat: 1, sixteenth: 1 })
  })
  it('conta compasso, tempo e semicolcheia', () => {
    expect(formatPosition(1920 + 480 + 120, [4, 4])).toBe('2.2.2')
    expect(formatPosition(1440, [3, 4])).toBe('2.1.1')
  })
})

describe('segundos', () => {
  it('uma semínima a 120 bpm dura meio segundo', () => {
    expect(ticksToSeconds(PPQ, 120)).toBeCloseTo(0.5)
    expect(secondsToTicks(0.5, 120)).toBe(PPQ)
  })
  it('mudar o bpm não mexe nos ticks, só nos segundos', () => {
    expect(ticksToSeconds(1920, 60)).toBeCloseTo(4)
    expect(ticksToSeconds(1920, 240)).toBeCloseTo(1)
  })
})

describe('quantizeNotes', () => {
  it('força 1 cola na grade', () => {
    expect(quantizeNotes([note(130), note(350)], 120).map((n) => n.start)).toEqual([120, 360])
  })
  it('força 0.5 anda metade do caminho', () => {
    expect(quantizeNotes([note(140)], 120, 0.5)[0].start).toBe(130)
  })
  it('força 0 devolve as mesmas notas', () => {
    const notes = [note(137)]
    expect(quantizeNotes(notes, 120, 0)[0]).toBe(notes[0])
  })
  it('só mexe nas notas indicadas', () => {
    const notes = [note(130), note(350)]
    const out = quantizeNotes(notes, 120, 1, { ids: new Set(['n130']) })
    expect(out.map((n) => n.start)).toEqual([120, 350])
  })
  it('quantizar o fim nunca zera a duração', () => {
    const out = quantizeNotes([{ ...note(110), duration: 20 }], 120, 1, { ends: true })
    expect(out[0].start).toBe(120)
    expect(out[0].duration).toBeGreaterThan(0)
  })
})
