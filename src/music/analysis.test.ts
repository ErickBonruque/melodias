import { describe, expect, it } from 'vitest'
import { detectKey, intervalLabel, intervalShort, outOfScale, previousNotes, rangeLabel, sameNotes } from './analysis'
import { getScale } from './scale'
import type { Note } from './types'

const mk = (pitches: number[], durations?: number[]): Note[] =>
  pitches.map((pitch, i) => ({ id: `n${i}`, pitch, start: i * 480, duration: durations?.[i] ?? 480, velocity: 0.8 }))

describe('detectKey', () => {
  it('sem notas não arrisca', () => {
    expect(detectKey([])).toEqual([])
  })
  it('reconhece Dó maior numa melodia que repousa em Dó', () => {
    // Brilha, brilha, estrelinha
    const twinkle = mk([60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60], [480, 480, 480, 480, 480, 480, 960, 480, 480, 480, 480, 480, 480, 960])
    expect(detectKey(twinkle)[0]).toMatchObject({ key: 'C', scale: 'major' })
  })
  it('reconhece Lá menor quando a melodia gira em torno de Lá, Dó e Mi', () => {
    const tune = mk([69, 72, 76, 72, 69, 71, 72, 74, 76, 72, 69, 68, 69], [960, 480, 960, 480, 960, 240, 240, 240, 480, 480, 480, 480, 1920])
    expect(detectKey(tune)[0]).toMatchObject({ key: 'A', scale: 'minor' })
  })
  it('transpor a melodia transpõe a resposta', () => {
    const twinkle = [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60]
    const durations = [480, 480, 480, 480, 480, 480, 960, 480, 480, 480, 480, 480, 480, 960]
    expect(detectKey(mk(twinkle.map((p) => p + 3), durations))[0]).toMatchObject({ key: 'Eb', scale: 'major' })
    expect(detectKey(mk(twinkle.map((p) => p + 7), durations))[0]).toMatchObject({ key: 'G', scale: 'major' })
  })
  it('devolve as 24 tonalidades em ordem de pontuação', () => {
    const guesses = detectKey(mk([60, 64, 67]))
    expect(guesses).toHaveLength(24)
    guesses.slice(1).forEach((g, i) => expect(g.score).toBeLessThanOrEqual(guesses[i].score))
  })
})

describe('escalas', () => {
  it('relativas têm as mesmas notas', () => {
    expect(sameNotes(getScale('C', 'major'), getScale('A', 'minor'))).toBe(true)
    expect(sameNotes(getScale('C', 'major'), getScale('D', 'dorian'))).toBe(true)
    expect(sameNotes(getScale('C', 'major'), getScale('G', 'major'))).toBe(false)
    expect(sameNotes(getScale('C', 'major'), getScale('C', 'major pentatonic'))).toBe(false)
  })
  it('acha as notas fora da escala', () => {
    expect(outOfScale(mk([60, 61, 64, 66]), getScale('C', 'major')).map((n) => n.pitch)).toEqual([61, 66])
  })
  it('extensão por extenso', () => {
    expect(rangeLabel(mk([64, 72, 67]), getScale('C', 'major'))).toBe('Mi4 a Dó5')
    expect(rangeLabel(mk([60]), getScale('C', 'major'))).toBe('Dó4')
    expect(rangeLabel([], getScale('C', 'major'))).toBe('')
  })
})

describe('intervalos', () => {
  it('por extenso', () => {
    expect(intervalLabel(4)).toBe('3ª maior acima')
    expect(intervalLabel(-1)).toBe('2ª menor abaixo')
    expect(intervalLabel(7)).toBe('5ª justa acima')
    expect(intervalLabel(0)).toBe('mesma nota')
    expect(intervalLabel(12)).toBe('8ª acima')
    expect(intervalLabel(-16)).toBe('8ª + 3ª maior abaixo')
  })
  it('forma curta', () => {
    expect(intervalShort(4)).toBe('+3M')
    expect(intervalShort(-3)).toBe('−3m')
    expect(intervalShort(0)).toBe('=')
    expect(intervalShort(6)).toBe('+TT')
  })
  it('nota anterior segue a ordem do tempo, não a da lista', () => {
    const notes: Note[] = [
      { id: 'c', pitch: 67, start: 960, duration: 240, velocity: 0.8 },
      { id: 'a', pitch: 60, start: 0, duration: 240, velocity: 0.8 },
      { id: 'b', pitch: 64, start: 480, duration: 240, velocity: 0.8 },
    ]
    const prev = previousNotes(notes)
    expect(prev.has('a')).toBe(false)
    expect(prev.get('b')?.id).toBe('a')
    expect(prev.get('c')?.id).toBe('b')
  })
  it('notas de um acorde apontam para a nota antes do acorde', () => {
    const notes: Note[] = [
      { id: 'a', pitch: 60, start: 0, duration: 240, velocity: 0.8 },
      { id: 'b', pitch: 64, start: 480, duration: 240, velocity: 0.8 },
      { id: 'c', pitch: 67, start: 480, duration: 240, velocity: 0.8 },
      { id: 'd', pitch: 72, start: 960, duration: 240, velocity: 0.8 },
    ]
    const prev = previousNotes(notes)
    expect(prev.get('b')?.id).toBe('a')
    expect(prev.get('c')?.id).toBe('a')
    expect(prev.get('d')?.id).toBe('c')
  })
})
