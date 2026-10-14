import { describe, expect, it } from 'vitest'
import { PROGRESSIONS, backingNotes, chordPitches, diatonicChords, fillProgression, suggestChords } from './chords'
import { KEYS, SCALES } from './scale'
import type { Note } from './types'

const symbols = (key: string, scale: string) => diatonicChords(key, scale).map((c) => c.symbol)
const romans = (key: string, scale: string) => diatonicChords(key, scale).map((c) => c.roman)
const bar = 1920
const tune = (specs: [pitch: number, start: number, duration: number][]): Note[] =>
  specs.map(([pitch, start, duration], i) => ({ id: `n${i}`, pitch, start, duration, velocity: 0.8 }))

describe('diatonicChords', () => {
  it('Dó maior', () => {
    expect(symbols('C', 'major')).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'])
    expect(romans('C', 'major')).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'])
  })
  it('Lá menor', () => {
    expect(symbols('A', 'minor')).toEqual(['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G'])
    expect(romans('A', 'minor')).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'])
  })
  it('Ré dórico tem IV maior', () => {
    expect(symbols('D', 'dorian')).toEqual(['Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'C'])
  })
  it('usa a grafia da tonalidade', () => {
    expect(symbols('Eb', 'major')).toEqual(['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm', 'Ddim'])
  })
  it('menor harmônica tem dominante maior e terceiro grau aumentado', () => {
    const chords = symbols('A', 'harmonic minor')
    expect(chords[4]).toBe('E')
    expect(chords[2]).toBe('Caug')
  })
  it('pentatônicas, blues e cromática pegam a harmonia da escala mãe', () => {
    expect(symbols('C', 'major pentatonic')).toEqual(symbols('C', 'major'))
    expect(symbols('A', 'minor pentatonic')).toEqual(symbols('A', 'minor'))
    expect(symbols('A', 'blues')).toEqual(symbols('A', 'minor'))
  })
  it('toda combinação da interface dá sete acordes que o tonal reconhece', () => {
    for (const key of KEYS) {
      for (const { id } of SCALES) {
        const chords = diatonicChords(key, id)
        expect(chords, `${key} ${id}`).toHaveLength(7)
        for (const c of chords) expect(chordPitches(c.symbol).length, `${key} ${id} ${c.symbol}`).toBeGreaterThanOrEqual(4)
      }
    }
  })
})

describe('chordPitches', () => {
  it('baixo na oitava 2 e tríade fechada subindo a partir da oitava 3', () => {
    expect(chordPitches('C')).toEqual([36, 48, 52, 55])
    expect(chordPitches('Am')).toEqual([45, 57, 60, 64])
    expect(chordPitches('Bdim')).toEqual([47, 59, 62, 65])
  })
  it('cifra desconhecida não dá nota', () => {
    expect(chordPitches('Xyz')).toEqual([])
  })
})

describe('fillProgression', () => {
  it('repete a progressão até cobrir a melodia', () => {
    const out = fillProgression([1, 5, 6, 4], 'C', 'major', bar, bar * 6)
    expect(out.map((c) => c.symbol)).toEqual(['C', 'G', 'Am', 'F', 'C', 'G'])
    expect(out.map((c) => c.start)).toEqual([0, 1920, 3840, 5760, 7680, 9600])
    expect(out.every((c) => c.duration === bar)).toBe(true)
  })
  it('a mesma progressão muda de cara conforme o modo', () => {
    expect(fillProgression([1, 5, 6, 4], 'A', 'minor', bar, bar * 4).map((c) => c.symbol)).toEqual(['Am', 'Em', 'F', 'Dm'])
  })
  it('todos os presets usam graus de 1 a 7', () => {
    for (const p of PROGRESSIONS) expect(p.degrees.every((d) => d >= 1 && d <= 7)).toBe(true)
  })
})

describe('suggestChords', () => {
  it('arpejos apontam o próprio acorde', () => {
    const notes = tune([
      [60, 0, 480], [64, 480, 480], [67, 960, 960], // Dó Mi Sol
      [65, 1920, 480], [69, 2400, 480], [72, 2880, 960], // Fá Lá Dó
      [67, 3840, 480], [71, 4320, 480], [74, 4800, 960], // Sol Si Ré
      [72, 5760, 1920], // Dó
    ])
    expect(suggestChords(notes, 'C', 'major', bar, bar * 4).map((c) => c.symbol)).toEqual(['C', 'F', 'G', 'C'])
  })
  it('a nota longa pesa mais que a de passagem', () => {
    // Lá longo com Sol e Si rápidos de passagem: cabe Am ou F, nunca G
    const notes = tune([[69, 0, 1440], [67, 1440, 240], [71, 1680, 240]])
    expect(['Am', 'F']).toContain(suggestChords(notes, 'C', 'major', bar, bar)[0].symbol)
  })
  it('compasso sem notas repete o acorde anterior', () => {
    const notes = tune([[65, 0, 960], [69, 960, 960]])
    const out = suggestChords(notes, 'C', 'major', bar, bar * 3)
    expect(out).toHaveLength(3)
    expect(out[1].symbol).toBe(out[0].symbol)
    expect(out[2].symbol).toBe(out[0].symbol)
  })
  it('só sugere acordes da escala', () => {
    const allowed = new Set(diatonicChords('D', 'dorian').map((c) => c.symbol))
    const notes = tune([[62, 0, 480], [65, 480, 480], [69, 960, 960], [71, 1920, 960], [67, 2880, 960]])
    for (const c of suggestChords(notes, 'D', 'dorian', bar / 2, bar * 2)) expect(allowed.has(c.symbol)).toBe(true)
  })
})

describe('backingNotes', () => {
  const chords = [{ start: 0, duration: bar, symbol: 'C' }, { start: bar, duration: bar, symbol: 'G' }]
  it('bloco sustenta o acorde inteiro pelo tempo da cifra', () => {
    const out = backingNotes(chords, 'block', [4, 4])
    expect(out).toHaveLength(8)
    expect(out.slice(0, 4).map((n) => n.pitch)).toEqual([36, 48, 52, 55])
    expect(out.every((n) => n.duration === bar)).toBe(true)
  })
  it('arpejo toca o baixo e sobe e desce em colcheias', () => {
    const out = backingNotes(chords.slice(0, 1), 'arp', [4, 4])
    expect(out[0]).toMatchObject({ pitch: 36, start: 0, duration: bar })
    const arp = out.slice(1)
    expect(arp).toHaveLength(8)
    expect(arp.map((n) => n.start)).toEqual([0, 240, 480, 720, 960, 1200, 1440, 1680])
    expect(arp.map((n) => n.pitch)).toEqual([48, 52, 55, 52, 48, 52, 55, 52])
  })
  it('cifra desconhecida é ignorada', () => {
    expect(backingNotes([{ start: 0, duration: bar, symbol: '?' }], 'block', [4, 4])).toEqual([])
  })
})
