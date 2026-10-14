import type { TranscribedNote } from '../music/pitchTrack'

/** Taxa de amostragem que o Basic Pitch exige. */
export const TRANSCRIBE_RATE = 22050

/**
 * Transcreve um áudio (mono, 22050 Hz) em notas com o Basic Pitch, da Spotify.
 * O modelo e o TensorFlow.js são pesados, por isso só são baixados na primeira vez
 * que esta função roda. Tudo acontece no navegador.
 */
export async function transcribe(audio: AudioBuffer, onProgress: (fraction: number) => void): Promise<TranscribedNote[]> {
  const { BasicPitch, addPitchBendsToNoteEvents, noteFramesToTime, outputToNotesPoly } = await import('@spotify/basic-pitch')
  const model = new BasicPitch(`${import.meta.env.BASE_URL}models/basic-pitch/model.json`)

  const frames: number[][] = []
  const onsets: number[][] = []
  const contours: number[][] = []
  await model.evaluateModel(
    audio,
    (f, o, c) => {
      frames.push(...f)
      onsets.push(...o)
      contours.push(...c)
    },
    onProgress,
  )

  const notes = noteFramesToTime(addPitchBendsToNoteEvents(contours, outputToNotesPoly(frames, onsets, 0.5, 0.3, 11)))
  return notes.map((n) => ({ pitch: n.pitchMidi, start: n.startTimeSeconds, duration: n.durationSeconds, velocity: n.amplitude }))
}
