import { useEffect, useMemo, useState } from 'react'
import { buildItems, type BaseItem } from './municipalities'
import {
  fetchArea, fetchPopulation, fetchRent, fetchMinWages, fetchDesignations, fetchCoastal, fetchMunicipalityCodes, fetchPopulationChange,
  type PopulationMap, type RentMap, type MinWageMap, type DesignationSets, type CodeEntry, type DataSelection, type ChangeMap,
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
// 人口増減 (#pop_from / #pop_to) is fetched only when a page uses it.
export function useMunicipalityData(selection: DataSelection, needChange = false): MunicipalityData {
  const [popMap, setPopMap]             = useState<PopulationMap>(new Map())
  const [areaMap, setAreaMap]           = useState(new Map<string, number>())
  const [rentMap, setRentMap]           = useState<RentMap>(new Map())
  const [minWageMap, setMinWageMap]     = useState<MinWageMap>(new Map())
  const [designations, setDesignations] = useState<DesignationSets | undefined>(undefined)
  const [coastal, setCoastal]           = useState<Set<string>>(new Set())
  const [codes, setCodes]               = useState<CodeEntry[]>([])
  const [changeMap, setChangeMap]       = useState<ChangeMap>(new Map())

  useEffect(() => { fetchPopulation(selection.pop).then(setPopMap) }, [selection.pop])
  useEffect(() => { fetchArea(selection.area).then(setAreaMap) }, [selection.area])
  useEffect(() => { fetchRent(selection.rent).then(setRentMap) }, [selection.rent])
  useEffect(() => { fetchMinWages(selection.minwage).then(setMinWageMap) }, [selection.minwage])

  useEffect(() => { if (needChange) fetchPopulationChange(selection.change).then(setChangeMap) }, [needChange, selection.change])
  useEffect(() => { fetchDesignations().then(setDesignations) }, [])
  useEffect(() => { fetchCoastal().then(setCoastal) }, [])
  useEffect(() => { fetchMunicipalityCodes().then(setCodes) }, [])

  const items = useMemo(
    () => buildItems(popMap, areaMap, codes, rentMap, minWageMap, changeMap),
    [popMap, areaMap, codes, rentMap, minWageMap, changeMap]
  )
  return { items, designations, coastal, loaded: codes.length > 0 && popMap.size > 0 }
}
