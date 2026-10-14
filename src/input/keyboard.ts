import { engine } from '../audio/engine'
import { useView } from '../store/view'

/** Fileira do meio toca as teclas brancas, a de cima as pretas, como nas DAWs. */
export const NOTE_KEYS: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
}

const held = new Map<string, number>()

/** Devolve true se a tecla foi tratada como nota. */
export function noteKeyDown(e: KeyboardEvent): boolean {
  const offset = NOTE_KEYS[e.code]
  if (offset == null) return false
  if (e.repeat || held.has(e.code)) return true
  const pitch = (useView.getState().kbOctave + 1) * 12 + offset
  if (pitch > 108) return true
  held.set(e.code, pitch)
  engine.noteOn(pitch, 0.8)
  return true
}

export function noteKeyUp(e: KeyboardEvent): boolean {
  const pitch = held.get(e.code)
  if (pitch == null) return false
  held.delete(e.code)
  engine.noteOff(pitch)
  return true
}

export function releaseAllKeys(): void {
  for (const pitch of held.values()) engine.noteOff(pitch)
  held.clear()
}

export function shiftOctave(delta: number): void {
  const v = useView.getState()
  v.set({ kbOctave: Math.min(7, Math.max(0, v.kbOctave + delta)) })
}
