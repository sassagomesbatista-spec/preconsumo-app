export interface FabricRow {
  id: string
  tipoPeca: string
  colecao: string
  codigo: string
  tema: string
  variante: string
  tecido: string
  consumo: number
  cor: string
  qtadeACortar: number
  consumoTotal: number
  tipoVariante: string
  // extra columns from files like Gomax
  [key: string]: string | number
}

export interface FabricSummary {
  tecido: string
  consumoTotal: number
  qtdCores: number
  qtdVariantes: number
  cores: string[]
}

export interface FabricCostInfo {
  preco: number
  unidade: 'kg' | 'metro'
  gramatura: number
}

export interface OutrosCustoItem {
  nome: string
  qtd: number
  preco: number
}

export interface PlmData {
  tecidos: Record<string, FabricCostInfo>
  outrosCustos: Record<string, OutrosCustoItem[]>
  // Quantidade em Kg por referência (código) e tecido, vinda da aba "Tecidos"
  // — mais confiável que o Consumo da aba "Tecidos de variantes", que às
  // vezes vem em metro em vez de Kg pro mesmo tecido.
  consumoPorCodigo: Record<string, Record<string, number>>
}

export interface ImportResult {
  rows: FabricRow[]
  clientName: string
  colecao: string
  extraColumns: string[]
  importId: string
  plmData: PlmData
}
