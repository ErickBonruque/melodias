import * as Tone from 'tone'
import { PPQ, type Note, type TimeSignature } from '../music/types'
import { ticksPerBeat } from '../music/time'

export const INSTRUMENTS = [
  { id: 'piano', label: 'Piano de cauda' },
  { id: 'synth', label: 'Sintetizador suave' },
  { id: 'music-box', label: 'Caixinha de música' },
] as const

export type InstrumentId = (typeof INSTRUMENTS)[number]['id']

type Voice = Tone.Sampler | Tone.PolySynth

type BackingNote = Omit<Note, 'id'>

export type LiveNoteEvent = { type: 'on' | 'off'; pitch: number; velocity: number }

const PIANO_SAMPLES = ['A0', 'C1', 'D#1', 'F#1', 'A1', 'C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6', 'F#6', 'A6', 'C7', 'D#7', 'F#7', 'A7', 'C8']

function midiToFreq(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12)
}

/**
 * Motor de áudio. É o único lugar do app que conversa com o Tone.js.
 * Recebe tudo em ticks e só converte para segundos na hora de agendar.
 */
class AudioEngine {
  private started = false
  private starting: Promise<void> | null = null
  private out: Tone.Volume | null = null
  private voices = new Map<InstrumentId, { node: Voice; ready: boolean }>()
  private instrument: InstrumentId = 'piano'
  private click: Tone.Synth | null = null

  private part: Tone.Part<{ time: string; note: Note }> | null = null
  private backingPart: Tone.Part<{ time: string; note: BackingNote }> | null = null
  private backing: BackingNote[] = []
  private backingVoice: Tone.PolySynth | null = null
  private backingVolume = 0.6
  private notes: Note[] = []
  private timeSignature: TimeSignature = [4, 4]
  private bpm = 96
  private loop = { on: false, start: 0, end: 0 }
  private endTick: number | null = PPQ * 4
  private endEventId: number | null = null
  private metronomeOn = false
  private metronomeId: number | null = null

  /** Alturas soando agora por ação ao vivo (mouse, teclado do computador, MIDI). */
  readonly live = new Set<number>()
  private silent = new Set<number>()
  private liveListeners = new Set<() => void>()

  private noteListeners = new Set<(ev: LiveNoteEvent) => void>()
  private countIn: { startAt: number; beatSec: number; tick: number } | null = null

  /** Chamado quando a reprodução chega ao fim da melodia sozinha. */
  onEnded: (() => void) | null = null
  /** Chamado com o rótulo do instrumento enquanto os samples carregam, e com null ao terminar. */
  onLoading: ((label: string | null) => void) | null = null

  get isStarted(): boolean {
    return this.started
  }

  /** Precisa ser chamado a partir de um gesto do usuário: é o que libera o áudio no navegador. */
  start(): Promise<void> {
    if (this.started) return Promise.resolve()
    if (this.starting) return this.starting
    this.starting = Tone.start().then(() => {
      const transport = Tone.getTransport()
      transport.PPQ = PPQ
      transport.bpm.value = this.bpm
      transport.timeSignature = this.timeSignature

      const limiter = new Tone.Limiter(-1).toDestination()
      this.out = new Tone.Volume(-6).connect(limiter)
      this.click = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
        volume: -8,
      }).connect(limiter)

      // acompanhamento: um timbre macio e sem ataque, para ficar atrás da melodia
      this.backingVoice = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.04, decay: 0.4, sustain: 0.6, release: 0.5 },
      }).connect(this.out)
      this.backingVoice.maxPolyphony = 32
      this.applyBackingVolume()

      this.started = true
      this.voice(this.instrument)
      this.rebuildPart()
      this.rebuildBacking()
      this.applyLoop()
      this.scheduleEnd()
      this.scheduleMetronome()
    })
    return this.starting
  }

  // ---------------------------------------------------------------- instrumentos

  private voice(id: InstrumentId): { node: Voice; ready: boolean } {
    const existing = this.voices.get(id)
    if (existing) return existing
    const out = this.out!
    let entry: { node: Voice; ready: boolean }

    if (id === 'piano') {
      const urls: Record<string, string> = {}
      for (const name of PIANO_SAMPLES) urls[name] = `${name.replace('#', 's')}.mp3`
      entry = { node: null as unknown as Voice, ready: false }
      this.onLoading?.('Piano de cauda')
      entry.node = new Tone.Sampler({
        urls,
        baseUrl: `${import.meta.env.BASE_URL}samples/piano/`,
        release: 1.2,
        onload: () => {
          entry.ready = true
          this.onLoading?.(null)
        },
        onerror: () => this.onLoading?.(null),
      }).connect(out)
    } else if (id === 'music-box') {
      const node = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 9,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.001, decay: 1.4, sustain: 0, release: 1.2 },
        modulationEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 },
        volume: -10,
      })
      node.maxPolyphony = 24
      entry = { node: node.connect(out), ready: true }
    } else {
      const node = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsine', count: 3, spread: 14 },
        envelope: { attack: 0.012, decay: 0.3, sustain: 0.45, release: 0.7 },
        volume: -9,
      })
      node.maxPolyphony = 24
      entry = { node: node.connect(out), ready: true }
    }

    this.voices.set(id, entry)
    return entry
  }

  /** O instrumento escolhido, ou o sintetizador enquanto os samples dele não chegam. */
  private currentVoice(): Voice {
    const chosen = this.voice(this.instrument)
    return chosen.ready ? chosen.node : this.voice('synth').node
  }

  setInstrument(id: string): void {
    const known = INSTRUMENTS.some((i) => i.id === id)
    const next = (known ? id : 'piano') as InstrumentId
    if (next === this.instrument) return
    this.releaseAll()
    this.instrument = next
    if (this.started) this.voice(next)
  }

  // ---------------------------------------------------------------- tocar ao vivo

  private whenStarted(fn: () => void): void {
    if (this.started) fn()
    else void this.start().then(fn)
  }

  /** `silent` acende a tecla e avisa quem grava, mas não toca (é o caso da voz captada pelo microfone). */
  noteOn(pitch: number, velocity = 0.8, silent = false): void {
    if (this.live.has(pitch)) return
    this.live.add(pitch)
    if (silent) this.silent.add(pitch)
    this.emitLive()
    for (const l of this.noteListeners) l({ type: 'on', pitch, velocity })
    if (silent) return
    this.whenStarted(() => {
      if (this.live.has(pitch)) this.currentVoice().triggerAttack(midiToFreq(pitch), Tone.now(), velocity)
    })
  }

  noteOff(pitch: number): void {
    if (!this.live.delete(pitch)) return
    this.emitLive()
    for (const l of this.noteListeners) l({ type: 'off', pitch, velocity: 0 })
    if (this.silent.delete(pitch)) return
    if (this.started) this.currentVoice().triggerRelease(midiToFreq(pitch), Tone.now())
  }

  /** Avisa de cada nota tocada ao vivo. É por aqui que a gravação escuta. */
  onNote(listener: (ev: LiveNoteEvent) => void): () => void {
    this.noteListeners.add(listener)
    return () => this.noteListeners.delete(listener)
  }

  /** Toca uma nota curta, para dar retorno sonoro ao criar ou mover notas. */
  preview(pitch: number, velocity = 0.8, seconds = 0.22): void {
    this.whenStarted(() => this.currentVoice().triggerAttackRelease(midiToFreq(pitch), seconds, Tone.now(), velocity))
  }

  onLiveChange(listener: () => void): () => void {
    this.liveListeners.add(listener)
    return () => this.liveListeners.delete(listener)
  }

  private emitLive(): void {
    for (const l of this.liveListeners) l()
  }

  private releaseAll(): void {
    for (const { node } of this.voices.values()) node.releaseAll()
    this.backingVoice?.releaseAll()
    for (const pitch of [...this.live]) this.noteOff(pitch)
  }

  // ---------------------------------------------------------------- melodia e transport

  setBpm(bpm: number): void {
    this.bpm = bpm
    if (this.started) Tone.getTransport().bpm.value = bpm
  }

  setTimeSignature(ts: TimeSignature): void {
    this.timeSignature = ts
    if (!this.started) return
    Tone.getTransport().timeSignature = ts
    this.scheduleMetronome()
  }

  setNotes(notes: Note[]): void {
    if (notes === this.notes) return
    this.notes = notes
    if (this.started) this.rebuildPart()
  }

  /** Notas do acompanhamento (as cifras já abertas em notas). Lista vazia desliga. */
  setBacking(notes: BackingNote[]): void {
    this.backing = notes
    if (this.started) this.rebuildBacking()
  }

  setBackingVolume(volume: number): void {
    this.backingVolume = volume
    if (this.started) this.applyBackingVolume()
  }

  private applyBackingVolume(): void {
    if (!this.backingVoice) return
    // 0 a 1 vira de -30 dB a -8 dB: o acompanhamento nunca cobre a melodia
    this.backingVoice.volume.value = this.backingVolume <= 0 ? -Infinity : -30 + this.backingVolume * 22
  }

  private rebuildBacking(): void {
    this.backingPart?.dispose()
    this.backingPart = null
    this.backingVoice?.releaseAll()
    if (this.backing.length === 0) return
    const events = this.backing.map((note) => ({ time: `${note.start}i`, note }))
    this.backingPart = new Tone.Part((time, { note }) => {
      const seconds = Tone.Ticks(note.duration).toSeconds()
      this.backingVoice?.triggerAttackRelease(midiToFreq(note.pitch), seconds, time, note.velocity)
    }, events)
    this.backingPart.start(0)
  }

  /** Tick em que a reprodução para sozinha quando não há loop. Com null, segue até mandarem parar. */
  setEnd(tick: number | null): void {
    if (tick === this.endTick) return
    this.endTick = tick
    if (this.started) this.scheduleEnd()
  }

  setLoop(loop: { on: boolean; start: number; end: number }): void {
    this.loop = loop
    if (this.started) this.applyLoop()
  }

  setMetronome(on: boolean): void {
    this.metronomeOn = on
    if (this.started) this.scheduleMetronome()
  }

  private rebuildPart(): void {
    this.part?.dispose()
    const events = this.notes.map((note) => ({ time: `${note.start}i`, note }))
    this.part = new Tone.Part((time, { note }) => {
      const seconds = Tone.Ticks(note.duration).toSeconds()
      this.currentVoice().triggerAttackRelease(midiToFreq(note.pitch), seconds, time, note.velocity)
    }, events)
    this.part.start(0)
  }

  private applyLoop(): void {
    const transport = Tone.getTransport()
    const valid = this.loop.on && this.loop.end > this.loop.start
    transport.loop = valid
    if (valid) transport.setLoopPoints(`${this.loop.start}i`, `${this.loop.end}i`)
  }

  private scheduleEnd(): void {
    const transport = Tone.getTransport()
    if (this.endEventId != null) transport.clear(this.endEventId)
    this.endEventId = null
    if (this.endTick == null) return
    this.endEventId = transport.schedule(() => {
      if (transport.loop) return
      // deixa o agendamento terminar antes de parar o transport
      setTimeout(() => {
        this.stop()
        this.onEnded?.()
      }, 0)
    }, `${this.endTick}i`)
  }

  private scheduleMetronome(): void {
    const transport = Tone.getTransport()
    if (this.metronomeId != null) {
      transport.clear(this.metronomeId)
      this.metronomeId = null
    }
    if (!this.metronomeOn) return
    const beat = ticksPerBeat(this.timeSignature)
    const beatsPerBar = this.timeSignature[0]
    this.metronomeId = transport.scheduleRepeat(
      (time) => {
        const index = Math.round(transport.getTicksAtTime(time) / beat)
        const accent = index % beatsPerBar === 0
        this.click?.triggerAttackRelease(accent ? 1760 : 1175, 0.03, time, accent ? 1 : 0.55)
      },
      `${beat}i`,
      0,
    )
  }

  /** Toca a partir do tick. Com `countInBeats`, estala esse número de tempos antes de partir. */
  play(fromTick: number, countInBeats = 0): void {
    this.whenStarted(() => {
      const transport = Tone.getTransport()
      const tick = Math.max(0, Math.round(fromTick))
      // já tocando, é um salto; parado, parte direto do tick pedido
      if (transport.state === 'started') {
        transport.ticks = tick
        return
      }
      const now = Tone.now()
      const beatSec = (60 / this.bpm) * (4 / this.timeSignature[1])
      for (let i = 0; i < countInBeats; i++) {
        const accent = i % this.timeSignature[0] === 0
        this.click?.triggerAttackRelease(accent ? 1760 : 1175, 0.03, now + i * beatSec, accent ? 1 : 0.55)
      }
      const startAt = now + countInBeats * beatSec
      this.countIn = countInBeats > 0 ? { startAt, beatSec, tick } : null
      transport.start(startAt, `${tick}i`)
    })
  }

  /** Tempos que faltam na contagem de entrada (com fração), ou 0 se não há contagem. */
  countInBeatsLeft(): number {
    if (!this.countIn) return 0
    const left = (this.countIn.startAt - Tone.immediate()) / this.countIn.beatSec
    if (left <= 0) {
      this.countIn = null
      return 0
    }
    return left
  }

  stop(): void {
    if (!this.started) return
    Tone.getTransport().stop()
    this.countIn = null
    this.releaseAll()
  }

  /** Posição do que está saindo pelas caixas agora, em ticks. */
  position(): number {
    if (!this.started) return 0
    if (this.countIn && this.countInBeatsLeft() > 0) return this.countIn.tick
    return Math.max(0, Tone.getTransport().getTicksAtTime(Tone.immediate()))
  }
}

export const engine = new AudioEngine()
