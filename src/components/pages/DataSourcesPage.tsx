import { useState } from 'react'
import meta from '@/assets/meta.json'
import { dataset } from '@/data/datasets'
import AppHeader from '@/components/AppHeader'
import Sidebar from '@/components/Sidebar'
import Canonical from '@/components/Canonical'
import { pageTitle } from '@/lib/brand'
import SiteFooter from '@/components/SiteFooter'

const ids = Object.keys((meta as unknown as { datasets: Record<string, unknown> }).datasets)

// /data — every dataset the app uses, with its publisher, a link to the
// original, and the editions available here. Generated from meta.json, so it
// lists exactly what データの選択 offers.
function DataSourcesPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <>
      <title>{pageTitle('データと出典')}</title>
      <Canonical />
      <AppHeader title="データと出典" onMenuClick={() => setMenuOpen(true)} />
      {menuOpen && <Sidebar onClose={() => setMenuOpen(false)} />}
      <main className="pt-11 pb-10">
        <ul className="max-w-3xl mx-auto px-4 pt-4 divide-y divide-gray-100">
          {ids.map(id => {
            const ds = dataset(id)
            return (
              <li key={id} className="py-4" id={id}>
                <h2 className="font-semibold">
                  {ds.page ? <a href={ds.page} target="_blank" rel="noopener noreferrer" className="text-[#13294b] hover:underline">{ds.name ?? ds.label} ↗</a> : (ds.name ?? ds.label)}
                </h2>
                {ds.agency && <p className="text-sm text-gray-600">{ds.agency}</p>}
                {ds.editions.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">{ds.editions.map(e => e.label ?? e.as_of).join('、')}</p>
                )}
              </li>
            )
          })}
        </ul>
      </main>
      <SiteFooter />
    </>
  )
}

export default DataSourcesPage
