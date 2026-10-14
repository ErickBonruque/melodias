import { useTransport } from '../store/transport'

/** O navegador só libera som depois de um gesto. Este aviso some no primeiro clique ou tecla. */
export function AudioNotice() {
  const ready = useTransport((s) => s.audioReady)
  return (
    <div
      role="status"
      className={`pointer-events-none fixed bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-line bg-panel px-4 py-2 text-[13px] text-ink shadow-xl transition-opacity duration-500 ${
        ready ? 'opacity-0' : 'opacity-100'
      }`}
    >
      O som liga no seu primeiro clique ou tecla. É o navegador que pede esse gesto.
    </div>
  )
}
