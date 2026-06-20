import { useState, useRef } from 'react'

const COMPLETIONS = [
  'AND(', 'OR(', 'NOT(', 'LEQ(', 'EQ(', 'SUM(', 'MULT(', 'NEG(', 'INV(',
  '#total', '#male', '#female',
  '$code', '$kanji', '$kana', '$prefcode', '$prefkanji', '$prefkana',
]

// The current token is everything between the last delimiter and the cursor.
// Delimiters: ( ) , and whitespace.
function tokenAtCursor(text: string, cursor: number): { token: string; start: number } {
  let start = cursor
  while (start > 0 && !/[(),\s]/.test(text[start - 1])) start--
  return { token: text.slice(start, cursor), start }
}

function getSuggestions(token: string): string[] {
  if (!token) return []
  const q = token.toLowerCase()
  return COMPLETIONS.filter(c => c.toLowerCase().includes(q))
}

type Props = {
  initialExpression?: string
  placeholder?: string
  onChange: (raw: string) => void
}

function ExprInput({ initialExpression = '', placeholder, onChange }: Props) {
  const [value,       setValue]       = useState(initialExpression)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const ref = useRef<HTMLTextAreaElement>(null)

  const refreshSuggestions = (text: string, cursor: number) => {
    const { token } = tokenAtCursor(text, cursor)
    const next = getSuggestions(token)
    setSuggestions(next)
    setSelectedIdx(0)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const raw = e.target.value
    setValue(raw)
    onChange(raw)
    refreshSuggestions(raw, e.target.selectionStart ?? raw.length)
  }

  // Also update suggestions when the cursor moves without text changing (click / arrow)
  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    refreshSuggestions(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)
  }

  const complete = (suggestion: string) => {
    const ta = ref.current
    if (!ta) return
    const cursor = ta.selectionStart ?? value.length
    const { token, start } = tokenAtCursor(value, cursor)
    const next = value.slice(0, start) + suggestion + value.slice(start + token.length)
    const newCursor = start + suggestion.length
    setValue(next)
    setSuggestions([])
    onChange(next)
    // Restore focus and place cursor after the inserted text
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(newCursor, newCursor)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length === 0) return
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault()
      complete(suggestions[selectedIdx])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Escape') {
      setSuggestions([])
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        className="border border-gray-300 p-2 w-full font-mono text-sm rounded"
        rows={3}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        onBlur={() => setSuggestions([])}
        placeholder={placeholder}
        spellCheck={false}
      />
      {suggestions.length > 0 && (
        <ul className="absolute left-0 top-full z-20 mt-0.5 bg-white border border-gray-200 rounded shadow-lg w-max min-w-[10rem] py-0.5">
          {suggestions.map((s, i) => (
            <li
              key={s}
              className={`px-3 py-1 text-sm font-mono cursor-pointer ${i === selectedIdx ? 'bg-blue-100 text-blue-900' : 'text-gray-800 hover:bg-gray-50'}`}
              onMouseDown={e => { e.preventDefault(); complete(s) }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ExprInput
