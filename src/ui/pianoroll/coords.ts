import { MAX_PITCH, MIN_PITCH } from '../../music/notes'
import { PPQ } from '../../music/types'

export const KEYS_W = 72
export const RULER_H = 30
/** Altura da faixa de cifras, que aparece no topo da grade quando a melodia tem acordes. */
export const CHORDS_H = 22

export type Region = 'corner' | 'ruler' | 'keys' | 'grid'

/**
 * Conversão entre pixels do canvas e posição musical (tick, altura).
 * Desenho e gestos passam sempre por aqui, nunca fazem a conta por conta própria.
 */
export class Coords {
  constructor(
    readonly width: number,
    readonly height: number,
    readonly pxPerBeat: number,
    readonly rowH: number,
    readonly scrollX: number,
    readonly scrollY: number,
  ) {}

  get pxPerTick(): number {
    return this.pxPerBeat / PPQ
  }

  get gridW(): number {
    return Math.max(0, this.width - KEYS_W)
  }

  get gridH(): number {
    return Math.max(0, this.height - RULER_H)
  }

  xOfTick(tick: number): number {
    return KEYS_W + tick * this.pxPerTick - this.scrollX
  }

  tickOfX(x: number): number {
    return (x - KEYS_W + this.scrollX) / this.pxPerTick
  }

  /** Topo da linha daquela altura. */
  yOfPitch(pitch: number): number {
    return RULER_H + (MAX_PITCH - pitch) * this.rowH - this.scrollY
  }

  pitchOfY(y: number): number {
    return MAX_PITCH - Math.floor((y - RULER_H + this.scrollY) / this.rowH)
  }

  region(x: number, y: number): Region {
    if (y < RULER_H) return x < KEYS_W ? 'corner' : 'ruler'
    return x < KEYS_W ? 'keys' : 'grid'
  }
}

export function contentHeight(rowH: number): number {
  return (MAX_PITCH - MIN_PITCH + 1) * rowH
}

const BLACK = [false, true, false, true, false, false, true, false, true, false, true, false]

export function isBlackKey(pitch: number): boolean {
  return BLACK[((pitch % 12) + 12) % 12]
}
