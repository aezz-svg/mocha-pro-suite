export type PdfInfo = {
  name: string
  sizeBytes: number
  pages: number
  version: string
  encrypted: boolean
  objects: number
  images: number
  fonts: number
  hasForms: boolean
  hasJavaScript: boolean
  linearized: boolean
  producer: string | null
  inspectMs: number
}

export async function inspectPdf(file: File): Promise<PdfInfo> {
  const started = performance.now()
  const buffer = await file.arrayBuffer()
  const text = new TextDecoder('latin1').decode(buffer)

  const version = text.slice(0, 32).match(/%PDF-(\d\.\d)/)?.[1] ?? 'N/A'
  const pageObjects = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0
  const pageCounts = [...text.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)].map((m) => Number(m[1]))
  const pageCountsAlt = [...text.matchAll(/\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages/g)].map((m) => Number(m[1]))
  const pages = Math.max(pageObjects, ...pageCounts, ...pageCountsAlt, 0)
  const producer = text.match(/\/Producer\s*\(([^)]{1,80})\)/)?.[1] ?? null

  return {
    name: file.name,
    sizeBytes: file.size,
    pages,
    version,
    encrypted: /\/Encrypt\s/.test(text),
    objects: text.match(/\d+\s+\d+\s+obj\b/g)?.length ?? 0,
    images: text.match(/\/Subtype\s*\/Image/g)?.length ?? 0,
    fonts: text.match(/\/Type\s*\/Font\b/g)?.length ?? 0,
    hasForms: /\/AcroForm/.test(text),
    hasJavaScript: /\/JavaScript|\/JS\s/.test(text),
    linearized: /\/Linearized/.test(text.slice(0, 2048)),
    producer,
    inspectMs: Math.round(performance.now() - started),
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`
}

export function parsePageRanges(input: string, maxPage: number): number[] {
  const pages = new Set<number>()
  for (const part of input.split(',').map((s) => s.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y)
      for (let p = a; p <= b; p++) pages.add(p)
    } else if (/^\d+$/.test(part)) {
      pages.add(Number(part))
    }
  }
  return [...pages].filter((p) => p >= 1 && (maxPage === 0 || p <= maxPage)).sort((a, b) => a - b)
}

export function pagesToRanges(pages: number[]) {
  const sorted = [...pages].sort((a, b) => a - b)
  const parts: string[] = []
  let start = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i]
    if (current === prev + 1) {
      prev = current
      continue
    }
    if (start !== undefined) parts.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = current
    prev = current
  }
  return parts.join(', ')
}
