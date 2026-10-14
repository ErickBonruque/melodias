import { engine } from '../audio/engine'
import { cloneNotesAt, moveNotes, notesEnd, removeNotes, resizeNotes } from '../music/notes'
import { getScale, shiftDiatonic, snapToScale, type ScaleInfo } from '../music/scale'
import { GRID_TICKS, snapTick, ticksPerBar } from '../music/time'
import type { Note } from '../music/types'
import { useDoc } from './doc'
import { useTransport } from './transport'
import { ZOOM_X, ZOOM_Y, useView } from './view'

/** Posição atual da reprodução em ticks (ou o cursor, quando parado). */
export function getPlayhead(): number {
  const t = useTransport.getState()
  return t.playing && engine.isStarted ? engine.position() : t.cursor
}

// ---------------------------------------------------------------- transport

export function togglePlay(): void {
  const t = useTransport.getState()
  if (t.playing) t.set({ playing: false, cursor: Math.round(getPlayhead()) })
  else t.set({ playing: true })
}

/** Tocando: para e volta para onde começou. Parado: volta para o início. */
export function stop(): void {
  const t = useTransport.getState()
  if (t.playing) t.set({ playing: false })
  else t.set({ cursor: 0 })
}

export function seek(tick: number): void {
  useTransport.getState().set({ cursor: Math.max(0, Math.round(tick)) })
}

export function toggleLoop(): void {
  const t = useTransport.getState()
  const { melody } = useDoc.getState()
  if (!t.loop.on && t.loop.end <= t.loop.start) {
    // primeira vez: o loop abraça a melodia inteira (ou dois compassos, se ela estiver vazia)
    const bar = ticksPerBar(melody.timeSignature)
    const end = Math.max(bar * 2, Math.ceil(notesEnd(melody.notes) / bar) * bar)
    t.set({ loop: { on: true, start: 0, end } })
  } else {
    t.set({ loop: { ...t.loop, on: !t.loop.on } })
  }
}

export function toggleMetronome(): void {
  const t = useTransport.getState()
  t.set({ metronome: !t.metronome })
}

// ---------------------------------------------------------------- seleção

function selectedNotes() {
  const d = useDoc.getState()
  const ids = new Set(d.selection)
  return { d, ids, picked: d.melody.notes.filter((n) => ids.has(n.id)) }
}

export function selectAll(): void {
  const d = useDoc.getState()
  d.select(d.melody.notes.map((n) => n.id))
}

export function clearSelection(): void {
  useDoc.getState().select([])
}

export function deleteSelection(): void {
  const { d, ids } = selectedNotes()
  if (ids.size === 0) return
  d.edit({ notes: removeNotes(d.melody.notes, ids) }, { selection: [] })
}

export function copySelection(): boolean {
  const { d, picked } = selectedNotes()
  if (picked.length === 0) return false
  d.setClipboard(picked)
  return true
}

export function cutSelection(): void {
  if (copySelection()) deleteSelection()
}

function gridStep(): number {
  return GRID_TICKS[useView.getState().grid]
}

/** Cola no cursor e avança o cursor para o fim do trecho, para colar em sequência. */
export function paste(): void {
  const d = useDoc.getState()
  if (d.clipboard.length === 0) return
  const at = snapTick(getPlayhead(), gridStep())
  const clones = cloneNotesAt(d.clipboard, at)
  d.edit({ notes: [...d.melody.notes, ...clones] }, { selection: clones.map((n) => n.id) })
  const t = useTransport.getState()
  if (!t.playing) t.set({ cursor: snapTick(notesEnd(clones), gridStep(), 'ceil') })
}

/** Repete a seleção logo depois dela mesma. */
export function duplicateSelection(): void {
  const { d, picked } = selectedNotes()
  if (picked.length === 0) return
  const start = Math.min(...picked.map((n) => n.start))
  const span = snapTick(notesEnd(picked) - start, gridStep(), 'ceil')
  const clones = cloneNotesAt(picked, start + span)
  d.edit({ notes: [...d.melody.notes, ...clones] }, { selection: clones.map((n) => n.id) })
}

/** Empurra a seleção: `dx` em passos da grade, `dy` em graus da escala (ou semitons, sem snap). */
export function nudgeSelection(dx: number, dy: number, octave = false): void {
  const { d, ids, picked } = selectedNotes()
  if (picked.length === 0) return
  const v = useView.getState()
  const scale = getScale(d.melody.key, d.melody.scale)
  const mapPitch = (p: number) => {
    if (dy === 0) return p
    if (octave) return p + 12 * dy
    return v.snapScale ? shiftDiatonic(snapToScale(p, scale, dy > 0 ? 1 : -1), dy, scale) : p + dy
  }
  const notes = moveNotes(d.melody.notes, ids, dx * gridStep(), mapPitch)
  if (notes === d.melody.notes || notes.every((n, i) => n === d.melody.notes[i])) return
  d.edit({ notes }, { coalesce: 'nudge' })
  if (dy !== 0) {
    const first = notes.find((n) => ids.has(n.id))
    if (first) engine.preview(first.pitch, first.velocity)
  }
}

export function resizeSelection(dir: number): void {
  const { d, ids } = selectedNotes()
  if (ids.size === 0) return
  const step = gridStep()
  const notes = resizeNotes(d.melody.notes, ids, dir * step, 'right', step)
  d.edit({ notes }, { coalesce: 'resize' })
  const first = notes.find((n) => ids.has(n.id))
  if (first) useView.getState().set({ lastDuration: first.duration })
}

export function setSelectionVelocity(velocity: number): void {
  const { d, ids } = selectedNotes()
  if (ids.size === 0) return
  const v = Math.min(1, Math.max(0.05, velocity))
  d.edit({ notes: d.melody.notes.map((n) => (ids.has(n.id) ? { ...n, velocity: v } : n)) }, { coalesce: 'velocity' })
}

/**
 * Aplica uma transformação às notas selecionadas ou, sem seleção, à melodia inteira.
 * A função recebe a escala atual só quando "grudar na escala" está ligado.
 */
export function applyTransform(fn: (notes: Note[], scale: ScaleInfo | null) => Note[], coalesce?: string): void {
  const d = useDoc.getState()
  const ids = new Set(d.selection)
  const target = ids.size > 0 ? d.melody.notes.filter((n) => ids.has(n.id)) : d.melody.notes
  if (target.length === 0) return
  const scale = useView.getState().snapScale ? getScale(d.melody.key, d.melody.scale) : null
  const out = fn(target, scale)
  if (out === target) return
  const byId = new Map(out.map((n) => [n.id, n]))
  d.edit({ notes: d.melody.notes.map((n) => byId.get(n.id) ?? n) }, { coalesce })
}

// ---------------------------------------------------------------- visão

export function zoomX(factor: number): void {
  const v = useView.getState()
  v.set({ pxPerBeat: Math.min(ZOOM_X.max, Math.max(ZOOM_X.min, v.pxPerBeat * factor)) })
}

export function zoomY(factor: number): void {
  const v = useView.getState()
  v.set({ rowH: Math.min(ZOOM_Y.max, Math.max(ZOOM_Y.min, Math.round(v.rowH * factor))) })
}
