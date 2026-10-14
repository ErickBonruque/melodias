import { engine } from '../../audio/engine'
import {
  MAX_PITCH,
  MIN_PITCH,
  clampPitch,
  cloneNotesAt,
  createNote,
  moveNotes,
  noteAt,
  notesEnd,
  notesInRect,
  removeNotes,
  resizeNotes,
} from '../../music/notes'
import {
  degreeLabel,
  getScale,
  isInScale,
  pitchLabel,
  scaleStepsBetween,
  shiftDiatonic,
  snapToScale,
  type ScaleInfo,
} from '../../music/scale'
import { GRID_TICKS, snapTick, ticksPerBar } from '../../music/time'
import type { Note } from '../../music/types'
import { getPlayhead, seek } from '../../store/commands'
import { useDoc } from '../../store/doc'
import { useTransport, type LoopRegion } from '../../store/transport'
import { ZOOM_X, ZOOM_Y, useView } from '../../store/view'
import { Coords, KEYS_W, RULER_H, contentHeight } from './coords'
import { readPalette, type Palette } from './palette'
import { draw, type Scene } from './render'

type Drag =
  | { kind: 'pan'; x: number; y: number; sx: number; sy: number }
  | { kind: 'keys'; pitch: number | null }
  | { kind: 'ruler'; downTick: number; downX: number; moved: boolean }
  | { kind: 'loop-edge'; edge: 'start' | 'end' }
  | {
      kind: 'move'
      base: Note[]
      ids: Set<string>
      anchor: Note
      downTick: number
      downPitch: number
      lastPitch: number
      moved: boolean
      collapseTo: string | null
    }
  | {
      kind: 'resize'
      edge: 'left' | 'right'
      base: Note[]
      ids: Set<string>
      anchor: Note
      downTick: number
      downX: number
      creating: boolean
      moved: boolean
    }
  | { kind: 'rect'; t0: number; cy0: number; baseSel: string[]; downX: number; downY: number; moved: boolean }
  | { kind: 'erase' }

/** `free`: Ctrl ou Cmd pressionado, que deixa a nota sair da escala. */
type Pointer = { x: number; y: number; shift: boolean; free: boolean }

const DRAG_THRESHOLD = 4
const FLASH_MS = 280

/**
 * Dono do canvas do piano roll: lê os stores, desenha a cada quadro em que algo
 * mudou e traduz ponteiro e roda do mouse em edições. Fica fora do React de
 * propósito, para arrastar e rolar não dispararem renderizações.
 */
export class PianoRollController {
  private ctx: CanvasRenderingContext2D
  private pal: Palette
  private width = 0
  private height = 0
  private dpr = 1

  private scrollX = 0
  private scrollY = 0
  private targetX = 0
  private targetY = 0
  private centered = false
  private lastPxPerBeat: number
  private lastRowH: number
  private zoomAnchor: { x: number; y: number } | null = null

  private dirty = true
  private raf = 0
  private drag: Drag | null = null
  private pointer: Pointer | null = null
  private hoverNoteId: string | null = null
  private hoverKey: number | null = null
  private ghost: Scene['ghost'] = null
  private rect: Scene['rect'] = null
  private flashes = new Map<string, number>()
  private lastPlayhead = 0
  private cleanup: (() => void)[] = []

  constructor(
    private canvas: HTMLCanvasElement,
    private tooltip: HTMLElement,
  ) {
    this.ctx = canvas.getContext('2d')!
    this.pal = readPalette()
    const v = useView.getState()
    this.lastPxPerBeat = v.pxPerBeat
    this.lastRowH = v.rowH

    const resize = new ResizeObserver(() => this.resize())
    resize.observe(canvas)
    this.cleanup.push(() => resize.disconnect())

    const theme = new MutationObserver(() => {
      this.pal = readPalette()
      this.dirty = true
    })
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    this.cleanup.push(() => theme.disconnect())

    const markDirty = () => (this.dirty = true)
    this.cleanup.push(
      useDoc.subscribe(() => {
        this.dirty = true
        // a nota sob o mouse pode ter mudado de nome ou de grau (troca de escala, desfazer)
        if (this.pointer && !this.drag) this.updateHover(this.pointer)
      }),
    )
    this.cleanup.push(useTransport.subscribe(markDirty))
    this.cleanup.push(useView.subscribe((s) => this.onViewChange(s.pxPerBeat, s.rowH)))
    this.cleanup.push(engine.onLiveChange(markDirty))
    void document.fonts?.ready.then(markDirty)

    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ) => {
      canvas.addEventListener(type, fn, opts)
      this.cleanup.push(() => canvas.removeEventListener(type, fn, opts))
    }
    on('pointerdown', (e) => this.onPointerDown(e))
    on('pointermove', (e) => this.onPointerMove(e))
    on('pointerup', (e) => this.onPointerUp(e))
    on('pointercancel', () => this.cancelDrag())
    on('pointerleave', () => this.onPointerLeave())
    on('wheel', (e) => this.onWheel(e), { passive: false })
    on('contextmenu', (e) => e.preventDefault())

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.drag) this.cancelDrag()
    }
    window.addEventListener('keydown', onKey)
    this.cleanup.push(() => window.removeEventListener('keydown', onKey))

    this.resize()
    const loop = () => {
      this.frame()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  destroy(): void {
    cancelAnimationFrame(this.raf)
    for (const fn of this.cleanup) fn()
    this.cleanup = []
  }

  /** Ponto da tela (em coordenadas da janela) no meio da linha daquela altura, naquele tick. Usado nos testes visuais. */
  pointFor(tick: number, pitch: number): { x: number; y: number } {
    const c = this.coords()
    const box = this.canvas.getBoundingClientRect()
    return { x: box.left + c.xOfTick(tick), y: box.top + c.yOfPitch(pitch) + c.rowH / 2 }
  }

  // ---------------------------------------------------------------- geometria

  private coords(): Coords {
    const v = useView.getState()
    return new Coords(this.width, this.height, v.pxPerBeat, v.rowH, this.scrollX, this.scrollY)
  }

  private scale(): ScaleInfo {
    const { melody } = useDoc.getState()
    return getScale(melody.key, melody.scale)
  }

  private gridStep(): number {
    return GRID_TICKS[useView.getState().grid]
  }

  /** Até onde dá para rolar para a direita: sempre sobra espaço depois da última nota. */
  private contentTicks(): number {
    const { melody } = useDoc.getState()
    const t = useTransport.getState()
    const bar = ticksPerBar(melody.timeSignature)
    const used = Math.max(notesEnd(melody.notes), t.loop.end, t.cursor)
    return Math.max(bar * 16, Math.ceil(used / bar) * bar + bar * 8)
  }

  private resize(): void {
    const box = this.canvas.getBoundingClientRect()
    this.dpr = window.devicePixelRatio || 1
    this.width = Math.round(box.width)
    this.height = Math.round(box.height)
    this.canvas.width = Math.round(this.width * this.dpr)
    this.canvas.height = Math.round(this.height * this.dpr)
    if (!this.centered && this.height > RULER_H) {
      // abre centrado na região em volta do Dó4, onde a maioria das melodias mora
      const rowH = useView.getState().rowH
      this.scrollY = this.targetY = (MAX_PITCH - 66) * rowH - (this.height - RULER_H) / 2
      this.centered = true
    }
    this.clampScroll()
    this.dirty = true
  }

  private clampScroll(): void {
    const c = this.coords()
    const maxX = Math.max(0, this.contentTicks() * c.pxPerTick - c.gridW)
    const maxY = Math.max(0, contentHeight(c.rowH) - c.gridH)
    this.targetX = Math.min(maxX, Math.max(0, this.targetX))
    this.targetY = Math.min(maxY, Math.max(0, this.targetY))
    this.scrollX = Math.min(maxX, Math.max(0, this.scrollX))
    this.scrollY = Math.min(maxY, Math.max(0, this.scrollY))
  }

  /** Zoom mudou (roda do mouse, botões ou atalho): mantém parado o ponto sob a âncora. */
  private onViewChange(pxPerBeat: number, rowH: number): void {
    if (pxPerBeat !== this.lastPxPerBeat) {
      const ax = this.zoomAnchor?.x ?? KEYS_W + (this.width - KEYS_W) / 2
      const beats = (ax - KEYS_W + this.scrollX) / this.lastPxPerBeat
      this.scrollX = this.targetX = beats * pxPerBeat - (ax - KEYS_W)
      this.lastPxPerBeat = pxPerBeat
    }
    if (rowH !== this.lastRowH) {
      const ay = this.zoomAnchor?.y ?? RULER_H + (this.height - RULER_H) / 2
      const rows = (ay - RULER_H + this.scrollY) / this.lastRowH
      this.scrollY = this.targetY = rows * rowH - (ay - RULER_H)
      this.lastRowH = rowH
    }
    this.zoomAnchor = null
    this.clampScroll()
    this.dirty = true
  }

  // ---------------------------------------------------------------- quadro

  private frame(): void {
    if (this.width === 0 || this.height === 0) return
    const now = performance.now()
    const t = useTransport.getState()
    const { melody, selection } = useDoc.getState()

    if (this.drag && this.pointer && this.autoScroll(this.pointer)) this.updateDrag(this.pointer)

    this.clampScroll()
    for (const axis of ['X', 'Y'] as const) {
      const cur = axis === 'X' ? this.scrollX : this.scrollY
      const target = axis === 'X' ? this.targetX : this.targetY
      if (cur === target) continue
      const next = Math.abs(target - cur) < 0.5 ? target : cur + (target - cur) * 0.35
      if (axis === 'X') this.scrollX = next
      else this.scrollY = next
      this.dirty = true
    }

    const playhead = getPlayhead()
    if (t.playing) {
      this.dirty = true
      // pisca as notas que o cursor acabou de alcançar
      const from = playhead >= this.lastPlayhead ? this.lastPlayhead : -1
      for (const n of melody.notes) {
        if (n.start > from && n.start <= playhead) this.flashes.set(n.id, now)
      }
    }
    // tocando ou não, se o cursor andou (stop, colar, Home) a visão vai atrás dele
    if (playhead !== this.lastPlayhead && !this.drag) this.followPlayhead(playhead, t.playing)
    this.lastPlayhead = playhead

    const flashes = new Map<string, number>()
    for (const [id, at] of this.flashes) {
      const k = 1 - (now - at) / FLASH_MS
      if (k <= 0) this.flashes.delete(id)
      else flashes.set(id, k)
    }
    if (flashes.size > 0) this.dirty = true

    if (!this.dirty) return
    this.dirty = false

    const lit = new Set(engine.live)
    if (t.playing) {
      for (const n of melody.notes) {
        if (playhead >= n.start && playhead < n.start + n.duration) lit.add(n.pitch)
      }
    }

    const scene: Scene = {
      notes: melody.notes,
      selection: new Set(selection),
      scale: this.scale(),
      timeSignature: melody.timeSignature,
      gridStep: this.gridStep(),
      playhead,
      playing: t.playing,
      loop: t.loop,
      hoverNoteId: this.hoverNoteId,
      hoverKey: this.hoverKey,
      ghost: this.ghost,
      rect: this.rect,
      lit,
      flashes,
      contentTicks: this.contentTicks(),
    }
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    draw(this.ctx, this.coords(), scene, this.pal)
  }

  /**
   * Mantém o cursor à vista. Tocando, vira a página (o cursor volta para a esquerda).
   * Parado, rola só o necessário, para não esconder o que acabou de ser colado.
   */
  private followPlayhead(playhead: number, playing: boolean): void {
    const c = this.coords()
    const x = c.xOfTick(playhead)
    const px = playhead * c.pxPerTick
    if (x < KEYS_W) this.targetX = px - 48
    else if (x > this.width - 48) this.targetX = playing ? px - 48 : px - c.gridW + 48
  }

  /** Arrastar perto da borda rola a grade. Devolve true se rolou. */
  private autoScroll(p: Pointer): boolean {
    const kind = this.drag?.kind
    if (kind !== 'move' && kind !== 'resize' && kind !== 'rect' && kind !== 'ruler' && kind !== 'loop-edge') return false
    const edge = 28
    let dx = 0
    let dy = 0
    if (p.x > this.width - edge) dx = Math.min(24, (p.x - (this.width - edge)) * 0.5)
    else if (p.x < KEYS_W + edge) dx = -Math.min(24, (KEYS_W + edge - p.x) * 0.5)
    if (kind === 'move' || kind === 'rect') {
      if (p.y > this.height - edge) dy = Math.min(18, (p.y - (this.height - edge)) * 0.4)
      else if (p.y < RULER_H + edge) dy = -Math.min(18, (RULER_H + edge - p.y) * 0.4)
    }
    if (dx === 0 && dy === 0) return false
    const beforeX = this.scrollX
    const beforeY = this.scrollY
    this.scrollX = this.targetX = this.scrollX + dx
    this.scrollY = this.targetY = this.scrollY + dy
    this.clampScroll()
    return this.scrollX !== beforeX || this.scrollY !== beforeY
  }

  // ---------------------------------------------------------------- ponteiro

  private pointerOf(e: PointerEvent | WheelEvent): Pointer {
    const box = this.canvas.getBoundingClientRect()
    return { x: e.clientX - box.left, y: e.clientY - box.top, shift: e.shiftKey, free: e.ctrlKey || e.metaKey }
  }

  private snapStart(tick: number, mode: 'round' | 'floor' = 'round'): number {
    const t = useView.getState().snapGrid ? snapTick(tick, this.gridStep(), mode) : Math.round(tick)
    return Math.max(0, t)
  }

  private snapPitch(pitch: number, free: boolean): number {
    const v = useView.getState()
    const p = clampPitch(pitch)
    return v.snapScale && !free ? clampPitch(snapToScale(p, this.scale())) : p
  }

  /** Borda da nota sob o ponteiro, se ele estiver na faixa de redimensionar. */
  private edgeAt(note: Note, x: number, c: Coords): 'left' | 'right' | null {
    const x0 = c.xOfTick(note.start)
    const x1 = c.xOfTick(note.start + note.duration)
    const w = x1 - x0
    if (w < 14) return x > x0 + w / 2 ? 'right' : null
    const zone = Math.min(8, w / 3)
    if (x >= x1 - zone) return 'right'
    if (x <= x0 + zone) return 'left'
    return null
  }

  private loopEdgeAt(x: number, c: Coords): 'start' | 'end' | null {
    const { loop } = useTransport.getState()
    if (!loop.on || loop.end <= loop.start) return null
    if (Math.abs(x - c.xOfTick(loop.end)) <= 6) return 'end'
    if (Math.abs(x - c.xOfTick(loop.start)) <= 6) return 'start'
    return null
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.drag) return
    const p = this.pointerOf(e)
    const c = this.coords()
    const region = c.region(p.x, p.y)
    const doc = useDoc.getState()
    const view = useView.getState()
    this.pointer = p
    this.canvas.setPointerCapture(e.pointerId)
    this.hideTooltip()

    if (e.button === 1) {
      e.preventDefault()
      this.drag = { kind: 'pan', x: p.x, y: p.y, sx: this.scrollX, sy: this.scrollY }
      this.canvas.style.cursor = 'grabbing'
      return
    }

    if (region === 'keys' && e.button === 0) {
      const pitch = c.pitchOfY(p.y)
      this.drag = { kind: 'keys', pitch: null }
      this.playKey(pitch)
      return
    }

    if (region === 'ruler' && e.button === 0) {
      const edge = this.loopEdgeAt(p.x, c)
      if (edge) this.drag = { kind: 'loop-edge', edge }
      else this.drag = { kind: 'ruler', downTick: c.tickOfX(p.x), downX: p.x, moved: false }
      return
    }

    if (region !== 'grid') return
    const tick = c.tickOfX(p.x)
    const pitch = c.pitchOfY(p.y)
    const hit = tick >= 0 ? noteAt(doc.melody.notes, tick, pitch) : undefined

    if (e.button === 2) {
      doc.beginGesture()
      this.drag = { kind: 'erase' }
      this.eraseAt(p)
      return
    }
    if (e.button !== 0) return

    if (hit) {
      const wasSelected = doc.selection.includes(hit.id)
      if (p.shift) {
        doc.select(wasSelected ? doc.selection.filter((id) => id !== hit.id) : [...doc.selection, hit.id])
        if (wasSelected) return
      } else if (!wasSelected) {
        doc.select([hit.id])
      }
      engine.preview(hit.pitch, hit.velocity)

      doc.beginGesture()
      let notes = doc.melody.notes
      let anchor = hit
      let ids = new Set(useDoc.getState().selection)
      const edge = this.edgeAt(hit, p.x, c)

      if (e.altKey && !edge) {
        // Alt+arrastar leva uma cópia e deixa o original no lugar
        const picked = notes.filter((n) => ids.has(n.id))
        const clones = cloneNotesAt(picked, Math.min(...picked.map((n) => n.start)))
        anchor = clones[picked.indexOf(hit)]
        notes = [...notes, ...clones]
        ids = new Set(clones.map((n) => n.id))
        doc.live(notes, [...ids])
      }

      if (edge) {
        this.drag = { kind: 'resize', edge, base: notes, ids, anchor, downTick: tick, downX: p.x, creating: false, moved: false }
      } else {
        this.drag = {
          kind: 'move',
          base: notes,
          ids,
          anchor,
          downTick: tick,
          downPitch: pitch,
          lastPitch: anchor.pitch,
          moved: false,
          collapseTo: wasSelected && !p.shift && ids.size > 1 ? hit.id : null,
        }
      }
      this.ghost = null
      this.dirty = true
      return
    }

    if (view.tool === 'select' || p.shift) {
      this.drag = {
        kind: 'rect',
        t0: tick,
        cy0: p.y - RULER_H + this.scrollY,
        baseSel: p.shift ? doc.selection : [],
        downX: p.x,
        downY: p.y,
        moved: false,
      }
      return
    }

    // lápis em área vazia: cria a nota e, se continuar arrastando, estica a duração
    const note = createNote({
      pitch: this.snapPitch(pitch, p.free),
      start: this.snapStart(tick, 'floor'),
      duration: view.lastDuration,
    })
    doc.beginGesture()
    const notes = [...doc.melody.notes, note]
    doc.live(notes, [note.id])
    engine.preview(note.pitch, note.velocity)
    this.flashes.set(note.id, performance.now())
    this.drag = {
      kind: 'resize',
      edge: 'right',
      base: notes,
      ids: new Set([note.id]),
      anchor: note,
      downTick: tick,
      downX: p.x,
      creating: true,
      moved: false,
    }
    this.ghost = null
    this.dirty = true
  }

  private onPointerMove(e: PointerEvent): void {
    const p = this.pointerOf(e)
    this.pointer = p
    if (this.drag) this.updateDrag(p)
    else this.updateHover(p)
  }

  private updateDrag(p: Pointer): void {
    const drag = this.drag
    if (!drag) return
    const c = this.coords()
    const doc = useDoc.getState()
    const view = useView.getState()
    this.dirty = true

    switch (drag.kind) {
      case 'pan':
        this.scrollX = this.targetX = drag.sx - (p.x - drag.x)
        this.scrollY = this.targetY = drag.sy - (p.y - drag.y)
        this.clampScroll()
        return

      case 'keys':
        if (c.region(p.x, p.y) === 'keys') this.playKey(c.pitchOfY(p.y))
        return

      case 'ruler': {
        if (!drag.moved && Math.abs(p.x - drag.downX) < DRAG_THRESHOLD) return
        drag.moved = true
        const a = this.snapStart(drag.downTick)
        const b = this.snapStart(c.tickOfX(p.x))
        if (a !== b) useTransport.getState().set({ loop: { on: true, start: Math.min(a, b), end: Math.max(a, b) } })
        return
      }

      case 'loop-edge': {
        const t = useTransport.getState()
        const tick = this.snapStart(c.tickOfX(p.x))
        const min = this.gridStep()
        const loop: LoopRegion =
          drag.edge === 'start'
            ? { ...t.loop, start: Math.min(tick, t.loop.end - min) }
            : { ...t.loop, end: Math.max(tick, t.loop.start + min) }
        t.set({ loop })
        return
      }

      case 'move': {
        const tick = c.tickOfX(p.x)
        const rows = c.pitchOfY(p.y) - drag.downPitch
        const target = this.snapStart(drag.anchor.start + (tick - drag.downTick))
        const dTick = target - drag.anchor.start

        let mapPitch = (pitch: number) => pitch + rows
        if (rows !== 0 && view.snapScale && !p.free) {
          // com snap na escala o grupo anda por graus, não por semitons
          const scale = this.scale()
          const bias = rows > 0 ? 1 : -1
          const from = snapToScale(drag.anchor.pitch, scale, bias)
          const to = snapToScale(clampPitch(drag.anchor.pitch + rows), scale, bias)
          const steps = scaleStepsBetween(from, to, scale)
          mapPitch = (pitch) => shiftDiatonic(isInScale(pitch, scale) ? pitch : snapToScale(pitch, scale, bias), steps, scale)
        }

        const notes = moveNotes(drag.base, drag.ids, dTick, mapPitch)
        if (dTick !== 0 || rows !== 0) drag.moved = true
        doc.live(notes)
        const anchor = notes.find((n) => n.id === drag.anchor.id)
        if (anchor && anchor.pitch !== drag.lastPitch) {
          drag.lastPitch = anchor.pitch
          engine.preview(anchor.pitch, anchor.velocity, 0.16)
        }
        if (anchor) this.showTooltip(anchor, p)
        return
      }

      case 'resize': {
        if (!drag.moved && Math.abs(p.x - drag.downX) < DRAG_THRESHOLD) return
        drag.moved = true
        const delta = c.tickOfX(p.x) - drag.downTick
        const step = view.snapGrid ? this.gridStep() : 1
        const min = view.snapGrid ? step : 30
        let dTick: number
        if (drag.creating) {
          // nota recém-criada: o fim acompanha o ponteiro
          const end = drag.anchor.start + drag.anchor.duration
          dTick = snapTick(c.tickOfX(p.x), step) - end
        } else if (drag.edge === 'right') {
          const end = drag.anchor.start + drag.anchor.duration
          dTick = snapTick(end + delta, step) - end
        } else {
          dTick = snapTick(drag.anchor.start + delta, step) - drag.anchor.start
        }
        doc.live(resizeNotes(drag.base, drag.ids, dTick, drag.edge, min))
        return
      }

      case 'rect': {
        if (!drag.moved && Math.hypot(p.x - drag.downX, p.y - drag.downY) < DRAG_THRESHOLD) return
        drag.moved = true
        const t1 = c.tickOfX(p.x)
        const cy1 = p.y - RULER_H + this.scrollY
        this.rect = { t0: drag.t0, t1, cy0: drag.cy0, cy1 }
        const pitchOf = (cy: number) => MAX_PITCH - Math.floor(cy / c.rowH)
        const inside = notesInRect(doc.melody.notes, drag.t0, t1, pitchOf(drag.cy0), pitchOf(cy1))
        doc.select([...new Set([...drag.baseSel, ...inside])])
        return
      }

      case 'erase':
        this.eraseAt(p)
        return
    }
  }

  private onPointerUp(e: PointerEvent): void {
    const drag = this.drag
    if (!drag) return
    const p = this.pointerOf(e)
    const doc = useDoc.getState()
    this.drag = null
    this.rect = null
    this.dirty = true
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId)

    switch (drag.kind) {
      case 'keys':
        this.releaseKey(drag.pitch)
        break
      case 'ruler':
        if (!drag.moved) seek(this.snapStart(drag.downTick))
        break
      case 'move':
        doc.commitGesture()
        if (!drag.moved && drag.collapseTo) doc.select([drag.collapseTo])
        break
      case 'resize': {
        doc.commitGesture()
        const anchor = useDoc.getState().melody.notes.find((n) => n.id === drag.anchor.id)
        if (anchor && drag.moved) useView.getState().set({ lastDuration: anchor.duration })
        break
      }
      case 'rect':
        if (!drag.moved) doc.select(drag.baseSel)
        break
      case 'erase':
        doc.commitGesture()
        break
    }
    this.updateHover(p)
  }

  private cancelDrag(): void {
    const drag = this.drag
    if (!drag) return
    if (drag.kind === 'keys') this.releaseKey(drag.pitch)
    if (drag.kind === 'move' || drag.kind === 'resize' || drag.kind === 'erase') useDoc.getState().cancelGesture()
    this.drag = null
    this.rect = null
    this.canvas.style.cursor = 'default'
    this.dirty = true
  }

  private onPointerLeave(): void {
    if (this.drag) return
    this.pointer = null
    this.hoverNoteId = null
    this.hoverKey = null
    this.ghost = null
    this.hideTooltip()
    this.dirty = true
  }

  private updateHover(p: Pointer): void {
    const c = this.coords()
    const region = c.region(p.x, p.y)
    const view = useView.getState()
    let cursor = 'default'
    let hoverNote: Note | undefined
    let hoverKey: number | null = null
    let ghost: Scene['ghost'] = null

    if (region === 'grid') {
      const tick = c.tickOfX(p.x)
      const pitch = c.pitchOfY(p.y)
      hoverNote = tick >= 0 ? noteAt(useDoc.getState().melody.notes, tick, pitch) : undefined
      if (hoverNote) {
        cursor = this.edgeAt(hoverNote, p.x, c) ? 'ew-resize' : 'move'
        hoverKey = hoverNote.pitch
      } else if (pitch >= MIN_PITCH && pitch <= MAX_PITCH) {
        if (view.tool === 'pencil' && !p.shift) {
          ghost = {
            tick: this.snapStart(tick, 'floor'),
            pitch: this.snapPitch(pitch, p.free),
            duration: view.lastDuration,
          }
          hoverKey = ghost.pitch
        } else {
          cursor = 'crosshair'
          hoverKey = pitch
        }
      }
    } else if (region === 'keys') {
      hoverKey = c.pitchOfY(p.y)
      cursor = 'pointer'
    } else if (region === 'ruler') {
      cursor = this.loopEdgeAt(p.x, c) ? 'ew-resize' : 'pointer'
    }

    const noteId = hoverNote?.id ?? null
    const ghostChanged =
      ghost?.tick !== this.ghost?.tick || ghost?.pitch !== this.ghost?.pitch || ghost?.duration !== this.ghost?.duration
    if (noteId !== this.hoverNoteId || hoverKey !== this.hoverKey || ghostChanged) this.dirty = true
    this.hoverNoteId = noteId
    this.hoverKey = hoverKey
    this.ghost = ghost
    this.canvas.style.cursor = cursor
    if (hoverNote) this.showTooltip(hoverNote, p)
    else this.hideTooltip()
  }

  private eraseAt(p: Pointer): void {
    const c = this.coords()
    if (c.region(p.x, p.y) !== 'grid') return
    const doc = useDoc.getState()
    const hit = noteAt(doc.melody.notes, c.tickOfX(p.x), c.pitchOfY(p.y))
    if (!hit) return
    const ids = new Set([hit.id])
    doc.live(
      removeNotes(doc.melody.notes, ids),
      doc.selection.filter((id) => id !== hit.id),
    )
  }

  /** Tecla do teclado lateral sob o mouse: solta a anterior e toca a nova. */
  private playKey(pitch: number | null): void {
    if (this.drag?.kind !== 'keys') return
    const next = pitch != null && pitch >= MIN_PITCH && pitch <= MAX_PITCH ? pitch : null
    if (next === this.drag.pitch) return
    if (this.drag.pitch != null) engine.noteOff(this.drag.pitch)
    if (next != null) engine.noteOn(next)
    this.drag.pitch = next
    this.hoverKey = next
    this.dirty = true
  }

  private releaseKey(pitch: number | null): void {
    if (pitch != null) engine.noteOff(pitch)
    this.dirty = true
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault()
    const p = this.pointerOf(e)
    const view = useView.getState()
    const unit = e.deltaMode === 1 ? 32 : 1
    const dx = e.deltaX * unit
    const dy = e.deltaY * unit

    if (e.ctrlKey || e.metaKey) {
      this.zoomAnchor = { x: Math.max(p.x, KEYS_W), y: p.y }
      const next = Math.min(ZOOM_X.max, Math.max(ZOOM_X.min, view.pxPerBeat * Math.exp(-dy * 0.0022)))
      if (next !== view.pxPerBeat) view.set({ pxPerBeat: next })
      else this.zoomAnchor = null
      return
    }
    if (e.altKey) {
      this.zoomAnchor = { x: p.x, y: Math.max(p.y, RULER_H) }
      const next = Math.min(ZOOM_Y.max, Math.max(ZOOM_Y.min, Math.round(view.rowH - Math.sign(dy) * 2)))
      if (next !== view.rowH) view.set({ rowH: next })
      else this.zoomAnchor = null
      return
    }
    if (e.shiftKey && dx === 0) this.targetX += dy
    else {
      this.targetX += dx
      this.targetY += dy
    }
    this.clampScroll()
    this.dirty = true
  }

  // ---------------------------------------------------------------- dica da nota

  private showTooltip(note: Note, p: Pointer): void {
    const scale = this.scale()
    const text = `${pitchLabel(note.pitch, scale)}, ${degreeLabel(note.pitch, scale)}`
    if (this.tooltip.textContent !== text) this.tooltip.textContent = text
    const x = Math.min(this.width - 150, p.x + 14)
    const y = Math.min(this.height - 34, p.y + 18)
    this.tooltip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
    this.tooltip.style.opacity = '1'
  }

  private hideTooltip(): void {
    this.tooltip.style.opacity = '0'
  }
}
