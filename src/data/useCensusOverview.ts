import { useEffect, useMemo, useState } from 'react'
import { kindOf } from './municipalities'
import {
  fetchPopulationChange, fetchMunicipalityCodes, officialCodes, prefectures, defaultDataSelection,
  type ChangeMap, type CodeEntry,
} from './datasets'

export type CensusRow = {
  code: string
  name: string
  prefCode: string        // 2 digits
  prefName: string
  kind: string            // $kind: 市 / 町 / 村 / 特別区 / 政令市の区 / 都道府県
  prev: number
  latest: number
  rate: number            // percent; NaN when the earlier count is missing or 0
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
    const row = (code: string, name: string, parent = ''): CensusRow => {
      const c = census.get(code)
      const prev = c?.from ?? NaN, latest = c?.to ?? NaN
      return {
        code, name, kind: kindOf({ code, kanji: name, parent }),
        prefCode: code.slice(0, 2), prefName: prefName.get(code.slice(0, 2)) ?? '',
        prev, latest,
        rate: prev > 0 ? (latest / prev - 1) * 100 : NaN,
      }
    }
    // Municipalities and designated-city wards (both have a page); not
    // prefectures or grouping rows (郡・振興局).
    const places = codes
      .filter(c => !c.code.endsWith('000') && (officialCodes.has(c.code) || c.parent))
      .map(c => ({ ...row(c.code, c.kanji, c.parent), kana: c.kana }))
    // Rankings keep to actual 地方公共団体.
    const municipalities = places.filter(p => officialCodes.has(p.code))
    const prefs = prefectures.map(p => row(p.code, p.kanji))
    return { municipalities, places, prefs, loaded: codes.length > 0 && census.size > 0 }
  }, [codes, census])
}
