import { useEffect, useMemo, useState } from 'react'
import {
  fetchPopulationChange, fetchMunicipalityCodes, officialCodes, prefectures, defaultDataSelection,
  type ChangeMap, type CodeEntry,
} from './datasets'

export type CensusRow = {
  code: string
  name: string
  prefCode: string        // 2 digits
  prefName: string
  kind: '市' | '区' | '町' | '村' | ''
  prev: number
  latest: number
  rate: number            // percent; NaN when the earlier count is missing or 0
}

const kindOf = (name: string): CensusRow['kind'] => {
  const last = name.slice(-1)
  return last === '市' || last === '区' || last === '町' || last === '村' ? last : ''
}

// The light-weight data behind the home page and the prefecture pages: names
// and the default 人口増減 comparison (the last two 国勢調査; ≈ 3 small CSVs),
// not the full table data.
export function useCensusOverview() {
  const [codes, setCodes] = useState<CodeEntry[]>([])
  const [census, setCensus] = useState<ChangeMap>(new Map())
  useEffect(() => { fetchMunicipalityCodes().then(setCodes) }, [])
  useEffect(() => { fetchPopulationChange(defaultDataSelection().change).then(setCensus) }, [])

  return useMemo(() => {
    const prefName = new Map(prefectures.map(p => [p.code.slice(0, 2), p.kanji]))
    const row = (code: string, name: string): CensusRow => {
      const c = census.get(code)
      const prev = c?.from ?? NaN, latest = c?.to ?? NaN
      return {
        code, name, kind: kindOf(name),
        prefCode: code.slice(0, 2), prefName: prefName.get(code.slice(0, 2)) ?? '',
        prev, latest,
        rate: prev > 0 ? (latest / prev - 1) * 100 : NaN,
      }
    }
    // Municipalities and designated-city wards (both have a page); not
    // prefectures or grouping rows (郡・振興局).
    const places = codes
      .filter(c => !c.code.endsWith('000') && (officialCodes.has(c.code) || /市.+区$/.test(c.kanji)))
      .map(c => ({ ...row(c.code, c.kanji), kana: c.kana }))
    // Rankings keep to actual 地方公共団体.
    const municipalities = places.filter(p => officialCodes.has(p.code))
    const prefs = prefectures.map(p => row(p.code, p.kanji))
    return { municipalities, places, prefs, loaded: codes.length > 0 && census.size > 0 }
  }, [codes, census])
}
