import { Link } from 'react-router-dom'

type Props = { onClose: () => void }

// Site menu (the page's own controls are on the page, not in here).
function Sidebar({ onClose }: Props) {
  const link = 'block px-4 py-2.5 text-sm hover:bg-gray-50'
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <nav className="fixed top-0 right-0 h-full w-64 bg-white shadow-xl z-50 flex flex-col" aria-label="メニュー">
        <div className="flex items-center justify-between h-11 px-4 border-b border-gray-200">
          <span className="text-sm font-semibold">メニュー</span>
          <button onClick={onClose} aria-label="メニューを閉じる" className="text-gray-500 hover:text-gray-700 leading-none text-lg">✕</button>
        </div>
        <div className="py-2">
          <Link to="/" onClick={onClose} className={link}>トップ</Link>
          <Link to="/rankings/all/population-change" onClick={onClose} className={link}>人口増加率ランキング</Link>
          <Link to="/rankings/all/designated-cities" onClick={onClose} className={link}>政令指定都市一覧</Link>
          <Link to="/search" onClick={onClose} className={link}>詳細検索</Link>
          <Link to="/explore" onClick={onClose} className={link}>自由探索（列・条件を自由に設定）</Link>
          <Link to="/formulas" onClick={onClose} className={link}>式の記述方法</Link>
          <Link to="/data" onClick={onClose} className={link}>データと出典</Link>
        </div>
        <div className="mt-auto p-4 text-xs text-gray-400">
          <p>© 2026 <a target="_blank" rel="noopener noreferrer" href="https://lakiryt.com">Lakiryt</a></p>
        </div>
      </nav>
    </>
  )
}

export default Sidebar
