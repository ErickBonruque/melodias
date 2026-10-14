import { PitchDetector } from 'pitchy'
import type { PitchFrame } from '../music/pitchTrack'

export type Mic = {
  stop: () => void
  /** Começa a guardar o áudio cru, para transcrever depois. */
  startCapture: () => void
  /** Encerra a captura e devolve o áudio em mono, na taxa pedida. */
  stopCapture: (sampleRate: number) => Promise<AudioBuffer>
}

const FRAME_MS = 20
const FFT = 2048

/**
 * Abre o microfone e chama `onFrame` umas 50 vezes por segundo com a altura detectada.
 * Usa um contexto de áudio próprio, só de análise: nada do microfone vai para as caixas.
 */
export async function openMic(onFrame: (frame: PitchFrame) => void): Promise<Mic> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  })
  const context = new AudioContext()
  const source = context.createMediaStreamSource(stream)
  const analyser = context.createAnalyser()
  analyser.fftSize = FFT
  source.connect(analyser)

  const detector = PitchDetector.forFloat32Array(FFT)
  const buffer = new Float32Array(FFT)
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buffer)
    let sum = 0
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
    const [freq, clarity] = detector.findPitch(buffer, context.sampleRate)
    onFrame({ time: performance.now(), freq, clarity, level: Math.sqrt(sum / buffer.length) })
  }, FRAME_MS)

  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []

  return {
    stop() {
      clearInterval(timer)
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      stream.getTracks().forEach((t) => t.stop())
      void context.close()
    },
    startCapture() {
      chunks = []
      recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.start()
    },
    async stopCapture(sampleRate) {
      const rec = recorder
      if (!rec) throw new Error('captura não iniciada')
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve()
        rec.stop()
      })
      recorder = null
      const encoded = await new Blob(chunks, { type: rec.mimeType }).arrayBuffer()
      const decoded = await context.decodeAudioData(encoded)
      // o modelo de transcrição quer mono numa taxa fixa: um contexto offline faz a conversão
      const frames = Math.max(1, Math.ceil(decoded.duration * sampleRate))
      const offline = new OfflineAudioContext(1, frames, sampleRate)
      const player = offline.createBufferSource()
      player.buffer = decoded
      player.connect(offline.destination)
      player.start()
      return offline.startRendering()
    },
  }
}
