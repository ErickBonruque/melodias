import { useEffect } from 'react'
import { engine } from '../audio/engine'
import { autoConnectMidi } from '../input/midi'
import { bindAudio } from '../store/bindAudio'
import { useDoc } from '../store/doc'
import { useHum } from '../store/hum'
import { initLibrary, useLibrary } from '../store/library'
import { bindRecorder } from '../store/recorder'
import { useTransport } from '../store/transport'
import { useView } from '../store/view'
import { AudioNotice } from './AudioNotice'
import { EditBar } from './EditBar'
import { LibraryPanel } from './LibraryPanel'
import { PianoRoll } from './pianoroll/PianoRoll'
import { ScorePanel } from './ScorePanel'
import { ShortcutsDialog } from './ShortcutsDialog'
import { installShortcuts } from './shortcuts'
import { ToolsPanel } from './ToolsPanel'
import { TransportBar } from './TransportBar'

export function App() {
  useEffect(() => {
    // o gravador entra antes do áudio: ao parar, ele fecha as notas enquanto o transport ainda sabe a posição
    const unbindRecorder = bindRecorder()
    const unbindAudio = bindAudio()
    const removeShortcuts = installShortcuts()
    let stopAutosave: (() => void) | null = null
    let alive = true
    void initLibrary().then((stop) => {
      if (alive) stopAutosave = stop
      else stop()
    })
    void autoConnectMidi()
    if (import.meta.env.DEV) {
      // gancho para os testes visuais (Playwright) lerem e mexerem no estado
      Object.assign(window, { __melodias: { doc: useDoc, view: useView, transport: useTransport, library: useLibrary, hum: useHum, engine } })
    }
    return () => {
      alive = false
      unbindAudio()
      unbindRecorder()
      removeShortcuts()
      stopAutosave?.()
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      <TransportBar />
      <div className="flex min-h-0 flex-1">
        <LibraryPanel />
        <main className="flex min-w-0 flex-1 flex-col">
          <EditBar />
          <PianoRoll />
          <ScorePanel />
        </main>
        <ToolsPanel />
      </div>
      <AudioNotice />
      <ShortcutsDialog />
    </div>
  )
}
