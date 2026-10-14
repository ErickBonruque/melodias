import { generateMelody, generateVariation } from '../music/generate'
import { notesEnd, removeNotes } from '../music/notes'
import { getScale } from '../music/scale'
import { snapTick, ticksPerBar } from '../music/time'
import type { Note } from '../music/types'
import { useDoc } from './doc'
import { useTransport } from './transport'
import { useView } from './view'

/** O último lote gerado. Gerar de novo com ele ainda selecionado troca o lote, em vez de empilhar outro. */
let last: { kind: 'idea' | 'variation'; ids: string[]; start: number; source: Note[] } | null = null

function sameSelection(ids: string[]): boolean {
  const { selection, melody } = useDoc.getState()
  if (ids.length === 0 || selection.length !== ids.length) return false
  const selected = new Set(selection)
  const alive = new Set(melody.notes.map((n) => n.id))
  return ids.every((id) => selected.has(id) && alive.has(id))
}

function place(batch: Note[], replace: string[], start: number, kind: 'idea' | 'variation', source: Note[]): void {
  const d = useDoc.getState()
  const kept = replace.length > 0 ? removeNotes(d.melody.notes, new Set(replace)) : d.melody.notes
  d.edit({ notes: [...kept, ...batch] }, { selection: batch.map((n) => n.id) })
  last = { kind, ids: batch.map((n) => n.id), start, source }
  useTransport.getState().set({ reveal: { start, end: notesEnd(batch) } })

  if (useView.getState().idea.autoPlay) {
    const t = useTransport.getState()
    if (t.playing) t.set({ cursor: start })
    else t.set({ cursor: start, playing: true })
  }
}

/** Gera uma melodia com os controles do gerador: na melodia vazia começa do zero, senão no compasso do cursor. */
export function generateIdea(): void {
  const { melody } = useDoc.getState()
  const { idea } = useView.getState()
  const bar = ticksPerBar(melody.timeSignature)

  // "gerar outra": o lote anterior ainda está selecionado, então a nova ideia entra no lugar dele
  const again = last?.kind === 'idea' && sameSelection(last.ids)
  const replace = again ? last!.ids : []
  const cursor = useTransport.getState().playing ? 0 : useTransport.getState().cursor
  const start = again ? last!.start : melody.notes.length === 0 ? 0 : snapTick(cursor, bar, 'floor')

  const others = again ? removeNotes(melody.notes, new Set(replace)) : melody.notes
  // centro: a região onde a melodia já mora, ou em volta do Sol4 se ela está vazia
  const center = others.length > 0 ? Math.round(others.reduce((sum, n) => sum + n.pitch, 0) / others.length) : 67

  const batch = generateMelody({
    scale: getScale(melody.key, melody.scale),
    timeSignature: melody.timeSignature,
    bars: idea.bars,
    contour: idea.contour,
    density: idea.density,
    leap: idea.leap,
    rest: idea.rest,
    center,
    start,
  })
  place(batch, replace, start, 'idea', [])
}

/** As notas do motivo: a seleção ou, se a seleção é a última variação gerada, o motivo que deu origem a ela. */
export function variationSource(): Note[] {
  const { selection, melody } = useDoc.getState()
  if (last?.kind === 'variation' && sameSelection(last.ids)) return last.source
  const ids = new Set(selection)
  return melody.notes.filter((n) => ids.has(n.id))
}

/** Cria uma variação do motivo selecionado, logo depois dele. */
export function generateMotifVariation(): boolean {
  const { melody } = useDoc.getState()
  const again = last?.kind === 'variation' && sameSelection(last.ids)
  const source = variationSource()
  if (source.length < 3) return false

  const bar = ticksPerBar(melody.timeSignature)
  const origin = Math.min(...source.map((n) => n.start))
  const span = Math.max(bar, Math.ceil((notesEnd(source) - origin) / bar) * bar)
  const start = again ? last!.start : origin + span

  const batch = generateVariation(source, getScale(melody.key, melody.scale), start)
  if (batch.length === 0) return false
  place(batch, again ? last!.ids : [], start, 'variation', source)
  return true
}
