import { describe, it, expect } from 'vitest'
import {
  TAXAS_TIKTOK_DEFAULT, calcularVenda, precoParaMargem, descontoMaximoSemPrejuizo,
  arredondarPara90, precificar, simularCenario, parseNumeroBR,
  type EntradaTikTok,
} from './tiktokPricing'

const t = TAXAS_TIKTOK_DEFAULT

// Caso de referência: custo 40, imposto 6%, devoluções 3%, frete grátis
// ligado, sem afiliada e sem anúncios, lucro desejado 20%, sem arredondamento.
const base: EntradaTikTok = {
  custoProducao: 40, embalagem: 0, etiqueta: 0, freteProprio: 0, custosFixos: 0, outros: 0,
  imposto: 6, afiliada: 0, anuncios: 0, devolucoes: 3, usaFreteGratis: true,
  lucroDesejado: 20, lucroMinimo: 5, maiorDesconto: 0,
  precoTeste: null, arredondar: false,
}

describe('caso de referência', () => {
  it('preço para 20% de lucro ≈ R$ 77,97 com lucro ≈ R$ 15,59', () => {
    const p = precoParaMargem(0.2, base, t)!
    expect(p).toBeCloseTo(77.97, 2)
    expect(calcularVenda(p, base, t).lucro).toBeCloseTo(15.59, 2)
  })

  it('precificar devolve o mesmo preço sugerido, definido pela meta de lucro', () => {
    const r = precificar(base, t)
    expect(r.precoSugerido).toBeCloseTo(77.97, 2)
    expect(r.definidoPor).toBe('lucro')
    expect(r.cheio!.lucro).toBeCloseTo(15.59, 2)
    expect(r.erros).toEqual([])
  })

  it('preço mínimo sem prejuízo ≈ R$ 58,23', () => {
    expect(precoParaMargem(0, base, t)).toBeCloseTo(58.23, 2)
    expect(precificar(base, t).precoMinimo).toBeCloseTo(58.23, 2)
  })

  it('desconto máximo sem prejuízo = 1 − 58,23/77,97', () => {
    const d = descontoMaximoSemPrejuizo(77.97, base, t)!
    expect(d).toBeCloseTo(1 - 58.2278 / 77.97, 3)
  })
})

describe('faixas de taxa', () => {
  it('usa o preço efetivo (com desconto) pra decidir a faixa', () => {
    const cheio = calcularVenda(60, base, t)
    expect(cheio.faixaBaixa).toBe(false)
    expect(cheio.comissao).toBeCloseTo(3.6)
    expect(cheio.taxaFixa).toBe(6)

    const c = simularCenario(60, 25, base, t)   // 60 × 0,75 = 45
    expect(c.preco).toBeCloseTo(45)
    expect(c.faixaBaixa).toBe(true)
    expect(c.caiuDeFaixa).toBe(true)
    expect(c.comissao).toBeCloseTo(4.5)
    expect(c.taxaFixa).toBe(4)
  })

  it('exatamente no limite já é faixa alta', () => {
    expect(calcularVenda(50, base, t).faixaBaixa).toBe(false)
    expect(calcularVenda(49.99, base, t).faixaBaixa).toBe(true)
  })

  it('frete grátis respeita o teto e some quando desligado', () => {
    expect(calcularVenda(1000, base, t).frete).toBe(50)
    expect(calcularVenda(100, base, t).frete).toBeCloseTo(6)
    expect(calcularVenda(100, { ...base, usaFreteGratis: false }, t).frete).toBe(0)
  })

  it('encontra preço na faixa baixa quando o custo é pequeno', () => {
    const e = { ...base, custoProducao: 5 }
    const p = precoParaMargem(0.2, e, t)!
    expect(p).toBeLessThan(50)
    expect(calcularVenda(p, e, t).margem).toBeGreaterThanOrEqual(0.2 - 1e-9)
    // e é o menor: um centavo abaixo não chega na margem
    expect(calcularVenda(p - 0.01, e, t).margem).toBeLessThan(0.2)
  })

  it('desconto máximo para no salto de faixa quando a faixa baixa é pior', () => {
    const tx = { ...t, comBaixo: 30 }   // faixa baixa bem mais cara
    const e = { ...base, custoProducao: 30 }
    // no limite (50) ainda tem lucro, logo abaixo dele já é prejuízo
    expect(calcularVenda(50, e, tx).lucro).toBeGreaterThan(0)
    expect(calcularVenda(49.99, e, tx).lucro).toBeLessThan(0)
    expect(descontoMaximoSemPrejuizo(60, e, tx)).toBeCloseTo(1 - 50 / 60, 6)
  })
})

describe('preço sugerido', () => {
  it('a meta de promoção pode subir o preço', () => {
    const e = { ...base, lucroMinimo: 5, maiorDesconto: 40 }
    const r = precificar(e, t)
    const p5 = precoParaMargem(0.05, e, t)!
    expect(r.definidoPor).toBe('promocao')
    expect(r.precoSugerido).toBeCloseTo(p5 / 0.6, 6)
    // com o maior desconto ainda sobra o lucro mínimo
    expect(r.maiorPromo!.margem).toBeCloseTo(0.05, 4)
  })

  it('arredonda pra terminar em ,90', () => {
    expect(arredondarPara90(77.97)).toBe(78.9)
    expect(arredondarPara90(78.9)).toBe(78.9)
    expect(arredondarPara90(78.91)).toBe(79.9)
    expect(arredondarPara90(78.2)).toBe(78.9)
    expect(precificar({ ...base, arredondar: true }, t).precoSugerido).toBe(78.9)
  })

  it('preço testado substitui o sugerido nos cálculos', () => {
    const r = precificar({ ...base, precoTeste: 55 }, t)
    expect(r.usandoTeste).toBe(true)
    expect(r.precoUsado).toBe(55)
    expect(r.cheio!.lucro).toBeLessThan(0)
    expect(r.descontoMaximo).toBeNull()
    expect(r.precoSugerido).toBeCloseTo(77.97, 2)
  })

  it('sem solução quando os percentuais somam 100% ou mais — sem quebrar', () => {
    const e = { ...base, afiliada: 50, anuncios: 40 }
    const r = precificar(e, t)
    expect(r.precoAlvoLucro).toBeNull()
    expect(r.precoSugerido).toBeNull()
    expect(r.precoMinimo).toBeNull()
    expect(r.cheio).toBeNull()
    expect(r.erros.length).toBeGreaterThan(0)
    expect(r.somaPercentuais).toBeGreaterThanOrEqual(100)
  })
})

describe('cenários', () => {
  it('selos de lucro, lucro baixo e prejuízo', () => {
    const L = 77.97
    expect(simularCenario(L, 0, base, t).selo).toBe('lucro')
    expect(simularCenario(L, 22, base, t).selo).toBe('baixo')      // 60,82 → margem ~3,4%
    expect(simularCenario(L, 40, base, t).selo).toBe('prejuizo')
  })
})

describe('parseNumeroBR', () => {
  it('aceita vírgula e ponto como decimal', () => {
    expect(parseNumeroBR('77,97')).toBe(77.97)
    expect(parseNumeroBR('77.97')).toBe(77.97)
    expect(parseNumeroBR('1.234,5')).toBe(1234.5)
    expect(parseNumeroBR('R$ 10,90')).toBe(10.9)
    expect(parseNumeroBR('6%')).toBe(6)
    expect(parseNumeroBR('0,')).toBe(0)
    expect(parseNumeroBR('')).toBeNull()
    expect(parseNumeroBR('abc')).toBeNull()
  })
})
