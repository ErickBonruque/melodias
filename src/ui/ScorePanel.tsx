import { useEffect, useRef, useState } from 'react'
import { melodyToAbc, type AbcResult } from '../music/abc'
import { getPlayhead, seek } from '../store/commands'
import { useDoc } from '../store/doc'
import { useTransport } from '../store/transport'
import { useView } from '../store/view'

type AbcElement = { el_type?: string; abselem?: { elemset?: Element[] } }
type AbcTune = { lines?: { staff?: { voices?: AbcElement[][] }[] }[] }

/** Notas e pausas desenhadas, na ordem em que foram escritas no ABC. */
function drawnNotes(tune: AbcTune): AbcElement[] {
  const out: AbcElement[] = []
  for (const line of tune.lines ?? []) {
    for (const staff of line.staff ?? []) {
      for (const voice of staff.voices ?? []) {
        for (const el of voice) if (el.el_type === 'note') out.push(el)
      }
    }
  }
  return out
}

function ScoreView() {
  const host = useRef<HTMLDivElement>(null)
  const drawn = useRef<{ tokens: AbcResult['tokens']; elements: AbcElement[] }>({ tokens: [], elements: [] })
  const [width, setWidth] = useState(0)
  const [failed, setFailed] = useState(false)

  const notes = useDoc((s) => s.melody.notes)
  const key = useDoc((s) => s.melody.key)
  const scale = useDoc((s) => s.melody.scale)
  const bpm = useDoc((s) => s.melody.bpm)
  const timeSignature = useDoc((s) => s.melody.timeSignature)
  const empty = notes.length === 0

  useEffect(() => {
    const el = host.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(Math.round(el.clientWidth / 20) * 20))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // redesenha quando a melodia muda; o atraso evita redesenhar a cada pixel de um arrasto
  useEffect(() => {
    const el = host.current
    if (!el || width === 0 || empty) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const abcjs = await import('abcjs')
        if (cancelled) return
        const { abc, tokens } = melodyToAbc({ title: '', notes, key, scale, bpm, timeSignature })
        const elements: AbcElement[] = []
        const tunes = abcjs.renderAbc(el, abc, {
          add_classes: true,
          selectionColor: 'currentColor',
          staffwidth: Math.max(280, width - 56),
          wrap: { minSpacing: 1.5, maxSpacing: 2.6, preferredMeasuresPerLine: 4 },
          paddingtop: 6,
          paddingbottom: 10,
          paddingleft: 16,
          paddingright: 16,
          clickListener: (clicked: unknown) => {
            const i = elements.indexOf(clicked as AbcElement)
            if (i >= 0 && tokens[i]) seek(tokens[i].start)
          },
        })
        elements.push(...drawnNotes(tunes[0] as unknown as AbcTune))
        // se a contagem não bater, é melhor não destacar nada do que destacar a nota errada
        drawn.current = elements.length === tokens.length ? { tokens, elements } : { tokens: [], elements: [] }
        setFailed(false)
      } catch (err) {
        console.error('Falha ao desenhar a partitura', err)
        if (!cancelled) setFailed(true)
      }
    }, 140)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [notes, key, scale, bpm, timeSignature, width, empty])

  // acende a nota sob o cursor enquanto toca
  useEffect(() => {
    let raf = 0
    let lit: Element[] = []
    let current = -1
    const frame = () => {
      const { tokens, elements } = drawn.current
      let index = -1
      if (useTransport.getState().playing && tokens.length > 0) {
        const at = getPlayhead()
        index = tokens.findIndex((t) => at >= t.start && at < t.end)
        if (index >= 0 && tokens[index].rest) index = -1
      }
      const next = index >= 0 ? (elements[index]?.abselem?.elemset ?? []) : []
      if (index !== current || next[0] !== lit[0]) {
        for (const el of lit) el.classList.remove('score-on')
        for (const el of next) el.classList.add('score-on')
        if (next[0] && index !== current) next[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        lit = next
        current = index
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <section aria-label="Partitura" className="h-[176px] shrink-0 overflow-x-hidden overflow-y-auto border-t border-line bg-ground">
      {empty && (
        <p className="px-5 py-6 text-[13px] text-ink-dim">
          A partitura aparece aqui assim que a melodia tiver a primeira nota. Depois, clicar numa nota da pauta leva o cursor até ela.
        </p>
      )}
      {failed && <p className="px-5 py-6 text-[13px] text-felt-text">Não deu para desenhar a partitura. Recarregue a página e tente de novo.</p>}
      <div ref={host} className={`score ${empty || failed ? 'hidden' : ''}`} />
    </section>
  )
}

export function ScorePanel() {
  const open = useView((s) => s.scoreOpen)
  return open ? <ScoreView /> : null
}
