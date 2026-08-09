export function prettyCategory(key: string): string {
  const s = key.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function pct(rate: number): string {
  return `${Math.round(rate * 100)}`
}

export function prettyCheck(name: string): string {
  return name.replace(/_/g, ' ')
}
