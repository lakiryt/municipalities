import { initialColumns } from './data/municipalities'
import MuniTable from './components/MuniTable'
import Canonical from './components/Canonical'

function App() {
  return (
    <>
      <Canonical />
      <meta name="description" content="表示する列・フィルター・並び順を自由にカスタマイズして市区町村データを探索できます。" />
      <MuniTable title="自由探索" initialColumns={initialColumns} restrictToOfficial />
    </>
  )
}

export default App
