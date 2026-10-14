import { detectKey, outOfScale, rangeLabel, sameNotes } from '../../music/analysis'
import { PROGRESSIONS, diatonicChords, fillProgression, suggestChords, type BackingStyle } from '../../music/chords'
import { melodyEnd } from '../../music/notes'
import { ticksPerBar } from '../../music/time'
import { getScale, scaleLabel, snapToScale } from '../../music/scale'
import { useDoc } from '../../store/doc'
import { useView, type NoteLabel } from '../../store/view'
import { Section } from './Section'

const LABELS: { id: NoteLabel; label: string; hint: string }[] = [
  { id: 'name', label: 'Nome', hint: 'Dó4, Mi♭4' },
  { id: 'degree', label: 'Grau', hint: 'o número do grau na escala; × para nota fora dela' },
  { id: 'interval', label: 'Intervalo', hint: 'a distância para a nota anterior: +3M é uma terça maior acima' },
]

function AnalysisSection() {
  const notes = useDoc((s) => s.melody.notes)
  const key = useDoc((s) => s.melody.key)
  const scale = useDoc((s) => s.melody.scale)
  const noteLabel = useView((s) => s.noteLabel)
  const current = getScale(key, scale)

  if (notes.length < 4) {
    return (
      <Section title="Análise">
        <p className="text-[13px] text-ink-dim">
          Com quatro notas ou mais, aqui aparecem a tonalidade mais provável, a extensão da melodia e as notas que saem da
          escala.
        </p>
      </Section>
    )
  }

  const guesses = detectKey(notes).slice(0, 3)
  const best = guesses[0]
  const outside = outOfScale(notes, current)
  const fits = (g: (typeof guesses)[number]) => sameNotes(getScale(g.key, g.scale), current)

  return (
    <Section title="Análise">
      <p className="text-[13px]">
        Soa como <strong className="font-semibold">{scaleLabel(best.key, best.scale)}</strong>
        {fits(best) ? (
          <span className="text-ink-dim">
            {best.key === key && best.scale === scale ? ', a escala que você escolheu.' : `, que tem as mesmas notas de ${scaleLabel(key, scale)}.`}
          </span>
        ) : (
          <span className="text-ink-dim">. A escala escolhida é {scaleLabel(key, scale)}.</span>
        )}
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {guesses.map((g) => {
          const active = g.key === key && g.scale === scale
          return (
            <button
              key={g.key + g.scale}
              className="relative flex h-[30px] items-center justify-between overflow-hidden rounded-md border border-line px-2.5 text-[13px] hover:bg-raised disabled:opacity-100"
              disabled={active}
              title={active ? 'É a escala atual' : `Usar ${scaleLabel(g.key, g.scale)} como escala`}
              onClick={() => useDoc.getState().edit({ key: g.key, scale: g.scale })}
            >
              <span
                className="absolute inset-y-0 left-0 bg-bronze opacity-20"
                style={{ width: `${Math.max(4, Math.round(g.score * 100))}%` }}
              />
              <span className="relative">{scaleLabel(g.key, g.scale)}</span>
              <span className="relative text-[12px] text-ink-dim">{active ? 'atual' : 'usar'}</span>
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-[13px]">
        {outside.length === 0
          ? 'Todas as notas estão na escala.'
          : outside.length === 1
            ? '1 nota fora da escala.'
            : `${outside.length} notas fora da escala.`}
        <span className="block text-[12px] text-ink-dim">Extensão: {rangeLabel(notes, current)}.</span>
      </p>
      {outside.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => useDoc.getState().select(outside.map((n) => n.id))}>
            Selecionar
          </button>
          <button
            className="btn"
            title="Leva cada uma para a nota da escala mais próxima"
            onClick={() => {
              const ids = new Set(outside.map((n) => n.id))
              const d = useDoc.getState()
              d.edit({ notes: d.melody.notes.map((n) => (ids.has(n.id) ? { ...n, pitch: snapToScale(n.pitch, current) } : n)) })
            }}
          >
            Trazer para a escala
          </button>
        </div>
      )}

      <p className="mt-4 mb-1.5 text-[13px]">Escrever em cada nota</p>
      <div role="radiogroup" aria-label="Escrever em cada nota" className="grid grid-cols-3 overflow-hidden rounded-md border border-line text-[12px]">
        {LABELS.map((l) => (
          <button
            key={l.id}
            role="radio"
            aria-checked={noteLabel === l.id}
            title={l.hint}
            className={`h-[30px] border-l border-line first:border-l-0 ${
              noteLabel === l.id ? 'bg-bronze font-semibold text-bronze-ink' : 'text-ink-dim hover:bg-raised hover:text-ink'
            }`}
            onClick={() => useView.getState().set({ noteLabel: l.id })}
          >
            {l.label}
          </button>
        ))}
      </div>
    </Section>
  )
}

const pretty = (symbol: string) => symbol.replace(/#/g, '♯').replace(/([A-G])b/, '$1♭')

const SLOTS = [
  { value: 0.5, label: 'meio compasso' },
  { value: 1, label: '1 compasso' },
  { value: 2, label: '2 compassos' },
]

function ChordsSection() {
  const notes = useDoc((s) => s.melody.notes)
  const key = useDoc((s) => s.melody.key)
  const scale = useDoc((s) => s.melody.scale)
  const timeSignature = useDoc((s) => s.melody.timeSignature)
  const chords = useDoc((s) => s.melody.chords) ?? []
  const backing = useView((s) => s.backing)
  const setBacking = (patch: Partial<typeof backing>) => useView.getState().set({ backing: { ...backing, ...patch } })

  if (notes.length === 0 && chords.length === 0) {
    return (
      <Section title="Acordes">
        <p className="text-[13px] text-ink-dim">
          Escreva uma melodia e volte aqui para ouvi-la com acompanhamento: dá para pedir uma sugestão de acordes ou partir de
          uma progressão conhecida.
        </p>
      </Section>
    )
  }

  const options = diatonicChords(key, scale)
  const slot = Math.round(ticksPerBar(timeSignature) * backing.slotBars)
  const total = melodyEnd({ notes, timeSignature })
  const setChords = (next: typeof chords) => useDoc.getState().edit({ chords: next })

  return (
    <Section title="Acordes">
      <label className="flex items-center justify-between gap-3 text-[13px]">
        Acorde a cada
        <select className="field w-[136px]" value={backing.slotBars} onChange={(e) => setBacking({ slotBars: Number(e.target.value) })}>
          {SLOTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <button
        className="btn btn-primary mt-3 w-full"
        disabled={notes.length === 0}
        title="Escolhe, para cada trecho, o acorde da escala que mais combina com as notas que soam nele"
        onClick={() => setChords(suggestChords(notes, key, scale, slot, total))}
      >
        Sugerir acordes para a melodia
      </button>

      <p className="mt-4 mb-1.5 text-[13px]">Ou parta de uma progressão</p>
      <div className="grid grid-cols-2 gap-1.5">
        {PROGRESSIONS.map((p) => (
          <button
            key={p.id}
            className="btn h-[30px] px-1 text-[12px] font-medium"
            title={p.degrees.map((d) => pretty(options[d - 1].symbol)).join('  ')}
            onClick={() => setChords(fillProgression(p.degrees, key, scale, slot, total))}
          >
            {p.degrees.map((d) => options[d - 1].roman).join(' ')}
          </button>
        ))}
      </div>

      {chords.length > 0 && (
        <>
          <p className="mt-4 mb-1.5 text-[13px]">Acorde por acorde</p>
          <div className="grid grid-cols-4 gap-1.5">
            {chords.map((chord, i) => (
              <select
                key={chord.start}
                aria-label={`Acorde ${i + 1}`}
                className="field h-[30px] px-1 text-[12px] font-semibold"
                value={chord.symbol}
                onChange={(e) => setChords(chords.map((c, j) => (j === i ? { ...c, symbol: e.target.value } : c)))}
              >
                {!options.some((o) => o.symbol === chord.symbol) && <option value={chord.symbol}>{pretty(chord.symbol)}</option>}
                {options.map((o) => (
                  <option key={o.symbol} value={o.symbol}>
                    {pretty(o.symbol)}
                  </option>
                ))}
              </select>
            ))}
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[13px]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-(--bronze)"
              checked={backing.on}
              onChange={(e) => setBacking({ on: e.target.checked })}
            />
            Tocar o acompanhamento
          </label>
          {backing.on && (
            <div className="mt-2 flex items-center gap-2 text-[13px]">
              <select
                aria-label="Jeito de tocar os acordes"
                className="field w-[92px]"
                value={backing.style}
                onChange={(e) => setBacking({ style: e.target.value as BackingStyle })}
              >
                <option value="block">Bloco</option>
                <option value="arp">Arpejo</option>
              </select>
              <input
                type="range"
                aria-label="Volume do acompanhamento"
                className="min-w-0 flex-1"
                min={0}
                max={100}
                step={5}
                value={Math.round(backing.volume * 100)}
                onChange={(e) => setBacking({ volume: Number(e.target.value) / 100 })}
              />
            </div>
          )}
          <button className="btn mt-3 w-full" onClick={() => setChords([])}>
            Tirar os acordes
          </button>
        </>
      )}
    </Section>
  )
}

export function HarmonyTab() {
  return (
    <>
      <ChordsSection />
      <AnalysisSection />
    </>
  )
}
