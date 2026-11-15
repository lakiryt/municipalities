import { useEffect, useRef, useState } from 'react'

// Shares the page exactly as it is on screen: the URL carries the view
// (表/地図), sort, filter, columns and データの選択, so whoever opens it sees
// the same table or map. The text is the page's title (which already ends in
// the site's name).
function ShareButton() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const url = () => window.location.href
  const text = () => document.title
  const canShareNatively = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url())
      setCopied('ok')
    } catch {
      setCopied('failed')
    }
    setTimeout(() => setCopied(null), 2000)
  }
  const openWindow = (href: string) => { window.open(href, '_blank', 'noopener,noreferrer'); setOpen(false) }

  const item = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50'
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="共有"
        aria-haspopup="menu"
        aria-expanded={open}
        title="共有"
        className="p-2 rounded hover:bg-gray-100 text-gray-600"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
        </svg>
      </button>
      {open && (
        <div role="menu" aria-label="共有" className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button role="menuitem" type="button" className={item} onClick={copy}>
            {copied === 'ok' ? 'コピーしました' : copied === 'failed' ? 'コピーできませんでした' : 'リンクをコピー'}
          </button>
          <button role="menuitem" type="button" className={item}
            onClick={() => openWindow(`https://x.com/intent/post?${new URLSearchParams({ text: text(), url: url() })}`)}>
            X でポスト
          </button>
          <button role="menuitem" type="button" className={item}
            onClick={() => openWindow(`https://line.me/R/share?text=${encodeURIComponent(`${text()}\n${url()}`)}`)}>
            LINE で送る
          </button>
          {canShareNatively && (
            <button role="menuitem" type="button" className={item}
              onClick={() => { navigator.share({ title: text(), url: url() }).catch(() => {}); setOpen(false) }}>
              その他のアプリ…
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default ShareButton
