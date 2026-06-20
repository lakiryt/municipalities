import { initialColumns } from './data/municipalities'
import MuniTable from './components/MuniTable'

function App() {
  return <MuniTable initialColumns={initialColumns} />
}

export default App
