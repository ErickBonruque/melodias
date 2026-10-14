import { create } from 'zustand'
import { engine } from '../audio/engine'
import { openMic, type Mic } from '../audio/mic'
import { notesEnd } from '../music/notes'
import { PitchTracker, cleanTranscription, freqToMidi } from '../music/pitchTrack'
import { getScale, snapToScale } from '../music/scale'
import { GRID_TICKS, quantizeNotes, snapTick } from '../music/time'
import { useDoc } from './doc'
import { useTransport } from './transport'
import { useView } from './view'

type HumState = {
  /** Microfone aberto, acompanhando a altura ao vivo. */
  listening: boolean
  /** Nota que está sendo cantada agora (MIDI), ou null. */
  pitch: number | null
  /** Desvio da afinação em centésimos de semitom, de -50 a 50. */
  cents: number
  level: number
  /** Gravação de áudio para transcrever: parada, gravando ou transcrevendo. */
  capture: 'idle' | 'recording' | 'working'
  progress: number
  /** Resultado ou problema da última ação, para mostrar na tela. */
  message: string | null
  error: string | null
}

export const useHum = create<HumState>()(() => ({
  listening: false,
  pitch: null,
  cents: 0,
  level: 0,
  capture: 'idle',
  progress: 0,
  message: null,
  error: null,
}))

let mic: Mic | null = null
let tracker: PitchTracker | null = null
let lastPaint = 0

/** Com "grudar na escala" ligado, a nota cantada vai para o grau mais próximo. */
function toScale(pitch: number): number {
  if (!useView.getState().snapScale) return pitch
  const { melody } = useDoc.getState()
  return snapToScale(pitch, getScale(melody.key, melody.scale))
}

async function ensureMic(): Promise<Mic | null> {
  if (mic) return mic
  if (!navigator.mediaDevices?.getUserMedia) {
    useHum.setState({ error: 'Este navegador não dá acesso ao microfone.' })
    return null
  }
  try {
    tracker = new PitchTracker({}, toScale)
    mic = await openMic((frame) => {
      if (!useHum.getState().listening || !tracker) return
      // a voz acende a tecla e entra na gravação, mas não toca o instrumento
      const events = tracker.push(frame)
      for (const ev of events) {
        if (ev.type === 'on') engine.noteOn(ev.pitch, 0.8, true)
        else engine.noteOff(ev.pitch)
      }
      // a tela atualiza na hora quando a nota muda; no resto do tempo, umas 15 vezes por segundo
      if (events.length === 0 && frame.time - lastPaint < 60) return
      lastPaint = frame.time
      const exact = frame.freq > 0 ? freqToMidi(frame.freq) : 0
      const pitch = tracker.current
      useHum.setState({
        pitch,
        level: frame.level,
        cents: pitch != null ? Math.max(-50, Math.min(50, Math.round((exact - Math.round(exact)) * 100))) : 0,
      })
    })
    useHum.setState({ error: null })
    return mic
  } catch {
    useHum.setState({ error: 'O navegador não liberou o microfone. Permita o acesso nas configurações do site e tente de novo.' })
    return null
  }
}

function closeMicIfUnused(): void {
  const s = useHum.getState()
  if (s.listening || s.capture !== 'idle' || !mic) return
  mic.stop()
  mic = null
}

/** Liga ou desliga o acompanhamento ao vivo da voz. */
export async function toggleListening(): Promise<void> {
  if (useHum.getState().listening) {
    for (const ev of tracker?.release() ?? []) engine.noteOff(ev.pitch)
    useHum.setState({ listening: false, pitch: null, level: 0, cents: 0 })
    closeMicIfUnused()
    return
  }
  if (await ensureMic()) useHum.setState({ listening: true, message: null })
}

/** Primeiro clique começa a gravar o áudio; o segundo encerra e transcreve para notas no cursor. */
export async function toggleCapture(): Promise<void> {
  const state = useHum.getState().capture
  if (state === 'working') return

  if (state === 'idle') {
    const m = await ensureMic()
    if (!m) return
    m.startCapture()
    useHum.setState({ capture: 'recording', message: null, progress: 0 })
    return
  }

  useHum.setState({ capture: 'working', progress: 0 })
  try {
    const { transcribe, TRANSCRIBE_RATE } = await import('../audio/transcribe')
    const audio = await mic!.stopCapture(TRANSCRIBE_RATE)
    const events = await transcribe(audio, (progress) => useHum.setState({ progress }))

    const d = useDoc.getState()
    const view = useView.getState()
    const step = GRID_TICKS[view.grid]
    const at = snapTick(useTransport.getState().cursor, step)
    let notes = cleanTranscription(events, d.melody.bpm, at, { map: toScale })
    if (view.recQuantize) notes = quantizeNotes(notes, step, view.recStrength)

    if (notes.length === 0) {
      useHum.setState({ capture: 'idle', message: 'Não encontrei notas nesse áudio. Tente cantar mais perto do microfone, com notas mais firmes.' })
    } else {
      d.edit({ notes: [...d.melody.notes, ...notes] }, { selection: notes.map((n) => n.id) })
      useTransport.getState().set({ reveal: { start: at, end: notesEnd(notes) } })
      useHum.setState({
        capture: 'idle',
        message: notes.length === 1 ? '1 nota colocada a partir do cursor.' : `${notes.length} notas colocadas a partir do cursor.`,
      })
    }
  } catch (err) {
    console.error('Falha ao transcrever', err)
    useHum.setState({ capture: 'idle', message: null, error: 'Não deu para transcrever esse áudio. Grave de novo e tente outra vez.' })
  }
  closeMicIfUnused()
}
