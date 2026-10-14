import { MAX_PITCH, MIN_PITCH } from '../../music/notes'
import { chromaOf, degreeOf, pitchLabel, type ScaleInfo } from '../../music/scale'
import { ticksPerBar, ticksPerBeat } from '../../music/time'
import type { Note, TimeSignature } from '../../music/types'
import { Coords, KEYS_W, RULER_H, contentHeight, isBlackKey } from './coords'
import type { Palette } from './palette'

export type Scene = {
  notes: Note[]
  selection: ReadonlySet<string>
  scale: ScaleInfo
  timeSignature: TimeSignature
  gridStep: number
  playhead: number
  playing: boolean
  recording: boolean
  loop: { on: boolean; start: number; end: number }
  hoverNoteId: string | null
  hoverKey: number | null
  /** Prévia da nota que o lápis criaria ali. */
  ghost: { tick: number; pitch: number; duration: number } | null
  /** Retângulo de seleção: ticks na horizontal, pixels de conteúdo na vertical. */
  rect: { t0: number; t1: number; cy0: number; cy1: number } | null
  /** Teclas acesas: notas sob o cursor de reprodução e notas tocadas ao vivo. */
  lit: ReadonlySet<number>
  /** Notas que acabaram de disparar, com intensidade de 1 (agora) a 0. */
  flashes: ReadonlyMap<string, number>
  /** Texto de cada nota quando o rótulo não é o nome (grau ou intervalo). */
  labels: ReadonlyMap<string, string> | null
  /** Largura total rolável, em ticks. */
  contentTicks: number
}

const FONT = "'Schibsted Grotesk Variable', system-ui, sans-serif"

export function draw(ctx: CanvasRenderingContext2D, c: Coords, s: Scene, pal: Palette): void {
  ctx.clearRect(0, 0, c.width, c.height)
  drawGrid(ctx, c, s, pal)
  drawRuler(ctx, c, s, pal)
  drawKeys(ctx, c, s, pal)

  // canto entre a régua e o teclado
  ctx.fillStyle = pal.rollRuler
  ctx.fillRect(0, 0, KEYS_W, RULER_H)
  ctx.fillStyle = pal.rollBeat
  ctx.fillRect(0, RULER_H - 1, c.width, 1)
  ctx.fillRect(KEYS_W - 1, 0, 1, RULER_H)
}

function visiblePitches(c: Coords): [number, number] {
  return [Math.max(MIN_PITCH, c.pitchOfY(c.height)), Math.min(MAX_PITCH, c.pitchOfY(RULER_H))]
}

function noteColor(pitch: number, scale: ScaleInfo, pal: Palette): string {
  const d = degreeOf(pitch, scale)
  return d == null ? pal.degOut : (pal.deg[d] ?? pal.degOut)
}

function noteRect(c: Coords, start: number, duration: number, pitch: number) {
  const x = c.xOfTick(start) + 0.5
  const y = c.yOfPitch(pitch) + 1
  const w = Math.max(3, duration * c.pxPerTick - 1)
  const h = c.rowH - 2
  return { x, y, w, h, r: Math.min(3, h / 2, w / 2) }
}

function drawGrid(ctx: CanvasRenderingContext2D, c: Coords, s: Scene, pal: Palette): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(KEYS_W, RULER_H, c.gridW, c.gridH)
  ctx.clip()

  ctx.fillStyle = pal.rollOut
  ctx.fillRect(KEYS_W, RULER_H, c.gridW, c.gridH)

  // linhas de altura: dentro da escala, tônica, ou esmaecida quando fora
  const [low, high] = visiblePitches(c)
  for (let p = low; p <= high; p++) {
    const d = degreeOf(p, s.scale)
    if (d == null) continue
    ctx.fillStyle = d === 1 ? pal.rollTonic : pal.rollIn
    ctx.fillRect(KEYS_W, c.yOfPitch(p), c.gridW, c.rowH)
  }
  for (let p = low; p <= high; p++) {
    ctx.fillStyle = chromaOf(p) === 0 ? pal.rollOctave : pal.rollLine
    ctx.fillRect(KEYS_W, c.yOfPitch(p) + c.rowH - 1, c.gridW, 1)
  }

  // grade de tempo: subdivisão, tempo e compasso, cada uma só aparece se couber
  const bar = ticksPerBar(s.timeSignature)
  const beat = ticksPerBeat(s.timeSignature)
  const ppt = c.pxPerTick
  const t0 = Math.max(0, c.tickOfX(KEYS_W))
  const t1 = c.tickOfX(c.width)
  const vlines = (step: number, skip: number, color: string) => {
    ctx.fillStyle = color
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) {
      if (skip > 0 && t % skip === 0) continue
      ctx.fillRect(Math.round(c.xOfTick(t)), RULER_H, 1, c.gridH)
    }
  }
  if (s.gridStep * ppt >= 7 && s.gridStep < beat) vlines(s.gridStep, beat, pal.rollSub)
  if (beat * ppt >= 7) vlines(beat, bar, pal.rollBeat)
  vlines(bar, 0, pal.rollBar)

  // região de loop
  const looping = s.loop.on && s.loop.end > s.loop.start
  if (looping) {
    const x0 = c.xOfTick(s.loop.start)
    const x1 = c.xOfTick(s.loop.end)
    ctx.globalAlpha = 0.07
    ctx.fillStyle = pal.bronze
    ctx.fillRect(x0, RULER_H, x1 - x0, c.gridH)
    ctx.globalAlpha = 0.55
    ctx.fillRect(Math.round(x0), RULER_H, 1, c.gridH)
    ctx.fillRect(Math.round(x1), RULER_H, 1, c.gridH)
    ctx.globalAlpha = 1
  }

  // notas
  const labelSize = Math.min(11, c.rowH - 5)
  ctx.font = `600 ${labelSize}px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  for (const n of s.notes) {
    const { x, y, w, h, r } = noteRect(c, n.start, n.duration, n.pitch)
    if (x + w < KEYS_W || x > c.width || y + h < RULER_H || y > c.height) continue
    const inScale = degreeOf(n.pitch, s.scale) != null
    const active = s.playing && s.playhead >= n.start && s.playhead < n.start + n.duration

    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    ctx.globalAlpha = 0.45 + 0.55 * n.velocity
    ctx.fillStyle = noteColor(n.pitch, s.scale, pal)
    ctx.fill()
    ctx.globalAlpha = 1

    if (!inScale) {
      // fora da escala: cinza com hachura
      ctx.save()
      ctx.clip()
      ctx.strokeStyle = pal.rollOut
      ctx.globalAlpha = 0.34
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let hx = x - h; hx < x + w; hx += 6) {
        ctx.moveTo(hx, y + h)
        ctx.lineTo(hx + h, y)
      }
      ctx.stroke()
      ctx.restore()
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, r)
    }

    const glow = Math.max(active ? 0.3 : 0, (s.flashes.get(n.id) ?? 0) * 0.65, s.hoverNoteId === n.id ? 0.16 : 0)
    if (glow > 0) {
      ctx.fillStyle = `rgba(255,255,255,${glow})`
      ctx.fill()
    }

    if (s.selection.has(n.id)) {
      ctx.beginPath()
      ctx.roundRect(x + 0.75, y + 0.75, Math.max(1.5, w - 1.5), h - 1.5, Math.max(0, r - 0.75))
      ctx.strokeStyle = pal.noteSelected
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    if (w >= 14 && c.rowH >= 14) {
      const label = s.labels ? (s.labels.get(n.id) ?? '') : pitchLabel(n.pitch, s.scale)
      if (label && ctx.measureText(label).width <= w - 8) {
        ctx.fillStyle = pal.noteInk
        ctx.globalAlpha = 0.85
        ctx.fillText(label, x + 5, y + h / 2 + 0.5)
        ctx.globalAlpha = 1
      }
    }
  }

  // prévia do lápis
  if (s.ghost) {
    const { x, y, w, h, r } = noteRect(c, s.ghost.tick, s.ghost.duration, s.ghost.pitch)
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    ctx.globalAlpha = 0.32
    ctx.fillStyle = noteColor(s.ghost.pitch, s.scale, pal)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // retângulo de seleção
  if (s.rect) {
    const x0 = c.xOfTick(Math.min(s.rect.t0, s.rect.t1))
    const x1 = c.xOfTick(Math.max(s.rect.t0, s.rect.t1))
    const y0 = RULER_H + Math.min(s.rect.cy0, s.rect.cy1) - c.scrollY
    const y1 = RULER_H + Math.max(s.rect.cy0, s.rect.cy1) - c.scrollY
    ctx.fillStyle = pal.bronze
    ctx.globalAlpha = 0.12
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
    ctx.globalAlpha = 1
    ctx.strokeStyle = pal.bronze
    ctx.lineWidth = 1
    ctx.strokeRect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(x1 - x0), Math.round(y1 - y0))
  }

  // cursor de reprodução
  const px = c.xOfTick(s.playhead)
  if (px >= KEYS_W - 1 && px <= c.width) {
    ctx.fillStyle = s.recording ? pal.felt : pal.bronze
    ctx.fillRect(Math.round(px) - 0.75, RULER_H, 1.5, c.gridH)
  }

  // indicadores de rolagem
  ctx.fillStyle = pal.ink
  ctx.globalAlpha = 0.22
  const contentW = Math.max(c.gridW, s.contentTicks * ppt)
  if (contentW > c.gridW + 1) {
    const tw = Math.max(28, (c.gridW * c.gridW) / contentW)
    const tx = KEYS_W + (c.scrollX / (contentW - c.gridW)) * (c.gridW - tw)
    ctx.beginPath()
    ctx.roundRect(tx, c.height - 6, tw, 4, 2)
    ctx.fill()
  }
  const contentH = contentHeight(c.rowH)
  if (contentH > c.gridH + 1) {
    const th = Math.max(28, (c.gridH * c.gridH) / contentH)
    const ty = RULER_H + (c.scrollY / (contentH - c.gridH)) * (c.gridH - th)
    ctx.beginPath()
    ctx.roundRect(c.width - 6, ty, 4, th, 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  ctx.restore()
}

function drawRuler(ctx: CanvasRenderingContext2D, c: Coords, s: Scene, pal: Palette): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(KEYS_W, 0, c.gridW, RULER_H)
  ctx.clip()

  ctx.fillStyle = pal.rollRuler
  ctx.fillRect(KEYS_W, 0, c.gridW, RULER_H)

  if (s.loop.on && s.loop.end > s.loop.start) {
    const x0 = c.xOfTick(s.loop.start)
    const x1 = c.xOfTick(s.loop.end)
    ctx.fillStyle = pal.bronze
    ctx.globalAlpha = 0.26
    ctx.fillRect(x0, 0, x1 - x0, RULER_H)
    ctx.globalAlpha = 1
    ctx.fillRect(Math.round(x0), 0, 2, RULER_H)
    ctx.fillRect(Math.round(x1) - 2, 0, 2, RULER_H)
  }

  const bar = ticksPerBar(s.timeSignature)
  const beat = ticksPerBeat(s.timeSignature)
  const ppt = c.pxPerTick
  const t0 = Math.max(0, c.tickOfX(KEYS_W))
  const t1 = c.tickOfX(c.width)

  if (beat * ppt >= 10) {
    ctx.fillStyle = pal.rollBeat
    for (let t = Math.ceil(t0 / beat) * beat; t <= t1; t += beat) {
      if (t % bar !== 0) ctx.fillRect(Math.round(c.xOfTick(t)), RULER_H - 5, 1, 5)
    }
  }

  // numera um compasso a cada N, para os números não encavalarem
  let every = 1
  while (bar * every * ppt < 46) every *= 2
  ctx.font = `500 11px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  for (let t = Math.floor(t0 / bar) * bar; t <= t1; t += bar) {
    const index = t / bar
    const x = Math.round(c.xOfTick(t))
    ctx.fillStyle = pal.rollBar
    ctx.fillRect(x, index % every === 0 ? 6 : RULER_H - 9, 1, RULER_H)
    if (index % every === 0) {
      ctx.fillStyle = pal.inkDim
      ctx.fillText(String(index + 1), x + 6, 13)
    }
  }

  const px = c.xOfTick(s.playhead)
  ctx.fillStyle = s.recording ? pal.felt : pal.bronze
  ctx.beginPath()
  ctx.moveTo(px - 6, RULER_H - 11)
  ctx.lineTo(px + 6, RULER_H - 11)
  ctx.lineTo(px, RULER_H - 1)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

function drawKeys(ctx: CanvasRenderingContext2D, c: Coords, s: Scene, pal: Palette): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, RULER_H, KEYS_W, c.gridH)
  ctx.clip()

  ctx.fillStyle = pal.keyWhite
  ctx.fillRect(0, RULER_H, KEYS_W, c.gridH)

  const blackW = Math.round(KEYS_W * 0.58)
  const [low, high] = visiblePitches(c)
  const showLabels = c.rowH >= 12

  // abaixo da tecla mais grave não há teclado
  const floorY = c.yOfPitch(MIN_PITCH) + c.rowH
  if (floorY < c.height) {
    ctx.fillStyle = pal.rollRuler
    ctx.fillRect(0, floorY, KEYS_W, c.height - floorY)
  }

  for (let p = low; p <= high; p++) {
    const y = c.yOfPitch(p)
    const black = isBlackKey(p)
    const lit = s.lit.has(p)
    const color = noteColor(p, s.scale, pal)

    if (!black) {
      if (lit) {
        ctx.fillStyle = color
        ctx.fillRect(0, y, KEYS_W, c.rowH)
      } else if (s.hoverKey === p) {
        ctx.fillStyle = pal.keyWhiteEdge
        ctx.globalAlpha = 0.45
        ctx.fillRect(0, y, KEYS_W, c.rowH)
        ctx.globalAlpha = 1
      }
      // Mi/Fá e Si/Dó são vizinhas brancas: a divisa fica na borda da linha
      const chroma = chromaOf(p)
      if (chroma === 0 || chroma === 5) {
        ctx.fillStyle = pal.keyWhiteEdge
        ctx.fillRect(0, y + c.rowH - 1, KEYS_W, 1)
      }
    } else {
      // a divisa entre as brancas vizinhas passa pelo meio da linha da preta
      ctx.fillStyle = pal.keyWhiteEdge
      ctx.fillRect(blackW, Math.round(y + c.rowH / 2), KEYS_W - blackW, 1)
      ctx.fillStyle = lit ? color : pal.keyBlack
      ctx.beginPath()
      ctx.roundRect(0, y + 0.5, blackW, c.rowH - 1, [0, 3, 3, 0])
      ctx.fill()
      if (!lit && s.hoverKey === p) {
        ctx.fillStyle = 'rgba(255,255,255,0.14)'
        ctx.fill()
      }
    }
  }

  // marca de cada grau na borda do teclado: é a legenda das cores das notas
  ctx.font = `500 10px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  for (let p = low; p <= high; p++) {
    const d = degreeOf(p, s.scale)
    const cy = c.yOfPitch(p) + c.rowH / 2
    if (d != null && !s.lit.has(p)) {
      ctx.fillStyle = pal.deg[d] ?? pal.degOut
      ctx.beginPath()
      ctx.arc(KEYS_W - 9, cy, d === 1 ? 3.5 : 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
    if (showLabels && chromaOf(p) === 0) {
      ctx.fillStyle = s.lit.has(p) ? pal.noteInk : pal.keyInk
      ctx.fillText(pitchLabel(p, s.scale), KEYS_W - 17, cy + 0.5)
    }
  }

  ctx.fillStyle = pal.keyWhiteEdge
  ctx.fillRect(KEYS_W - 1, RULER_H, 1, c.gridH)
  ctx.restore()
}
