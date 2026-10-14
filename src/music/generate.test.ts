import { describe, expect, it } from 'vitest'
import { generateMelody, generateVariation, type Contour, type GenerateOptions } from './generate'
import { degreeOf, getScale, isInScale, stepIndex } from './scale'
import { seededRng } from './transform'
import type { Note } from './types'

const dDorian = getScale('D', 'dorian')
const gen = (over: Partial<GenerateOptions> = {}, seed = 1) =>
  generateMelody({
    scale: dDorian,
    timeSignature: [4, 4],
    bars: 4,
    contour: 'arch',
    density: 0.5,
    leap: 2,
    rest: 1,
    rng: seededRng(seed),
    ...over,
  })
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1)

describe('generateMelody', () => {
  it('fica na escala, dentro do trecho pedido e sem sobreposição', () => {
    for (const seed of SEEDS) {
      const notes = gen({}, seed)
      expect(notes.length).toBeGreaterThan(3)
      expect(notes.every((n) => isInScale(n.pitch, dDorian))).toBe(true)
      expect(notes[0].start).toBe(0)
      expect(Math.max(...notes.map((n) => n.start + n.duration))).toBeLessThanOrEqual(4 * 1920)
      notes.slice(1).forEach((n, i) => expect(n.start).toBeGreaterThanOrEqual(notes[i].start + notes[i].duration))
    }
  })
  it('é reproduzível com a mesma semente e muda com outra', () => {
    const strip = (ns: Note[]) => ns.map(({ pitch, start, duration }) => ({ pitch, start, duration }))
    expect(strip(gen({}, 5))).toEqual(strip(gen({}, 5)))
    expect(strip(gen({}, 5))).not.toEqual(strip(gen({}, 6)))
  })
  it('termina na nota de repouso pedida, numa nota longa', () => {
    for (const rest of [1, 3, 5]) {
      for (const seed of SEEDS) {
        const notes = gen({ rest }, seed)
        const last = notes[notes.length - 1]
        expect(degreeOf(last.pitch, dDorian)).toBe(rest)
        expect(last.duration).toBeGreaterThanOrEqual(900)
      }
    }
  })
  it('funciona em escalas de cinco e de doze notas', () => {
    const penta = getScale('C', 'minor pentatonic')
    const chromatic = getScale('C', 'chromatic')
    for (const seed of SEEDS) {
      const a = gen({ scale: penta, rest: 5 }, seed)
      expect(a.every((n) => isInScale(n.pitch, penta))).toBe(true)
      expect(degreeOf(a.at(-1)!.pitch, penta)).toBe(5)
      expect(gen({ scale: chromatic, rest: 1 }, seed).length).toBeGreaterThan(3)
    }
  })
  it('o contorno aparece na média de muitas sementes', () => {
    const thirds = (contour: Contour) => {
      const parts: number[][] = [[], [], []]
      for (const seed of SEEDS) {
        const notes = gen({ contour, bars: 4, density: 0.6 }, seed).slice(0, -1)
        notes.forEach((n) => parts[Math.min(2, Math.floor((n.start / (4 * 1920)) * 3))].push(n.pitch))
      }
      return parts.map(mean)
    }
    const rise = thirds('rise')
    expect(rise[2]).toBeGreaterThan(rise[0] + 3)
    const fall = thirds('fall')
    expect(fall[0]).toBeGreaterThan(fall[2] + 3)
    const arch = thirds('arch')
    expect(arch[1]).toBeGreaterThan(arch[0] + 1.5)
    expect(arch[1]).toBeGreaterThan(arch[2])
    const valley = thirds('valley')
    expect(valley[1]).toBeLessThan(valley[0] - 1.5)
  })
  it('mais densidade, mais notas', () => {
    const count = (density: number) => mean(SEEDS.map((seed) => gen({ density }, seed).length))
    expect(count(0.9)).toBeGreaterThan(count(0.5) + 3)
    expect(count(0.5)).toBeGreaterThan(count(0.1) + 2)
  })
  it('respeita o salto máximo entre vizinhas (fora a chegada no repouso)', () => {
    for (const leap of [1, 2, 4]) {
      for (const seed of SEEDS) {
        const steps = gen({ leap }, seed).map((n) => stepIndex(n.pitch, dDorian))
        steps.slice(1, -1).forEach((s, i) => expect(Math.abs(s - steps[i])).toBeLessThanOrEqual(leap))
      }
    }
  })
  it('respeita compasso e ponto de partida', () => {
    const notes = gen({ timeSignature: [3, 4], bars: 2, start: 2880 })
    expect(notes[0].start).toBe(2880)
    expect(Math.max(...notes.map((n) => n.start + n.duration))).toBeLessThanOrEqual(2880 + 2 * 1440)
  })
})

describe('generateVariation', () => {
  const cMajor = getScale('C', 'major')
  const motif: Note[] = [60, 62, 64, 62, 67, 65, 64, 60].map((pitch, i) => ({
    id: `m${i}`,
    pitch,
    start: 480 + i * 240,
    duration: i % 2 ? 120 : 240,
    velocity: 0.8,
  }))
  const intervalsOf = (notes: Note[]) => {
    const steps = notes.map((n) => stepIndex(n.pitch, cMajor))
    return steps.slice(1).map((s, i) => s - steps[i])
  }

  it('mantém o ritmo, começa onde pedido e ganha ids novos', () => {
    const out = generateVariation(motif, cMajor, 3840, seededRng(3))
    expect(out.map((n) => n.start - 3840)).toEqual(motif.map((n) => n.start - 480))
    expect(out.map((n) => n.duration)).toEqual(motif.map((n) => n.duration))
    expect(out.every((n) => !n.id.startsWith('m'))).toBe(true)
  })
  it('começa na mesma nota, fica na escala e é diferente do original', () => {
    for (const seed of SEEDS) {
      const out = generateVariation(motif, cMajor, 0, seededRng(seed))
      expect(out[0].pitch).toBe(60)
      expect(out.every((n) => isInScale(n.pitch, cMajor))).toBe(true)
      expect(out.map((n) => n.pitch)).not.toEqual(motif.map((n) => n.pitch))
    }
  })
  it('só usa intervalos que existem no motivo (ou nota repetida, quando não cabe)', () => {
    const vocabulary = new Set([...intervalsOf(motif), 0])
    for (const seed of SEEDS) {
      for (const interval of intervalsOf(generateVariation(motif, cMajor, 0, seededRng(seed)))) {
        expect(vocabulary.has(interval)).toBe(true)
      }
    }
  })
  it('não se afasta da região do motivo', () => {
    for (const seed of SEEDS) {
      const out = generateVariation(motif, cMajor, 0, seededRng(seed))
      expect(Math.min(...out.map((n) => n.pitch))).toBeGreaterThanOrEqual(60 - 6)
      expect(Math.max(...out.map((n) => n.pitch))).toBeLessThanOrEqual(67 + 6)
    }
  })
  it('motivo de uma nota só não gera nada', () => {
    expect(generateVariation(motif.slice(0, 1), cMajor, 0)).toEqual([])
  })
})
