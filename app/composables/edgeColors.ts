export const EDGE_COLORS: Record<string, string> = {
  execute: '#3ddc97',
  webhookHttp: '#10b981',
  error: '#ef4444',
  trigger: '#f5a623',
  dataTable: '#b48cff',
}

export const EDGE_FALLBACK = '#6aa0ff'

export function edgeColor(type: string | undefined): string {
  return (type && EDGE_COLORS[type]) || EDGE_FALLBACK
}
