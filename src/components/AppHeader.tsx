import { Link } from 'react-router-dom'
import { BRAND_NAME, BRAND_SERIES } from '../lib/brand'

type Props = { onMenuClick: () => void }

// The site bar: always the same on every table/map page. Page-specific
// things (title, data, view/sort/filter) live in PageHeader and Toolbar
// below it, where they're visible on phones too.
function AppHeader({ onMenuClick }: Props) {
  return (
    <header className="fixed top-0 inset-x-0 z-40 h-11 flex items-center gap-2 bg-white border-b border-gray-200 px-3">
      <Link to="/" className="flex items-center gap-2 min-w-0">
        <img src="/logo.svg" alt="" className="h-6 w-6 shrink-0" />
        <span className="flex items-baseline gap-1.5 min-w-0 truncate">
          <span className="text-[11px] text-gray-400 tracking-wide">{BRAND_SERIES}</span>
          <span className="font-bold text-[15px] text-[#13294b]">{BRAND_NAME}</span>
        </span>
      </Link>
      <button
        className="ml-auto p-2 rounded hover:bg-gray-100 flex flex-col gap-1 justify-center"
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
