import type { ReactNode } from 'react'
import { useView, type ToolsTab } from '../store/view'
import { NotesTab } from './tools/NotesTab'
import { SoundTab } from './tools/SoundTab'

const TABS: { id: ToolsTab; label: string; render: () => ReactNode }[] = [
  { id: 'notes', label: 'Notas', render: () => <NotesTab /> },
  { id: 'sound', label: 'Som', render: () => <SoundTab /> },
]

export function ToolsPanel() {
  const open = useView((s) => s.toolsOpen)
  const tab = useView((s) => s.toolsTab)
  const current = TABS.find((t) => t.id === tab) ?? TABS[0]

  return (
    <aside
      aria-label="Ferramentas"
      className={`shrink-0 overflow-hidden border-line bg-panel transition-[width] duration-150 ${open ? 'w-[280px] border-l' : 'w-0'}`}
      inert={!open}
    >
      <div className="flex h-full w-[280px] flex-col">
        <div role="tablist" aria-label="Ferramentas" className="flex shrink-0 border-b border-line px-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === current.id}
              className={`-mb-px h-10 flex-1 border-b-2 text-[13px] font-medium transition-colors ${
                t.id === current.id ? 'border-bronze text-ink' : 'border-transparent text-ink-dim hover:text-ink'
              }`}
              onClick={() => useView.getState().set({ toolsTab: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto">
          {current.render()}
        </div>
      </div>
    </aside>
  )
}
