export function formatPct(value: number | null | undefined, opts: { hasData?: boolean; emptyMark?: string } = {}): string {
  const { hasData = true, emptyMark = '—' } = opts
  if (!hasData) return emptyMark
  const v = value ?? 0
  return `${Math.round(v)}%`
}

export function formatCount(value: number | null | undefined, opts: { hasData?: boolean; emptyMark?: string } = {}): string {
  const { hasData = true, emptyMark = '—' } = opts
  if (!hasData) return emptyMark
  return String(value ?? 0)
}
