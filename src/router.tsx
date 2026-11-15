import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import HomePage from './components/pages/HomePage'
import RankingPage from './components/pages/RankingPage'
import { densityConfig } from './rankings/density'
import { cityPopulationConfig } from './rankings/cityPopulation'
import { areaConfig, cityAreaConfig } from './rankings/area'
import FormulasPage from './components/pages/FormulasPage'
import MunicipalityPage from './components/pages/MunicipalityPage'
import PrefRankingPage from './components/pages/PrefRankingPage'
import PrefHubPage from './components/pages/PrefHubPage'
import DataSourcesPage from './components/pages/DataSourcesPage'
import { populationChangeConfig } from './rankings/populationChange'
import { designatedCitiesConfig, coreCitiesConfig } from './rankings/designatedCities'
import { townVillageConfig } from './rankings/townsVillages'
import MuniTable from './components/MuniTable'
import Canonical from './components/Canonical'
import populationOver500k from './rankings/populationOver500k'
import { populationConfig } from './rankings/population'
import { elderlyRatioConfig } from './rankings/elderlyRatio'
import { rentConfig } from './rankings/rent'
import { municipalPopulationConfig, householdsConfig } from './rankings/municipalPopulation'
import { loveCompetitionConfig, pensionRentConfig, newcomersConfig } from './rankings/life'
import rentLaborDaysConfig from './rankings/rentLaborDays'
import { initialColumns } from './data/municipalities'

const router = createBrowserRouter([
  { path: '/',                                   element: <HomePage /> },
  { path: '/explore',                            element: <App /> },
  { path: '/rankings/:pref',                     element: <PrefHubPage /> },
  { path: '/rankings/:pref/population',          element: <PrefRankingPage configFor={municipalPopulationConfig} /> },
  { path: '/rankings/:pref/households',          element: <PrefRankingPage configFor={householdsConfig} /> },
  { path: '/rankings/:pref/elderly-ratio',       element: <PrefRankingPage configFor={elderlyRatioConfig} /> },
  { path: '/rankings/:pref/rent',                element: <PrefRankingPage configFor={rentConfig} /> },
  { path: '/rankings/:pref/love-competition',    element: <PrefRankingPage configFor={loveCompetitionConfig} /> },
  { path: '/rankings/:pref/pension-rent',        element: <PrefRankingPage configFor={pensionRentConfig} /> },
  { path: '/rankings/:pref/newcomers',           element: <PrefRankingPage configFor={newcomersConfig} /> },
  { path: '/rankings/:pref/density',             element: <PrefRankingPage configFor={densityConfig} /> },
  { path: '/rankings/:pref/cities',              element: <PrefRankingPage configFor={cityPopulationConfig} /> },
  { path: '/rankings/:pref/area',                element: <PrefRankingPage configFor={areaConfig} /> },
  { path: '/rankings/:pref/city-area',           element: <PrefRankingPage configFor={cityAreaConfig} /> },
  { path: '/rankings/:pref/population-change',  element: <PrefRankingPage configFor={(p, sel) => populationChangeConfig(p, 'growth', sel)} /> },
  { path: '/rankings/:pref/population-decline', element: <PrefRankingPage configFor={(p, sel) => populationChangeConfig(p, 'decline', sel)} /> },
  { path: '/rankings/:pref/towns',              element: <PrefRankingPage configFor={p => townVillageConfig(p, '町')} /> },
  { path: '/rankings/:pref/villages',           element: <PrefRankingPage configFor={p => townVillageConfig(p, '村')} /> },
  { path: '/rankings/all/designated-cities',    element: <RankingPage config={designatedCitiesConfig} /> },
  { path: '/rankings/all/core-cities',          element: <RankingPage config={coreCitiesConfig} /> },
  { path: '/rankings/all/population-over-500k', element: <RankingPage config={populationOver500k} /> },
  { path: '/rankings/all/rent-labor-days',       element: <RankingPage config={rentLaborDaysConfig} /> },
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
