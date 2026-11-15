import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND_FULL, BRAND_NAME, BRAND_SERIES } from '../lib/brand'
import ShareButton from './ShareButton'

type Props = {
  onMenuClick: () => void
  // A table/map page's title. The bar then shows just the logo mark (still a
  // link home) and keeps the title in view as the page's h1 — the brand name
  // would only take up room the title needs, especially on phones.
  title?: string
  // The home page already shows the brand large in its hero: the bar then
  // starts bare (just the menu) and brings the brand in once that's scrolled away.
  brandAfterScroll?: boolean
  // A share button (link copy, X, LINE) for this page as it is on screen.
  share?: boolean
}

const REVEAL_AT = 120 // px — about where the hero's title has left the screen

function useScrolledPast(px: number, enabled: boolean) {
  const [past, setPast] = useState(() => !enabled || (typeof window !== 'undefined' && window.scrollY > px))
  useEffect(() => {
    if (!enabled) return
    const onScroll = () => setPast(window.scrollY > px)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [px, enabled])
  return past
}

// The site bar on every page. Everything else page-specific (description,
// data, view/sort/filter) lives in PageHeader and Toolbar below it.
function AppHeader({ onMenuClick, title, brandAfterScroll = false, share = false }: Props) {
  const showBrand = useScrolledPast(REVEAL_AT, brandAfterScroll)
  return (
    <header className={`fixed top-0 inset-x-0 z-40 h-11 flex items-center gap-2 px-3 border-b transition-colors duration-200 ${showBrand ? 'bg-white border-gray-200' : 'bg-transparent border-transparent'}`}>
      {title ? (
        <>
          <Link to="/" className="shrink-0 -m-1 p-1 rounded hover:bg-gray-100" aria-label={`${BRAND_FULL}（トップへ）`} title={BRAND_FULL}>
            <img src="/logo.svg" alt="" className="h-6 w-6" />
          </Link>
          <h1 className="min-w-0 font-bold text-[13px] sm:text-base leading-tight line-clamp-2 text-gray-900" title={title}>{title}</h1>
        </>
      ) : (
        <Link
          to="/"
          className={`flex items-center gap-2 min-w-0 transition-opacity duration-200 ${showBrand ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-hidden={!showBrand}
          tabIndex={showBrand ? undefined : -1}
        >
          <img src="/logo.svg" alt="" className="h-6 w-6 shrink-0" />
          <span className="flex items-baseline gap-1.5 min-w-0 truncate">
            <span className="text-[11px] text-gray-400 tracking-wide">{BRAND_SERIES}</span>
            <span className="font-bold text-[15px] text-navy-900">{BRAND_NAME}</span>
          </span>
        </Link>
      )}
      {share && <div className="ml-auto"><ShareButton /></div>}
      <button
        className={`${share ? '' : 'ml-auto '}shrink-0 p-2 rounded hover:bg-gray-100 flex flex-col gap-1 justify-center`}
        onClick={onMenuClick}
        aria-label="メニュー"
      >
        <span className="block w-4 h-px bg-gray-600" />
        <span className="block w-4 h-px bg-gray-600" />
        <span className="block w-4 h-px bg-gray-600" />
      </button>
    </header>
  )
}

export default AppHeader
