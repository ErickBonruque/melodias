import { useEffect, useRef } from 'react'
import { useView } from '../store/view'
import { CloseIcon } from './icons'
import { SHORTCUT_GROUPS } from './shortcuts'

const byTitle = (...titles: string[]) => SHORTCUT_GROUPS.filter((g) => titles.includes(g.title))
const LEFT = byTitle('Tocar', 'Teclado musical', 'Ver')
const COLUMNS = [LEFT, SHORTCUT_GROUPS.filter((g) => !LEFT.includes(g))]

export function ShortcutsDialog() {
  const open = useView((s) => s.helpOpen)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="atalhos-titulo"
      className="m-auto max-h-[86vh] w-[min(920px,92vw)] overflow-hidden rounded-xl border border-line bg-panel p-0 text-ink shadow-2xl backdrop:bg-black/55"
      onClose={() => useView.getState().set({ helpOpen: false })}
      onClick={(e) => {
        if (e.target === ref.current) useView.getState().set({ helpOpen: false })
      }}
    >
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 id="atalhos-titulo" className="font-score text-[24px] italic">
          Atalhos de teclado
        </h2>
        <button className="tool" aria-label="Fechar" onClick={() => useView.getState().set({ helpOpen: false })}>
          <CloseIcon />
        </button>
      </div>
      <div className="grid max-h-[calc(86vh-70px)] gap-x-10 overflow-y-auto px-6 py-5 md:grid-cols-2">
        {COLUMNS.map((column, i) => (
          <div key={i}>
            {column.map((group) => (
              <section key={group.title} className="mb-6">
                <h3 className="mb-2 text-[13px] font-semibold text-bronze">{group.title}</h3>
                <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5">
                  {group.items.map((item) => (
                    <div key={item.label + item.keys.join()} className="contents">
                      <dt className="flex flex-wrap gap-1">
                        {item.keys.map((k) => (
                          <kbd key={k}>{k}</kbd>
                        ))}
                      </dt>
                      <dd className="text-[13px] text-ink-dim">{item.label}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        ))}
      </div>
    </dialog>
  )
}
