import { useMemo, useState } from 'react'
import { degreeOf, getScale, scaleLabel } from '../music/scale'
import type { Melody } from '../music/types'
import { useDoc } from '../store/doc'
import { deleteMelody, duplicateMelody, newMelody, openMelody, renameMelody, useLibrary } from '../store/library'
import { useView } from '../store/view'
import { CloseIcon, CopyIcon, PlusIcon, RenameIcon, SearchIcon, TrashIcon } from './icons'

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto', style: 'short' })

function timeAgo(at: number): string {
  const minutes = Math.round((at - Date.now()) / 60000)
  if (minutes > -1) return 'agora'
  if (minutes > -60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours > -24) return relative.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (days > -30) return relative.format(days, 'day')
  return new Date(at).toLocaleDateString('pt-BR')
}

/** Miniatura do desenho da melodia, com as cores dos graus. */
function Contour({ melody }: { melody: Melody }) {
  const { notes } = melody
  if (notes.length === 0) return <div className="h-7" />
  const scale = getScale(melody.key, melody.scale)
  const end = Math.max(...notes.map((n) => n.start + n.duration))
  const low = Math.min(...notes.map((n) => n.pitch))
  const high = Math.max(...notes.map((n) => n.pitch))
  const rows = Math.max(8, high - low + 1)
  const rowH = 28 / rows
  return (
    <svg viewBox={`0 0 ${end} 28`} preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      {notes.map((n) => {
        const d = degreeOf(n.pitch, scale)
        return (
          <rect
            key={n.id}
            x={n.start}
            y={(high - n.pitch) * rowH + (28 - (high - low + 1) * rowH) / 2}
            width={Math.max(end / 120, n.duration * 0.92)}
            height={Math.max(1.5, rowH - 0.5)}
            rx={end / 400}
            fill={d ? `var(--deg-${d})` : 'var(--deg-out)'}
          />
        )
      })}
    </svg>
  )
}

function TagEditor({ tags }: { tags: string[] }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const tag = draft.trim().toLowerCase()
    if (tag && !tags.includes(tag)) useDoc.getState().setMeta({ tags: [...tags, tag] })
    setDraft('')
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-0.5 rounded-full bg-raised py-0.5 pr-1 pl-2.5 text-[12px]">
          {tag}
          <button
            className="rounded-full p-0.5 text-ink-dim hover:text-ink"
            aria-label={`Tirar a tag ${tag}`}
            onClick={() => useDoc.getState().setMeta({ tags: tags.filter((t) => t !== tag) })}
          >
            <CloseIcon />
          </button>
        </span>
      ))}
      <input
        aria-label="Nova tag"
        className="h-6 w-[92px] rounded-full border border-dashed border-line bg-transparent px-2.5 text-[12px] outline-none placeholder:text-ink-dim focus:border-bronze"
        placeholder="nova tag"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          }
        }}
      />
    </div>
  )
}

function Item({ melody, active, onTag }: { melody: Melody; active: boolean; onTag: (tag: string) => void }) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const finishRename = () => {
    if (renaming != null && renaming !== melody.title) void renameMelody(melody.id, renaming.trim())
    setRenaming(null)
  }

  return (
    <li
      className={`group relative cursor-pointer border-b border-line px-3 py-2.5 ${
        active ? 'bg-raised shadow-[inset_3px_0_0_var(--bronze)]' : 'hover:bg-raised/50'
      }`}
      onClick={() => void openMelody(melody.id)}
    >
      <div className="flex items-baseline gap-2">
        {renaming != null ? (
          <input
            autoFocus
            aria-label="Novo título"
            className="field h-7 flex-1 font-score text-[16px] italic"
            value={renaming}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRenaming(e.target.value)}
            onBlur={finishRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finishRename()
              if (e.key === 'Escape') setRenaming(null)
            }}
          />
        ) : (
          <button
            className={`min-w-0 flex-1 truncate text-left font-score text-[17px] italic ${melody.title ? '' : 'text-ink-dim'}`}
            onClick={(e) => {
              e.stopPropagation()
              void openMelody(melody.id)
            }}
          >
            {melody.title || 'Sem título'}
          </button>
        )}
        <span className="shrink-0 text-[11px] text-ink-dim">{timeAgo(melody.updatedAt)}</span>
      </div>

      <div className="mt-1.5 opacity-90">
        <Contour melody={melody} />
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-dim">
        <span className="truncate">
          {scaleLabel(melody.key, melody.scale)}, {melody.bpm} bpm
        </span>
        <span className="ml-auto flex shrink-0 gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <button
            className="rounded p-1 hover:bg-line hover:text-ink"
            title="Renomear"
            aria-label={`Renomear ${melody.title || 'melodia sem título'}`}
            onClick={(e) => {
              e.stopPropagation()
              setRenaming(melody.title)
            }}
          >
            <RenameIcon />
          </button>
          <button
            className="rounded p-1 hover:bg-line hover:text-ink"
            title="Duplicar"
            aria-label={`Duplicar ${melody.title || 'melodia sem título'}`}
            onClick={(e) => {
              e.stopPropagation()
              void duplicateMelody(melody.id)
            }}
          >
            <CopyIcon />
          </button>
          <button
            className="rounded p-1 hover:bg-line hover:text-felt-text"
            title="Apagar"
            aria-label={`Apagar ${melody.title || 'melodia sem título'}`}
            onClick={(e) => {
              e.stopPropagation()
              setConfirming(true)
            }}
          >
            <TrashIcon />
          </button>
        </span>
      </div>

      {active ? (
        <TagEditor tags={melody.tags} />
      ) : (
        melody.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {melody.tags.map((tag) => (
              <button
                key={tag}
                className="rounded-full bg-raised px-2.5 py-0.5 text-[12px] text-ink-dim hover:text-ink"
                title={`Ver só melodias com a tag ${tag}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onTag(tag)
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )
      )}

      {confirming && (
        <div
          className="absolute inset-0 flex items-center justify-center gap-2 bg-panel/95 px-3 text-[13px]"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="mr-1">Apagar de vez?</span>
          <button className="btn h-7 border-felt bg-felt px-2.5 text-white" onClick={() => void deleteMelody(melody.id)}>
            Apagar
          </button>
          <button className="btn h-7 px-2.5" onClick={() => setConfirming(false)}>
            Manter
          </button>
        </div>
      )}
    </li>
  )
}

export function LibraryPanel() {
  const open = useView((s) => s.libraryOpen)
  const items = useLibrary((s) => s.items)
  const ready = useLibrary((s) => s.ready)
  const current = useDoc((s) => s.melody)
  const [query, setQuery] = useState('')

  // a melodia aberta aparece com o estado de agora, não com o último salvo
  const list = useMemo(() => {
    const merged = items.map((m) => (m.id === current.id ? current : m))
    const q = query.trim().toLowerCase()
    if (!q) return merged
    return merged.filter((m) => m.title.toLowerCase().includes(q) || m.tags.some((t) => t.includes(q)))
  }, [items, current, query])

  return (
    <aside
      aria-label="Biblioteca"
      className={`shrink-0 overflow-hidden border-line bg-panel transition-[width] duration-150 ${open ? 'w-[264px] border-r' : 'w-0'}`}
      inert={!open}
    >
      <div className="flex h-full w-[264px] flex-col">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <h2 className="text-[13px] font-semibold">Biblioteca</h2>
          <button className="btn h-7 px-2.5 text-[13px]" onClick={() => void newMelody()}>
            <PlusIcon />
            Nova melodia
          </button>
        </div>

        <div className="relative px-3 pb-3">
          <span className="pointer-events-none absolute top-[7px] left-[22px] text-ink-dim">
            <SearchIcon />
          </span>
          <input
            type="search"
            aria-label="Buscar na biblioteca"
            className="field w-full pl-8"
            placeholder="Buscar por título ou tag"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {list.length > 0 ? (
          <ul className="min-h-0 flex-1 overflow-y-auto border-t border-line">
            {list.map((m) => (
              <Item key={m.id} melody={m} active={m.id === current.id} onTag={setQuery} />
            ))}
          </ul>
        ) : (
          <div className="border-t border-line px-4 py-6 text-[13px] text-ink-dim">
            {!ready ? (
              <p>Abrindo a biblioteca…</p>
            ) : query.trim() ? (
              <>
                <p>Nenhuma melodia com “{query.trim()}” no título ou nas tags.</p>
                <button className="btn mt-3 h-7 px-2.5" onClick={() => setQuery('')}>
                  Limpar a busca
                </button>
              </>
            ) : (
              <p>
                Nada guardado ainda. Assim que a melodia ganhar a primeira nota ou um título, ela aparece aqui e passa a
                ser salva sozinha a cada mudança.
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
