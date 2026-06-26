import { initialColumns } from './data/municipalities'
import MuniTable from './components/MuniTable'

function App() {
  return (
    <>
      <meta name="description" content="表示する列・フィルター・並び順を自由にカスタマイズして市区町村データを探索できます。" />
      <MuniTable title="自由探索" initialColumns={initialColumns} />
    </>
  )
}

export default App
