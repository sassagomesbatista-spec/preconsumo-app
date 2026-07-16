import ExcelJS from 'exceljs'
import type { FabricRow } from '../types'

// Brand colors (ARGB)
const A = {
  white:     'FFFFFFFF',
  cream:     'FFF5EFE4',
  rowAlt:    'FFFDFAF7',
  header:    'FFFAF7F4',
  border:    'FFE5DDD5',
  charcoal:  'FF2D2926',
  muted:     'FF7A6E67',
  lavLight:  'FFF0ECF5',
  lavCell:   'FFF8F4FC',
  lavText:   'FF5C4F7A',
  lavBorder: 'FFC8BDD8',
  sageLight: 'FFEEF3EA',
  sageCell:  'FFF2F7EF',
  sageText:  'FF3D6035',
  sageBorder:'FFB4C4A8',
}

function fill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}
function border(argb: string): Partial<ExcelJS.Borders> {
  const s = { style: 'thin' as const, color: { argb } }
  return { top: s, bottom: s, left: s, right: s }
}

// Escapa aspas duplas para uso como literal em fórmulas do Excel
function escFormula(s: string): string {
  return s.replace(/"/g, '""')
}

export async function exportExcel(rows: FabricRow[], clientName: string, colecao: string): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Pré Consumo App'

  /* ── Aba 1: Dados ── */
  const ws = wb.addWorksheet('Tecidos de variantes')

  ws.columns = [
    { header: 'Tipo Peça',      key: 'tipoPeca',     width: 16 },
    { header: 'Coleção',        key: 'colecao',      width: 22 },
    { header: 'Código',         key: 'codigo',       width: 12 },
    { header: 'Tema',           key: 'tema',         width: 20 },
    { header: 'Variante',       key: 'variante',     width: 24 },
    { header: 'Tecido',         key: 'tecido',       width: 22 },
    { header: 'Consumo (kg)',   key: 'consumo',      width: 14 },
    { header: 'Cor',            key: 'cor',          width: 20 },
    { header: 'QTADE À CORTAR', key: 'qtadeACortar', width: 16 },
    { header: 'Consumo Total (kg)', key: 'consumoTotal', width: 18 },
  ]

  // Header row
  const hRow = ws.getRow(1)
  hRow.height = 22
  hRow.eachCell((cell, col) => {
    const isQtd   = col === 9
    const isTotal = col === 10
    cell.fill      = fill(isQtd ? A.lavLight : isTotal ? A.sageLight : A.header)
    cell.font      = { name: 'Calibri', size: 10, bold: true,
                       color: { argb: isQtd ? A.lavText : isTotal ? A.sageText : A.charcoal } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border    = border(isQtd ? A.lavBorder : isTotal ? A.sageBorder : A.border)
  })

  // Data rows
  rows.forEach((row, i) => {
    const r = ws.addRow({
      tipoPeca:     row.tipoPeca,
      colecao:      row.colecao,
      codigo:       row.codigo,
      tema:         row.tema,
      variante:     row.variante,
      tecido:       row.tecido,
      consumo:      row.consumo,
      cor:          row.cor,
      qtadeACortar: row.qtadeACortar,
    })
    r.getCell(10).value = { formula: `G${r.number}*I${r.number}`, result: row.consumoTotal }
    r.height = 16
    const bg = i % 2 === 0 ? A.white : A.rowAlt

    r.eachCell((cell, col) => {
      const isQtd   = col === 9
      const isTotal = col === 10
      cell.fill      = fill(isQtd ? A.lavCell : isTotal ? A.sageCell : bg)
      cell.font      = { name: 'Calibri', size: 9,
                         color: { argb: isQtd ? A.lavText : isTotal ? A.sageText : A.charcoal },
                         bold: isQtd || isTotal }
      cell.alignment = { vertical: 'middle',
                         horizontal: (col === 7 || col === 9 || col === 10) ? 'right' : 'left' }
      cell.border    = { bottom: { style: 'thin', color: { argb: A.border } } }
      if (col === 7 || col === 9 || col === 10) cell.numFmt = '#,##0.000'
    })
  })

  ws.autoFilter = { from: 'A1', to: 'J1' }
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

  /* ── Aba 2: Totalizações ── */
  const wt = wb.addWorksheet('Totalizações')

  // Build summary
  const map = new Map<string, { consumo: number; codes: Set<string>; colorMap: Map<string, { consumo: number; codes: Set<string> }> }>()
  for (const row of rows) {
    if (!map.has(row.tecido)) map.set(row.tecido, { consumo: 0, codes: new Set(), colorMap: new Map() })
    const s = map.get(row.tecido)!
    s.consumo += row.consumoTotal
    s.codes.add(row.codigo)
    const cor = row.cor || '(sem cor)'
    const c = s.colorMap.get(cor) ?? { consumo: 0, codes: new Set<string>() }
    c.consumo += row.consumoTotal
    c.codes.add(row.codigo)
    s.colorMap.set(cor, c)
  }

  const summary = [...map.entries()]
    .map(([tecido, s]) => ({
      tecido,
      consumoTotal: Math.round(s.consumo * 1000) / 1000,
      qtdPecas: s.codes.size,
      qtdCores: s.colorMap.size,
      breakdown: [...s.colorMap.entries()]
        .map(([cor, d]) => ({ cor, consumo: Math.round(d.consumo * 1000) / 1000, pecas: d.codes.size }))
        .sort((a, b) => b.consumo - a.consumo),
    }))
    .sort((a, b) => b.consumoTotal - a.consumoTotal)

  const consumoGeral = Math.round(summary.reduce((s, r) => s + r.consumoTotal, 0) * 1000) / 1000
  const totalPecas = new Set(rows.map(r => r.codigo)).size

  const lastRow = rows.length + 1
  const tecidoRange = `'Tecidos de variantes'!F2:F${lastRow}`
  const corRange = `'Tecidos de variantes'!H2:H${lastRow}`
  const totalRange = `'Tecidos de variantes'!J2:J${lastRow}`

  // Summary header title
  wt.mergeCells('A1:F1')
  const title = wt.getCell('A1')
  title.value = `Totalizações — ${clientName} · ${colecao}`
  title.font = { name: 'Calibri', size: 13, bold: true, color: { argb: A.charcoal } }
  title.fill = fill(A.cream)
  title.alignment = { horizontal: 'left', vertical: 'middle' }
  wt.getRow(1).height = 26

  // KPI row
  wt.mergeCells('A2:B2')
  wt.mergeCells('C2:D2')
  wt.mergeCells('E2:F2')
  const kpis = [
    { cell: 'A2', value: { formula: `="Consumo Total: "&TEXT(SUM(${totalRange}),"#,##0.000")&" kg"`, result: `Consumo Total: ${consumoGeral.toFixed(3)} kg` }, fill: A.sageLight, font: A.sageText },
    { cell: 'C2', value: `Total de Peças: ${totalPecas}`,                fill: A.lavLight,  font: A.lavText },
    { cell: 'E2', value: `Total de Tecidos: ${summary.length}`,          fill: A.header,    font: A.charcoal },
  ]
  kpis.forEach(({ cell, value, fill: f, font }) => {
    const c = wt.getCell(cell)
    c.value = value as ExcelJS.CellValue
    c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: f } }
    c.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: font } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border = border(A.border)
  })
  wt.getRow(2).height = 20

  // Blank row
  wt.getRow(3).height = 8

  // Table header
  const thRow = wt.getRow(4)
  thRow.height = 20
  ;['Tecido', 'Consumo Total (kg)', 'Qtd. Peças', 'Qtd. Cores', 'Cor', 'Consumo por Cor (kg)'].forEach((h, i) => {
    const cell = thRow.getCell(i + 1)
    cell.value = h
    cell.fill  = fill(A.header)
    cell.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: A.charcoal } }
    cell.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' }
    cell.border = border(A.border)
  })

  wt.columns = [
    { key: 'tecido',      width: 28 },
    { key: 'consumo',     width: 18 },
    { key: 'pecas',       width: 12 },
    { key: 'cores',       width: 12 },
    { key: 'cor',         width: 22 },
    { key: 'consumoCor',  width: 20 },
  ]

  // Data: one row per fabric+color combination
  let rowIdx = 5
  summary.forEach((s, si) => {
    const bg = si % 2 === 0 ? A.white : A.rowAlt
    s.breakdown.forEach((cb, ci) => {
      const r = wt.getRow(rowIdx++)
      r.height = 15

      const tecidoCriteria = `"${escFormula(s.tecido)}"`
      const corCriteria = cb.cor === '(sem cor)' ? '""' : `"${escFormula(cb.cor)}"`

      const cells: { val?: ExcelJS.CellValue; formula?: string; result?: ExcelJS.CellValue; argb: string; bold?: boolean; fmt?: string; align?: string }[] = [
        { val: ci === 0 ? s.tecido : '',              argb: A.charcoal, bold: ci === 0 },
        { formula: ci === 0 ? `SUMIF(${tecidoRange},${tecidoCriteria},${totalRange})` : undefined, val: ci === 0 ? undefined : '', result: s.consumoTotal, argb: A.sageText, bold: ci === 0, fmt: '#,##0.000', align: 'right' },
        { val: ci === 0 ? s.qtdPecas : '',            argb: A.lavText,  bold: ci === 0, align: 'center' },
        { val: ci === 0 ? s.qtdCores : '',            argb: A.muted,    align: 'center' },
        { val: cb.cor,                                argb: A.charcoal },
        { formula: `SUMIFS(${totalRange},${tecidoRange},${tecidoCriteria},${corRange},${corCriteria})`, result: cb.consumo, argb: A.sageText, fmt: '#,##0.000', align: 'right' },
      ]

      cells.forEach(({ val, formula, result, argb, bold, fmt, align }, j) => {
        const cell = r.getCell(j + 1)
        if (formula) {
          cell.value = { formula, result: result as string | number | undefined }
        } else {
          cell.value = val === '' ? null : (val ?? null)
        }
        cell.fill  = fill(j <= 3 ? bg : bg)
        cell.font  = { name: 'Calibri', size: 9, color: { argb }, bold: bold || false }
        cell.alignment = { vertical: 'middle', horizontal: (align as ExcelJS.Alignment['horizontal']) || 'left' }
        cell.border = { bottom: { style: 'thin', color: { argb: A.border } } }
        if (fmt) cell.numFmt = fmt
      })
    })
  })

  /* ── Download ── */
  const safeClient  = clientName.replace(/[^\w\s-]/g, '').trim() || 'Cliente'
  const safeColecao = colecao.replace(/[^\w\s/-]/g, '').trim() || 'Colecao'
  const fileName = `${safeClient}_${safeColecao}_PRECONSUMO.xlsx`

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
