import { describe, expect, it } from 'vitest'
import { MAX_PITCH } from './notes'
import { getScale, isInScale } from './scale'
import { humanize, invert, mirrorContour, retrograde, scaleRhythm, seededRng, transposeChromatic, transposeDiatonic } from './transform'
import type { Note } from './types'

const mk = (pitches: number[], step = 480, duration = 240): Note[] =>
  pitches.map((pitch, i) => ({ id: `n${i}`, pitch, start: i * step, duration, velocity: 0.8 }))
const pitches = (notes: Note[]) => notes.map((n) => n.pitch)
const cMajor = getScale('C', 'major')
const aMinor = getScale('A', 'minor')

describe('transpor', () => {
  it('cromático soma semitons e preserva ids', () => {
    const out = transposeChromatic(mk([60, 64, 67]), 3)
    expect(pitches(out)).toEqual([63, 67, 70])
    expect(out.map((n) => n.id)).toEqual(['n0', 'n1', 'n2'])
  })
  it('diatônico anda por graus: Dó-Mi-Sol sobe para Ré-Fá-Lá', () => {
    expect(pitches(transposeDiatonic(mk([60, 64, 67]), 1, cMajor))).toEqual([62, 65, 69])
    expect(pitches(transposeDiatonic(mk([60, 64, 67]), -2, cMajor))).toEqual([57, 60, 64])
  })
  it('se alguma nota sairia do teclado, nada muda', () => {
    const notes = mk([60, MAX_PITCH])
    expect(transposeChromatic(notes, 1)).toBe(notes)
  })
})

describe('inverter', () => {
  it('cromático espelha em torno da primeira nota', () => {
    expect(pitches(invert(mk([60, 64, 67, 62])))).toEqual([60, 56, 53, 58])
  })
  it('com escala inverte por graus e fica na escala', () => {
    const out = invert(mk([60, 64, 67, 62]), cMajor)
    expect(pitches(out)).toEqual([60, 57, 53, 59]) // Dó, Lá, Fá, Si
    expect(out.every((n) => isInScale(n.pitch, cMajor))).toBe(true)
  })
  it('inverter duas vezes devolve o original', () => {
    const notes = mk([69, 72, 76, 74, 71])
    expect(pitches(invert(invert(notes, aMinor), aMinor))).toEqual(pitches(notes))
    expect(pitches(invert(invert(notes)))).toEqual(pitches(notes))
  })
})

describe('espelhar contorno', () => {
  it('troca agudo por grave sem sair da tessitura', () => {
    const out = mirrorContour(mk([60, 62, 64, 67]), cMajor)
    expect(pitches(out)).toEqual([67, 65, 64, 60])
    expect(Math.min(...pitches(out))).toBe(60)
    expect(Math.max(...pitches(out))).toBe(67)
  })
  it('cromático: mínimo + máximo - altura', () => {
    expect(pitches(mirrorContour(mk([60, 61, 67])))).toEqual([67, 66, 60])
  })
  it('espelhar duas vezes devolve o original', () => {
    const notes = mk([60, 64, 62, 67, 65])
    expect(pitches(mirrorContour(mirrorContour(notes, cMajor), cMajor))).toEqual(pitches(notes))
  })
})

describe('retrógrado', () => {
  it('inverte a ordem no tempo ocupando o mesmo trecho', () => {
    const notes = mk([60, 62, 64]).map((n) => ({ ...n, start: n.start + 960 }))
    const out = retrograde(notes)
    // trecho original: 960 até 2160
    expect(out.map((n) => n.start)).toEqual([1920, 1440, 960])
    expect(Math.max(...out.map((n) => n.start + n.duration))).toBe(2160)
  })
  it('respeita durações diferentes', () => {
    const notes: Note[] = [
      { id: 'a', pitch: 60, start: 0, duration: 960, velocity: 0.8 },
      { id: 'b', pitch: 62, start: 960, duration: 240, velocity: 0.8 },
    ]
    expect(retrograde(notes).map((n) => [n.start, n.duration])).toEqual([[240, 960], [0, 240]])
  })
  it('duas vezes devolve o original', () => {
    const notes = mk([60, 62, 64, 65], 360, 200)
    expect(retrograde(retrograde(notes))).toEqual(notes)
  })
})

describe('ritmo', () => {
  it('fator 2 dobra distâncias e durações a partir do início do trecho', () => {
    const notes = mk([60, 62, 64]).map((n) => ({ ...n, start: n.start + 480 }))
    const out = scaleRhythm(notes, 2)
    expect(out.map((n) => n.start)).toEqual([480, 1440, 2400])
    expect(out.map((n) => n.duration)).toEqual([480, 480, 480])
  })
  it('fator 0,5 comprime e nunca zera a duração', () => {
    const out = scaleRhythm(mk([60, 62], 480, 40), 0.5)
    expect(out.map((n) => n.start)).toEqual([0, 240])
    expect(out[0].duration).toBe(30)
  })
})

describe('humanizar', () => {
  it('fica dentro dos limites e é reproduzível com semente', () => {
    const notes = mk([60, 62, 64, 65, 67, 69])
    const a = humanize(notes, { timing: 20, velocity: 0.1 }, seededRng(7))
    const b = humanize(notes, { timing: 20, velocity: 0.1 }, seededRng(7))
    expect(a).toEqual(b)
    a.forEach((n, i) => {
      expect(Math.abs(n.start - notes[i].start)).toBeLessThanOrEqual(20)
      expect(Math.abs(n.velocity - 0.8)).toBeLessThanOrEqual(0.1 + 1e-9)
      expect(n.start).toBeGreaterThanOrEqual(0)
      expect(n.pitch).toBe(notes[i].pitch)
    })
    expect(a.some((n, i) => n.start !== notes[i].start)).toBe(true)
  })
  it('zero não muda nada', () => {
    const notes = mk([60, 62])
    expect(humanize(notes, { timing: 0, velocity: 0 }, seededRng(1))).toEqual(notes)
  })
})
