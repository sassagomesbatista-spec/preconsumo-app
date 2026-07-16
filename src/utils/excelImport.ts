import * as XLSX from 'xlsx'
import type { FabricRow, ImportResult, PlmData } from '../types'

const SHEET_NAME = 'Tecidos de variantes'

const REQUIRED_COLS = ['Tipo Peça', 'Coleção', 'Código', 'Tema', 'Variante', 'Tecido', 'Consumo', 'Cor', 'Tipo de Variante']

const COL_MAP: Record<string, keyof FabricRow> = {
  'Tipo Peça': 'tipoPeca',
  'Coleção': 'colecao',
  'Código': 'codigo',
  'Tema': 'tema',
  'Variante': 'variante',
  'Tecido': 'tecido',
  'Consumo': 'consumo',
  'Cor': 'cor',
  'QTADE À CORTAR': 'qtadeACortar',
  'Consumo Total': 'consumoTotal',
  'Tipo de Variante': 'tipoVariante',
}

export function extractPlmData(wb: XLSX.WorkBook): PlmData {
  const tecidos: PlmData['tecidos'] = {}
  const outrosCustos: PlmData['outrosCustos'] = {}

  const ts = wb.Sheets['Tecidos']
  if (ts) {
    XLSX.utils.sheet_to_json<Record<string, string>>(ts).forEach(row => {
      const nome = row['Tecido']?.trim()
      const preco = parseFloat(String(row['Preço'] ?? '').replace(',', '.'))
      const unidade = String(row['Unidade'] ?? 'Kg').toLowerCase().includes('metro') ? 'metro' as const : 'kg' as const
      if (nome && !isNaN(preco)) tecidos[nome] = { preco, unidade, gramatura: 200 }
    })
  }

  // A planilha do PLM costuma repetir a mesma linha de aviamento/custo uma vez
  // por variante (cor) do produto — mantemos só a primeira ocorrência por nome.
  const seenNames: Record<string, Set<string>> = {}
  const addItem = (tp: string, nome: string, qtd: number, preco: number) => {
    if (!outrosCustos[tp]) outrosCustos[tp] = []
    if (!seenNames[tp]) seenNames[tp] = new Set()
    if (seenNames[tp].has(nome)) return
    seenNames[tp].add(nome)
    if (preco > 0) outrosCustos[tp].push({ nome, qtd, preco })
  }

  const as = wb.Sheets['Aviamentos']
  if (as) {
    XLSX.utils.sheet_to_json<Record<string, string>>(as).forEach(row => {
      const tp = row['Tipo Peça']?.trim()
      const nome = row['Aviamento']?.trim() || 'Aviamento'
      const qtd = parseFloat(String(row['Quantidade'] ?? '1').replace(',', '.'))
      const preco = parseFloat(String(row['Preço'] ?? '0').replace(',', '.'))
      if (tp) addItem(tp, nome, isNaN(qtd) ? 1 : qtd, isNaN(preco) ? 0 : preco)
    })
  }

  const os = wb.Sheets['Outros custos']
  if (os) {
    XLSX.utils.sheet_to_json<Record<string, string>>(os).forEach(row => {
      const tp = row['Tipo Peça']?.trim()
      const nome = row['Nome']?.trim() || row['Descrição']?.trim() || 'Outro'
      const qtd = parseFloat(String(row['Quantidade'] ?? '1').replace(',', '.'))
      const preco = parseFloat(String(row['Preço'] ?? '0').replace('R$', '').replace('.', '').replace(',', '.'))
      if (tp) addItem(tp, nome, isNaN(qtd) ? 1 : qtd, isNaN(preco) ? 0 : preco)
    })
  }

  return { tecidos, outrosCustos }
}

export function importExcel(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })

        if (!wb.SheetNames.includes(SHEET_NAME)) {
          reject(new Error(`Aba "${SHEET_NAME}" não encontrada.\nAbas disponíveis: ${wb.SheetNames.join(', ')}`))
          return
        }

        const ws = wb.Sheets[SHEET_NAME]
        const raw: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

        if (raw.length < 2) {
          reject(new Error('A aba está vazia ou sem dados.'))
          return
        }

        const headers = (raw[0] as string[]).map(h => String(h ?? '').trim())
        const hasQtade = headers.includes('QTADE À CORTAR')

        const missing = REQUIRED_COLS.filter(c => !headers.includes(c))
        if (missing.length > 0) {
          reject(new Error(`Colunas obrigatórias não encontradas: ${missing.join(', ')}`))
          return
        }

        const knownCols = new Set(Object.keys(COL_MAP))
        const extraColumns = headers.filter(h => h && !knownCols.has(h) && h !== 'ID' && h !== 'Imagem Capa')

        const rows: FabricRow[] = []
        for (let i = 1; i < raw.length; i++) {
          const rawRow = raw[i] as (string | number | null)[]
          if (!rawRow || rawRow.every(c => c === null || c === '')) continue

          const get = (col: string) => {
            const idx = headers.indexOf(col)
            return idx >= 0 ? rawRow[idx] : null
          }

          const consumo = Number(get('Consumo') ?? 0)
          const qtade = hasQtade ? Number(get('QTADE À CORTAR') ?? 0) : 0

          const row: FabricRow = {
            id: `row-${i}`,
            tipoPeca: String(get('Tipo Peça') ?? ''),
            colecao: String(get('Coleção') ?? ''),
            codigo: String(get('Código') ?? ''),
            tema: String(get('Tema') ?? ''),
            variante: String(get('Variante') ?? ''),
            tecido: String(get('Tecido') ?? ''),
            consumo,
            cor: String(get('Cor') ?? ''),
            qtadeACortar: qtade,
            consumoTotal: Math.round(consumo * qtade * 1000) / 1000,
            tipoVariante: String(get('Tipo de Variante') ?? ''),
          }

          for (const col of extraColumns) {
            row[col] = get(col) ?? ''
          }

          rows.push(row)
        }

        const rawName = file.name.replace(/\.(xlsx|xls)$/i, '').replace(/pré consumo\s*/i, '').trim()
        const clientName = rawName.replace(/\b\w/g, c => c.toUpperCase())
        const colecao = rows[0]?.colecao ?? ''
        const plmData = extractPlmData(wb)
        const importId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        resolve({ rows, clientName, colecao, extraColumns, importId, plmData })
      } catch (err) {
        reject(new Error('Erro ao ler o arquivo: ' + (err as Error).message))
      }
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'))
    reader.readAsArrayBuffer(file)
  })
}
