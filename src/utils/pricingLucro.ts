// Lucro líquido de uma peça vendida a "preco": desconta do preço o custo total
// de produção E as despesas que incidem em % sobre a venda (impostos,
// comissão, frete, encargos). Antes a ficha mostrava só (preço − custo) ÷
// preço como "Lucro Real", o que deixava de fora essas despesas e fazia o
// lucro parecer bem maior do que é.
export function lucroLiquido(preco:number, custoTotal:number, despesasPct:number){
  if(!(preco>0)) return {rs:0, pct:0, margemBruta:0}
  const rs = preco*(1-despesasPct/100) - custoTotal
  return {
    rs,                                        // R$ que sobra por peça
    pct: rs/preco*100,                         // % do preço de venda
    margemBruta: (preco-custoTotal)/preco*100, // % antes das despesas sobre a venda
  }
}
