import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Contour } from '../music/generate'
import { PPQ, type GridValue } from '../music/types'

export type Tool = 'pencil' | 'select'
export type Theme = 'dark' | 'light'
export type ToolsTab = 'notes' | 'create' | 'harmony' | 'sound'

export const ZOOM_X = { min: 24, max: 480, default: 96 } // pixels por semínima
export const ZOOM_Y = { min: 10, max: 34, default: 18 } // pixels por semitom

type ViewState = {
  theme: Theme
  tool: Tool
  grid: GridValue
  snapGrid: boolean
  snapScale: boolean
  pxPerBeat: number
  rowH: number
  /** Duração (em ticks) da próxima nota criada com o lápis: a última que foi usada. */
  lastDuration: number
  /** Oitava em que o teclado do computador toca (4 = a tecla A é o Dó4). */
  kbOctave: number
  /** Compassos de contagem antes de gravar. */
  countInBars: number
  /** Ao terminar de gravar, puxa as notas para a grade com esta força (0 a 1). */
  recQuantize: boolean
  recStrength: number
  /** Controles do gerador de ideias. */
  idea: { contour: Contour; bars: number; density: number; leap: number; rest: number; autoPlay: boolean }
  libraryOpen: boolean
  toolsOpen: boolean
  toolsTab: ToolsTab
  helpOpen: boolean
  set: (patch: Partial<Omit<ViewState, 'set'>>) => void
}

export const useView = create<ViewState>()(
  persist(
    (set) => ({
      theme: 'dark',
      tool: 'pencil',
      grid: '1/16',
      snapGrid: true,
      snapScale: true,
      pxPerBeat: ZOOM_X.default,
      rowH: ZOOM_Y.default,
      lastDuration: PPQ / 2,
      kbOctave: 4,
      countInBars: 1,
      recQuantize: true,
      recStrength: 1,
      idea: { contour: 'arch', bars: 2, density: 0.5, leap: 2, rest: 1, autoPlay: true },
      libraryOpen: true,
      toolsOpen: true,
      toolsTab: 'notes',
      helpOpen: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'melodias:view',
      partialize: ({ set: _set, helpOpen: _help, ...rest }) => rest,
    },
  ),
)

useView.subscribe((s) => {
  document.documentElement.dataset.theme = s.theme
})
