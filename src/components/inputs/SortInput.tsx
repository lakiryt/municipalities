import { ALL_SORT_OPTIONS } from '@/data/columnDefs'

export type SortSimpleState = { key: string }

type Props = {
  value: SortSimpleState
  onChange: (s: SortSimpleState) => void
  disabled?: boolean
}

function SortInput({ value, onChange, disabled }: Props) {
  return (
    <fieldset disabled={disabled}>
      <select
        value={value.key}
        onChange={e => onChange({ key: e.target.value })}
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400"
      >
        {ALL_SORT_OPTIONS.map(opt => (
          <option key={opt.key} value={opt.key}>{opt.label}</option>
        ))}
      </select>
    </fieldset>
  )
}

export default SortInput
