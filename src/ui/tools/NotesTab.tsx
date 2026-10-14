import { useState } from 'react'
import { engine } from '../../audio/engine'
import { KEYS, SCALES, getScale, pitchClassLabel, pitchLabel } from '../../music/scale'
import { GRID_TICKS, quantizeNotes } from '../../music/time'
import {
  humanize,
  invert,
  mirrorContour,
  retrograde,
  scaleRhythm,
  transposeChromatic,
  transposeDiatonic,
} from '../../music/transform'
import { applyTransform, deleteSelection, duplicateSelection, setSelectionVelocity } from '../../store/commands'
import { useDoc } from '../../store/doc'
import { useView } from '../../store/view'
import { Section, Stepper } from './Section'

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
        <button className="btn" title="Repete a seleção logo em seguida (Ctrl+D)" onClick={duplicateSelection}>
          Repetir
        </button>
        <button className="btn text-felt-text" onClick={deleteSelection}>
          Apagar
        </button>
      </div>
    </Section>
  )
}

function TransformSection() {
  const hasNotes = useDoc((s) => s.melody.notes.length > 0)
  const selected = useDoc((s) => s.selection.length)
  const grid = useView((s) => s.grid)
  const [human, setHuman] = useState(35)
  const [strength, setStrength] = useState(100)

  if (!hasNotes) {
    return (
      <Section title="Transformar">
        <p className="text-[13px] text-ink-dim">
          Escreva algumas notas e volte aqui para transpor, inverter, tocar de trás para a frente ou tirar a rigidez do ritmo.
        </p>
      </Section>
    )
  }

  return (
    <Section title="Transformar">
      <p className="mb-3 text-[12px] text-ink-dim">
        {selected > 0 ? 'Vale para as notas selecionadas.' : 'Sem seleção, vale para a melodia inteira.'}
      </p>

      <div className="grid grid-cols-1 gap-2">
        <Stepper
          label="semitom"
          onDown={() => applyTransform((n) => transposeChromatic(n, -1), 'transpose')}
          onUp={() => applyTransform((n) => transposeChromatic(n, 1), 'transpose')}
        />
        <Stepper
          label="grau da escala"
          onDown={() => applyTransform((n) => transposeDiatonic(n, -1, scaleOf()), 'transpose')}
          onUp={() => applyTransform((n) => transposeDiatonic(n, 1, scaleOf()), 'transpose')}
        />
        <Stepper
          label="oitava"
          onDown={() => applyTransform((n) => transposeChromatic(n, -12), 'transpose')}
          onUp={() => applyTransform((n) => transposeChromatic(n, 12), 'transpose')}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className="btn"
          title="O que subia passa a descer, em torno da primeira nota"
          onClick={() => applyTransform((n, scale) => invert(n, scale))}
        >
          Inverter
        </button>
        <button className="btn" title="Toca de trás para a frente" onClick={() => applyTransform((n) => retrograde(n))}>
          Retrógrado
        </button>
        <button
          className="btn col-span-2"
          title="A nota mais aguda vira a mais grave, sem sair da mesma região"
          onClick={() => applyTransform((n, scale) => mirrorContour(n, scale))}
        >
          Espelhar o contorno
        </button>
        <button className="btn" title="Dobra as durações: o trecho fica duas vezes mais lento" onClick={() => applyTransform((n) => scaleRhythm(n, 2))}>
          Ritmo × 2
        </button>
        <button className="btn" title="Corta as durações pela metade: o trecho fica duas vezes mais rápido" onClick={() => applyTransform((n) => scaleRhythm(n, 0.5))}>
          Ritmo ÷ 2
        </button>
      </div>

      <div className="mt-4 text-[13px]">
        <label className="flex justify-between" htmlFor="human-amount">
          Humanizar <span className="text-ink-dim">{human}%</span>
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id="human-amount"
            type="range"
            className="min-w-0 flex-1"
            min={5}
            max={100}
            step={5}
            value={human}
            onChange={(e) => setHuman(Number(e.target.value))}
          />
          <button
            className="btn"
            title="Desloca um pouco o início e a intensidade de cada nota"
            onClick={() => applyTransform((n) => humanize(n, { timing: (human / 100) * 40, velocity: (human / 100) * 0.22 }))}
          >
            Aplicar
          </button>
        </div>
      </div>

      <div className="mt-3 text-[13px]">
        <label className="flex justify-between" htmlFor="quant-strength">
          Quantizar em {grid.replace('T', ' tercina')} <span className="text-ink-dim">{strength}%</span>
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id="quant-strength"
            type="range"
            className="min-w-0 flex-1"
            min={10}
            max={100}
            step={10}
            value={strength}
            onChange={(e) => setStrength(Number(e.target.value))}
          />
          <button
            className="btn"
            title="Puxa o início das notas para a grade; com menos de 100%, só parte do caminho"
            onClick={() => applyTransform((n) => quantizeNotes(n, GRID_TICKS[grid], strength / 100))}
          >
            Aplicar
          </button>
        </div>
      </div>
    </Section>
  )
}

function scaleOf() {
  const { melody } = useDoc.getState()
  return getScale(melody.key, melody.scale)
}

export function NotesTab() {
  return (
    <>
      <ScaleSection />
      <SelectionSection />
      <TransformSection />
    </>
  )
}
