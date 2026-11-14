import { useCallback, useEffect, useState } from 'react'

/**
 * The element's current width in px (charts draw at real size, so text stays
 * legible on phones). A callback ref, so measuring starts whenever the
 * element appears — also when a chart first renders a placeholder instead.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 600) {
  const [node, setNode] = useState<T | null>(null)
  const [width, setWidth] = useState(fallback)
  const ref = useCallback((el: T | null) => setNode(el), [])
  useEffect(() => {
    if (!node) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(node)
    return () => ro.disconnect()
  }, [node])
  return [ref, width] as const
}
