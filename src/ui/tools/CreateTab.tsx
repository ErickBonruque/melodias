import { toggleRecord } from '../../store/commands'
import { useTransport } from '../../store/transport'
import { useView } from '../../store/view'
import { RecordIcon } from '../icons'
import { Section } from './Section'

function RecordSection() {
  const recording = useTransport((s) => s.recording)
  const countInBars = useView((s) => s.countInBars)
  const recQuantize = useView((s) => s.recQuantize)
  const recStrength = useView((s) => s.recStrength)
  const grid = useView((s) => s.grid)
  const set = useView((s) => s.set)

  return (
    <Section title="Gravar tocando">
      <button className={`btn w-full ${recording ? 'border-felt bg-felt text-white' : ''}`} onClick={toggleRecord}>
        <span className={recording ? '' : 'text-felt-text'}>
          <RecordIcon />
        </span>
        {recording ? 'Encerrar a gravação' : 'Gravar a partir do cursor'}
      </button>
      <p className="mt-2 text-[12px] text-ink-dim">
        Toque no teclado do computador, no teclado lateral ou num teclado MIDI. A tomada inteira vira um passo só de desfazer.
      </p>

      <label className="mt-4 flex items-center justify-between gap-3 text-[13px]">
        Contagem antes
        <select className="field w-[136px]" value={countInBars} onChange={(e) => set({ countInBars: Number(e.target.value) })}>
          <option value={0}>sem contagem</option>
          <option value={1}>1 compasso</option>
          <option value={2}>2 compassos</option>
        </select>
      </label>

      <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[13px]">
        <input
          type="checkbox"
          className="h-4 w-4 accent-(--bronze)"
          checked={recQuantize}
          onChange={(e) => set({ recQuantize: e.target.checked })}
        />
        Quantizar ao terminar, em {grid.replace('T', ' tercina')}
      </label>
      {recQuantize && (
        <label className="mt-2 block text-[13px]">
          <span className="flex justify-between">
            Força <span className="text-ink-dim">{Math.round(recStrength * 100)}%</span>
          </span>
          <input
            type="range"
            className="mt-1 w-full"
            min={10}
            max={100}
            step={10}
            value={Math.round(recStrength * 100)}
            onChange={(e) => set({ recStrength: Number(e.target.value) / 100 })}
          />
          <span className="block text-[12px] text-ink-dim">
            Com 100% a nota cola na grade. Com menos, ela chega perto e guarda um pouco do seu jeito de tocar.
          </span>
        </label>
      )}
    </Section>
  )
}

export function CreateTab() {
  return (
    <>
      <RecordSection />
    </>
  )
}
