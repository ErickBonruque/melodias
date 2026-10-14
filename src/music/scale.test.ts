import { describe, expect, it } from 'vitest'
import {
  KEYS,
  SCALES,
  degreeLabel,
  degreeOf,
  getScale,
  isInScale,
  pitchLabel,
  scaleLabel,
  scaleStepsBetween,
  shiftDiatonic,
  snapToScale,
} from './scale'

const cMajor = getScale('C', 'major')
const cDorian = getScale('C', 'dorian')

describe('getScale', () => {
  it('conhece todas as combinações de tonalidade e escala da interface', () => {
    for (const key of KEYS) {
      for (const { id } of SCALES) {
        const s = getScale(key, id)
        expect(s.chromas.length, `${key} ${id}`).toBeGreaterThanOrEqual(5)
        expect(s.degrees[s.tonic], `${key} ${id}`).toBe(1)
      }
    }
  })
  it('Dó maior são as teclas brancas', () => {
    expect(cMajor.chromas).toEqual([0, 2, 4, 5, 7, 9, 11])
  })
  it('Dó dórico tem Mi♭ e Si♭', () => {
    expect(cDorian.chromas).toEqual([0, 2, 3, 5, 7, 9, 10])
    expect(cDorian.names[3]).toBe('Eb')
    expect(cDorian.names[10]).toBe('Bb')
  })
  it('pentatônica usa o número do intervalo como grau', () => {
    const s = getScale('C', 'major pentatonic')
    expect(s.chromas).toEqual([0, 2, 4, 7, 9])
    expect(degreeOf(67, s)).toBe(5)
    expect(degreeOf(69, s)).toBe(6)
  })
})

describe('pertencer à escala', () => {
  it('reconhece notas dentro e fora', () => {
    expect(isInScale(60, cMajor)).toBe(true)
    expect(isInScale(61, cMajor)).toBe(false)
    expect(isInScale(63, cDorian)).toBe(true)
    expect(isInScale(64, cDorian)).toBe(false)
  })
  it('grau', () => {
    expect(degreeOf(60, cMajor)).toBe(1)
    expect(degreeOf(67, cMajor)).toBe(5)
    expect(degreeOf(72, cMajor)).toBe(1)
    expect(degreeOf(61, cMajor)).toBeNull()
  })
})

describe('snapToScale', () => {
  it('não mexe em nota que já está na escala', () => {
    expect(snapToScale(64, cMajor)).toBe(64)
  })
  it('no empate o padrão é descer', () => {
    expect(snapToScale(61, cMajor)).toBe(60)
    expect(snapToScale(61, cMajor, 1)).toBe(62)
  })
  it('vai para a mais próxima quando não há empate', () => {
    // em Dó pentatônica maior, Fá (65) fica a 1 de Mi e a 2 de Sol
    const penta = getScale('C', 'major pentatonic')
    expect(snapToScale(65, penta)).toBe(64)
    expect(snapToScale(66, penta)).toBe(67)
  })
  it('funciona em todas as oitavas e com tônica diferente de Dó', () => {
    const d = getScale('D', 'major')
    expect(snapToScale(24, d)).toBe(23) // Dó1 → Si0 (empate desce)
    expect(snapToScale(101, d)).toBe(100) // Fá7 → Mi7
  })
})

describe('movimento diatônico', () => {
  it('sobe e desce por graus', () => {
    expect(shiftDiatonic(60, 1, cMajor)).toBe(62)
    expect(shiftDiatonic(60, 2, cMajor)).toBe(64)
    expect(shiftDiatonic(64, 1, cMajor)).toBe(65)
    expect(shiftDiatonic(60, -1, cMajor)).toBe(59)
    expect(shiftDiatonic(60, 7, cMajor)).toBe(72)
    expect(shiftDiatonic(60, -7, cMajor)).toBe(48)
  })
  it('respeita a tônica', () => {
    const a = getScale('A', 'minor')
    expect(shiftDiatonic(69, 2, a)).toBe(72) // Lá → Dó
    expect(shiftDiatonic(69, -1, a)).toBe(67) // Lá → Sol
  })
  it('nota fora da escala mantém a distância da vizinha de baixo', () => {
    expect(shiftDiatonic(61, 1, cMajor)).toBe(63) // Dó♯ → Ré♯
  })
  it('ida e volta devolve a nota original', () => {
    for (let p = 40; p < 90; p++) {
      if (!isInScale(p, cDorian)) continue
      expect(shiftDiatonic(shiftDiatonic(p, 5, cDorian), -5, cDorian)).toBe(p)
    }
  })
  it('conta passos entre duas notas da escala', () => {
    expect(scaleStepsBetween(60, 67, cMajor)).toBe(4)
    expect(scaleStepsBetween(67, 60, cMajor)).toBe(-4)
    expect(scaleStepsBetween(60, 72, cMajor)).toBe(7)
  })
})

describe('nomes', () => {
  it('usa a grafia da escala', () => {
    expect(pitchLabel(60, cMajor)).toBe('Dó4')
    expect(pitchLabel(63, cDorian)).toBe('Mi♭4')
    expect(pitchLabel(66, getScale('D', 'major'))).toBe('Fá♯4')
  })
  it('fora da escala segue a armadura: bemóis em tom de bemol, sustenidos nos demais', () => {
    expect(pitchLabel(61, cMajor)).toBe('Dó♯4')
    expect(pitchLabel(61, getScale('F', 'major'))).toBe('Ré♭4')
  })
  it('Dó♭ pertence à oitava de cima', () => {
    const gb = getScale('Ab', 'minor') // Lá♭ menor tem Dó♭ e Fá♭
    expect(pitchLabel(59, gb)).toBe('Dó♭4')
  })
  it('rótulos em português', () => {
    expect(scaleLabel('C', 'dorian')).toBe('Dó dórico')
    expect(scaleLabel('F#', 'minor')).toBe('Fá♯ menor')
    expect(degreeLabel(60, cMajor)).toBe('tônica')
    expect(degreeLabel(64, cMajor)).toBe('3º grau')
    expect(degreeLabel(61, cMajor)).toBe('fora da escala')
  })
})
