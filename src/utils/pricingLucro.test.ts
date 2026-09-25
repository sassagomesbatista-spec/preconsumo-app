import { describe, it, expect } from 'vitest'
import { lucroLiquido } from './pricingLucro'

describe('lucroLiquido', () => {
  // Configuração padrão da aba Precificação: impostos 6 + comissão 5 + frete 4
  // + encargos 4 = 19% de despesas sobre a venda, lucro desejado 20%.
  const despesas = 19
  const custo = 40
  const precoProposto = custo / (1 - (despesas + 20) / 100)   // R$ 65,57

  it('no preço proposto, o lucro líquido é exatamente o lucro desejado', () => {
    const l = lucroLiquido(precoProposto, custo, despesas)
    expect(l.pct).toBeCloseTo(20, 6)
    expect(l.rs).toBeCloseTo(precoProposto * 0.2, 6)
  })

  it('a margem bruta (fórmula antiga) fica bem acima do lucro de verdade', () => {
    const l = lucroLiquido(precoProposto, custo, despesas)
    expect(l.margemBruta).toBeCloseTo(39, 6)
  })

  it('preço abaixo do custo + despesas dá lucro negativo', () => {
    const l = lucroLiquido(45, custo, despesas)   // 45 × 0,81 = 36,45 < 40
    expect(l.rs).toBeCloseTo(-3.55, 6)
    expect(l.pct).toBeLessThan(0)
  })

  it('preço zero não quebra', () => {
    expect(lucroLiquido(0, custo, despesas)).toEqual({ rs: 0, pct: 0, margemBruta: 0 })
  })
})
