import { useEffect, useRef, useState } from 'react'
import { scaleLabel } from '../music/scale'
import { positionOf } from '../music/time'
import type { TimeSignature } from '../music/types'
import { getPlayhead, stop, toggleLoop, toggleMetronome, togglePlay } from '../store/commands'
import { useDoc } from '../store/doc'
import { useLibrary } from '../store/library'
import { useTransport } from '../store/transport'
import { useView } from '../store/view'
import {
  HelpIcon,
  LibraryIcon,
  LoopIcon,
  MetronomeIcon,
  MoonIcon,
  PauseIcon,
  PlayIcon,
  QuarterNoteIcon,
  StopIcon,
  SunIcon,
  ToolsPanelIcon,
} from './icons'

const TIME_SIGNATURES: TimeSignature[] = [
  [2, 4],
  [3, 4],
  [4, 4],
  [5, 4],
  [6, 8],
  [7, 8],
  [12, 8],
]

const BPM_MIN = 30
const BPM_MAX = 300

function setBpm(value: number): void {
  const bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(value)))
  const d = useDoc.getState()
  if (bpm !== d.melody.bpm) d.edit({ bpm }, { coalesce: 'bpm' })
}

/** Andamento escrito como numa partitura. Dá para digitar, arrastar a figura ou usar a roda do mouse. */
function TempoField() {
  const bpm = useDoc((s) => s.melody.bpm)
  const [draft, setDraft] = useState<string | null>(null)
  const drag = useRef<{ y: number; bpm: number } | null>(null)

  const commit = () => {
    if (draft != null && draft.trim() !== '' && !Number.isNaN(Number(draft))) setBpm(Number(draft))
    setDraft(null)
  }

  return (
    <div
      className="flex h-8 items-center gap-1.5 rounded-md px-2 font-score text-[19px] italic hover:bg-raised"
      onWheel={(e) => setBpm(bpm - Math.sign(e.deltaY))}
    >
      <span
        className="flex cursor-ns-resize items-center gap-1.5 text-ink-dim"
        title="Arraste para cima ou para baixo para mudar o andamento"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { y: e.clientY, bpm }
        }}
        onPointerMove={(e) => {
          if (drag.current) setBpm(drag.current.bpm + (drag.current.y - e.clientY) / 3)
        }}
        onPointerUp={() => (drag.current = null)}
      >
        <QuarterNoteIcon />
        <span>=</span>
      </span>
      <input
        aria-label="Andamento, em batidas por minuto"
        className="w-[3.2ch] bg-transparent text-ink italic tabular-nums outline-none"
        inputMode="numeric"
        value={draft ?? String(bpm)}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'ArrowUp') setBpm(bpm + 1)
          if (e.key === 'ArrowDown') setBpm(bpm - 1)
        }}
      />
    </div>
  )
}

/** Compasso, tempo e semicolcheia do cursor. Atualiza direto no DOM, sem renderizar o React a cada quadro. */
function PositionReadout() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let raf = 0
    let last = ''
    const tick = () => {
      const p = positionOf(getPlayhead(), useDoc.getState().melody.timeSignature)
      const text = `${p.bar}.${p.beat}.${p.sixteenth}`
      const cells = ref.current?.querySelectorAll('b')
      if (text !== last && cells?.length === 3) {
        last = text
        cells[0].textContent = String(p.bar)
        cells[1].textContent = String(p.beat)
        cells[2].textContent = String(p.sixteenth)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <span
      ref={ref}
      className="flex w-[64px] items-baseline justify-center gap-px text-[15px] text-ink-dim"
      title="Compasso, tempo e semicolcheia do cursor"
    >
      <b className="min-w-[2ch] text-right font-medium text-ink tabular-nums">1</b>.
      <b className="font-medium text-ink tabular-nums">1</b>.<b className="font-medium text-ink tabular-nums">1</b>
    </span>
  )
}

function SaveStatus() {
  const status = useLibrary((s) => s.status)
  const loading = useTransport((s) => s.loadingInstrument)
  if (loading) return <span className="text-[12px] text-ink-dim">Carregando {loading.toLowerCase()}…</span>
  if (status === 'error') return <span className="text-[12px] text-felt-text">Não deu para salvar</span>
  if (status === 'pending') return <span className="text-[12px] text-ink-dim">Salvando…</span>
  if (status === 'saved') return <span className="text-[12px] text-ink-dim">Salvo</span>
  return null
}

export function TransportBar() {
  const title = useDoc((s) => s.melody.title)
  const timeSignature = useDoc((s) => s.melody.timeSignature)
  const key = useDoc((s) => s.melody.key)
  const scale = useDoc((s) => s.melody.scale)
  const playing = useTransport((s) => s.playing)
  const loopOn = useTransport((s) => s.loop.on)
  const metronome = useTransport((s) => s.metronome)
  const { theme, libraryOpen, toolsOpen, set } = useView()

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-1 border-b border-line bg-panel px-2">
      <button
        className="tool"
        aria-pressed={libraryOpen}
        title="Biblioteca ( [ )"
        aria-label="Mostrar ou esconder a biblioteca"
        onClick={() => set({ libraryOpen: !libraryOpen })}
      >
        <LibraryIcon />
      </button>

      <input
        aria-label="Título da melodia"
        className="ml-1 h-9 min-w-0 flex-1 basis-40 rounded-md bg-transparent px-2 font-score text-[21px] text-ink italic outline-none placeholder:text-ink-dim hover:bg-raised focus:bg-ground"
        placeholder="Melodia sem título"
        value={title}
        onChange={(e) => useDoc.getState().setMeta({ title: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />

      <div className="flex items-center gap-1">
        <button className="tool" title="Parar (Enter)" aria-label="Parar" onClick={stop}>
          <StopIcon />
        </button>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full bg-bronze text-bronze-ink transition-transform hover:brightness-110 active:scale-95"
          title={playing ? 'Pausar (Espaço)' : 'Tocar (Espaço)'}
          aria-label={playing ? 'Pausar' : 'Tocar'}
          onClick={togglePlay}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button className="tool" aria-pressed={loopOn} title="Loop (C)" aria-label="Loop" onClick={toggleLoop}>
          <LoopIcon />
        </button>
        <button className="tool" aria-pressed={metronome} title="Metrônomo (M)" aria-label="Metrônomo" onClick={toggleMetronome}>
          <MetronomeIcon />
        </button>
        <div className="divider" />
        <PositionReadout />
        <TempoField />
        <select
          aria-label="Fórmula de compasso"
          title="Fórmula de compasso"
          className="h-8 cursor-pointer rounded-md bg-transparent px-1 font-score text-[18px] font-semibold text-ink hover:bg-raised"
          value={timeSignature.join('/')}
          onChange={(e) => {
            const [n, d] = e.target.value.split('/').map(Number)
            useDoc.getState().edit({ timeSignature: [n, d] })
          }}
        >
          {TIME_SIGNATURES.map((ts) => (
            <option key={ts.join('/')} value={ts.join('/')}>
              {ts.join('/')}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-0 flex-1 basis-40 items-center justify-end gap-1">
        <span className="mr-2 truncate">
          <SaveStatus />
        </span>
        <button
          className="tool shrink-0 px-2.5 font-score text-[17px] italic text-ink"
          title="Tonalidade e escala"
          onClick={() => set({ toolsOpen: true })}
        >
          {scaleLabel(key, scale)}
        </button>
        <button
          className="tool"
          title={theme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
          aria-label="Alternar tema claro e escuro"
          onClick={() => set({ theme: theme === 'dark' ? 'light' : 'dark' })}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <button className="tool" title="Atalhos de teclado (?)" aria-label="Atalhos de teclado" onClick={() => set({ helpOpen: true })}>
          <HelpIcon />
        </button>
        <button
          className="tool"
          aria-pressed={toolsOpen}
          title="Ferramentas ( ] )"
          aria-label="Mostrar ou esconder as ferramentas"
          onClick={() => set({ toolsOpen: !toolsOpen })}
        >
          <ToolsPanelIcon />
        </button>
      </div>
    </header>
  )
}
