import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import HomePage from './components/pages/HomePage'
import RankingPage from './components/pages/RankingPage'
import DensityPage from './components/pages/DensityPage'
import CityPopulationPage from './components/pages/CityPopulationPage'
import FormulasPage from './components/pages/FormulasPage'
import MuniTable from './components/MuniTable'
import populationOver500k from './rankings/populationOver500k'
import { populationConfig } from './rankings/population'
import elderlyRatioConfig from './rankings/elderlyRatio'
import { initialColumns } from './data/municipalities'

const router = createBrowserRouter([
  { path: '/',                                   element: <HomePage /> },
  { path: '/explore',                            element: <App /> },
  { path: '/rankings/:pref/density',             element: <DensityPage /> },
  { path: '/rankings/:pref/cities',              element: <CityPopulationPage /> },
  { path: '/rankings/all/population-over-500k', element: <RankingPage config={populationOver500k} /> },
  { path: '/rankings/all/elderly-ratio',        element: <RankingPage config={elderlyRatioConfig} /> },
  { path: '/list/all/population',              element: <RankingPage config={populationConfig} /> },
  { path: '/formulas',                           element: <FormulasPage /> },
  {
    path: '/search',
    element: (
      <>
        <title>自由探索 — 日本の自治体データ</title>
        <meta name="description" content="市区町村名・都道府県・種別・区分などで絞り込み、人口や面積など様々な統計でソートできます。" />
        <MuniTable title="自由探索" initialColumns={initialColumns} initialSearchOpen />
      </>
    ),
  },
])

export function Router() {
  return <RouterProvider router={router} />
}
