import { ALL_COL_DEFS, GROUPS, type ColKey } from '@/data/columnDefs'

type Props = {
  value: ColKey[]
  onChange: (keys: ColKey[]) => void
  /** When true, only one column may be selected at a time */
  singleSelect?: boolean
  disabled?: boolean
}

function ColumnInput({ value, onChange, singleSelect, disabled }: Props) {
  const toggle = (key: ColKey) => {
    if (singleSelect) {
      onChange(value[0] === key ? [] : [key])
    } else {
      onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key])
    }
  }

  return (
    <fieldset disabled={disabled} className="border border-gray-200 rounded overflow-hidden text-sm">
      {GROUPS.map(group => {
        const cols = ALL_COL_DEFS.filter(c => c.group === group)
        return (
          <div key={group}>
            <div className="px-2.5 py-1 text-xs font-semibold text-gray-400 bg-gray-50 border-b border-gray-200">
              {group}
            </div>
            {cols.map(col => (
              <label
                key={col.key}
                className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-b-0 disabled:cursor-not-allowed"
              >
                <input
                  type={singleSelect ? 'radio' : 'checkbox'}
                  name={singleSelect ? 'column-single' : undefined}
                  checked={value.includes(col.key)}
                  onChange={() => toggle(col.key)}
                />
                {col.label}
              </label>
            ))}
          </div>
        )
      })}
    </fieldset>
  )
}

export default ColumnInput
