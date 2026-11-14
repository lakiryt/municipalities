import { dataset, selectedSource, type DataKey, type DataSelection } from '@/data/datasets'

type Props = {
  used: DataKey[]
  selection: DataSelection
  designations: boolean
  map: boolean
  compact?: boolean
}

type Line = { agency?: string; name?: string; edition?: string; page?: string }

// 出典: like a figure caption under the table — names, readings and codes
// always come from 標準地域コード; the rest is whatever data is on screen.
function SourceNote({ used, selection, designations, map, compact = false }: Props) {
  const lines: Line[] = []
  const add = (id: string, edition?: string) => {
    const ds = dataset(id)
    lines.push({ agency: ds.agency, name: ds.name ?? ds.label, edition, page: ds.page })
  }
  for (const k of used) {
    const src = selectedSource(k, selection)
    if (src && src.path !== 'effective') add(src.dataset, src.name)
    else if (src) add('minwage', '現在発効中の額')
  }
  if (designations) add('designations')
  if (map) add('map', dataset('map').editions[0]?.as_of)
  add('codes', dataset('codes').editions[0]?.as_of)

  return (
    <div className={`w-full max-w-5xl mx-auto px-4 text-xs text-gray-500 ${compact ? 'py-1 truncate' : 'py-4'}`}>
      <span className="font-semibold">出典：</span>
      {lines.map((l, i) => (
        <span key={i}>
          {i > 0 && '、'}
          {l.agency}「{l.page ? <a href={l.page} target="_blank" rel="noopener noreferrer" className="hover:underline">{l.name}</a> : l.name}」
          {l.edition && `（${l.edition}）`}
        </span>
      ))}
    </div>
  )
}

export default SourceNote
