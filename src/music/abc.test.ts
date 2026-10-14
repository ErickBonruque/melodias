import { describe, expect, it } from 'vitest'
import { melodyToAbc } from './abc'
import type { Melody, Note } from './types'

type Spec = [pitch: number, startBeats: number, beats: number]
const tune = (specs: Spec[], over: Partial<Melody> = {}) => {
  const notes: Note[] = specs.map(([pitch, s, d], i) => ({
    id: `n${i}`,
    pitch,
    start: Math.round(s * 480),
    duration: Math.round(d * 480),
    velocity: 0.8,
  }))
  return melodyToAbc({ title: '', notes, key: 'C', scale: 'major', bpm: 96, timeSignature: [4, 4], ...over })
}
const body = (r: { abc: string }) => r.abc.trim().split('\n').at(-1)!

describe('cabeçalho', () => {
  it('compasso, unidade, andamento e tonalidade', () => {
    const { abc } = tune([[60, 0, 1]], { title: 'Valsa', key: 'D', scale: 'dorian', bpm: 132, timeSignature: [3, 4] })
    expect(abc).toContain('T:Valsa\n')
    expect(abc).toContain('M:3/4\n')
    expect(abc).toContain('L:1/16\n')
    expect(abc).toContain('Q:1/4=132\n')
    expect(abc).toContain('K:Ddor\n')
  })
  it('sem título não escreve a linha T', () => {
    expect(tune([[60, 0, 1]]).abc).not.toContain('T:')
  })
  it('modos e escalas sem armadura própria usam a da tonalidade mãe', () => {
    expect(tune([[57, 0, 1]], { key: 'A', scale: 'minor' }).abc).toContain('K:Am')
    expect(tune([[57, 0, 1]], { key: 'A', scale: 'harmonic minor' }).abc).toContain('K:Am')
    expect(tune([[67, 0, 1]], { key: 'G', scale: 'mixolydian' }).abc).toContain('K:Gmix')
    expect(tune([[60, 0, 1]], { key: 'C', scale: 'major pentatonic' }).abc).toContain('K:C\n')
  })
  it('melodia grave vai para a clave de fá', () => {
    expect(tune([[40, 0, 1], [43, 1, 1]]).abc).toContain('clef=bass')
    expect(tune([[60, 0, 1]]).abc).not.toContain('clef=bass')
  })
})

describe('notas e durações', () => {
  it('escala de Dó em semínimas: oitavas e barra de compasso', () => {
    const r = tune([60, 62, 64, 65, 67, 69, 71, 72].map((p, i) => [p, i, 1] as Spec))
    expect(body(r)).toBe('C4 D4 E4 F4 | G4 A4 B4 c4 |]')
    expect(r.tokens).toHaveLength(8)
    expect(r.tokens[4]).toEqual({ start: 1920, end: 2400, rest: false })
  })
  it('colcheias e semicolcheias se agrupam por tempo', () => {
    const r = tune([[60, 0, 0.5], [62, 0.5, 0.5], [64, 1, 0.25], [65, 1.25, 0.25], [67, 1.5, 0.5], [72, 2, 2]])
    expect(body(r)).toBe('C2D2 EFG2 c8 |]')
  })
  it('oitavas abaixo e acima', () => {
    expect(body(tune([[48, 0, 1], [36, 1, 1], [84, 2, 1], [96, 3, 1]]))).toBe("C,4 C,,4 c'4 c''4 |]")
  })
  it('pausas no começo, no meio e completando o compasso', () => {
    expect(body(tune([[60, 1, 1], [64, 3, 0.5]]))).toBe('z4 C4 z4 E2z2 |]')
  })
  it('nota pontuada', () => {
    expect(body(tune([[60, 0, 1.5], [62, 1.5, 0.5], [64, 2, 2]]))).toBe('C6D2 E8 |]')
  })
  it('nota que cruza a barra ganha ligadura', () => {
    const r = tune([[60, 3, 2], [62, 5, 3]])
    expect(body(r)).toBe('z12 C4- | C4 D12 |]')
    expect(r.tokens.map((t) => t.rest)).toEqual([true, false, false, false])
  })
  it('duração que não é uma figura só é partida com ligadura', () => {
    // 5 semicolcheias a partir do tempo: semínima ligada a semicolcheia
    expect(body(tune([[60, 0, 1.25], [62, 2, 2]]))).toBe('C4- Cz3 D8 |]')
  })
  it('fora do tempo, a figura vai só até o próximo tempo', () => {
    // sincopa: colcheia, semínima começando no contratempo, colcheia
    expect(body(tune([[60, 0, 0.5], [64, 0.5, 1], [67, 1.5, 0.5], [72, 2, 2]]))).toBe('C2E2- E2G2 c8 |]')
  })
})

describe('acordes e sobreposição', () => {
  it('notas que começam juntas viram acorde, do grave para o agudo', () => {
    expect(body(tune([[67, 0, 2], [60, 0, 2], [64, 0, 2], [72, 2, 2]]))).toBe('[CEG]8 c8 |]')
  })
  it('nota que invade a seguinte é cortada onde a outra começa', () => {
    expect(body(tune([[60, 0, 3], [64, 1, 3]]))).toBe('C4 E12 |]')
  })
})

describe('acidentes', () => {
  it('nota da armadura não repete o acidente', () => {
    expect(body(tune([[62, 0, 1], [66, 1, 1], [69, 2, 1], [73, 3, 1]], { key: 'D', scale: 'major' }))).toBe('D4 F4 A4 c4 |]')
  })
  it('nota fora da armadura leva acidente, que vale até o fim do compasso', () => {
    // Dó maior: Fá♯, Fá♯ de novo (sem repetir), Fá natural (bequadro), e no compasso seguinte Fá♯ outra vez
    const r = tune([[66, 0, 1], [66, 1, 1], [65, 2, 1], [67, 3, 1], [66, 4, 4]])
    expect(body(r)).toBe('^F4 F4 =F4 G4 | ^F16 |]')
  })
  it('bemóis em tom de bemol', () => {
    // Fá maior tem Si♭ na armadura; Mi♭ é acidente
    expect(body(tune([[70, 0, 1], [75, 1, 1], [77, 2, 2]], { key: 'F', scale: 'major' }))).toBe('B4 _e4 f8 |]')
  })
  it('sensível da menor harmônica aparece como acidente', () => {
    expect(body(tune([[69, 0, 1], [68, 1, 1], [69, 2, 2]], { key: 'A', scale: 'harmonic minor' }))).toBe('A4 ^G4 A8 |]')
  })
  it('acidente vale só para aquela oitava', () => {
    expect(body(tune([[66, 0, 1], [78, 1, 1], [67, 2, 2]]))).toBe("^F4 ^f4 G8 |]")
  })
})

describe('outros compassos', () => {
  it('3/4', () => {
    expect(body(tune([[62, 0, 1], [65, 1, 1], [69, 2, 1], [71, 3, 3]], { timeSignature: [3, 4] }))).toBe('D4 F4 A4 | B12 |]')
  })
  it('6/8 agrupa de três em três colcheias', () => {
    const r = tune([[60, 0, 0.5], [62, 0.5, 0.5], [64, 1, 0.5], [65, 1.5, 1.5]], { timeSignature: [6, 8] })
    expect(body(r)).toBe('C2D2E2 F6 |]')
  })
  it('melodia vazia é um compasso de pausa', () => {
    expect(body(tune([]))).toBe('z16 |]')
  })
})
