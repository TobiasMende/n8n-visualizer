export function useOfficialHost(): boolean {
  const { hostname } = useRequestURL()
  return hostname === 'effizienzagent.de' || hostname.endsWith('.effizienzagent.de')
}
