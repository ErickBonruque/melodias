import { GRID_OPTIONS } from '../music/time'
import type { GridValue } from '../music/types'
import { zoomX, zoomY } from '../store/commands'
import { useDoc } from '../store/doc'
import { useView } from '../store/view'
import { GridSnapIcon, MinusIcon, PencilIcon, PlusIcon, PointerIcon, RedoIcon, ScaleSnapIcon, UndoIcon } from './icons'

export function EditBar() {
  const { tool, grid, snapGrid, snapScale, set } = useView()
  const canUndo = useDoc((s) => s.past.length > 0)
  const canRedo = useDoc((s) => s.future.length > 0)

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line bg-panel px-2">
      <button className="tool" aria-pressed={tool === 'pencil'} title="Lápis (1)" aria-label="Lápis" onClick={() => set({ tool: 'pencil' })}>
        <PencilIcon />
      </button>
      <button className="tool" aria-pressed={tool === 'select'} title="Seleção (2)" aria-label="Seleção" onClick={() => set({ tool: 'select' })}>
        <PointerIcon />
      </button>

      <div className="divider" />

      <label className="flex items-center gap-2 pl-1 text-[13px] text-ink-dim">
        Grade
        <select className="field h-7 text-ink" value={grid} onChange={(e) => set({ grid: e.target.value as GridValue })}>
          {GRID_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <button
        className="tool"
        aria-pressed={snapGrid}
        title="Grudar na grade ao criar e mover"
        aria-label="Grudar na grade"
        onClick={() => set({ snapGrid: !snapGrid })}
      >
        <GridSnapIcon />
      </button>
      <button
        className="tool"
        aria-pressed={snapScale}
        title="Grudar nas notas da escala"
        aria-label="Grudar na escala"
        onClick={() => set({ snapScale: !snapScale })}
      >
        <ScaleSnapIcon />
      </button>

      <div className="divider" />

      <button className="tool" disabled={!canUndo} title="Desfazer (Ctrl+Z)" aria-label="Desfazer" onClick={() => useDoc.getState().undo()}>
        <UndoIcon />
      </button>
      <button className="tool" disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer" onClick={() => useDoc.getState().redo()}>
        <RedoIcon />
      </button>

      <div className="ml-auto flex items-center gap-1 text-[13px] text-ink-dim">
        <span className="pr-1">Largura</span>
        <button className="tool" title="Menos zoom horizontal (−)" aria-label="Menos zoom horizontal" onClick={() => zoomX(0.8)}>
          <MinusIcon />
        </button>
        <button className="tool" title="Mais zoom horizontal (+)" aria-label="Mais zoom horizontal" onClick={() => zoomX(1.25)}>
          <PlusIcon />
        </button>
        <span className="pr-1 pl-3">Altura</span>
        <button className="tool" title="Menos zoom vertical (Alt + roda)" aria-label="Menos zoom vertical" onClick={() => zoomY(0.85)}>
          <MinusIcon />
        </button>
        <button className="tool" title="Mais zoom vertical (Alt + roda)" aria-label="Mais zoom vertical" onClick={() => zoomY(1.18)}>
          <PlusIcon />
        </button>
      </div>
    </div>
  )
}
