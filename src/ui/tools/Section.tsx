import type { ReactNode } from 'react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-4">
      <h2 className="mb-3 text-[13px] font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}

/** Par de botões menos/mais com a legenda no meio. */
export function Stepper({ label, onDown, onUp }: { label: string; onDown: () => void; onUp: () => void }) {
  return (
    <div className="flex h-[30px] items-center rounded-md border border-line text-[13px]">
      <button className="h-full w-8 rounded-l-md hover:bg-raised" aria-label={`${label}: descer`} onClick={onDown}>
        −
      </button>
      <span className="flex-1 text-center text-ink-dim">{label}</span>
      <button className="h-full w-8 rounded-r-md hover:bg-raised" aria-label={`${label}: subir`} onClick={onUp}>
        +
      </button>
    </div>
  )
}
