import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import HomePage from './components/HomePage'
import RankingPage from './components/RankingPage'
import DensityPage from './components/DensityPage'
import FormulasPage from './components/FormulasPage'
import populationOver500k from './rankings/populationOver500k'

const router = createBrowserRouter([
  { path: '/',                                   element: <HomePage /> },
  { path: '/explore',                            element: <App /> },
  { path: '/rankings/:pref/density',             element: <DensityPage /> },
  { path: '/rankings/all/population-over-500k', element: <RankingPage config={populationOver500k} /> },
  { path: '/formulas',                           element: <FormulasPage /> },
])

export function Router() {
  return <RouterProvider router={router} />
}
