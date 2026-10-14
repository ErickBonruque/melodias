import { create } from 'zustand'

export type LoopRegion = { on: boolean; start: number; end: number }

type TransportState = {
  playing: boolean
  /** Gravando o que é tocado ao vivo. Só faz sentido com `playing`. */
  recording: boolean
  /** De onde a reprodução parte e para onde o stop volta, em ticks. */
  cursor: number
  loop: LoopRegion
  metronome: boolean
  /** O navegador já liberou o áudio (houve um gesto do usuário). */
  audioReady: boolean
  /** Nome do instrumento que ainda está carregando samples, se houver. */
  loadingInstrument: string | null
  midiInputs: string[]
  /** Pedido para o piano roll trazer este trecho (em ticks) para a área visível. */
  reveal: { start: number; end: number } | null
  set: (patch: Partial<Omit<TransportState, 'set'>>) => void
}

export const useTransport = create<TransportState>()((set) => ({
  playing: false,
  recording: false,
  cursor: 0,
  loop: { on: false, start: 0, end: 0 },
  metronome: false,
  audioReady: false,
  loadingInstrument: null,
  midiInputs: [],
  reveal: null,
  set: (patch) => set(patch),
}))
