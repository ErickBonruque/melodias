import { engine } from '../audio/engine'
import { backingNotes } from '../music/chords'
import { melodyEnd } from '../music/notes'
import { useDoc } from './doc'
import { useTransport } from './transport'
import { useView } from './view'

/**
 * Liga os stores ao motor de áudio. A interface só mexe no estado;
 * é aqui que o estado vira som.
 */
export function bindAudio(): () => void {
  const syncDoc = () => {
    const { melody } = useDoc.getState()
    engine.setBpm(melody.bpm)
    engine.setTimeSignature(melody.timeSignature)
    engine.setInstrument(melody.instrument)
    engine.setNotes(melody.notes)
    engine.setEnd(melodyEnd(melody))
  }
  syncDoc()

  const syncBacking = () => {
    const { melody } = useDoc.getState()
    const { backing } = useView.getState()
    const chords = melody.chords ?? []
    engine.setBacking(backing.on && chords.length > 0 ? backingNotes(chords, backing.style, melody.timeSignature) : [])
    engine.setBackingVolume(backing.volume)
  }
  syncBacking()
  let prevBacking = useView.getState().backing
  const unsubView = useView.subscribe((v) => {
    if (v.backing !== prevBacking) syncBacking()
    prevBacking = v.backing
  })

  let prevMelody = useDoc.getState().melody
  const unsubDoc = useDoc.subscribe((s) => {
    const m = s.melody
    if (m === prevMelody) return
    if (m.id !== prevMelody.id) useTransport.getState().set({ playing: false, cursor: 0, loop: { on: false, start: 0, end: 0 } })
    if (m.bpm !== prevMelody.bpm) engine.setBpm(m.bpm)
    if (m.timeSignature !== prevMelody.timeSignature) engine.setTimeSignature(m.timeSignature)
    if (m.instrument !== prevMelody.instrument) engine.setInstrument(m.instrument)
    if (m.notes !== prevMelody.notes || m.timeSignature !== prevMelody.timeSignature) {
      engine.setNotes(m.notes)
      // gravando, a reprodução não para no fim: a melodia ainda está crescendo
      engine.setEnd(useTransport.getState().recording ? null : melodyEnd(m))
    }
    if (m.chords !== prevMelody.chords || m.timeSignature !== prevMelody.timeSignature) syncBacking()
    prevMelody = m
  })

  let prev = useTransport.getState()
  engine.setLoop(prev.loop)
  engine.setMetronome(prev.metronome)
  const unsubTransport = useTransport.subscribe((t) => {
    if (t.loop !== prev.loop) engine.setLoop(t.loop)
    if (t.metronome !== prev.metronome) engine.setMetronome(t.metronome)
    if (t.recording !== prev.recording) engine.setEnd(t.recording ? null : melodyEnd(useDoc.getState().melody))
    if (t.playing !== prev.playing) {
      if (t.playing) {
        const loop = t.loop.on && t.loop.end > t.loop.start ? t.loop : null
        const end = melodyEnd(useDoc.getState().melody)
        let from = t.cursor
        if (loop && (from < loop.start || from >= loop.end)) from = loop.start
        if (!loop && from >= end && !t.recording) from = 0
        if (from !== t.cursor) {
          prev = { ...t, cursor: from }
          t.set({ cursor: from })
        }
        const { melody } = useDoc.getState()
        engine.play(from, t.recording ? useView.getState().countInBars * melody.timeSignature[0] : 0)
      } else {
        engine.stop()
      }
    } else if (t.playing && t.cursor !== prev.cursor) {
      // mudaram o cursor com a música tocando: pula para lá
      engine.play(t.cursor)
    }
    prev = useTransport.getState()
  })

  engine.onEnded = () => useTransport.getState().set({ playing: false })
  engine.onLoading = (label) => useTransport.getState().set({ loadingInstrument: label })

  // o navegador só libera áudio depois de um gesto: o primeiro clique ou tecla resolve
  const unlock = () => {
    void engine.start().then(() => useTransport.getState().set({ audioReady: true }))
    window.removeEventListener('pointerdown', unlock, true)
    window.removeEventListener('keydown', unlock, true)
  }
  window.addEventListener('pointerdown', unlock, true)
  window.addEventListener('keydown', unlock, true)

  return () => {
    unsubDoc()
    unsubView()
    unsubTransport()
    engine.onEnded = null
    engine.onLoading = null
    window.removeEventListener('pointerdown', unlock, true)
    window.removeEventListener('keydown', unlock, true)
  }
}
