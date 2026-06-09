export function matchesQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  return !q || text.toLowerCase().includes(q)
}

export function tagsMatch(tags: string[], selected: string[]): boolean {
  return selected.length === 0 || tags.some(t => selected.includes(t))
}
