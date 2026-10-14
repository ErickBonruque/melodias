import { Scale } from 'tonal'
import { chromaOf, getScale } from './scale'
import { ticksPerBar, ticksPerBeat } from './time'
import type { Melody } from './types'

/** Menor figura da partitura: semicolcheia. Tercinas saem aproximadas para ela. */
const UNIT = 120
/** Durações que existem como uma figura só (em semicolcheias), da maior para a menor. */
const FIGURES = [16, 12, 8, 6, 4, 3, 2, 1]

/** De que modo vem a armadura de cada escala, e como o ABC chama esse modo. */
const SIGNATURE: Record<string, [mode: string, abc: string]> = {
  major: ['major', ''],
  minor: ['minor', 'm'],
  dorian: ['dorian', 'dor'],
  phrygian: ['phrygian', 'phr'],
  lydian: ['lydian', 'lyd'],
  mixolydian: ['mixolydian', 'mix'],
  locrian: ['locrian', 'loc'],
  'harmonic minor': ['minor', 'm'],
  'melodic minor': ['minor', 'm'],
  'major pentatonic': ['major', ''],
  'minor pentatonic': ['minor', 'm'],
  blues: ['minor', 'm'],
  chromatic: ['major', ''],
}

export type AbcResult = {
  abc: string
  /** Trecho de tempo (em ticks) de cada nota ou pausa escrita, na ordem em que aparecem. */
  tokens: { start: number; end: number; rest: boolean }[]
}

type Spelled = { letter: string; alter: number; octave: number }

function spell(pitch: number, names: string[]): Spelled {
  const name = names[chromaOf(pitch)]
  const letter = name[0]
  const acc = name.slice(1)
  const alter = acc.includes('#') ? acc.length : -acc.length
  let octave = Math.floor(pitch / 12) - 1
  if (letter === 'C' && alter < 0) octave += 1
  if (letter === 'B' && alter > 0) octave -= 1
  return { letter, alter, octave }
}

function abcPitch({ letter, octave }: Spelled): string {
  if (octave >= 5) return letter.toLowerCase() + "'".repeat(octave - 5)
  return letter + ','.repeat(4 - octave)
}

const ACCIDENTAL: Record<number, string> = { [-2]: '__', [-1]: '_', 0: '=', 1: '^', 2: '^^' }

/**
 * Escreve a melodia em notação ABC, para o abcjs desenhar a partitura.
 * Notas que começam juntas viram acorde; uma nota que invade a seguinte é cortada
 * ali; notas que cruzam a barra de compasso ganham ligadura.
 */
export function melodyToAbc(m: Pick<Melody, 'title' | 'notes' | 'key' | 'scale' | 'bpm' | 'timeSignature'>): AbcResult {
  const scale = getScale(m.key, m.scale)
  const [sigMode, abcMode] = SIGNATURE[m.scale] ?? SIGNATURE.major
  const signature = new Map<string, number>()
  for (const name of Scale.get(`${m.key} ${sigMode}`).notes) {
    const acc = name.slice(1)
    signature.set(name[0], acc.includes('#') ? acc.length : -acc.length)
  }

  const barU = ticksPerBar(m.timeSignature) / UNIT
  const beatU = ticksPerBeat(m.timeSignature) / UNIT
  // em compasso composto (6/8, 12/8) as colcheias se agrupam de três em três
  const groupU = m.timeSignature[1] === 8 && m.timeSignature[0] % 3 === 0 ? beatU * 3 : beatU

  // 1. arredonda para semicolcheias e junta o que começa junto
  const groups = new Map<number, { end: number; pitches: Set<number> }>()
  for (const n of m.notes) {
    const start = Math.round(n.start / UNIT)
    const end = Math.max(start + 1, Math.round((n.start + n.duration) / UNIT))
    const g = groups.get(start) ?? { end, pitches: new Set<number>() }
    g.end = Math.max(g.end, end)
    g.pitches.add(n.pitch)
    groups.set(start, g)
  }
  const starts = [...groups.keys()].sort((a, b) => a - b)

  // 2. linha do tempo de notas e pausas, sem sobreposição
  const segments: { start: number; end: number; pitches: number[] }[] = []
  let cursor = 0
  starts.forEach((start, i) => {
    const g = groups.get(start)!
    const end = Math.min(g.end, starts[i + 1] ?? Infinity)
    if (start > cursor) segments.push({ start: cursor, end: start, pitches: [] })
    segments.push({ start, end, pitches: [...g.pitches].sort((a, b) => a - b) })
    cursor = end
  })
  const total = Math.max(1, Math.ceil(cursor / barU)) * barU
  if (cursor < total) segments.push({ start: cursor, end: total, pitches: [] })

  // 3. escreve, quebrando cada trecho em figuras que existem e respeitando compasso e tempo
  let body = ''
  const tokens: AbcResult['tokens'] = []
  let accidentals = new Map<string, number>()

  for (const seg of segments) {
    let pos = seg.start
    while (pos < seg.end) {
      if (pos > 0 && pos % barU === 0) {
        body += ' | '
        accidentals = new Map()
      } else if (pos > 0 && pos % groupU === 0) {
        body += ' '
      }
      const barEnd = (Math.floor(pos / barU) + 1) * barU
      let limit = Math.min(seg.end, barEnd)
      // fora do tempo, a figura vai no máximo até o próximo tempo: fica mais fácil de ler
      if (pos % groupU !== 0) limit = Math.min(limit, (Math.floor(pos / groupU) + 1) * groupU)
      const length = FIGURES.find((f) => f <= limit - pos) ?? 1
      const tied = seg.pitches.length > 0 && pos + length < seg.end

      let text: string
      if (seg.pitches.length === 0) {
        text = 'z'
      } else {
        const written = seg.pitches.map((pitch) => {
          const s = spell(pitch, scale.names)
          const slot = s.letter + s.octave
          const current = accidentals.get(slot) ?? signature.get(s.letter) ?? 0
          if (current === s.alter) return abcPitch(s)
          accidentals.set(slot, s.alter)
          return ACCIDENTAL[s.alter] + abcPitch(s)
        })
        text = written.length > 1 ? `[${written.join('')}]` : written[0]
      }
      body += text + (length === 1 ? '' : length) + (tied ? '-' : '')
      tokens.push({ start: pos * UNIT, end: (pos + length) * UNIT, rest: seg.pitches.length === 0 })
      pos += length
    }
  }
  body += ' |]'

  const pitches = m.notes.map((n) => n.pitch).sort((a, b) => a - b)
  const median = pitches.length > 0 ? pitches[Math.floor(pitches.length / 2)] : 67
  const header = [
    'X:1',
    m.title.trim() ? `T:${m.title.trim()}` : null,
    `M:${m.timeSignature[0]}/${m.timeSignature[1]}`,
    'L:1/16',
    `Q:1/4=${m.bpm}`,
    `K:${m.key}${abcMode}${median < 55 ? ' clef=bass' : ''}`,
  ].filter(Boolean)

  return { abc: `${header.join('\n')}\n${body}\n`, tokens }
}
