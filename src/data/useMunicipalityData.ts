import { useEffect, useMemo, useState } from 'react'
import { buildItems, type BaseItem } from './municipalities'
import {
  fetchArea, fetchPopulation, fetchRent, fetchMinWages, fetchDesignations, fetchCoastal, fetchMunicipalityCodes, fetchCensusChange,
  type PopulationMap, type RentMap, type MinWageMap, type DesignationSets, type CodeEntry, type DataSelection, type CensusMap,
} from './datasets'

export type MunicipalityData = {
  // Every 標準地域コード row joined with the selected editions (wards and
  // grouping rows included — callers narrow it their own way).
  items: BaseItem[]
  designations: DesignationSets | undefined
  coastal: Set<string>
  loaded: boolean
}

// Loads what the table, the map and the detail page all share. The
// selectable datasets reload whenever データの選択 picks another edition.
// The census comparison (#census_*) is fetched only once a page uses it.
export function useMunicipalityData(selection: DataSelection, needCensus = false): MunicipalityData {
  const [popMap, setPopMap]             = useState<PopulationMap>(new Map())
  const [areaMap, setAreaMap]           = useState(new Map<string, number>())
  const [rentMap, setRentMap]           = useState<RentMap>(new Map())
  const [minWageMap, setMinWageMap]     = useState<MinWageMap>(new Map())
  const [designations, setDesignations] = useState<DesignationSets | undefined>(undefined)
  const [coastal, setCoastal]           = useState<Set<string>>(new Set())
  const [codes, setCodes]               = useState<CodeEntry[]>([])
  const [censusMap, setCensusMap]       = useState<CensusMap>(new Map())

  useEffect(() => { fetchPopulation(selection.pop).then(setPopMap) }, [selection.pop])
  useEffect(() => { fetchArea(selection.area).then(setAreaMap) }, [selection.area])
  useEffect(() => { fetchRent(selection.rent).then(setRentMap) }, [selection.rent])
  useEffect(() => { fetchMinWages(selection.minwage).then(setMinWageMap) }, [selection.minwage])

  useEffect(() => { if (needCensus) fetchCensusChange().then(setCensusMap) }, [needCensus])
  useEffect(() => { fetchDesignations().then(setDesignations) }, [])
  useEffect(() => { fetchCoastal().then(setCoastal) }, [])
  useEffect(() => { fetchMunicipalityCodes().then(setCodes) }, [])

  const items = useMemo(
    () => buildItems(popMap, areaMap, codes, rentMap, minWageMap, censusMap),
    [popMap, areaMap, codes, rentMap, minWageMap, censusMap]
  )
  return { items, designations, coastal, loaded: codes.length > 0 && popMap.size > 0 }
}
