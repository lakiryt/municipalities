import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { normalizeKana } from '@/data/municipalities'

export type SearchEntry = { code: string; name: string; kana: string; prefName: string; population: number }

type Props = { entries: SearchEntry[] }

const MAX = 8

// Jump straight to a municipality's page by name or reading (kanji, hiragana
// or katakana). Arrow keys move through the suggestions, Enter opens one.
function MuniSearch({ entries }: Props) {
  const navigate = useNavigate()
  const listId = useId()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)

  const results = useMemo(() => {
    const query = q.trim()
    if (!query) return []
    const kanaQ = normalizeKana(query)
    const scored: { e: SearchEntry; score: number }[] = []
    for (const e of entries) {
      const kana = normalizeKana(e.kana)
      const score =
        e.name.startsWith(query) ? 0 :
        kana.startsWith(kanaQ) ? 1 :
        e.name.includes(query) || `${e.prefName}${e.name}`.includes(query) ? 2 : -1
      if (score >= 0) scored.push({ e, score })
    }
    scored.sort((a, b) => a.score - b.score || (b.e.population || 0) - (a.e.population || 0))
    return scored.slice(0, MAX).map(s => s.e)
  }, [q, entries])

  const go = (e: SearchEntry | undefined) => { if (e) navigate(`/m/${e.code}`) }
  const open = results.length > 0

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">市区町村名で探す</label>
      <div className="flex items-center gap-2 rounded-xl border-2 border-navy-900/20 bg-white px-3 focus-within:border-navy-900 transition-colors">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-navy-500" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder="市区町村名で探す"
          className="w-full py-3 bg-transparent outline-none text-base placeholder:text-gray-400"
          value={q}
          onChange={e => { setQ(e.target.value); setActive(0) }}
          onKeyDown={e => {
            if (e.nativeEvent.isComposing) return
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); go(results[active]) }
            else if (e.key === 'Escape') setQ('')
          }}
        />
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          {results.map((e, i) => (
            <li
              key={e.code}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`flex items-baseline gap-2 px-4 py-2 cursor-pointer ${i === active ? 'bg-navy-100' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={ev => { ev.preventDefault(); go(e) }}
            >
              <span className="font-medium">{e.name}</span>
              <span className="text-xs text-gray-500">{e.prefName}</span>
              {!Number.isNaN(e.population) && e.population > 0 && (
                <span className="ml-auto text-xs text-gray-400 tabular-nums">{e.population.toLocaleString('ja-JP')}人</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MuniSearch
