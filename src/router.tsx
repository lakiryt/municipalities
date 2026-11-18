import { createBrowserRouter, RouterProvider, Outlet, useMatches, type RouteObject } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App'
import HomePage from './components/pages/HomePage'
import RankingPage from './components/pages/RankingPage'
import FormulasPage from './components/pages/FormulasPage'
import MunicipalityPage from './components/pages/MunicipalityPage'
import PrefRankingPage from './components/pages/PrefRankingPage'
import { RANKINGS } from './rankings/catalog'
import PrefHubPage from './components/pages/PrefHubPage'
import DataSourcesPage from './components/pages/DataSourcesPage'
import MuniTable from './components/MuniTable'
import Canonical from './components/Canonical'
import { populationConfig } from './rankings/population'
import { initialColumns } from './data/municipalities'

const pages: (RouteObject & { path: string })[] = [
  { path: '/',                                   element: <HomePage /> },
  { path: '/explore',                            element: <App /> },
  { path: '/rankings/:pref',                     element: <PrefHubPage /> },
  // Every ranking in the catalog: /rankings/<pref>/<slug>, or only
  // /rankings/all/<slug> for the national-only ones.
  ...RANKINGS.map(e => ({
    path: `/rankings/${e.perPref ? ':pref' : 'all'}/${e.slug}`,
    element: <PrefRankingPage configFor={e.configFor} />,
  })),
  { path: '/list/all/population',              element: <RankingPage config={populationConfig} /> },
  { path: '/data',                               element: <DataSourcesPage /> },
  { path: '/formulas',                           element: <FormulasPage /> },
  { path: '/m/:code',                            element: <MunicipalityPage /> },
  {
    path: '/search',
    element: (
      <>
        <Canonical />
        <meta name="description" content="市区町村名・都道府県・種別・区分などで絞り込み、人口や面積など様々な統計でソートできます。" />
        <MuniTable title="自由探索" initialColumns={initialColumns} initialSearchOpen />
      </>
    ),
  },
]

// Speed Insights groups its measurements by route — /m/[code], not each of
// ~1,900 municipality pages apart. Each page carries its route's pattern.
type Handle = { route: string }
const routeOf = (path: string) => path.replace(/:(\w+)/g, '[$1]')

function Root() {
  const handle = useMatches().at(-1)?.handle as Handle | undefined
  return (
    <>
      <Outlet />
      <SpeedInsights route={handle?.route ?? null} />
    </>
  )
}

const router = createBrowserRouter([
  { element: <Root />, children: pages.map(p => ({ ...p, handle: { route: routeOf(p.path) } satisfies Handle })) },
])

export function Router() {
  return <RouterProvider router={router} />
}
