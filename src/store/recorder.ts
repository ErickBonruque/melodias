import { engine } from '../audio/engine'
import { createNote } from '../music/notes'
import { GRID_TICKS, quantizeNotes } from '../music/time'
import type { Note } from '../music/types'
import { useDoc } from './doc'
import { useTransport } from './transport'
import { useView } from './view'

const MIN_DURATION = 30
/** Nota tocada um pouco antes do fim da contagem conta como tocada no primeiro tempo. */
const EARLY_BEATS = 0.3

/**
 * Grava o que é tocado ao vivo (teclado do computador, teclado lateral, MIDI, voz)
 * enquanto o transport está em modo de gravação. A tomada inteira vira um único
 * passo de desfazer.
 */
export function bindRecorder(): () => void {
  let active = false
  let take: string[] = []
  const held = new Map<number, string>()
  let timer: ReturnType<typeof setInterval> | null = null

  const notes = () => useDoc.getState().melody.notes

  /** Fim de uma nota que começou em `start`, levando em conta a volta do loop. */
  const durationSince = (start: number): number => {
    const now = Math.round(engine.position())
    if (now >= start) return Math.max(MIN_DURATION, now - start)
    const { loop } = useTransport.getState()
    return Math.max(MIN_DURATION, (loop.on ? loop.end : start + MIN_DURATION) - start)
  }

  const setDuration = (id: string, duration: number) => {
    useDoc.getState().live(notes().map((n) => (n.id === id ? { ...n, duration } : n)))
  }

  const begin = () => {
    active = true
    take = []
    held.clear()
    useDoc.getState().beginGesture()
    // as notas seguradas crescem na tela enquanto soam
    timer = setInterval(() => {
      if (held.size === 0 || engine.countInBeatsLeft() > 0) return
      const growing = new Set(held.values())
      useDoc.getState().live(notes().map((n) => (growing.has(n.id) ? { ...n, duration: durationSince(n.start) } : n)))
    }, 50)
  }

  const finish = () => {
    active = false
    if (timer) clearInterval(timer)
    timer = null
    for (const id of held.values()) {
      const note = notes().find((n) => n.id === id)
      if (note) setDuration(id, durationSince(note.start))
    }
    held.clear()

    const doc = useDoc.getState()
    const view = useView.getState()
    if (take.length > 0) {
      let result: Note[] = notes()
      if (view.recQuantize) {
        result = quantizeNotes(result, GRID_TICKS[view.grid], view.recStrength, { ids: new Set(take) })
      }
      doc.live(result, take)
    }
    doc.commitGesture()
  }

  const offNote = engine.onNote((ev) => {
    if (!active) return
    if (ev.type === 'on') {
      const left = engine.countInBeatsLeft()
      if (left > EARLY_BEATS) return
      const note = createNote({
        pitch: ev.pitch,
        start: Math.round(engine.position()),
        duration: MIN_DURATION,
        velocity: Math.max(0.2, ev.velocity),
      })
      held.set(ev.pitch, note.id)
      take.push(note.id)
      useDoc.getState().live([...notes(), note])
    } else {
      const id = held.get(ev.pitch)
      if (!id) return
      held.delete(ev.pitch)
      const note = notes().find((n) => n.id === id)
      if (note) setDuration(id, durationSince(note.start))
    }
  })

  const sync = () => {
    const t = useTransport.getState()
    const should = t.recording && t.playing
    if (should && !active) begin()
    else if (!should && active) finish()
  }
  const offTransport = useTransport.subscribe(sync)

  return () => {
    offNote()
    offTransport()
    if (active) finish()
  }
}
