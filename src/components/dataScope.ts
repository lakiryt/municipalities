import { createContext } from 'react'
import { ANY_DATA, type Scope } from '@/data/schema'

// The variables the page's データの選択 provides, for the expression editors
// inside it (a page with no selection to respect leaves every variable open).
export const DataScope = createContext<Scope>(ANY_DATA)
