import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

const REF_RE = /Ref[:\.]?\s*(\S+)/i
const SEQ_CODE_RE = /Sequ[êe]ncia:\s*(.+?)\s*-\s*(\S+)/i
const HEADER_RE = /Opera[çc][ãa]o/i
const MAQUINA_RE = /M[áa]quina/i
const DURACAO_HEADER_RE = /Dura[çc][ãa]o/i
const DURACAO_VALOR_RE = /\d+[,.]\d+/
const OBS_RE = /^Observa[çc][õo]es:?$/i

/**
 * Lê um PDF de "Fichas Técnicas" (sequências operacionais) e retorna,
 * para cada código de modelo encontrado, a quantidade de operações
 * listadas na tabela "Sequência: <Tipo> - <Código>".
 */
export async function countOperationsByCode(file: File): Promise<Record<string, number>> {
  const buf = await file.arrayBuffer()
  const pdf = await getDocument({ data: buf }).promise
  const result: Record<string, number> = {}

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()

    // Agrupa os itens de texto em "linhas" por posição vertical
    const lines: { y: number; parts: { x: number; str: string }[] }[] = []
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = item.transform[5] as number
      const x = item.transform[4] as number
      let line = lines.find(l => Math.abs(l.y - y) <= 2)
      if (!line) { line = { y, parts: [] }; lines.push(line) }
      line.parts.push({ x, str: item.str })
    }

    const sortedLines = lines
      .sort((a, b) => b.y - a.y) // topo -> base da página
      .map(l => l.parts.sort((a, b) => a.x - b.x).map(p => p.str).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)

    let currentCode: string | null = null
    let counting = false

    for (const line of sortedLines) {
      const refMatch = line.match(REF_RE)
      if (refMatch) {
        currentCode = refMatch[1]
        counting = false
        if (!(currentCode in result)) result[currentCode] = 0
        continue
      }
      const seqMatch = line.match(SEQ_CODE_RE)
      if (seqMatch) {
        currentCode = seqMatch[2]
        counting = false
        if (!(currentCode in result)) result[currentCode] = 0
        continue
      }
      if (HEADER_RE.test(line) && MAQUINA_RE.test(line) && DURACAO_HEADER_RE.test(line)) {
        counting = true
        continue
      }
      if (OBS_RE.test(line)) {
        counting = false
        continue
      }
      if (counting && currentCode && DURACAO_VALOR_RE.test(line)) {
        result[currentCode] = (result[currentCode] ?? 0) + 1
      }
    }
  }

  return result
}
