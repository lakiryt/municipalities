import { prefectures } from '@/data/municipalities'
import {
  MUNI_TYPES, KUBUN_OPTS,
  type FilterState,
} from '@/data/columnDefs'

type Props = {
  value: FilterState
  onChange: (s: FilterState) => void
  disabled?: boolean
}

function FilterInput({ value, onChange, disabled }: Props) {
  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    onChange({ ...value, [k]: v })

  const headLabel = 'block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5'
  const checkRow  = 'flex items-center gap-2 text-sm cursor-pointer select-none'

  return (
    <fieldset disabled={disabled} className="space-y-4">
      {/* Kana search */}
      <div>
        <label className={headLabel}>名前（よみかた）</label>
        <input
          type="text"
          value={value.kana}
          onChange={e => set('kana', e.target.value)}
          placeholder="かな（前方一致）"
          className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>

      {/* Prefecture */}
      <div>
        <label className={headLabel}>都道府県</label>
        <select
          value={value.pref}
          onChange={e => set('pref', e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">全国</option>
          {prefectures.map(p => (
            <option key={p.code} value={p.kanji}>{p.kanji}</option>
          ))}
        </select>
      </div>

      {/* Type */}
      <div>
        <p className={headLabel}>種別</p>
        <div className="grid grid-cols-2 gap-y-1.5">
          {MUNI_TYPES.map(t => (
            <label key={t.key} className={checkRow}>
              <input
                type="checkbox"
                checked={value.types[t.key]}
                onChange={() => set('types', { ...value.types, [t.key]: !value.types[t.key] })}
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      {/* Designation */}
      <div>
        <p className={headLabel}>区分</p>
        <div className="space-y-1.5">
          {KUBUN_OPTS.map(o => (
            <label key={o.key} className={checkRow}>
              <input
                type="checkbox"
                checked={value.kubun[o.key]}
                onChange={() => set('kubun', { ...value.kubun, [o.key]: !value.kubun[o.key] })}
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  )
}

export default FilterInput
