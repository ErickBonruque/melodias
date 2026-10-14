import { create } from 'zustand'
import { db } from '../db/db'
import { createMelody, newId } from '../music/notes'
import type { Melody } from '../music/types'
import { useDoc } from './doc'

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'error'

type LibraryState = {
  items: Melody[]
  status: SaveStatus
  ready: boolean
}

export const useLibrary = create<LibraryState>()(() => ({ items: [], status: 'idle', ready: false }))

const LAST_KEY = 'melodias:last'
const SAVE_DELAY = 600
let timer: ReturnType<typeof setTimeout> | null = null

async function refresh(): Promise<void> {
  const items = await db.melodies.orderBy('updatedAt').reverse().toArray()
  useLibrary.setState({ items, ready: true })
}

function isStored(id: string): boolean {
  return useLibrary.getState().items.some((m) => m.id === id)
}

/** Uma melodia vazia e sem nome não vai para a biblioteca: evita entulho. */
function worthSaving(m: Melody): boolean {
  return m.notes.length > 0 || m.title.trim() !== '' || m.tags.length > 0 || isStored(m.id)
}

/** Grava a melodia atual agora, sem esperar o atraso do autosave. */
export async function flushSave(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  const { melody } = useDoc.getState()
  if (!worthSaving(melody)) return
  try {
    await db.melodies.put(melody)
    localStorage.setItem(LAST_KEY, melody.id)
    await refresh()
    useLibrary.setState({ status: 'saved' })
  } catch (err) {
    console.error('Falha ao salvar a melodia', err)
    useLibrary.setState({ status: 'error' })
  }
}

export async function openMelody(id: string): Promise<void> {
  if (id === useDoc.getState().melody.id) return
  await flushSave()
  const melody = await db.melodies.get(id)
  if (!melody) return
  useDoc.getState().load(melody)
  localStorage.setItem(LAST_KEY, id)
  useLibrary.setState({ status: 'saved' })
}

export async function newMelody(): Promise<void> {
  await flushSave()
  useDoc.getState().load(createMelody())
  useLibrary.setState({ status: 'idle' })
}

export async function duplicateMelody(id: string): Promise<void> {
  await flushSave()
  const source = await db.melodies.get(id)
  if (!source) return
  const now = Date.now()
  const copy: Melody = {
    ...source,
    id: newId(),
    title: source.title.trim() ? `${source.title} (cópia)` : '',
    notes: source.notes.map((n) => ({ ...n, id: newId() })),
    versions: undefined,
    createdAt: now,
    updatedAt: now,
  }
  await db.melodies.put(copy)
  await refresh()
  useDoc.getState().load(copy)
  localStorage.setItem(LAST_KEY, copy.id)
  useLibrary.setState({ status: 'saved' })
}

export async function renameMelody(id: string, title: string): Promise<void> {
  if (id === useDoc.getState().melody.id) {
    useDoc.getState().setMeta({ title })
    await flushSave()
    return
  }
  await db.melodies.update(id, { title, updatedAt: Date.now() })
  await refresh()
}

export async function deleteMelody(id: string): Promise<void> {
  const current = useDoc.getState().melody.id === id
  if (current && timer) {
    clearTimeout(timer)
    timer = null
  }
  await db.melodies.delete(id)
  await refresh()
  if (current) {
    const next = useLibrary.getState().items[0]
    useDoc.getState().load(next ?? createMelody())
    useLibrary.setState({ status: next ? 'saved' : 'idle' })
    if (next) localStorage.setItem(LAST_KEY, next.id)
    else localStorage.removeItem(LAST_KEY)
  }
}

/** Carrega a biblioteca, reabre a última melodia e liga o autosave. */
export async function initLibrary(): Promise<() => void> {
  try {
    await refresh()
    const last = localStorage.getItem(LAST_KEY)
    const melody = last ? await db.melodies.get(last) : undefined
    if (melody) {
      useDoc.getState().load(melody)
      useLibrary.setState({ status: 'saved' })
    }
  } catch (err) {
    console.error('Falha ao abrir a biblioteca', err)
    useLibrary.setState({ status: 'error', ready: true })
  }

  let seen = useDoc.getState().melody
  const unsub = useDoc.subscribe((s) => {
    const m = s.melody
    // só mudanças confirmadas contam: durante um arrasto o updatedAt não muda
    if (m === seen || (m.id === seen.id && m.updatedAt === seen.updatedAt)) return
    const switched = m.id !== seen.id
    seen = m
    if (switched || !worthSaving(m)) return
    useLibrary.setState({ status: 'pending' })
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flushSave(), SAVE_DELAY)
  })

  const onHide = () => {
    if (document.visibilityState === 'hidden') void flushSave()
  }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onHide)

  return () => {
    unsub()
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onHide)
  }
}
