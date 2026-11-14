import { Link } from 'react-router-dom'
import { BRAND_FULL } from '@/lib/brand'

function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <p className="max-w-5xl mx-auto px-4 py-6 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
        <span>{BRAND_FULL}</span>
        <Link to="/data" className="hover:underline">データと出典</Link>
        <Link to="/formulas" className="hover:underline">式の記述方法</Link>
        <span>© 2026 <a target="_blank" rel="noopener noreferrer" href="https://lakiryt.com" className="hover:underline">Lakiryt</a></span>
      </p>
    </footer>
  )
}

export default SiteFooter
