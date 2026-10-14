import type { ReactNode } from 'react'

function Icon({ children, fill = false, size = 18 }: { children: ReactNode; fill?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const PlayIcon = () => (
  <Icon fill>
    <path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11.3-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z" />
  </Icon>
)
export const PauseIcon = () => (
  <Icon fill>
    <rect x="6" y="4.5" width="4.5" height="15" rx="1.2" />
    <rect x="13.5" y="4.5" width="4.5" height="15" rx="1.2" />
  </Icon>
)
export const StopIcon = () => (
  <Icon fill>
    <rect x="5.5" y="5.5" width="13" height="13" rx="2" />
  </Icon>
)
export const LoopIcon = () => (
  <Icon>
    <path d="M17 3l3 3-3 3" />
    <path d="M20 6H8a4 4 0 0 0-4 4v1" />
    <path d="M7 21l-3-3 3-3" />
    <path d="M4 18h12a4 4 0 0 0 4-4v-1" />
  </Icon>
)
export const MetronomeIcon = () => (
  <Icon>
    <path d="M9 3h6l4 18H5L9 3z" />
    <path d="M12 16l5-9" />
    <path d="M7 16h10" />
  </Icon>
)
export const PencilIcon = () => (
  <Icon>
    <path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20z" />
    <path d="M14.5 6l3 3" />
  </Icon>
)
export const PointerIcon = () => (
  <Icon>
    <path d="M5 3l5.5 16 2.4-6.6L19.5 10 5 3z" />
  </Icon>
)
export const UndoIcon = () => (
  <Icon>
    <path d="M8 7L4 11l4 4" />
    <path d="M4 11h10a5 5 0 0 1 0 10h-2" />
  </Icon>
)
export const RedoIcon = () => (
  <Icon>
    <path d="M16 7l4 4-4 4" />
    <path d="M20 11H10a5 5 0 0 0 0 10h2" />
  </Icon>
)
export const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
)
export const MoonIcon = () => (
  <Icon>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Icon>
)
export const LibraryIcon = () => (
  <Icon>
    <rect x="3.5" y="4" width="17" height="16" rx="2" />
    <path d="M9 4v16" />
  </Icon>
)
export const ToolsPanelIcon = () => (
  <Icon>
    <rect x="3.5" y="4" width="17" height="16" rx="2" />
    <path d="M15 4v16" />
  </Icon>
)
export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)
export const MinusIcon = () => (
  <Icon>
    <path d="M5 12h14" />
  </Icon>
)
export const SearchIcon = () => (
  <Icon size={16}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Icon>
)
export const TrashIcon = () => (
  <Icon size={16}>
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />
  </Icon>
)
export const CopyIcon = () => (
  <Icon size={16}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Icon>
)
export const RenameIcon = () => (
  <Icon size={16}>
    <path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20z" />
  </Icon>
)
export const CloseIcon = () => (
  <Icon size={16}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)
export const HelpIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8" />
    <path d="M12 17v.01" />
  </Icon>
)
export const GridSnapIcon = () => (
  <Icon>
    <path d="M4 9h16M4 15h16M9 4v16M15 4v16" />
  </Icon>
)
export const ScaleSnapIcon = () => (
  <Icon>
    <path d="M4 18h3v-3h3v-3h3V9h3V6h4" />
  </Icon>
)
export const QuarterNoteIcon = () => (
  <svg width="11" height="20" viewBox="0 0 11 20" fill="currentColor" aria-hidden="true">
    <ellipse cx="4.2" cy="16" rx="4.2" ry="3" transform="rotate(-22 4.2 16)" />
    <rect x="7.3" y="1" width="1.4" height="15" />
  </svg>
)
