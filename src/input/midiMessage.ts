export type MidiNoteEvent = { type: 'on' | 'off'; pitch: number; velocity: number }

/** Interpreta uma mensagem MIDI crua. Só nota ligada e desligada interessam aqui. */
export function parseMidiMessage(data: ArrayLike<number> | null | undefined): MidiNoteEvent | null {
  if (!data || data.length < 3) return null
  const status = data[0] & 0xf0
  const pitch = data[1] & 0x7f
  const value = data[2] & 0x7f
  if (status === 0x90 && value > 0) return { type: 'on', pitch, velocity: value / 127 }
  // nota ligada com intensidade zero é o jeito abreviado de desligar
  if (status === 0x80 || status === 0x90) return { type: 'off', pitch, velocity: 0 }
  return null
}
