import { initialColumns } from './data/municipalities'
import MuniTable from './components/MuniTable'

function App() {
  return (
    <>
      <title>自由探索 — 日本の自治体データ</title>
      <MuniTable title="自由探索" initialColumns={initialColumns} />
    </>
  )
}

export default App
