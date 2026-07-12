import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import HomePage from './components/pages/HomePage'
import RankingPage from './components/pages/RankingPage'
import DensityPage from './components/pages/DensityPage'
import CityPopulationPage from './components/pages/CityPopulationPage'
import AreaPage from './components/pages/AreaPage'
import CityAreaPage from './components/pages/CityAreaPage'
import FormulasPage from './components/pages/FormulasPage'
import MuniTable from './components/MuniTable'
import Canonical from './components/Canonical'
import populationOver500k from './rankings/populationOver500k'
import { populationConfig } from './rankings/population'
import elderlyRatioConfig from './rankings/elderlyRatio'
import rentConfig from './rankings/rent'
import { initialColumns } from './data/municipalities'

const router = createBrowserRouter([
  { path: '/',                                   element: <HomePage /> },
  { path: '/explore',                            element: <App /> },
  { path: '/rankings/:pref/density',             element: <DensityPage /> },
  { path: '/rankings/:pref/cities',              element: <CityPopulationPage /> },
  { path: '/rankings/:pref/area',                element: <AreaPage /> },
  { path: '/rankings/:pref/city-area',           element: <CityAreaPage /> },
  { path: '/rankings/all/population-over-500k', element: <RankingPage config={populationOver500k} /> },
  { path: '/rankings/all/elderly-ratio',        element: <RankingPage config={elderlyRatioConfig} /> },
  { path: '/rankings/all/rent',                  element: <RankingPage config={rentConfig} /> },
  { path: '/list/all/population',              element: <RankingPage config={populationConfig} /> },
  { path: '/formulas',                           element: <FormulasPage /> },
  {
    path: '/search',
    element: (
      <>
        <Canonical />
        <meta name="description" content="市区町村名・都道府県・種別・区分などで絞り込み、人口や面積など様々な統計でソートできます。" />
        <MuniTable title="自由探索" initialColumns={initialColumns} initialSearchOpen restrictToOfficial />
      </>
    ),
  },
])

export function Router() {
  return <RouterProvider router={router} />
}
