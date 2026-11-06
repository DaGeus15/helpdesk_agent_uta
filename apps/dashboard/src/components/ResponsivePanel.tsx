import { useEffect, useRef, useState, type ReactNode } from 'react'

/** A modal on small screens; preserves the inline panel on larger screens. */
export function ResponsivePanel({
  id, label, media, className, backdropClassName, onClose, children,
}: {
  id: string
  label: string
  media: string
  className: string
  backdropClassName: string
  onClose: () => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const [modal, setModal] = useState(() => window.matchMedia(media).matches)

  useEffect(() => {
    const query = window.matchMedia(media)
    const update = () => setModal(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [media])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    if (modal) panel?.focus({ preventScroll: true })
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
      }
      if (!modal || event.key !== 'Tab' || !panel) return
      const targets = Array.from(panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      )).filter((element) => element.getClientRects().length > 0)
      const first = targets[0]
      const last = targets.at(-1)
      if (!first) {
        event.preventDefault()
        panel.focus()
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) {
        event.preventDefault()
        first.focus()
      }
    }
    function keepFocus(event: FocusEvent) {
      if (modal && panel && !panel.contains(event.target as Node)) panel.focus({ preventScroll: true })
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('focusin', keepFocus)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', keepFocus)
      if (modal && previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [modal])

  return (
    <>
      <div className={backdropClassName} onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} id={id} role="dialog" aria-label={label}
        aria-modal={modal || undefined} tabIndex={-1} className={className}>
        {children}
      </div>
    </>
  )
}
