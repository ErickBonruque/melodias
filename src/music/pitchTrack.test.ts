import { describe, expect, it } from 'vitest'
import { PitchTracker, cleanTranscription, freqToMidi, type TrackerEvent } from './pitchTrack'

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/** Alimenta o rastreador com trechos de (altura MIDI ou null para silêncio, duração em ms), um quadro a cada 10 ms. */
function run(tracker: PitchTracker, segments: [number | null, number][], clarity = 0.95): { at: number; ev: TrackerEvent }[] {
  const out: { at: number; ev: TrackerEvent }[] = []
  let time = 0
  for (const [midi, ms] of segments) {
    for (let t = 0; t < ms; t += 10, time += 10) {
      const frame = midi == null ? { time, freq: 0, clarity: 0, level: 0 } : { time, freq: hz(midi), clarity, level: 0.2 }
      for (const ev of tracker.push(frame)) out.push({ at: time, ev })
    }
  }
  return out
}
const kinds = (events: { ev: TrackerEvent }[]) => events.map((e) => `${e.ev.type}${e.ev.pitch}`)

describe('freqToMidi', () => {
  it('Lá 440 é 69 e cada oitava dobra a frequência', () => {
    expect(freqToMidi(440)).toBeCloseTo(69)
    expect(freqToMidi(880)).toBeCloseTo(81)
    expect(freqToMidi(261.63)).toBeCloseTo(60, 1)
  })
})

describe('PitchTracker', () => {
  it('nota firme liga depois do tempo de ataque e desliga depois do silêncio', () => {
    const events = run(new PitchTracker(), [[60, 300], [null, 300]])
    expect(kinds(events)).toEqual(['on60', 'off60'])
    expect(events[0].at).toBeGreaterThanOrEqual(40)
    expect(events[0].at).toBeLessThanOrEqual(70)
    expect(events[1].at).toBeGreaterThan(300 + 100)
  })
  it('mudar de altura desliga uma e liga a outra', () => {
    expect(kinds(run(new PitchTracker(), [[60, 200], [64, 200], [67, 200], [null, 200]]))).toEqual([
      'on60', 'off60', 'on64', 'off64', 'on67', 'off67',
    ])
  })
  it('um estalo curto de outra altura não vira nota', () => {
    expect(kinds(run(new PitchTracker(), [[60, 200], [72, 20], [60, 200], [null, 200]]))).toEqual(['on60', 'off60'])
  })
  it('falha curta no meio da nota não corta a nota', () => {
    expect(kinds(run(new PitchTracker(), [[60, 200], [null, 60], [60, 200], [null, 300]]))).toEqual(['on60', 'off60'])
  })
  it('vibrato e afinação solta ficam na mesma nota', () => {
    const wobble: [number, number][] = []
    for (let i = 0; i < 20; i++) wobble.push([60 + (i % 2 ? 0.45 : -0.45), 30])
    expect(kinds(run(new PitchTracker(), [[60, 100], ...wobble, [null, 300]]))).toEqual(['on60', 'off60'])
  })
  it('leitura sem confiança ou baixa demais é ignorada', () => {
    expect(run(new PitchTracker(), [[60, 300]], 0.5)).toEqual([])
    const tracker = new PitchTracker()
    expect(tracker.push({ time: 0, freq: hz(60), clarity: 0.99, level: 0.001 })).toEqual([])
    expect(run(new PitchTracker(), [[20, 300]])).toEqual([])
  })
  it('com mapa para a escala, vizinhas que caem na mesma nota não redisparam', () => {
    const toCMajor = (p: number) => (p % 12 === 1 ? p - 1 : p) // Dó♯ vira Dó
    expect(kinds(run(new PitchTracker({}, toCMajor), [[60, 200], [61, 200], [62, 200], [null, 300]]))).toEqual([
      'on60', 'off60', 'on62', 'off62',
    ])
  })
  it('release encerra a nota em andamento', () => {
    const tracker = new PitchTracker()
    run(tracker, [[64, 200]])
    expect(tracker.current).toBe(64)
    expect(tracker.release()).toEqual([{ type: 'off', pitch: 64 }])
    expect(tracker.current).toBeNull()
  })
})

describe('cleanTranscription', () => {
  // a 120 bpm, 1 segundo = 960 ticks
  it('converte segundos em ticks e começa onde pedido', () => {
    const out = cleanTranscription(
      [{ pitch: 60, start: 0.5, duration: 0.5, velocity: 0.8 }, { pitch: 64, start: 1, duration: 0.25, velocity: 0.7 }],
      120,
      1920,
    )
    expect(out.map((n) => [n.pitch, n.start, n.duration])).toEqual([[60, 1920, 480], [64, 2400, 240]])
    expect(out.every((n) => n.id)).toBe(true)
  })
  it('descarta notas curtas demais', () => {
    const out = cleanTranscription(
      [{ pitch: 60, start: 0, duration: 0.5, velocity: 0.8 }, { pitch: 80, start: 0.6, duration: 0.02, velocity: 0.9 }],
      120,
    )
    expect(out.map((n) => n.pitch)).toEqual([60])
  })
  it('em sobreposição fica a mais forte e a outra cede espaço', () => {
    // harmônico fraco soando junto com a nota de verdade
    const sameTime = cleanTranscription(
      [{ pitch: 60, start: 0, duration: 0.5, velocity: 0.9 }, { pitch: 72, start: 0, duration: 0.5, velocity: 0.3 }],
      120,
    )
    expect(sameTime.map((n) => n.pitch)).toEqual([60])
    // nota seguinte começa antes de a anterior terminar e é mais forte: a anterior é cortada
    const legato = cleanTranscription(
      [{ pitch: 60, start: 0, duration: 0.6, velocity: 0.6 }, { pitch: 62, start: 0.5, duration: 0.5, velocity: 0.8 }],
      120,
    )
    expect(legato.map((n) => [n.pitch, n.start, n.duration])).toEqual([[60, 0, 480], [62, 480, 480]])
  })
  it('o resultado nunca se sobrepõe', () => {
    const messy = Array.from({ length: 30 }, (_, i) => ({
      pitch: 60 + (i * 7) % 12,
      start: i * 0.13,
      duration: 0.1 + ((i * 37) % 10) / 20,
      velocity: 0.3 + ((i * 53) % 7) / 10,
    }))
    const out = cleanTranscription(messy, 100)
    out.slice(1).forEach((n, i) => expect(n.start).toBeGreaterThanOrEqual(out[i].start + out[i].duration))
  })
  it('aplica o mapa de alturas e arredonda', () => {
    const out = cleanTranscription([{ pitch: 60.6, start: 0, duration: 0.5, velocity: 0.8 }], 120, 0, { map: (p) => p + 12 })
    expect(out[0].pitch).toBe(73)
  })
  it('sem notas devolve vazio', () => {
    expect(cleanTranscription([], 120)).toEqual([])
  })
})
