import { useEffect, useRef } from 'react'
import { engine } from '../../audio/engine'
import { useTransport } from '../../store/transport'
import { useDoc } from '../../store/doc'
import { KEYS_W, RULER_H } from './coords'
import { PianoRollController } from './controller'

/** Contagem de entrada da gravação: mostra os tempos que faltam, em cima da grade. */
function CountIn() {
  const recording = useTransport((s) => s.recording)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!recording) return
    let raf = 0
    const tick = () => {
      const left = engine.countInBeatsLeft()
      if (ref.current) {
        ref.current.textContent = left > 0 ? String(Math.ceil(left)) : ''
        ref.current.style.opacity = left > 0 ? '1' : '0'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [recording])
  if (!recording) return null
  return (
    <div
      ref={ref}
      role="status"
      aria-label="Contagem de entrada"
      className="pointer-events-none absolute top-16 left-1/2 flex h-24 w-24 -translate-x-1/2 items-center justify-center rounded-full bg-felt font-score text-[56px] leading-none text-white italic opacity-0 shadow-xl tabular-nums"
    />
  )
}

export function PianoRoll() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const empty = useDoc((s) => s.melody.notes.length === 0)
  const recording = useTransport((s) => s.recording)

  useEffect(() => {
    const controller = new PianoRollController(canvasRef.current!, tipRef.current!)
    if (import.meta.env.DEV) Object.assign(window, { __roll: controller })
    return () => controller.destroy()
  }, [])

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-ground">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full touch-none"
        aria-label="Piano roll: grade de notas da melodia"
      />
      {empty && !recording && (
        <div
          className="pointer-events-none absolute flex items-center justify-center"
          style={{ left: KEYS_W, top: RULER_H, right: 0, bottom: 0 }}
        >
          {/* o fundo em degradê apaga a grade atrás do texto, sem virar um cartão */}
          <div
            className="flex flex-col items-center gap-2.5 px-20 py-14 text-center"
            style={{ background: 'radial-gradient(closest-side, var(--ground) 62%, transparent)' }}
          >
            <p className="font-score text-[26px] leading-tight text-ink italic">Clique na grade para criar sua primeira nota</p>
            <p className="max-w-[44ch] text-ink-dim">
              Arraste para esticar a duração. Para ouvir a escala antes de escrever, toque no teclado do computador:{' '}
              <span className="whitespace-nowrap">
                <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> <kbd>F</kbd> <kbd>G</kbd> <kbd>H</kbd> <kbd>J</kbd>
              </span>
            </p>
          </div>
        </div>
      )}
      <CountIn />
      <div
        ref={tipRef}
        role="status"
        className="pointer-events-none absolute top-0 left-0 rounded-md border border-line bg-panel px-2 py-1 text-[12px] font-medium whitespace-nowrap text-ink opacity-0 shadow-lg transition-opacity duration-100"
      />
    </div>
  )
}
