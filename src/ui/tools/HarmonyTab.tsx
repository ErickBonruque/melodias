import { detectKey, outOfScale, rangeLabel, sameNotes } from '../../music/analysis'
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

export function HarmonyTab() {
  return (
    <>
      <AnalysisSection />
    </>
  )
}
