import { CONTOURS } from '../../music/generate'
import { toggleRecord } from '../../store/commands'
import { degreeLabel, degreeOf, getScale, pitchLabel } from '../../music/scale'
import { useDoc } from '../../store/doc'
import { toggleCapture, toggleListening, useHum } from '../../store/hum'
import { generateIdea, generateMotifVariation, variationSource } from '../../store/ideas'
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

const REST_OPTIONS = [
  { value: 1, label: 'tônica' },
  { value: 3, label: 'terça' },
  { value: 5, label: 'quinta' },
]

function IdeaSection() {
  const idea = useView((s) => s.idea)
  const setIdea = (patch: Partial<typeof idea>) => useView.getState().set({ idea: { ...idea, ...patch } })

  return (
    <Section title="Gerador de ideias">
      <div role="radiogroup" aria-label="Contorno" className="grid grid-cols-5 overflow-hidden rounded-md border border-line text-[12px]">
        {CONTOURS.map((c) => (
          <button
            key={c.id}
            role="radio"
            aria-checked={idea.contour === c.id}
            className={`h-[30px] border-l border-line first:border-l-0 ${
              idea.contour === c.id ? 'bg-bronze font-semibold text-bronze-ink' : 'text-ink-dim hover:bg-raised hover:text-ink'
            }`}
            onClick={() => setIdea({ contour: c.id })}
          >
            {c.label}
          </button>
        ))}
      </div>

      <label className="mt-3 block text-[13px]">
        <span className="flex justify-between">
          Densidade <span className="text-ink-dim">{idea.density < 0.34 ? 'notas longas' : idea.density < 0.67 ? 'equilibrada' : 'muitas notas'}</span>
        </span>
        <input
          type="range"
          className="mt-1 w-full"
          min={0}
          max={100}
          step={5}
          value={Math.round(idea.density * 100)}
          onChange={(e) => setIdea({ density: Number(e.target.value) / 100 })}
        />
      </label>

      <label className="mt-2 block text-[13px]">
        <span className="flex justify-between">
          Saltos{' '}
          <span className="text-ink-dim">{idea.leap === 1 ? 'só grau conjunto' : `até ${idea.leap} graus`}</span>
        </span>
        <input
          type="range"
          className="mt-1 w-full"
          min={1}
          max={6}
          value={idea.leap}
          onChange={(e) => setIdea({ leap: Number(e.target.value) })}
        />
      </label>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
        <label>
          Tamanho
          <select className="field mt-1 w-full" value={idea.bars} onChange={(e) => setIdea({ bars: Number(e.target.value) })}>
            {[1, 2, 4, 8].map((b) => (
              <option key={b} value={b}>
                {b === 1 ? '1 compasso' : `${b} compassos`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Repousa na
          <select className="field mt-1 w-full" value={idea.rest} onChange={(e) => setIdea({ rest: Number(e.target.value) })}>
            {REST_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button className="btn btn-primary mt-4 w-full" onClick={generateIdea}>
        Gerar melodia
      </button>
      <p className="mt-2 text-[12px] text-ink-dim">
        Não gostou? Gere de novo: enquanto a ideia estiver selecionada, a próxima entra no lugar dela. Numa melodia que já tem
        notas, a ideia começa no compasso do cursor.
      </p>
      <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[13px]">
        <input
          type="checkbox"
          className="h-4 w-4 accent-(--bronze)"
          checked={idea.autoPlay}
          onChange={(e) => setIdea({ autoPlay: e.target.checked })}
        />
        Tocar assim que gerar
      </label>
    </Section>
  )
}

function VariationSection() {
  // a seleção muda a conta; o seletor só serve para redesenhar quando ela muda
  useDoc((s) => s.selection)
  const size = variationSource().length

  return (
    <Section title="Variar um motivo">
      {size >= 3 ? (
        <>
          <button className="btn w-full" onClick={generateMotifVariation}>
            Criar variação das {size} notas
          </button>
          <p className="mt-2 text-[12px] text-ink-dim">
            A variação guarda o ritmo e sorteia os intervalos entre os que o próprio motivo usa. Ela entra logo depois dele;
            peça de novo para trocar por outra.
          </p>
        </>
      ) : (
        <p className="text-[13px] text-ink-dim">
          Selecione pelo menos três notas de um trecho de que você gosta. A variação mantém o ritmo dele e muda o caminho das
          alturas.
        </p>
      )}
    </Section>
  )
}

function HumSection() {
  const hum = useHum()
  const key = useDoc((s) => s.melody.key)
  const scaleName = useDoc((s) => s.melody.scale)
  const scale = getScale(key, scaleName)
  const degree = hum.pitch != null ? degreeOf(hum.pitch, scale) : null

  return (
    <Section title="Cantarolar">
      <button className={`btn w-full ${hum.listening ? 'border-bronze text-bronze' : ''}`} onClick={() => void toggleListening()}>
        {hum.listening ? 'Desligar o microfone' : 'Ligar o microfone e ver a nota'}
      </button>

      {hum.listening && (
        <div className="mt-3" role="status" aria-label="Nota cantada">
          <div className="flex h-14 items-center gap-3">
            {hum.pitch != null ? (
              <>
                <span
                  className="flex h-12 min-w-[76px] items-center justify-center rounded-md px-2 font-score text-[28px] italic"
                  style={{ background: degree ? `var(--deg-${degree})` : 'var(--deg-out)', color: 'var(--note-ink)' }}
                >
                  {pitchLabel(hum.pitch, scale)}
                </span>
                <span className="text-[13px] text-ink-dim">{degreeLabel(hum.pitch, scale)}</span>
              </>
            ) : (
              <span className="text-[13px] text-ink-dim">Cante ou assobie uma nota firme.</span>
            )}
          </div>
          {/* afinação: o ponteiro no meio é a nota cheia */}
          <div className="relative mt-1 h-2 rounded-full bg-ground" title="Afinação: no centro, a nota está cheia">
            <span className="absolute top-[-3px] left-1/2 h-[14px] w-px bg-line" />
            {hum.pitch != null && (
              <span
                className="absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-bronze transition-[left] duration-75"
                style={{ left: `${50 + hum.cents}%` }}
              />
            )}
          </div>
          <p className="mt-3 text-[12px] text-ink-dim">
            Para escrever o que você canta, aperte gravar (<kbd>R</kbd>) com o microfone ligado. Use fone de ouvido: sem ele, o
            microfone também escuta o metrônomo e a melodia.
          </p>
        </div>
      )}

      <button
        className={`btn mt-4 w-full ${hum.capture === 'recording' ? 'border-felt bg-felt text-white' : ''}`}
        disabled={hum.capture === 'working'}
        onClick={() => void toggleCapture()}
      >
        {hum.capture === 'recording'
          ? 'Parar e transcrever'
          : hum.capture === 'working'
            ? `Transcrevendo… ${Math.round(hum.progress * 100)}%`
            : 'Gravar um trecho e transcrever'}
      </button>
      <p className="mt-2 text-[12px] text-ink-dim">
        {hum.capture === 'recording'
          ? 'Gravando. Cante a frase inteira e depois pare.'
          : 'Mais lento, mas entende melhor uma frase inteira. O modelo roda no seu navegador; o áudio não sai da sua máquina.'}
      </p>
      {hum.message && (
        <p className="mt-2 text-[13px]" role="status">
          {hum.message}
        </p>
      )}
      {hum.error && (
        <p className="mt-2 text-[13px] text-felt-text" role="alert">
          {hum.error}
        </p>
      )}
    </Section>
  )
}

export function CreateTab() {
  return (
    <>
      <IdeaSection />
      <VariationSection />
      <RecordSection />
      <HumSection />
    </>
  )
}
