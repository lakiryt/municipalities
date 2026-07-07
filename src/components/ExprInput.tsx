import { useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { varCompletions } from '@/data/municipalities'

export type ExprInputHandle = { insertAtCursor: (text: string) => void }

const COMPLETIONS = [
  'AND(', 'OR(', 'NOT(', 'LEQ(', 'EQ(', 'SUM(', 'MULT(', 'MIN(', 'MAX(', 'NEG(', 'INV(', 'ROUND(',
  ...varCompletions,
]

// The current token is everything between the last delimiter and the cursor.
// Delimiters: ( ) , and whitespace.
function tokenAtCursor(text: string, cursor: number): { token: string; start: number } {
  let start = cursor
  while (start > 0 && !/[(),\s]/.test(text[start - 1])) start--
  return { token: text.slice(start, cursor), start }
}

// Levenshtein edit distance between two strings.
function editDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[a.length][b.length]
}

// Typo-tolerance fallback only kicks in for near matches, otherwise every
// completion would show up (in distance order) for any keystroke.
const FUZZY_DISTANCE_THRESHOLD = 2

// Checks whether every character of `q` appears in `s`, in order (gaps allowed),
// e.g. "fema20" matches "female20_24" by skipping "le" and "_24"'s underscore.
// Returns the gap count (skipped chars between first and last match, lower = tighter)
// and the start index of the match (lower = earlier in the string), or null if
// `q` isn't a subsequence of `s`.
function subsequenceMatch(q: string, s: string): { gap: number; first: number } | null {
  let qi = 0
  let first = -1
  let last = -1
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) {
      if (first === -1) first = i
      last = i
      qi++
    }
  }
  if (qi < q.length) return null
  return { gap: (last - first + 1) - q.length, first }
}

function getSuggestions(token: string): string[] {
  if (!token) return []
  const q = token.toLowerCase()
  return COMPLETIONS
    .filter(c => c.toLowerCase() !== q)
    .map(c => {
      const lc = c.toLowerCase()
      if (lc.startsWith(q)) return { c, tier: 0, a: lc.length, b: 0 }
      if (lc.includes(q)) return { c, tier: 1, a: lc.indexOf(q), b: 0 }
      const match = subsequenceMatch(q, lc)
      if (match !== null) return { c, tier: 2, a: match.gap, b: match.first }
      return { c, tier: 3, a: editDistance(q, lc), b: 0 }
    })
    .filter(({ tier, a }) => tier < 3 || a <= FUZZY_DISTANCE_THRESHOLD)
    .sort((x, y) => x.tier - y.tier || x.a - y.a || x.b - y.b)
    .map(({ c }) => c)
}

type Props = {
  initialExpression?: string
  placeholder?: string
  onChange: (raw: string) => void
}

const ExprInput = forwardRef<ExprInputHandle, Props>(function ExprInput({ initialExpression = '', placeholder, onChange }, handleRef) {
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

  useImperativeHandle(handleRef, () => ({ insertAtCursor: complete }))

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
        rows={2}
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
})

export default ExprInput
