import { createBrowserRouter, RouterProvider } from 'react-router-dom'
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

const router = createBrowserRouter([
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
])

export function Router() {
  return <RouterProvider router={router} />
}
