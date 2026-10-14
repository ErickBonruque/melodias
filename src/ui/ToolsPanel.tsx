import type { ReactNode } from 'react'
import { INSTRUMENTS, engine } from '../audio/engine'
import { connectMidi, midiSupported } from '../input/midi'
import { KEYS, SCALES, getScale, pitchClassLabel, pitchLabel } from '../music/scale'
import { deleteSelection, duplicateSelection, nudgeSelection, setSelectionVelocity } from '../store/commands'
import { useDoc } from '../store/doc'
import { useTransport } from '../store/transport'
import { useView } from '../store/view'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-4">
      <h2 className="mb-3 text-[13px] font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}

function ScaleSection() {
  const key = useDoc((s) => s.melody.key)
  const scale = useDoc((s) => s.melody.scale)
  const snapScale = useView((s) => s.snapScale)
  const kbOctave = useView((s) => s.kbOctave)
  const info = getScale(key, scale)
  const base = (kbOctave + 1) * 12 + info.tonic

  return (
    <Section title="Escala">
      <div className="flex gap-2">
        <select
          aria-label="Tonalidade"
          className="field w-[92px]"
          value={key}
          onChange={(e) => useDoc.getState().edit({ key: e.target.value })}
        >
          {KEYS.map((k) => (
            <option key={k} value={k}>
              {pitchClassLabel(k)}
            </option>
          ))}
        </select>
        <select
          aria-label="Escala ou modo"
          className="field flex-1"
          value={scale}
          onChange={(e) => useDoc.getState().edit({ scale: e.target.value })}
        >
          {SCALES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* as notas da escala, na cor que cada grau tem no piano roll; clicar toca */}
      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(29px,1fr))] gap-1.5">
        {info.chromas.map((chroma, i) => {
          const pitch = base + ((chroma - info.tonic + 12) % 12)
          const degree = info.degrees[chroma] ?? 1
          return (
            <button
              key={chroma}
              className="h-8 rounded-md text-[12px] font-semibold transition-transform active:scale-95"
              style={{ background: `var(--deg-${degree})`, color: 'var(--note-ink)' }}
              title={`Tocar ${pitchLabel(pitch, info)}`}
              onPointerDown={() => engine.preview(pitch, 0.8, 0.5)}
            >
              {pitchClassLabel(info.names[chroma])}
              <span className="sr-only">, nota {i + 1} da escala</span>
            </button>
          )
        })}
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px]">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-(--bronze)"
          checked={snapScale}
          onChange={(e) => useView.getState().set({ snapScale: e.target.checked })}
        />
        <span>
          Grudar notas na escala
          <span className="block text-[12px] text-ink-dim">
            Ao criar ou mover, a nota vai para o grau mais próximo. Segure Ctrl para escapar.
          </span>
        </span>
      </label>
    </Section>
  )
}

function SelectionSection() {
  const count = useDoc((s) => s.selection.length)
  const velocity = useDoc((s) => {
    if (s.selection.length === 0) return 0.8
    const ids = new Set(s.selection)
    const picked = s.melody.notes.filter((n) => ids.has(n.id))
    return picked.reduce((sum, n) => sum + n.velocity, 0) / Math.max(1, picked.length)
  })

  if (count === 0) {
    return (
      <Section title="Seleção">
        <p className="text-[13px] text-ink-dim">
          Clique numa nota para selecionar. Para marcar várias, arraste com <kbd>Shift</kbd> ou use a ferramenta de seleção.
        </p>
      </Section>
    )
  }

  return (
    <Section title={count === 1 ? '1 nota selecionada' : `${count} notas selecionadas`}>
      <label className="block text-[13px]">
        <span className="flex justify-between">
          Intensidade <span className="text-ink-dim">{Math.round(velocity * 100)}%</span>
        </span>
        <input
          type="range"
          className="mt-1 w-full"
          min={5}
          max={100}
          value={Math.round(velocity * 100)}
          onChange={(e) => setSelectionVelocity(Number(e.target.value) / 100)}
        />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="btn" onClick={() => nudgeSelection(0, 1, true)}>
          Oitava acima
        </button>
        <button className="btn" onClick={() => nudgeSelection(0, -1, true)}>
          Oitava abaixo
        </button>
        <button className="btn" onClick={duplicateSelection}>
          Repetir
        </button>
        <button className="btn text-felt-text" onClick={deleteSelection}>
          Apagar
        </button>
      </div>
    </Section>
  )
}

function SoundSection() {
  const instrument = useDoc((s) => s.melody.instrument)
  const loading = useTransport((s) => s.loadingInstrument)
  const midiInputs = useTransport((s) => s.midiInputs)
  const kbOctave = useView((s) => s.kbOctave)

  return (
    <Section title="Som e entrada">
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

      <p className="mt-4 text-[13px]">
        Teclado do computador na oitava {kbOctave}
        <span className="block text-[12px] text-ink-dim">
          <kbd>A</kbd> é o Dó{kbOctave}. <kbd>Z</kbd> desce e <kbd>X</kbd> sobe uma oitava.
        </span>
      </p>

      <div className="mt-4 text-[13px]">
        {midiInputs.length > 0 ? (
          <p>
            Teclado MIDI conectado
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
  )
}

export function ToolsPanel() {
  const open = useView((s) => s.toolsOpen)
  return (
    <aside
      aria-label="Ferramentas"
      className={`shrink-0 overflow-hidden border-line bg-panel transition-[width] duration-150 ${open ? 'w-[280px] border-l' : 'w-0'}`}
      inert={!open}
    >
      <div className="h-full w-[280px] overflow-y-auto">
        <ScaleSection />
        <SelectionSection />
        <SoundSection />
      </div>
    </aside>
  )
}
