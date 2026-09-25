// Cálculo de preço para venda no TikTok Shop Brasil (marca própria).
//
// Fica separado da tela (TikTokTab) pra poder ser testado sozinho — ver
// tiktokPricing.test.ts. Todos os percentuais entram aqui em "pontos
// percentuais" (6 = 6%), igual ao que é digitado na tela; as margens de
// saída (margem, desconto) saem como fração (0,2 = 20%).

export interface TaxasTikTok {
  limite: number        // R$ — preço efetivo abaixo disso cai na faixa baixa
  comBaixo: number      // % comissão abaixo do limite
  fixBaixo: number      // R$ taxa fixa por item abaixo do limite
  comAlto: number       // % comissão a partir do limite
  fixAlto: number       // R$ taxa fixa por item a partir do limite
  fretePct: number      // % do programa de frete grátis
  freteTeto: number     // R$ teto da taxa de frete por item
  atualizadoEm: string | null  // ISO — quando as taxas foram salvas pela última vez
}

export const TAXAS_TIKTOK_DEFAULT: TaxasTikTok = {
  limite: 50,
  comBaixo: 10, fixBaixo: 4,
  comAlto: 6,   fixAlto: 6,
  fretePct: 6,  freteTeto: 50,
  atualizadoEm: null,
}

export interface EntradaTikTok {
  custoProducao: number
  // custos extras por peça (R$)
  embalagem: number
  etiqueta: number
  freteProprio: number
  custosFixos: number
  outros: number
  // percentuais sobre o preço (%)
  imposto: number
  afiliada: number
  anuncios: number
  devolucoes: number
  usaFreteGratis: boolean
  // metas (%)
  lucroDesejado: number
  lucroMinimo: number
  maiorDesconto: number
  precoTeste: number | null
  arredondar: boolean
}

export interface Venda {
  preco: number
  faixaBaixa: boolean
  comissao: number
  taxaFixa: number
  frete: number
  taxasTikTok: number   // comissão + taxa fixa + frete
  imposto: number
  afiliada: number
  anuncios: number
  devolucoes: number
  custoUnitario: number
  lucro: number
  margem: number        // fração; 0 quando preço <= 0
}

export const PRECO_MIN_BUSCA = 0.01
export const PRECO_MAX_BUSCA = 1_000_000
const ITERACOES = 200

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

export function custoUnitario(e: EntradaTikTok): number {
  return pos(e.custoProducao) + pos(e.embalagem) + pos(e.etiqueta)
    + pos(e.freteProprio) + pos(e.custosFixos) + pos(e.outros)
}

/** Resultado de uma venda com o cliente pagando P (já com o desconto do vendedor). */
export function calcularVenda(P: number, e: EntradaTikTok, t: TaxasTikTok): Venda {
  const faixaBaixa = P < t.limite
  const comissao = P * (faixaBaixa ? t.comBaixo : t.comAlto) / 100
  const taxaFixa = faixaBaixa ? t.fixBaixo : t.fixAlto
  const frete = e.usaFreteGratis ? Math.min(P * t.fretePct / 100, t.freteTeto) : 0
  const imposto = P * pos(e.imposto) / 100
  const afiliada = P * pos(e.afiliada) / 100
  const anuncios = P * pos(e.anuncios) / 100
  const devolucoes = P * pos(e.devolucoes) / 100
  const cu = custoUnitario(e)
  const lucro = P - cu - comissao - taxaFixa - frete - imposto - afiliada - anuncios - devolucoes
  return {
    preco: P, faixaBaixa, comissao, taxaFixa, frete,
    taxasTikTok: comissao + taxaFixa + frete,
    imposto, afiliada, anuncios, devolucoes,
    custoUnitario: cu, lucro,
    margem: P > 0 ? lucro / P : 0,
  }
}

const margem = (P: number, e: EntradaTikTok, t: TaxasTikTok) => calcularVenda(P, e, t).margem

// O único salto da margem é na troca de faixa (P = limite). Dentro de cada
// faixa ela é crescente com o preço (margem = 1 − %s − custosFixos/P, e o
// teto do frete só troca uma parte percentual por uma fixa, sem salto), então
// a busca binária é feita faixa por faixa, da mais barata pra mais cara.
function faixas(t: TaxasTikTok): [number, number][] {
  const L = t.limite
  if (!(L > PRECO_MIN_BUSCA && L < PRECO_MAX_BUSCA)) return [[PRECO_MIN_BUSCA, PRECO_MAX_BUSCA]]
  // topo da faixa baixa: o maior preço ainda < limite (em centavos não faz diferença)
  return [[PRECO_MIN_BUSCA, L - 1e-9], [L, PRECO_MAX_BUSCA]]
}

/**
 * Menor preço P (entre R$ 0,01 e R$ 1.000.000) com margem(P) ≥ M.
 * M é fração (0,2 = 20%). Retorna null se nenhum preço chega nessa margem —
 * típico quando as porcentagens sobre o preço somam 100% ou mais.
 */
export function precoParaMargem(M: number, e: EntradaTikTok, t: TaxasTikTok): number | null {
  for (const [a, b] of faixas(t)) {
    if (margem(b, e, t) < M) continue
    if (margem(a, e, t) >= M) return a
    let lo = a, hi = b
    for (let i = 0; i < ITERACOES; i++) {
      const mid = (lo + hi) / 2
      if (margem(mid, e, t) >= M) hi = mid; else lo = mid
    }
    return hi
  }
  return null
}

/**
 * Maior desconto d (fração) que ainda deixa lucro ≥ 0, partindo do preço
 * cheio L. Retorna null se o preço cheio já dá prejuízo.
 */
export function descontoMaximoSemPrejuizo(L: number, e: EntradaTikTok, t: TaxasTikTok): number | null {
  if (!(L > 0) || calcularVenda(L, e, t).lucro < 0) return null
  // Desce do preço cheio até o primeiro preço com prejuízo, faixa por faixa
  // (dentro da faixa o lucro cresce com o preço, então cada uma tem no
  // máximo um ponto de virada).
  const fx = faixas(t).map(([a, b]) => [a, Math.min(b, L)] as [number, number]).filter(([a, b]) => a <= b).reverse()
  let pisoAnterior = L   // menor preço já confirmado com lucro ≥ 0
  for (const [a, b] of fx) {
    // Na troca de faixa o lucro pode dar um salto pra baixo: se já no topo
    // desta faixa dá prejuízo, o limite é o piso da faixa de cima.
    if (calcularVenda(b, e, t).lucro < 0) return Math.max(0, 1 - pisoAnterior / L)
    if (calcularVenda(a, e, t).lucro >= 0) { pisoAnterior = a; continue }
    let lo = a, hi = b   // lucro(lo) < 0 ≤ lucro(hi)
    for (let i = 0; i < ITERACOES; i++) {
      const mid = (lo + hi) / 2
      if (calcularVenda(mid, e, t).lucro >= 0) hi = mid; else lo = mid
    }
    return Math.max(0, 1 - hi / L)
  }
  return 1 - PRECO_MIN_BUSCA / L
}

/** Arredonda pra cima até terminar em ,90 (77,97 → 78,90; 78,90 → 78,90). */
export function arredondarPara90(P: number): number {
  const base = Math.ceil(Math.round((P - 0.9) * 1e6) / 1e6)
  return Math.round((base + 0.9) * 100) / 100
}

export interface ResultadoTikTok {
  precoAlvoLucro: number | null     // precoParaMargem(lucro desejado)
  precoAlvoPromo: number | null     // precoParaMargem(lucro mínimo) / (1 − maior desconto)
  precoSugerido: number | null      // maior dos dois, arredondado se marcado
  definidoPor: 'lucro' | 'promocao' | null
  precoMinimo: number | null        // precoParaMargem(0)
  precoUsado: number | null         // preço testado, se houver; senão o sugerido
  usandoTeste: boolean
  cheio: Venda | null               // venda no preço usado, sem desconto
  maiorPromo: Venda | null          // venda no preço usado com o maior desconto
  descontoMaximo: number | null     // fração
  somaPercentuais: number           // % sobre o preço na faixa alta (sem teto de frete)
  erros: string[]
}

export function precificar(e: EntradaTikTok, t: TaxasTikTok): ResultadoTikTok {
  const erros: string[] = []
  const somaPercentuais = t.comAlto + (e.usaFreteGratis ? t.fretePct : 0)
    + pos(e.imposto) + pos(e.afiliada) + pos(e.anuncios) + pos(e.devolucoes)

  const precoAlvoLucro = precoParaMargem(e.lucroDesejado / 100, e, t)
  if (precoAlvoLucro === null) {
    erros.push(`Nenhum preço chega a ${fmtPct(e.lucroDesejado)} de lucro: as porcentagens sobre o preço (taxas do TikTok, imposto, afiliada, anúncios, devoluções) já somam ${fmtPct(somaPercentuais)}. Reduza algum percentual ou a meta de lucro.`)
  }

  const desc = e.maiorDesconto / 100
  let precoAlvoPromo: number | null = null
  if (desc >= 1) {
    erros.push('O maior desconto precisa ser menor que 100%.')
  } else {
    const pMin = precoParaMargem(e.lucroMinimo / 100, e, t)
    if (pMin === null) {
      erros.push(`Nenhum preço chega a ${fmtPct(e.lucroMinimo)} de lucro na promoção: as porcentagens sobre o preço já somam ${fmtPct(somaPercentuais)}.`)
    } else {
      precoAlvoPromo = pMin / (1 - Math.max(0, desc))
    }
  }

  let precoSugerido: number | null = null
  let definidoPor: ResultadoTikTok['definidoPor'] = null
  if (precoAlvoLucro !== null && precoAlvoPromo !== null) {
    definidoPor = precoAlvoPromo > precoAlvoLucro ? 'promocao' : 'lucro'
    const bruto = Math.max(precoAlvoLucro, precoAlvoPromo)
    precoSugerido = e.arredondar ? arredondarPara90(bruto) : bruto
  }

  const precoMinimo = precoParaMargem(0, e, t)
  if (precoMinimo === null && precoAlvoLucro !== null) {
    erros.push('Nenhum preço cobre os custos com essas porcentagens.')
  }

  const usandoTeste = e.precoTeste !== null && e.precoTeste > 0
  const precoUsado = usandoTeste ? e.precoTeste : precoSugerido
  const cheio = precoUsado !== null ? calcularVenda(precoUsado, e, t) : null
  const maiorPromo = precoUsado !== null && desc < 1
    ? calcularVenda(precoUsado * (1 - Math.max(0, desc)), e, t) : null
  const descontoMaximo = precoUsado !== null ? descontoMaximoSemPrejuizo(precoUsado, e, t) : null

  return {
    precoAlvoLucro, precoAlvoPromo, precoSugerido, definidoPor, precoMinimo,
    precoUsado, usandoTeste, cheio, maiorPromo, descontoMaximo, somaPercentuais, erros,
  }
}

export type SeloCenario = 'lucro' | 'baixo' | 'prejuizo'

export interface Cenario { id: string; nome: string; desconto: number }

export interface ResultadoCenario extends Venda {
  desconto: number
  selo: SeloCenario
  caiuDeFaixa: boolean   // o desconto derrubou o preço pra faixa abaixo do limite
}

export function simularCenario(L: number, descontoPct: number, e: EntradaTikTok, t: TaxasTikTok): ResultadoCenario {
  const d = Math.min(Math.max(descontoPct, 0), 100) / 100
  const v = calcularVenda(L * (1 - d), e, t)
  const selo: SeloCenario = v.lucro < 0 ? 'prejuizo' : v.margem < e.lucroMinimo / 100 ? 'baixo' : 'lucro'
  return { ...v, desconto: d, selo, caiuDeFaixa: L >= t.limite && v.faixaBaixa }
}

/* ─── Formatação / entrada pt-BR ───────────────────────────── */

export const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export function fmtPct(n: number, casas = 1): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + '%'
}
/** Número pra mostrar dentro de um campo editável: "77,97", "6", "0,5". */
export function fmtNumero(n: number, casas = 2): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas, useGrouping: false })
}

/**
 * Lê um número digitado no padrão brasileiro ("1.234,56", "77,9", "R$ 10")
 * ou com ponto decimal ("77.9"). Retorna null se o campo estiver vazio ou
 * não for número.
 */
export function parseNumeroBR(s: string): number | null {
  let t = s.replace(/R\$|%|\s/g, '')
  if (t === '') return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if ((t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, '')
  if (!/^-?\d*\.?\d*$/.test(t) || t === '.' || t === '-') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
