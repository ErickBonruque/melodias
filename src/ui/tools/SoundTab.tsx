import { INSTRUMENTS } from '../../audio/engine'
import { connectMidi, midiSupported } from '../../input/midi'
import { useDoc } from '../../store/doc'
import { useTransport } from '../../store/transport'
import { useView } from '../../store/view'
import { Section } from './Section'

export function SoundTab() {
  const instrument = useDoc((s) => s.melody.instrument)
  const loading = useTransport((s) => s.loadingInstrument)
  const midiInputs = useTransport((s) => s.midiInputs)
  const kbOctave = useView((s) => s.kbOctave)

  return (
    <>
      <Section title="Instrumento">
        <select
          aria-label="Instrumento"
          className="field w-full"
          value={instrument}
          onChange={(e) => useDoc.getState().setMeta({ instrument: e.target.value })}
        >
          {INSTRUMENTS.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </select>
        {loading && <p className="mt-2 text-[12px] text-ink-dim">Carregando os samples. Até chegarem, toca o sintetizador.</p>}
      </Section>

      <Section title="Teclado do computador">
        <p className="text-[13px]">
          Tocando na oitava {kbOctave}
          <span className="mt-1 block text-[12px] text-ink-dim">
            <kbd>A</kbd> é o Dó{kbOctave}. <kbd>Z</kbd> desce e <kbd>X</kbd> sobe uma oitava.
          </span>
        </p>
      </Section>

      <Section title="Teclado MIDI">
        <div className="text-[13px]">
          {midiInputs.length > 0 ? (
            <p>
              Conectado
              <span className="block text-[12px] text-ink-dim">{midiInputs.join(', ')}</span>
            </p>
          ) : midiSupported() ? (
            <>
              <button className="btn w-full" onClick={() => void connectMidi()}>
                Conectar teclado MIDI
              </button>
              <p className="mt-1.5 text-[12px] text-ink-dim">O navegador vai pedir permissão na primeira vez.</p>
            </>
          ) : (
            <p className="text-ink-dim">Este navegador não tem Web MIDI. No Chrome ou no Edge funciona.</p>
          )}
        </div>
      </Section>
    </>
  )
}
