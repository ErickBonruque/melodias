import { engine } from '../audio/engine'
import { useTransport } from '../store/transport'
import { parseMidiMessage } from './midiMessage'

export function midiSupported(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
}

let access: MIDIAccess | null = null

function attach(): void {
  if (!access) return
  const names: string[] = []
  access.inputs.forEach((input) => {
    if (input.state === 'disconnected') return
    names.push(input.name || 'Teclado MIDI')
    input.onmidimessage = (e) => {
      const ev = parseMidiMessage(e.data)
      if (!ev) return
      if (ev.type === 'on') engine.noteOn(ev.pitch, ev.velocity)
      else engine.noteOff(ev.pitch)
    }
  })
  useTransport.getState().set({ midiInputs: names })
}

/** Pede acesso aos teclados MIDI. O navegador pode mostrar um pedido de permissão. */
export async function connectMidi(): Promise<boolean> {
  if (!midiSupported()) return false
  try {
    access = await navigator.requestMIDIAccess()
    access.onstatechange = attach
    attach()
    return true
  } catch {
    return false
  }
}

/** Reconecta sozinho quando a permissão já foi dada antes, sem incomodar com o pedido. */
export async function autoConnectMidi(): Promise<void> {
  if (!midiSupported()) return
  try {
    const status = await navigator.permissions.query({ name: 'midi' as PermissionName })
    if (status.state === 'granted') await connectMidi()
  } catch {
    // navegador sem a consulta de permissão: fica para o botão de conectar
  }
}
