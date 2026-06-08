const ACRONYMS: Record<string, string> = {
  http: 'HTTP', https: 'HTTPS', api: 'API', url: 'URL', ai: 'AI',
  s3: 'S3', sql: 'SQL', html: 'HTML', xml: 'XML', json: 'JSON',
  csv: 'CSV', ftp: 'FTP', ssh: 'SSH', oauth: 'OAuth', id: 'ID',
}

export function prettifyType(type: string): string {
  const afterDot = type.includes('.') ? type.slice(type.lastIndexOf('.') + 1) : type
  const words = afterDot
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return words
    .map(w => ACRONYMS[w.toLowerCase()] ?? (w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}
