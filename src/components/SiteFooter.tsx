import { Link } from 'react-router-dom'
import { BRAND_FULL } from '@/lib/brand'

// Footer for the home page and the prefecture pages (table/map pages have
// their own 出典 line instead).
function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-6 text-xs text-gray-500 space-y-2">
        <p>
          データ：総務省「国勢調査」「住民基本台帳に基づく人口、人口動態及び世帯数」「住宅・土地統計調査」、
          国土地理院「全国都道府県市区町村別面積調」、厚生労働省「地域別最低賃金」、国土数値情報（行政区域）ほか。
          各ページの出典欄に、使っているデータと時点を載せています。
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <span>{BRAND_FULL}</span>
          <Link to="/formulas" className="hover:underline">式の記述方法</Link>
          <span>© 2026 <a target="_blank" rel="noopener noreferrer" href="https://lakiryt.com" className="hover:underline">Lakiryt</a></span>
        </p>
      </div>
    </footer>
  )
}

export default SiteFooter
