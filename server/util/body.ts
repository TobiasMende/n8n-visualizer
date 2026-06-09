import { createError, type H3Event } from 'h3'

// Reads and JSON-parses the request body while enforcing a hard byte cap during
// streaming. Unlike a content-length header check, this also bounds chunked
// requests (which carry no content-length) and clients that lie about size.
//
// On overflow we stop buffering and reject (the handler then returns 413) but
// keep draining the socket so the client still receives a clean response
// instead of a connection reset. Memory stays bounded because over-limit
// chunks are discarded, not retained.
export function readJsonBodyCapped(event: H3Event, maxBytes: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = event.node.req
    const chunks: Buffer[] = []
    let size = 0
    let overflowed = false
    let settled = false

    req.on('data', (c: Buffer) => {
      if (overflowed) return // keep draining, but stop buffering
      size += c.length
      if (size > maxBytes) {
        overflowed = true
        chunks.length = 0 // release what we buffered
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      if (overflowed)
        return reject(createError({ statusCode: 413, statusMessage: 'Request body exceeds the size limit' }))
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(null)
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(createError({ statusCode: 400, statusMessage: 'Invalid JSON body' }))
      }
    })
    req.on('error', () => {
      if (settled) return
      settled = true
      reject(createError({ statusCode: 400, statusMessage: 'Could not read request body' }))
    })
  })
}
