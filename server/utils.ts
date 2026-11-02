export function apiErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** Batas aman body multipart (file Excel ikut di dalamnya). */
const MAX_MULTIPART_BYTES = 16 * 1024 * 1024

export async function readMultipart(req: import('node:http').IncomingMessage): Promise<{
  fields: Record<string, string>
  files: { fieldname: string; filename: string; contentType: string; data: Buffer }[]
}> {
  const fields: Record<string, string> = {}
  const files: { fieldname: string; filename: string; contentType: string; data: Buffer }[] = []

  const contentType = String(req.headers['content-type'] ?? '')
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
  if (!boundaryMatch) return { fields, files }
  const boundary = `--${(boundaryMatch[1] ?? boundaryMatch[2]).trim()}`

  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_MULTIPART_BYTES) {
      throw new Error('File yang diunggah terlalu besar.')
    }
    chunks.push(buffer)
  }

  const body = Buffer.concat(chunks)
  const delimiter = Buffer.from(boundary, 'latin1')

  let cursor = body.indexOf(delimiter)
  if (cursor === -1) return { fields, files }

  while (cursor !== -1) {
    let start = cursor + delimiter.length
    // "--" menandakan akhir dari multipart.
    if (body[start] === 0x2d && body[start + 1] === 0x2d) break
    // Lewati CRLF setelah boundary.
    if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2

    const next = body.indexOf(delimiter, start)
    if (next === -1) break

    let end = next
    // Buang CRLF sebelum boundary berikutnya.
    if (body[end - 2] === 0x0d && body[end - 1] === 0x0a) end -= 2

    const part = body.subarray(start, end)
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
    if (headerEnd !== -1) {
      const headerText = part.subarray(0, headerEnd).toString('utf8')
      const data = part.subarray(headerEnd + 4)

      let fieldname = ''
      let filename: string | null = null
      let partContentType = 'application/octet-stream'
      for (const line of headerText.split('\r\n')) {
        const lower = line.toLowerCase()
        if (lower.startsWith('content-disposition:')) {
          fieldname = line.match(/\bname="([^"]*)"/i)?.[1] ?? ''
          filename = line.match(/\bfilename="([^"]*)"/i)?.[1] ?? null
        } else if (lower.startsWith('content-type:')) {
          partContentType = line.slice('content-type:'.length).trim()
        }
      }

      if (fieldname) {
        if (filename !== null) {
          // Data file harus tetap berupa Buffer mentah (tidak boleh di-decode UTF-8).
          files.push({ fieldname, filename, contentType: partContentType, data: Buffer.from(data) })
        } else {
          fields[fieldname] = data.toString('utf8')
        }
      }
    }

    cursor = next
  }

  return { fields, files }
}
