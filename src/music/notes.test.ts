import { describe, expect, it } from 'vitest'
import type { Note } from './types'
import {
  MAX_PITCH,
  cloneNotesAt,
  createMelody,
  createNote,
  melodyEnd,
  moveNotes,
  noteAt,
  notesEnd,
  notesInRect,
  removeNotes,
  resizeNotes,
} from './notes'

const n = (id: string, pitch: number, start: number, duration = 240): Note => ({ id, pitch, start, duration, velocity: 0.8 })
const ids = (...list: string[]) => new Set(list)

describe('criar', () => {
  it('nota nova tem id, velocity padrão e valores válidos', () => {
    const a = createNote({ pitch: 60.4, start: -10, duration: 0 })
    expect(a.id).toBeTruthy()
    expect(a).toMatchObject({ pitch: 60, start: 0, duration: 1, velocity: 0.8 })
  })
  it('melodia nova começa vazia em Dó maior', () => {
    const m = createMelody()
    expect(m).toMatchObject({ key: 'C', scale: 'major', notes: [], timeSignature: [4, 4] })
  })
})

describe('fim da melodia', () => {
  it('notesEnd é o fim da última nota', () => {
    expect(notesEnd([n('a', 60, 0, 480), n('b', 62, 1000, 100)])).toBe(1100)
    expect(notesEnd([])).toBe(0)
  })
  it('melodyEnd arredonda para o compasso e nunca é zero', () => {
    expect(melodyEnd({ notes: [], timeSignature: [4, 4] })).toBe(1920)
    expect(melodyEnd({ notes: [n('a', 60, 1900, 100)], timeSignature: [4, 4] })).toBe(3840)
    expect(melodyEnd({ notes: [n('a', 60, 0, 1920)], timeSignature: [4, 4] })).toBe(1920)
  })
})

describe('moveNotes', () => {
  const notes = [n('a', 60, 240), n('b', 64, 480), n('c', 67, 960)]

  it('move só as selecionadas e preserva as outras por referência', () => {
    const out = moveNotes(notes, ids('a', 'b'), 120, (p) => p + 2)
    expect(out[0]).toMatchObject({ start: 360, pitch: 62 })
    expect(out[1]).toMatchObject({ start: 600, pitch: 66 })
    expect(out[2]).toBe(notes[2])
  })
  it('o grupo para junto no início da linha do tempo', () => {
    const out = moveNotes(notes, ids('a', 'b'), -1000)
    expect(out[0].start).toBe(0)
    expect(out[1].start).toBe(240) // distância entre as duas mantida
  })
  it('não deixa nenhuma nota sair do teclado', () => {
    const high = [n('a', MAX_PITCH - 1, 0), n('b', 60, 0)]
    const out = moveNotes(high, ids('a', 'b'), 0, (p) => p + 2)
    expect(out.map((x) => x.pitch)).toEqual([MAX_PITCH - 1, 60])
  })
  it('sem mudança devolve as mesmas referências', () => {
    const out = moveNotes(notes, ids('a'), 0)
    expect(out[0]).toBe(notes[0])
  })
})

describe('resizeNotes', () => {
  it('borda direita muda a duração', () => {
    expect(resizeNotes([n('a', 60, 0, 240)], ids('a'), 240, 'right')[0].duration).toBe(480)
  })
  it('respeita a duração mínima', () => {
    expect(resizeNotes([n('a', 60, 0, 240)], ids('a'), -1000, 'right', 60)[0].duration).toBe(60)
  })
  it('borda esquerda move o início e mantém o fim', () => {
    const out = resizeNotes([n('a', 60, 480, 480)], ids('a'), -240, 'left')[0]
    expect(out).toMatchObject({ start: 240, duration: 720 })
    expect(out.start + out.duration).toBe(960)
  })
  it('borda esquerda não passa do início nem do fim da nota', () => {
    expect(resizeNotes([n('a', 60, 100, 480)], ids('a'), -500, 'left')[0].start).toBe(0)
    const squeezed = resizeNotes([n('a', 60, 0, 480)], ids('a'), 5000, 'left', 60)[0]
    expect(squeezed).toMatchObject({ start: 420, duration: 60 })
  })
})

describe('remover e clonar', () => {
  it('remove pelas ids', () => {
    expect(removeNotes([n('a', 60, 0), n('b', 62, 0)], ids('a')).map((x) => x.id)).toEqual(['b'])
  })
  it('clone tem ids novos e começa no tick pedido, mantendo o desenho', () => {
    const src = [n('a', 60, 480), n('b', 64, 720)]
    const out = cloneNotesAt(src, 1920)
    expect(out.map((x) => x.start)).toEqual([1920, 2160])
    expect(out.map((x) => x.pitch)).toEqual([60, 64])
    expect(out[0].id).not.toBe('a')
    expect(new Set(out.map((x) => x.id)).size).toBe(2)
  })
})

describe('achar notas', () => {
  const notes = [n('a', 60, 0, 480), n('b', 64, 480, 480), n('c', 67, 960, 480)]

  it('retângulo pega o que toca nele, em qualquer direção de arrasto', () => {
    expect(notesInRect(notes, 100, 500, 59, 65)).toEqual(['a', 'b'])
    expect(notesInRect(notes, 500, 100, 65, 59)).toEqual(['a', 'b'])
  })
  it('encostar na borda no tempo não conta', () => {
    expect(notesInRect(notes, 480, 960, 60, 60)).toEqual([])
  })
  it('noteAt acha a nota sob o ponto', () => {
    expect(noteAt(notes, 500, 64)?.id).toBe('b')
    expect(noteAt(notes, 479, 64)).toBeUndefined()
    expect(noteAt(notes, 480, 60)).toBeUndefined() // fim é exclusivo
  })
  it('na sobreposição vale a mais recente', () => {
    expect(noteAt([n('a', 60, 0, 480), n('z', 60, 0, 480)], 10, 60)?.id).toBe('z')
  })
})
