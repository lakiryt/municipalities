import { initialColumns } from './data/municipalities'
import { parseAndTypeCheck } from './lang/expr'
import MuniTable from './components/MuniTable'
import Canonical from './components/Canonical'

// Starts without designated-city wards (they would double-count their
// city) — as a visible filter the user can change or drop.
const OFFICIAL_ONLY = { expression: '&official', typed: parseAndTypeCheck('&official') }

function App() {
  return (
    <>
      <Canonical />
      <meta name="description" content="表示する列・フィルター・並び順を自由にカスタマイズして市区町村データを探索できます。" />
      <MuniTable title="自由探索" initialColumns={initialColumns} initialFilter={OFFICIAL_ONLY} />
    </>
  )
}

export default App
