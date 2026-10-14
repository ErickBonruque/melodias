import { create } from 'zustand'
import { createMelody } from '../music/notes'
import type { Melody, Note } from '../music/types'

/** A parte da melodia que entra no desfazer/refazer. */
export type Content = Pick<Melody, 'notes' | 'key' | 'scale' | 'bpm' | 'timeSignature'>
type Snapshot = Content & { selection: string[] }
type Meta = Pick<Melody, 'title' | 'tags' | 'instrument'>

const HISTORY_LIMIT = 300
const COALESCE_MS = 700

type DocState = {
  melody: Melody
  selection: string[]
  past: Snapshot[]
  future: Snapshot[]
  /** Estado de antes de um gesto de arrasto em andamento. */
  gestureBase: Snapshot | null
  clipboard: Note[]
  coalesce: { key: string; at: number } | null

  load: (melody: Melody) => void
  /** Título, tags e instrumento: salvam, mas ficam fora do desfazer. */
  setMeta: (patch: Partial<Meta>) => void
  /**
   * Edição que entra no histórico. Edições seguidas com a mesma chave `coalesce`
   * (arrastar o andamento, por exemplo) viram um único passo de desfazer.
   */
  edit: (patch: Partial<Content>, opts?: { selection?: string[]; coalesce?: string }) => void
  select: (ids: string[]) => void
  beginGesture: () => void
  /** Atualiza as notas durante um arrasto, sem criar passo de histórico. */
  live: (notes: Note[], selection?: string[]) => void
  commitGesture: () => void
  cancelGesture: () => void
  undo: () => void
  redo: () => void
  setClipboard: (notes: Note[]) => void
}

/** Carimbo de alteração. Sempre avança, mesmo com duas mudanças no mesmo milissegundo: o autosave depende disso. */
function touch(previous: number): number {
  return Math.max(Date.now(), previous + 1)
}

function snapshot(s: Pick<DocState, 'melody' | 'selection'>): Snapshot {
  const { notes, key, scale, bpm, timeSignature } = s.melody
  return { notes, key, scale, bpm, timeSignature, selection: s.selection }
}

function restore(melody: Melody, snap: Snapshot): Melody {
  const { selection: _selection, ...content } = snap
  return { ...melody, ...content, updatedAt: touch(melody.updatedAt) }
}

function pushPast(past: Snapshot[], snap: Snapshot): Snapshot[] {
  const next = [...past, snap]
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
}

export const useDoc = create<DocState>()((set, get) => ({
  melody: createMelody(),
  selection: [],
  past: [],
  future: [],
  gestureBase: null,
  clipboard: [],
  coalesce: null,

  load: (melody) => set({ melody, selection: [], past: [], future: [], gestureBase: null, coalesce: null }),

  setMeta: (patch) => set((s) => ({ melody: { ...s.melody, ...patch, updatedAt: touch(s.melody.updatedAt) } })),

  edit: (patch, opts = {}) =>
    set((s) => {
      const now = Date.now()
      const merge =
        opts.coalesce != null && s.coalesce?.key === opts.coalesce && now - s.coalesce.at < COALESCE_MS
      const selection = opts.selection ?? s.selection
      const alive = patch.notes ? new Set(patch.notes.map((n) => n.id)) : null
      return {
        melody: { ...s.melody, ...patch, updatedAt: touch(s.melody.updatedAt) },
        selection: alive ? selection.filter((id) => alive.has(id)) : selection,
        past: merge ? s.past : pushPast(s.past, snapshot(s)),
        future: [],
        coalesce: opts.coalesce != null ? { key: opts.coalesce, at: now } : null,
      }
    }),

  select: (ids) => set({ selection: ids }),

  beginGesture: () => set((s) => ({ gestureBase: snapshot(s), coalesce: null })),

  live: (notes, selection) =>
    set((s) => ({
      melody: { ...s.melody, notes },
      selection: selection ?? s.selection,
    })),

  commitGesture: () =>
    set((s) => {
      const base = s.gestureBase
      if (!base) return {}
      if (base.notes === s.melody.notes) return { gestureBase: null }
      return {
        gestureBase: null,
        melody: { ...s.melody, updatedAt: touch(s.melody.updatedAt) },
        past: pushPast(s.past, base),
        future: [],
      }
    }),

  cancelGesture: () =>
    set((s) => {
      const base = s.gestureBase
      if (!base) return {}
      return { gestureBase: null, melody: { ...s.melody, notes: base.notes }, selection: base.selection }
    }),

  undo: () => {
    const s = get()
    if (s.gestureBase || s.past.length === 0) return
    const prev = s.past[s.past.length - 1]
    set({
      melody: restore(s.melody, prev),
      selection: prev.selection,
      past: s.past.slice(0, -1),
      future: [snapshot(s), ...s.future],
      coalesce: null,
    })
  },

  redo: () => {
    const s = get()
    if (s.gestureBase || s.future.length === 0) return
    const next = s.future[0]
    set({
      melody: restore(s.melody, next),
      selection: next.selection,
      past: pushPast(s.past, snapshot(s)),
      future: s.future.slice(1),
      coalesce: null,
    })
  },

  setClipboard: (notes) => set({ clipboard: notes }),
}))
