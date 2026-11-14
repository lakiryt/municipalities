import { Link } from 'react-router-dom'
import { BRAND_FULL, BRAND_NAME, BRAND_SERIES } from '../lib/brand'

type Props = {
  onMenuClick: () => void
  // A table/map page's title. The bar then shows just the logo mark (still a
  // link home) and keeps the title in view as the page's h1 — the brand name
  // would only take up room the title needs, especially on phones.
  title?: string
}

// The site bar on every page. Everything else page-specific (description,
// data, view/sort/filter) lives in PageHeader and Toolbar below it.
function AppHeader({ onMenuClick, title }: Props) {
  return (
    <header className="fixed top-0 inset-x-0 z-40 h-11 flex items-center gap-2 bg-white border-b border-gray-200 px-3">
      {title ? (
        <>
          <Link to="/" className="shrink-0 -m-1 p-1 rounded hover:bg-gray-100" aria-label={`${BRAND_FULL}（トップへ）`} title={BRAND_FULL}>
            <img src="/logo.svg" alt="" className="h-6 w-6" />
          </Link>
          <h1 className="min-w-0 font-bold text-[13px] sm:text-base leading-tight line-clamp-2 text-gray-900" title={title}>{title}</h1>
        </>
      ) : (
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <img src="/logo.svg" alt="" className="h-6 w-6 shrink-0" />
          <span className="flex items-baseline gap-1.5 min-w-0 truncate">
            <span className="text-[11px] text-gray-400 tracking-wide">{BRAND_SERIES}</span>
            <span className="font-bold text-[15px] text-[#13294b]">{BRAND_NAME}</span>
          </span>
        </Link>
      )}
      <button
        className="ml-auto shrink-0 p-2 rounded hover:bg-gray-100 flex flex-col gap-1 justify-center"
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
