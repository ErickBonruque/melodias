import { noteKeyDown, noteKeyUp, releaseAllKeys, shiftOctave } from '../input/keyboard'
import {
  clearSelection,
  copySelection,
  cutSelection,
  deleteSelection,
  duplicateSelection,
  nudgeSelection,
  paste,
  resizeSelection,
  seek,
  selectAll,
  stop,
  toggleLoop,
  toggleMetronome,
  togglePlay,
  toggleRecord,
  zoomX,
} from '../store/commands'
import { useDoc } from '../store/doc'
import { useTransport } from '../store/transport'
import { useView } from '../store/view'

/** O que aparece na tela de atalhos (tecla ?). */
export const SHORTCUT_GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'Tocar',
    items: [
      { keys: ['Espaço'], label: 'Tocar ou pausar' },
      { keys: ['Enter'], label: 'Parar e voltar ao ponto de partida' },
      { keys: ['Home'], label: 'Levar o cursor ao início' },
      { keys: ['R'], label: 'Gravar o que você tocar, com contagem de entrada' },
      { keys: ['C'], label: 'Ligar ou desligar o loop' },
      { keys: ['M'], label: 'Ligar ou desligar o metrônomo' },
    ],
  },
  {
    title: 'Teclado musical',
    items: [
      { keys: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K'], label: 'Teclas brancas, de Dó a Dó' },
      { keys: ['W', 'E', 'T', 'Y', 'U'], label: 'Teclas pretas' },
      { keys: ['Z', 'X'], label: 'Descer ou subir uma oitava' },
    ],
  },
  {
    title: 'Editar',
    items: [
      { keys: ['1'], label: 'Lápis: clicar cria nota, arrastar estica' },
      { keys: ['2'], label: 'Seleção: arrastar marca várias notas' },
      { keys: ['Shift', 'arrastar'], label: 'Retângulo de seleção, mesmo com o lápis' },
      { keys: ['Alt', 'arrastar'], label: 'Arrastar uma cópia das notas' },
      { keys: ['Ctrl', 'clicar ou arrastar'], label: 'Sair da escala: aceita qualquer semitom' },
      { keys: ['Botão direito'], label: 'Apagar a nota sob o mouse' },
      { keys: ['Ctrl', 'Z'], label: 'Desfazer' },
      { keys: ['Ctrl', 'Shift', 'Z'], label: 'Refazer' },
    ],
  },
  {
    title: 'Notas selecionadas',
    items: [
      { keys: ['↑', '↓'], label: 'Subir ou descer um grau da escala' },
      { keys: ['Shift', '↑', '↓'], label: 'Subir ou descer uma oitava' },
      { keys: ['←', '→'], label: 'Mover um passo da grade' },
      { keys: ['Shift', '←', '→'], label: 'Encurtar ou alongar' },
      { keys: ['Ctrl', 'C'], label: 'Copiar' },
      { keys: ['Ctrl', 'X'], label: 'Recortar' },
      { keys: ['Ctrl', 'V'], label: 'Colar no cursor' },
      { keys: ['Ctrl', 'D'], label: 'Repetir logo em seguida' },
      { keys: ['Ctrl', 'A'], label: 'Selecionar tudo' },
      { keys: ['Delete'], label: 'Apagar' },
      { keys: ['Esc'], label: 'Soltar a seleção' },
    ],
  },
  {
    title: 'Ver',
    items: [
      { keys: ['Roda do mouse'], label: 'Rolar para cima e para baixo' },
      { keys: ['Shift', 'roda'], label: 'Rolar para os lados' },
      { keys: ['Ctrl', 'roda'], label: 'Zoom horizontal' },
      { keys: ['Alt', 'roda'], label: 'Zoom vertical' },
      { keys: ['Botão do meio', 'arrastar'], label: 'Arrastar a grade' },
      { keys: ['+', '−'], label: 'Zoom horizontal' },
      { keys: ['['], label: 'Mostrar ou esconder a biblioteca' },
      { keys: [']'], label: 'Mostrar ou esconder as ferramentas' },
      { keys: ['?'], label: 'Abrir esta tela' },
    ],
  },
]

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
}

function onKeyDown(e: KeyboardEvent): void {
  const view = useView.getState()

  if (e.key === 'Escape') {
    if (view.helpOpen) view.set({ helpOpen: false })
    else if (isTyping(e.target)) (e.target as HTMLElement).blur()
    else clearSelection()
    return
  }
  if (isTyping(e.target)) return
  // o ? vem antes dos modificadores: em alguns teclados ele só sai com AltGr
  if (e.key === '?') {
    view.set({ helpOpen: !view.helpOpen })
    return
  }
  if (view.helpOpen) return
  // botão com foco pelo teclado: Espaço e Enter acionam o botão, não o transport
  if ((e.key === ' ' || e.key === 'Enter') && (e.target as HTMLElement | null)?.tagName === 'BUTTON') return

  // gravando, o teclado é só instrumento e transport: nada de editar no meio da tomada
  if (useTransport.getState().recording) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === ' ' || e.key === 'Enter' || e.code === 'KeyR') {
      e.preventDefault()
      if (!e.repeat) toggleRecord()
    } else if (e.code === 'KeyZ' && !e.repeat) shiftOctave(-1)
    else if (e.code === 'KeyX' && !e.repeat) shiftOctave(1)
    else if (noteKeyDown(e)) e.preventDefault()
    return
  }

  const mod = e.ctrlKey || e.metaKey
  if (mod) {
    const run = (fn: () => void) => {
      e.preventDefault()
      fn()
    }
    switch (e.code) {
      case 'KeyZ':
        return run(() => (e.shiftKey ? useDoc.getState().redo() : useDoc.getState().undo()))
      case 'KeyY':
        return run(() => useDoc.getState().redo())
      case 'KeyC':
        return run(() => copySelection())
      case 'KeyX':
        return run(cutSelection)
      case 'KeyV':
        return run(paste)
      case 'KeyD':
        return run(duplicateSelection)
      case 'KeyA':
        return run(selectAll)
    }
    return
  }
  if (e.altKey) return

  switch (e.key) {
    case ' ':
      e.preventDefault()
      if (!e.repeat) togglePlay()
      return
    case 'Enter':
      e.preventDefault()
      return stop()
    case 'Home':
      return seek(0)
    case 'Delete':
    case 'Backspace':
      e.preventDefault()
      return deleteSelection()
    case '[':
      return view.set({ libraryOpen: !view.libraryOpen })
    case ']':
      return view.set({ toolsOpen: !view.toolsOpen })
    case '+':
    case '=':
      return zoomX(1.25)
    case '-':
      return zoomX(0.8)
    case 'ArrowUp':
      e.preventDefault()
      return nudgeSelection(0, 1, e.shiftKey)
    case 'ArrowDown':
      e.preventDefault()
      return nudgeSelection(0, -1, e.shiftKey)
    case 'ArrowLeft':
      e.preventDefault()
      return e.shiftKey ? resizeSelection(-1) : nudgeSelection(-1, 0)
    case 'ArrowRight':
      e.preventDefault()
      return e.shiftKey ? resizeSelection(1) : nudgeSelection(1, 0)
  }

  if (e.repeat && e.code in { KeyZ: 1, KeyX: 1, KeyC: 1, KeyM: 1, KeyR: 1 }) return
  switch (e.code) {
    case 'Digit1':
      return view.set({ tool: 'pencil' })
    case 'Digit2':
      return view.set({ tool: 'select' })
    case 'KeyC':
      return toggleLoop()
    case 'KeyM':
      return toggleMetronome()
    case 'KeyR':
      return toggleRecord()
    case 'KeyZ':
      return shiftOctave(-1)
    case 'KeyX':
      return shiftOctave(1)
  }

  if (noteKeyDown(e)) e.preventDefault()
}

function onKeyUp(e: KeyboardEvent): void {
  noteKeyUp(e)
}

/** Depois de um clique de mouse o foco volta para o estúdio, para os atalhos seguirem valendo. */
function releaseFocus(e: Event): void {
  const el = document.activeElement as HTMLElement | null
  if (!el) return
  if (e.type === 'change' ? el.tagName === 'SELECT' : el.tagName === 'BUTTON' && (e as MouseEvent).detail > 0) el.blur()
}

export function installShortcuts(): () => void {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', releaseAllKeys)
  window.addEventListener('click', releaseFocus)
  window.addEventListener('change', releaseFocus)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', releaseAllKeys)
    window.removeEventListener('click', releaseFocus)
    window.removeEventListener('change', releaseFocus)
    releaseAllKeys()
  }
}
