import { describe, expect, it } from 'vitest'
import { parseMidiMessage } from './midiMessage'

describe('parseMidiMessage', () => {
  it('nota ligada, em qualquer canal', () => {
    expect(parseMidiMessage([0x90, 60, 127])).toEqual({ type: 'on', pitch: 60, velocity: 1 })
    expect(parseMidiMessage([0x93, 72, 64])?.type).toBe('on')
    expect(parseMidiMessage([0x90, 60, 64])?.velocity).toBeCloseTo(0.504, 2)
  })
  it('nota desligada', () => {
    expect(parseMidiMessage([0x80, 60, 0])).toEqual({ type: 'off', pitch: 60, velocity: 0 })
  })
  it('nota ligada com intensidade zero desliga', () => {
    expect(parseMidiMessage([0x90, 60, 0])?.type).toBe('off')
  })
  it('ignora o resto', () => {
    expect(parseMidiMessage([0xb0, 64, 127])).toBeNull() // pedal
    expect(parseMidiMessage([0xf8])).toBeNull() // clock
    expect(parseMidiMessage(null)).toBeNull()
  })
  it('aceita Uint8Array', () => {
    expect(parseMidiMessage(new Uint8Array([0x90, 61, 100]))?.pitch).toBe(61)
  })
})
