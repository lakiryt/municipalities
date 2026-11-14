import * as codes from './codes.mjs'
import * as dantai from './dantai.mjs'
import * as jumin from './jumin.mjs'
import * as kokusei from './kokusei.mjs'
import * as area from './area.mjs'
import * as designations from './designations.mjs'
import * as rent from './rent.mjs'
import * as minwage from './minwage.mjs'
import * as map from './map.mjs'

// Keys match data/sources.json. Each module exports fetchRaw(src, opts) and
// build(src, opts) → { editions, merge? }; optionally find(src, args).
export const DATASETS = { codes, dantai, jumin, kokusei, area, designations, rent, minwage, map }
