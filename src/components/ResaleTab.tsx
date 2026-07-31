import { useEffect, useMemo, useState } from 'react'
import { Printer, FileSpreadsheet } from 'lucide-react'
import type { AtacadoPreco } from './PricingTab'

const C = {
  bg:'#0A0C14', surface:'#12141F', surface2:'#1A1D2E', border:'#252A45',
  text:'#E2E8F0', muted:'#8892B0',
  purple:'#7C6FCD', purpleLt:'#9D8FE0', purpleBg:'#1E1B35',
  teal:'#4ECDC4', tealBg:'#152828',
  pink:'#E879A0', pinkBg:'#1F1220',
  yellow:'#F6C90E',
  green:'#4ADE80', greenBg:'#0F2018',
}

interface CustoItem { id:string; nome:string; qtd:number; preco:number }
interface CustoPct  { id:string; nome:string; pct:number }
type ModoPreco = 'margem' | 'markup'
interface Pagamento {
  entrada:number            // R$ pago na aprovação do pedido
  dataEntrada:string        // data de pagamento da entrada, formato YYYY-MM-DD
  parceladoCartao:number    // R$ que você recebe pela parte no cartão (sem juros — os juros são por conta do cliente)
  parcelasQtd:number        // em quantas vezes
  taxaJurosCartao:number    // % de juros ao mês da maquininha — usado pra CALCULAR o valor com juros, não digitado à mão
  dataParcelamento:string   // data da 1ª parcela do cartão, formato YYYY-MM-DD
  dataRestante:string       // data de vencimento do restante (30 dias), formato YYYY-MM-DD
}
interface Config {
  modo:ModoPreco; margemCliente:number; markupCliente:number; custosCliente:CustoItem[]
  custosPercentuais:CustoPct[]      // taxas de venda em % do preço (plataforma, gateway etc.)
  qtdCompra:Record<string,number>   // quantidade que o cliente vai comprar, por código de modelo
  // Se um código não aparece aqui, é tratado como incluído (true) — assim
  // orçamentos antigos continuam com tudo selecionado, sem precisar migrar nada.
  selecionados:Record<string,boolean>
  pagamento:Pagamento
}

function uid(){ return Math.random().toString(36).slice(2,9) }

// Custos fixos (R$ por peça) típicos de quem compra peça pronta no atacado
// pra revender — ponto de partida editável, não valores reais dela.
const CUSTOS_DEFAULT:CustoItem[] = [
  {id:uid(),nome:'Embalagem para revenda',                   qtd:1,preco:2},
  {id:uid(),nome:'Taxa de cartão/maquininha',                qtd:1,preco:3},
  {id:uid(),nome:'TikTok Shop — taxa fixa por item vendido', qtd:1,preco:6},
]

const SUGESTOES = [
  'Embalagem para revenda','Taxa de cartão/maquininha','Comissão de vendedor(a)',
  'Taxa de marketplace','TikTok Shop — taxa fixa por item vendido','Fotos/conteúdo para anúncio','Outro',
]

// Taxas que incidem em % sobre o preço de venda (não valor fixo por peça) —
// marketing e frete de marketplace escalam com o preço, por isso ficam aqui
// e não na lista de custo fixo. Valores de referência pro Brasil em 2026,
// editáveis (ver fontes na conversa com a Samanta).
const PERCENTUAIS_DEFAULT:CustoPct[] = [
  {id:uid(),nome:'Marketing / divulgação (redes sociais, anúncios)',                pct:8},
  {id:uid(),nome:'Frete — Programa de Frete Grátis (TikTok Shop e outros marketplaces)', pct:6},
  {id:uid(),nome:'TikTok Shop — comissão sobre o produto (peças ≥ R$50)',           pct:6},
  {id:uid(),nome:'Gateway de pagamento (e-commerce próprio, Pix/cartão)',           pct:3.5},
  {id:uid(),nome:'Despesas Fixas / Gestão (aluguel, sistema, pró-labore)',          pct:10},
  {id:uid(),nome:'Impostos (DAS/Simples Nacional)',                                 pct:6},
]

const SUGESTOES_PCT = [
  'Marketing / divulgação (redes sociais, anúncios)',
  'Frete — Programa de Frete Grátis (TikTok Shop e outros marketplaces)',
  'TikTok Shop — comissão sobre o produto (peças ≥ R$50)',
  'Gateway de pagamento (e-commerce próprio, Pix/cartão)',
  'Despesas Fixas / Gestão (aluguel, sistema, pró-labore)',
  'Impostos (DAS/Simples Nacional)',
  'Comissão de marketplace', 'Outro',
]

function dataHoje(){ return new Date().toISOString().slice(0,10) }
function dataMaisDias(n:number){
  const d=new Date(); d.setDate(d.getDate()+n)
  return d.toISOString().slice(0,10)
}

const PAGAMENTO_DEFAULT:Pagamento = {
  entrada:0, dataEntrada:dataHoje(),
  parceladoCartao:0, parcelasQtd:1, taxaJurosCartao:0, dataParcelamento:dataHoje(),
  dataRestante:dataMaisDias(30),
}

const DEFAULT:Config = {
  modo:'margem', margemCliente:40, markupCliente:2,
  custosCliente:CUSTOS_DEFAULT, custosPercentuais:PERCENTUAIS_DEFAULT, qtdCompra:{},
  selecionados:{},
  pagamento:PAGAMENTO_DEFAULT,
}

const R$  = (n:number) => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})

function NInput({v,set,step=0.01,color=C.text,bg=C.surface2,w='w-24'}:{
  v:number;set:(n:number)=>void;step?:number;color?:string;bg?:string;w?:string
}){
  return(
    <input type="number" step={step} value={v} min={0}
      onChange={e=>set(Number(e.target.value))} onFocus={e=>e.target.select()}
      className={`${w} rounded px-2 py-1 text-sm font-semibold text-right focus:outline-none
        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
        [&::-webkit-inner-spin-button]:appearance-none`}
      style={{background:bg,border:`1px solid ${C.border}`,color}}/>
  )
}

function Row({label,value,sub,bold,accent}:{label:string;value:string;sub?:string;bold?:boolean;accent?:string}){
  return(
    <div className="flex items-baseline justify-between py-1.5 px-4"
      style={{borderBottom:`1px solid ${C.border}`}}>
      <div>
        <span style={{color:bold?C.text:C.muted,fontWeight:bold?600:400,fontSize:'0.875rem'}}>{label}</span>
        {sub&&<span className="ml-2 text-xs" style={{color:C.muted}}>{sub}</span>}
      </div>
      <span style={{color:accent??C.text,fontWeight:bold?700:500,fontSize:bold?'1rem':'0.875rem'}}>
        {value}
      </span>
    </div>
  )
}

interface Props {
  precos:AtacadoPreco[]
  initialConfig?:Partial<Config>|null
  onConfigChange?:(cfg:Config)=>void
}

export default function ResaleTab({precos,initialConfig,onConfigChange}:Props){
  const [cfg,setCfg] = useState<Config>(()=>{
    if(initialConfig) return {...DEFAULT,...initialConfig,
      custosCliente:initialConfig.custosCliente??CUSTOS_DEFAULT,
      custosPercentuais:initialConfig.custosPercentuais??PERCENTUAIS_DEFAULT,
      pagamento:{...PAGAMENTO_DEFAULT,...initialConfig.pagamento}}
    try{
      const s=localStorage.getItem('revenda-v2')
      if(s){
        const p=JSON.parse(s)
        return {...DEFAULT,...p,
          custosCliente:p.custosCliente??CUSTOS_DEFAULT,
          custosPercentuais:p.custosPercentuais??PERCENTUAIS_DEFAULT,
          pagamento:{...PAGAMENTO_DEFAULT,...p.pagamento}}
      }
    }catch{}
    return DEFAULT
  })
  const [selectedCod,setSelectedCod] = useState<string|null>(precos[0]?.cod??null)

  useEffect(()=>{localStorage.setItem('revenda-v2',JSON.stringify(cfg)); onConfigChange?.(cfg)},[cfg])
  useEffect(()=>{if(!selectedCod&&precos.length>0) setSelectedCod(precos[0].cod)},[precos,selectedCod])

  const setCustos=(fn:(arr:CustoItem[])=>CustoItem[])=>
    setCfg(p=>({...p,custosCliente:fn(p.custosCliente)}))
  const setPercentuais=(fn:(arr:CustoPct[])=>CustoPct[])=>
    setCfg(p=>({...p,custosPercentuais:fn(p.custosPercentuais)}))
  const setPagamento=<K extends keyof Pagamento>(k:K,v:Pagamento[K])=>
    setCfg(p=>({...p,pagamento:{...p.pagamento,[k]:v}}))

  const custosTotal = useMemo(()=>cfg.custosCliente.reduce((s,i)=>s+i.qtd*i.preco,0),[cfg.custosCliente])
  const pctTotal = useMemo(()=>cfg.custosPercentuais.reduce((s,i)=>s+i.pct,0),[cfg.custosPercentuais])
  const fator = 1-(cfg.margemCliente+pctTotal)/100
  const fatorPct = 1-pctTotal/100

  const resultados = useMemo(()=>precos.map(p=>{
    const custoCliente = p.precoAtacado+custosTotal
    const precoRevenda = cfg.modo==='markup'
      ? (fatorPct>0?(custoCliente*cfg.markupCliente)/fatorPct:custoCliente*cfg.markupCliente)
      : (fator>0?custoCliente/fator:custoCliente)
    const lucroCliente = precoRevenda-custoCliente
    const lucroPct = precoRevenda>0?(lucroCliente/precoRevenda)*100:0
    const qtdCompra = cfg.qtdCompra[p.cod]??p.totalPecas
    // "Valor Total da Compra" é quanto o CLIENTE paga pra Samanta (atacado × qtd) —
    // não o quanto ele fatura revendendo (isso é o precoRevenda, mostrado à parte).
    const valorTotalAtacado = p.precoAtacado*qtdCompra
    const lucroTotalCliente = lucroCliente*qtdCompra
    return {...p,custoCliente,precoRevenda,lucroCliente,lucroPct,qtdCompra,valorTotalAtacado,lucroTotalCliente}
  }),[precos,custosTotal,fator,fatorPct,cfg.modo,cfg.markupCliente,cfg.qtdCompra])

  const setQtdCompra=(cod:string,qtd:number)=>setCfg(p=>({...p,qtdCompra:{...p.qtdCompra,[cod]:qtd}}))

  const isSelecionado=(cod:string)=>cfg.selecionados[cod]??true
  const toggleSelecionado=(cod:string)=>setCfg(p=>({...p,selecionados:{...p.selecionados,[cod]:!isSelecionado(cod)}}))
  const selecionarTodos=(sel:boolean)=>setCfg(p=>({...p,
    selecionados:Object.fromEntries(resultados.map(r=>[r.cod,sel]))}))

  const current = selectedCod?resultados.find(r=>r.cod===selectedCod):null

  // Só as peças marcadas entram no pedido/orçamento — o cliente às vezes
  // compra só parte do que foi desenvolvido, não tudo.
  const resultadosPedido = useMemo(()=>resultados.filter(r=>isSelecionado(r.cod)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [resultados,cfg.selecionados])

  const totalGeralCompra = useMemo(()=>resultadosPedido.reduce((s,r)=>s+r.valorTotalAtacado,0),[resultadosPedido])
  // O que abate a dívida com você é sempre o valor SEM juros — os juros da
  // maquininha vão pra administradora do cartão, não pra você.
  const restantePagamento = totalGeralCompra-cfg.pagamento.entrada-cfg.pagamento.parceladoCartao
  const parcelaValor = cfg.pagamento.parcelasQtd>0?cfg.pagamento.parceladoCartao/cfg.pagamento.parcelasQtd:0
  // Fórmula de juros compostos ao mês (padrão financeiro de parcelamento) —
  // calculado, não digitado à mão, pra poder reusar com qualquer cliente
  // só trocando a taxa: valorComJuros = capital × (1+taxa)^parcelas
  const valorComJuros = cfg.pagamento.parceladoCartao*Math.pow(1+cfg.pagamento.taxaJurosCartao/100,cfg.pagamento.parcelasQtd)
  const parcelaJurosValor = cfg.pagamento.parcelasQtd>0?valorComJuros/cfg.pagamento.parcelasQtd:0
  const fmtData=(s:string)=>{
    const [y,m,d]=s.split('-')
    return y&&m&&d?`${d}/${m}/${y}`:s
  }
  const dataEntradaFmt = fmtData(cfg.pagamento.dataEntrada)
  const dataParcelamentoFmt = fmtData(cfg.pagamento.dataParcelamento)
  const dataRestanteFmt = fmtData(cfg.pagamento.dataRestante)

  /* ── Ficha de revenda de uma peça (PDF) ─────────────── */
  const printFicha=(r:typeof resultados[number])=>{
    const w=window.open('','_blank','width=820,height=960')
    if(!w) return
    const logoUrl=`${window.location.origin}/logo.png`
    w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Ficha de Revenda — ${r.cod}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1C1C1E;background:#fff;padding:36px 40px;font-size:12.5px;line-height:1.5}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:0;padding-bottom:18px;border-bottom:3px solid #1C1C1E}
  .logo-wrap{background:#fff;padding:6px 10px;border:1px solid #E5E5E5;border-radius:4px;display:inline-flex;align-items:center}
  .logo-wrap img{height:38px;width:auto;display:block}
  .ref{text-align:right}
  .ref .doc-title{font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:4px}
  .ref h2{font-size:26px;font-weight:800;letter-spacing:-0.5px;color:#1C1C1E}
  .ref p{color:#666;font-size:11px;margin-top:2px}
  .accent-bar{height:3px;background:linear-gradient(to right,#C9A96E,#E8D5B0,#C9A96E);margin-bottom:22px}
  .section{margin-bottom:14px}
  .row{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid #F0EDEA;font-size:13px}
  .row.subtotal{background:#FAF8F5;font-weight:600}
  .row.price-proposto{background:#F7F5F2;color:#666;font-size:12px;padding:7px 14px}
  .row.price-real{background:linear-gradient(135deg,#C9A96E 0%,#B8864E 100%);color:#fff;font-size:22px;font-weight:800;padding:16px 14px;letter-spacing:-0.3px;border-radius:2px;margin-top:2px}
  .row.price-real .label{display:flex;flex-direction:column}
  .row.price-real .label small{font-size:9px;font-weight:400;letter-spacing:1.5px;text-transform:uppercase;opacity:.85;margin-bottom:1px}
  .row.total{background:#1C1C1E;color:#fff;font-weight:700;font-size:14px;padding:10px 14px;margin-top:16px}
  .footer{margin-top:28px;padding-top:10px;border-top:1px solid #E5E5E5;font-size:9.5px;color:#BBBBBB;display:flex;justify-content:space-between}
  @media print{body{padding:20px 24px}button{display:none}.row.total{-webkit-print-color-adjust:exact;print-color-adjust:exact}.row.price-real{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head><body>

<div class="header">
  <div class="logo-wrap"><img src="${logoUrl}" alt="Samanta Gomes"/></div>
  <div class="ref">
    <div class="doc-title">Ficha de Revenda</div>
    <h2>REF ${r.cod}</h2>
    <p>${r.tipo}</p>
  </div>
</div>
<div class="accent-bar"></div>

<div class="section">
  <div class="row"><span>Preço de Atacado</span><span>${R$(r.precoAtacado)}</span></div>
</div>

<div class="row price-real">
  <span class="label"><small>Preço de Revenda</small>SUGERIDO</span>
  <span>${R$(r.precoRevenda)}</span>
</div>

<div class="section" style="margin-top:16px">
  <div class="row"><span>Quantidade</span><span>${r.qtdCompra} peças</span></div>
  <div class="row subtotal"><span>Valor Total da Compra</span><span>${R$(r.valorTotalAtacado)}</span></div>
</div>

<div class="footer">
  <span>Samanta Gomes Fashion Office</span>
  <span>Gerado em ${new Date().toLocaleDateString('pt-BR')}</span>
</div>
<script>setTimeout(()=>window.print(),300)</script>
</body></html>`)
    w.document.close()
  }

  /* ── Fichas de revenda de todas as peças, uma por página (PDF) ── */
  /* ── Orçamento de revenda: documento único, com total geral no final ── */
  const printFichasTodas=()=>{
    if(resultadosPedido.length===0){window.alert('Nenhuma peça marcada pro pedido — marca pelo menos uma na lista de Modelos.');return}
    const w=window.open('','_blank','width=900,height=1000')
    if(!w) return
    const logoUrl=`${window.location.origin}/logo.png`
    const hoje=new Date()
    const validade=new Date(hoje.getTime()+7*24*60*60*1000)
    const totalGeral=resultadosPedido.reduce((s,r)=>s+r.valorTotalAtacado,0)
    const totalPecas=resultadosPedido.reduce((s,r)=>s+r.qtdCompra,0)
    w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Orçamento de Revenda</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1C1C1E;background:#fff;padding:40px 44px;font-size:12.5px;line-height:1.5}
  /* Header */
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:3px solid #1C1C1E}
  .logo-wrap{background:#fff;padding:6px 10px;border:1px solid #E5E5E5;border-radius:4px;display:inline-flex;align-items:center}
  .logo-wrap img{height:38px;width:auto;display:block}
  .doc{text-align:right}
  .doc .doc-title{font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:4px}
  .doc h1{font-size:26px;font-weight:800;letter-spacing:-0.5px;color:#1C1C1E}
  .doc p{color:#666;font-size:11px;margin-top:3px}
  .accent-bar{height:3px;background:linear-gradient(to right,#C9A96E,#E8D5B0,#C9A96E);margin:0 0 26px}
  /* Meta info */
  .meta{display:flex;gap:40px;margin-bottom:24px}
  .meta div{flex:1}
  .meta .label{font-size:9.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#B8864E;margin-bottom:3px}
  .meta .value{font-size:13px;color:#1C1C1E}
  /* Table */
  table{width:100%;border-collapse:collapse;margin-bottom:0}
  thead th{background:#1C1C1E;color:#fff;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:right;padding:10px 12px}
  thead th:first-child,thead th:nth-child(2){text-align:left}
  tbody td{padding:11px 12px;border-bottom:1px solid #F0EDEA;text-align:right;font-size:12.5px}
  tbody td:first-child,tbody td:nth-child(2){text-align:left}
  tbody td.cod{font-weight:600;color:#8C6D46}
  tbody tr:nth-child(even){background:#FAF8F5}
  tbody td.price{font-weight:600}
  /* Totals */
  .totals{display:flex;justify-content:flex-end;margin-top:0}
  .totals-box{width:280px}
  .totals-row{display:flex;justify-content:space-between;padding:8px 12px;font-size:12.5px;color:#666;border-bottom:1px solid #F0EDEA}
  .totals-row.grand{background:linear-gradient(135deg,#C9A96E 0%,#B8864E 100%);color:#fff;font-size:19px;font-weight:800;padding:16px 14px;border-radius:2px;margin-top:8px;letter-spacing:-0.3px}
  .totals-row.grand small{display:block;font-size:9px;font-weight:400;letter-spacing:1.5px;text-transform:uppercase;opacity:.85;margin-bottom:2px}
  /* Forma de pagamento */
  .payment{margin-top:28px;border:1px solid #EAD9BF;border-radius:4px;overflow:hidden}
  .payment-title{background:#F7F5F2;padding:8px 14px;font-size:9.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#8C6D46}
  .payment-grid{display:flex}
  .payment-item{flex:1;padding:12px 14px;border-right:1px solid #F0EDEA}
  .payment-item:last-child{border-right:none}
  .payment-item .label{font-size:10px;color:#999;margin-bottom:3px}
  .payment-item .value{font-size:15px;font-weight:700;color:#1C1C1E}
  .payment-item .note{font-size:10.5px;color:#666;margin-top:2px}
  /* Footer */
  .footer{margin-top:32px;padding-top:12px;border-top:1px solid #E5E5E5;font-size:9.5px;color:#BBBBBB;display:flex;justify-content:space-between}
  @media print{.totals-row.grand{-webkit-print-color-adjust:exact;print-color-adjust:exact}thead th{-webkit-print-color-adjust:exact;print-color-adjust:exact}tbody tr:nth-child(even){-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head><body>

<div class="header">
  <div class="logo-wrap"><img src="${logoUrl}" alt="Samanta Gomes"/></div>
  <div class="doc">
    <div class="doc-title">Orçamento de Revenda</div>
    <h1>Proposta de Compra</h1>
    <p>Gerado em ${hoje.toLocaleDateString('pt-BR')} &nbsp;·&nbsp; Válido até ${validade.toLocaleDateString('pt-BR')}</p>
  </div>
</div>
<div class="accent-bar"></div>

<div class="meta">
  <div><div class="label">Peças no orçamento</div><div class="value">${resultadosPedido.length} modelo(s) &nbsp;·&nbsp; ${totalPecas} peças</div></div>
  <div><div class="label">Condição</div><div class="value">Preços válidos para a quantidade indicada por modelo</div></div>
</div>

<table>
  <thead><tr>
    <th>Código</th><th>Peça</th><th>Preço Unitário</th><th>Qtd.</th><th>Valor Total</th>
  </tr></thead>
  <tbody>
  ${resultadosPedido.map(r=>`
    <tr>
      <td class="cod">${r.cod}</td>
      <td>${r.tipo}</td>
      <td>${R$(r.precoAtacado)}</td>
      <td>${r.qtdCompra}</td>
      <td class="price">${R$(r.valorTotalAtacado)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="totals">
  <div class="totals-box">
    <div class="totals-row"><span>Total de peças</span><span>${totalPecas}</span></div>
    <div class="totals-row grand">
      <span><small>Valor Total do Orçamento</small>${R$(totalGeral)}</span>
    </div>
  </div>
</div>

${(cfg.pagamento.entrada>0||cfg.pagamento.parceladoCartao>0||restantePagamento>0)?`<div class="payment">
  <div class="payment-title">Forma de Pagamento</div>
  <div class="payment-grid">
    <div class="payment-item">
      <div class="label">Entrada</div>
      <div class="value">${R$(cfg.pagamento.entrada)}</div>
      <div class="note">Pagamento em ${dataEntradaFmt}</div>
    </div>
    <div class="payment-item">
      <div class="label">Parcelado no Cartão</div>
      <div class="value">${R$(cfg.pagamento.parceladoCartao)}</div>
      ${cfg.pagamento.taxaJurosCartao>0?`<div class="note">Na fatura do cartão: ${cfg.pagamento.parcelasQtd}× de ${R$(parcelaJurosValor)} (total ${R$(valorComJuros)}), 1ª parcela em ${dataParcelamentoFmt} — a diferença é juros da operadora do cartão, não é cobrada por nós</div>`:`<div class="note">${cfg.pagamento.parcelasQtd}× de ${R$(parcelaValor)} — 1ª parcela em ${dataParcelamentoFmt}</div>`}
    </div>
    <div class="payment-item">
      <div class="label">Restante</div>
      <div class="value">${R$(restantePagamento)}</div>
      <div class="note">Vencimento: ${dataRestanteFmt}</div>
    </div>
  </div>
</div>`:''}

<div class="footer">
  <span>Samanta Gomes Fashion Office</span>
  <span>Gerado em ${hoje.toLocaleDateString('pt-BR')}</span>
</div>
<script>setTimeout(()=>window.print(),300)</script>
</body></html>`)
    w.document.close()
  }

  const printProposta = ()=>{
    if(resultadosPedido.length===0){window.alert('Nenhuma peça marcada pro pedido — marca pelo menos uma na lista de Modelos.');return}
    const w=window.open('','_blank','width=1100,height=900')
    if(!w) return
    w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Proposta de Revenda</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;color:#1a1a1a;padding:32px;font-size:11px}
  h1{font-size:18px;margin-bottom:4px}
  p.sub{color:#666;font-size:11px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:right}
  th{background:#1a1a1a;color:#fff;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
  td.left{text-align:left}
  tr:nth-child(even) td{background:#f7f7f7}
  td.price{font-weight:700;color:#2D6A4F}
  .footer{margin-top:24px;font-size:10px;color:#999;text-align:center}
  @media print{body{padding:16px}}
</style>
</head><body>
<h1>Proposta de Revenda</h1>
<p class="sub">Sugestão de preço de revenda pro cliente que compra no atacado &nbsp;·&nbsp; Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
<table>
  <thead><tr>
    <th>Código</th><th>Tipo</th><th>Preço de Atacado</th><th>Preço de Revenda Sugerido</th><th>Qtd.</th><th>Valor Total da Compra</th>
  </tr></thead>
  <tbody>
  ${resultadosPedido.map(r=>`
    <tr>
      <td class="left">${r.cod}</td>
      <td class="left">${r.tipo}</td>
      <td>${R$(r.precoAtacado)}</td>
      <td class="price">${R$(r.precoRevenda)}</td>
      <td>${r.qtdCompra}</td>
      <td class="price">${R$(r.valorTotalAtacado)}</td>
    </tr>`).join('')}
  </tbody>
  <tfoot>
    <tr style="font-weight:700">
      <td class="left" colspan="4">VALOR TOTAL DA COMPRA</td>
      <td>${resultadosPedido.reduce((s,r)=>s+r.qtdCompra,0)}</td>
      <td class="price">${R$(resultadosPedido.reduce((s,r)=>s+r.valorTotalAtacado,0))}</td>
    </tr>
  </tfoot>
</table>
<div class="footer">Samanta Gomes Fashion Office &nbsp;·&nbsp; Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
<script>setTimeout(()=>window.print(),300)</script>
</body></html>`)
    w.document.close()
  }

  const exportRevendaExcel=async()=>{
    if(resultadosPedido.length===0){window.alert('Nenhuma peça marcada pro pedido — marca pelo menos uma na lista de Modelos.');return}
    const ExcelJS=(await import('exceljs')).default
    const wb=new ExcelJS.Workbook()
    wb.creator='Pré Consumo App'
    const ws=wb.addWorksheet('Proposta de Revenda')

    ws.columns=[
      {header:'Código',                     key:'cod',    width:12},
      {header:'Tipo',                       key:'tipo',   width:18},
      {header:'Preço de Atacado',           key:'atacado',width:16},
      {header:'Preço de Revenda Sugerido',  key:'revenda',width:20},
      {header:'Quantidade',                 key:'qtd',    width:12},
      {header:'Valor Total da Compra',      key:'total',  width:20},
    ]

    const hRow=ws.getRow(1)
    hRow.height=22
    hRow.eachCell(cell=>{
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A1A1A'}}
      cell.font={name:'Calibri',size:10,bold:true,color:{argb:'FFFFFFFF'}}
      cell.alignment={horizontal:'center',vertical:'middle',wrapText:true}
    })

    resultadosPedido.forEach((r,i)=>{
      const rowNum=i+2
      const row=ws.addRow({
        cod:r.cod, tipo:r.tipo, atacado:r.precoAtacado, revenda:r.precoRevenda, qtd:r.qtdCompra,
      })
      row.getCell('total').value={formula:`C${rowNum}*E${rowNum}`}
      const bg=i%2===0?'FFFFFFFF':'FFF7F7F7'
      row.eachCell((cell,col)=>{
        cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}}
        cell.font={name:'Calibri',size:10}
        cell.alignment={vertical:'middle',horizontal:col<=2?'left':'right'}
        if(col===3||col===4||col===6) cell.numFmt='"R$" #,##0.00'
        if(col===5) cell.numFmt='#,##0'
      })
    })

    const lastRow=resultadosPedido.length+1
    const totalRow=ws.addRow({tipo:'VALOR TOTAL DA COMPRA'})
    totalRow.getCell('qtd').value={formula:`SUM(E2:E${lastRow})`}
    totalRow.getCell('total').value={formula:`SUM(F2:F${lastRow})`}
    totalRow.eachCell((cell,col)=>{
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE0E0E0'}}
      cell.font={name:'Calibri',size:10,bold:true}
      cell.alignment={vertical:'middle',horizontal:col<=2?'left':'right'}
      if(col===5) cell.numFmt='#,##0'
      if(col===6) cell.numFmt='"R$" #,##0.00'
    })

    ws.views=[{state:'frozen',xSplit:0,ySplit:1}]

    const buffer=await wb.xlsx.writeBuffer()
    const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a')
    a.href=url
    a.download='Proposta_de_Revenda.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  if(precos.length===0){
    return(
      <div className="flex-1 flex items-center justify-center rounded-xl p-10"
        style={{border:`1px solid ${C.border}`,color:C.muted}}>
        Calcule os preços na aba "Precificação" primeiro — essa aba usa o Preço de Venda de lá como ponto de partida.
      </div>
    )
  }

  return(
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3"
        style={{background:C.surface2,border:`1px solid ${C.border}`}}>
        <p className="text-sm" style={{color:C.muted}}>
          Sugestão de preço de revenda pro cliente que compra pronto no atacado, a partir do Preço de Venda já calculado.
        </p>
        <button onClick={exportRevendaExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ml-auto"
          style={{background:C.greenBg,border:`1px solid ${C.green}`,color:C.green}}>
          <FileSpreadsheet size={13}/> Exportar Excel (pro cliente)
        </button>
        <button onClick={printProposta}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{background:C.purpleBg,border:`1px solid ${C.purple}`,color:C.purple}}>
          <Printer size={13}/> Proposta de Revenda (PDF)
        </button>
        <button onClick={printFichasTodas}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{background:C.purpleBg,border:`1px solid ${C.purple}`,color:C.purple}}>
          <Printer size={13}/> Orçamento de Revenda — Todas as Peças (PDF)
        </button>
      </div>

      <div className="rounded-xl p-4 flex flex-col gap-4" style={{background:C.surface2,border:`1px solid ${C.border}`}}>
        <div className="flex items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide" style={{color:C.muted}}>Como calcular o preço de revenda</label>
            <div className="flex rounded-lg overflow-hidden" style={{border:`1px solid ${C.border}`}}>
              <button onClick={()=>setCfg(p=>({...p,modo:'margem'}))}
                className="px-3 py-1.5 text-sm font-medium"
                style={cfg.modo==='margem'?{background:C.green,color:'#06120C'}:{background:C.surface,color:C.muted}}>
                Margem de Lucro (%)
              </button>
              <button onClick={()=>setCfg(p=>({...p,modo:'markup'}))}
                className="px-3 py-1.5 text-sm font-medium"
                style={cfg.modo==='markup'?{background:C.green,color:'#06120C'}:{background:C.surface,color:C.muted}}>
                Mark-up (×)
              </button>
            </div>
          </div>
          {cfg.modo==='margem'?(
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide" style={{color:C.muted}}>Margem de Lucro do Cliente (%)</label>
              <NInput v={cfg.margemCliente} set={v=>setCfg(p=>({...p,margemCliente:v}))} step={1} color={C.green} bg={C.greenBg} w="w-20"/>
            </div>
          ):(
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide" style={{color:C.muted}}>Mark-up do Cliente (×)</label>
              <NInput v={cfg.markupCliente} set={v=>setCfg(p=>({...p,markupCliente:v}))} step={0.1} color={C.green} bg={C.greenBg} w="w-20"/>
            </div>
          )}
          <p className="text-xs max-w-sm" style={{color:C.muted}}>
            {cfg.modo==='margem'
              ?'Margem de lucro: preço = custo ÷ (1 − margem). É a conta usada quando você já sabe quanto % de lucro quer sobre o preço final.'
              :'Mark-up: preço = custo × valor informado. Mark-up 2× é o "keystone pricing" — a regra clássica do varejo de moda no mundo todo (dobrar o preço de custo). É mais fácil de explicar pra quem nunca precificou nada.'}
            {' '}Ajuste conforme o perfil de cada cliente — vale pra todos os modelos.
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide mb-2" style={{color:C.muted}}>Custos do Cliente (aplicados a todos os modelos)</p>
          <datalist id="sug-revenda">
            {SUGESTOES.map(s=><option key={s} value={s}/>)}
          </datalist>
          {cfg.custosCliente.map((item,idx)=>(
            <div key={item.id} className="flex items-center gap-3 px-1 py-1.5"
              style={{borderBottom:`1px solid ${C.border}`}}>
              <input list="sug-revenda" value={item.nome}
                onChange={e=>setCustos(arr=>arr.map((x,i)=>i===idx?{...x,nome:e.target.value}:x))}
                className="flex-1 rounded px-2 py-1 text-sm focus:outline-none"
                style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text}}
                placeholder="Nome do custo"/>
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{color:C.muted}}>Qtd</span>
                <NInput v={item.qtd} set={v=>setCustos(arr=>arr.map((x,i)=>i===idx?{...x,qtd:v}:x))}
                  step={1} color={C.text} bg={C.surface} w="w-14"/>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{color:C.muted}}>R$</span>
                <NInput v={item.preco} set={v=>setCustos(arr=>arr.map((x,i)=>i===idx?{...x,preco:v}:x))}
                  step={0.01} color={C.yellow} bg="#1C1A0E" w="w-24"/>
              </div>
              <span className="text-sm font-semibold w-20 text-right" style={{color:C.yellow}}>
                {R$(item.qtd*item.preco)}
              </span>
              <button onClick={()=>setCustos(arr=>arr.filter((_,i)=>i!==idx))}
                className="text-xs px-2 py-0.5 rounded" style={{color:C.pink,background:C.pinkBg}}>
                ✕
              </button>
            </div>
          ))}
          <button onClick={()=>setCustos(arr=>[...arr,{id:uid(),nome:'',qtd:1,preco:0}])}
            className="mt-2 text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{color:C.teal,border:`1px solid ${C.teal}`,background:C.tealBg}}>
            + Adicionar custo
          </button>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide mb-2" style={{color:C.muted}}>
            Taxas de Venda (% sobre o preço) — plataforma, gateway de pagamento etc.
          </p>
          <datalist id="sug-revenda-pct">
            {SUGESTOES_PCT.map(s=><option key={s} value={s}/>)}
          </datalist>
          {cfg.custosPercentuais.map((item,idx)=>(
            <div key={item.id} className="flex items-center gap-3 px-1 py-1.5"
              style={{borderBottom:`1px solid ${C.border}`}}>
              <input list="sug-revenda-pct" value={item.nome}
                onChange={e=>setPercentuais(arr=>arr.map((x,i)=>i===idx?{...x,nome:e.target.value}:x))}
                className="flex-1 rounded px-2 py-1 text-sm focus:outline-none"
                style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text}}
                placeholder="Nome da taxa"/>
              <div className="flex items-center gap-1">
                <NInput v={item.pct} set={v=>setPercentuais(arr=>arr.map((x,i)=>i===idx?{...x,pct:v}:x))}
                  step={0.5} color={C.yellow} bg="#1C1A0E" w="w-16"/>
                <span className="text-xs" style={{color:C.muted}}>%</span>
              </div>
              <button onClick={()=>setPercentuais(arr=>arr.filter((_,i)=>i!==idx))}
                className="text-xs px-2 py-0.5 rounded" style={{color:C.pink,background:C.pinkBg}}>
                ✕
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between mt-2">
            <button onClick={()=>setPercentuais(arr=>[...arr,{id:uid(),nome:'',pct:0}])}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{color:C.teal,border:`1px solid ${C.teal}`,background:C.tealBg}}>
              + Adicionar taxa
            </button>
            <span className="text-xs" style={{color:C.muted}}>Total: <strong style={{color:C.yellow}}>{pctTotal.toFixed(1)}%</strong></span>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4 flex flex-col gap-4" style={{background:C.surface2,border:`1px solid ${C.border}`}}>
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide" style={{color:C.muted}}>
            Forma de Pagamento (aparece no Orçamento em PDF, vale pro pedido inteiro) — mesma fórmula pra qualquer cliente, só troca os valores
          </p>
          <div className="text-right shrink-0 pl-4">
            <p className="text-xs uppercase tracking-wide" style={{color:C.muted}}>Valor Total do Pedido</p>
            <p className="text-lg font-bold" style={{color:C.green}}>{R$(totalGeralCompra)}</p>
          </div>
        </div>

        {/* Entrada */}
        <div className="flex flex-wrap items-end gap-6 pb-3" style={{borderBottom:`1px solid ${C.border}`}}>
          <span className="text-xs font-bold uppercase tracking-wide w-20" style={{color:C.purpleLt}}>1. Entrada</span>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{color:C.muted}}>Valor (R$)</label>
            <NInput v={cfg.pagamento.entrada} set={v=>setPagamento('entrada',v)} step={10} color={C.purpleLt} bg={C.purpleBg}/>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{color:C.muted}}>Data de Pagamento</label>
            <input type="date" value={cfg.pagamento.dataEntrada}
              onChange={e=>setPagamento('dataEntrada',e.target.value)}
              className="rounded px-2 py-1 text-sm focus:outline-none"
              style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text}}/>
          </div>
        </div>

        {/* Parcelado no cartão */}
        <div className="flex flex-wrap items-end gap-6 pb-3" style={{borderBottom:`1px solid ${C.border}`}}>
          <span className="text-xs font-bold uppercase tracking-wide w-20" style={{color:C.purpleLt}}>2. Cartão</span>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{color:C.muted}}>Valor Parcelado (R$)</label>
            <NInput v={cfg.pagamento.parceladoCartao} set={v=>setPagamento('parceladoCartao',v)} step={10} color={C.purpleLt} bg={C.purpleBg}/>
            <span className="text-xs" style={{color:C.muted}}>O que você recebe — sem juros</span>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{color:C.muted}}>Nº de Parcelas</label>
            <NInput v={cfg.pagamento.parcelasQtd} set={v=>setPagamento('parcelasQtd',Math.max(1,v))} step={1} color={C.text} bg={C.surface} w="w-16"/>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{color:C.muted}}>Taxa de Juros da Maquininha (% ao mês)</label>
            <NInput v={cfg.pagamento.taxaJurosCartao} set={v=>setPagamento('taxaJurosCartao',v)} step={0.1} color={C.yellow} bg="#1C1A0E" w="w-20"/>
            {cfg.pagamento.taxaJurosCartao>0&&cfg.pagamento.parceladoCartao>0&&
              <span className="text-xs" style={{color:C.muted}}>Calculado: {cfg.pagamento.parcelasQtd}× de {R$(parcelaJurosValor)} (total {R$(valorComJuros)} na fatura dela — juros não entram na sua conta)</span>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{color:C.muted}}>1ª Parcela em</label>
            <input type="date" value={cfg.pagamento.dataParcelamento}
              onChange={e=>setPagamento('dataParcelamento',e.target.value)}
              className="rounded px-2 py-1 text-sm focus:outline-none"
              style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text}}/>
          </div>
        </div>

        {/* Restante */}
        <div className="flex flex-wrap items-end gap-6">
          <span className="text-xs font-bold uppercase tracking-wide w-20" style={{color:C.purpleLt}}>3. Restante</span>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{color:C.muted}}>Valor (calculado)</label>
            <span className="text-lg font-bold" style={{color:C.green}}>{R$(restantePagamento)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{color:C.muted}}>Vencimento</label>
            <input type="date" value={cfg.pagamento.dataRestante}
              onChange={e=>setPagamento('dataRestante',e.target.value)}
              className="rounded px-2 py-1 text-sm focus:outline-none"
              style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text}}/>
          </div>
        </div>
      </div>

      <div className="flex gap-4" style={{minHeight:0}}>
        <div className="flex flex-col gap-1 shrink-0" style={{width:220}}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs uppercase tracking-wide" style={{color:C.muted}}>
              Modelos <span style={{color:C.purpleLt}}>({resultadosPedido.length}/{resultados.length} no pedido)</span>
            </p>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={()=>selecionarTodos(true)} className="text-xs" style={{color:C.teal}}>Marcar todos</button>
            <button onClick={()=>selecionarTodos(false)} className="text-xs" style={{color:C.pink}}>Desmarcar todos</button>
          </div>
          {resultados.map(r=>{
            const sel=isSelecionado(r.cod)
            return(
            <button key={r.cod} onClick={()=>setSelectedCod(r.cod)}
              className="flex items-start gap-2 px-3 py-2 rounded-lg text-left transition-all"
              style={{
                background:selectedCod===r.cod?C.purpleBg:C.surface,
                border:`1px solid ${selectedCod===r.cod?C.purple:C.border}`,
                opacity:sel?1:0.5,
              }}>
              <input type="checkbox" checked={sel} onClick={e=>e.stopPropagation()}
                onChange={()=>toggleSelecionado(r.cod)}
                className="mt-1 shrink-0" style={{accentColor:C.teal}}/>
              <div className="flex flex-col items-start">
                <span className="font-mono text-xs" style={{color:selectedCod===r.cod?C.purple:C.muted}}>{r.cod}</span>
                <span className="text-sm font-medium" style={{color:C.text}}>{r.tipo}</span>
                <span className="text-xs font-bold mt-0.5" style={{color:C.green}}>{R$(r.precoRevenda)}</span>
              </div>
            </button>
          )})}
        </div>

        {current?(
          <div className="flex-1 min-w-0 rounded-xl overflow-hidden" style={{border:`1px solid ${C.border}`}}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{background:C.surface2,borderBottom:`1px solid ${C.border}`}}>
              <div>
                <p className="text-xs uppercase tracking-widest mb-0.5" style={{color:C.muted}}>Sugestão de Revenda</p>
                <h2 className="text-xl font-bold" style={{color:C.text}}>REF: {current.cod}</h2>
                <p className="text-sm mt-0.5" style={{color:C.muted}}>{current.tipo}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <label className="text-xs uppercase tracking-wide" style={{color:C.muted}}>Quantidade que o cliente vai comprar</label>
                <NInput v={current.qtdCompra} set={v=>setQtdCompra(current.cod,v)} step={1} color={C.purpleLt} bg={C.purpleBg} w="w-20"/>
              </div>
            </div>
            <div>
              <Row label="Preço de Atacado" sub="(o que você cobra do cliente)" value={R$(current.precoAtacado)} accent={C.purpleLt}/>
              <div className="flex items-center justify-between px-5 py-3"
                style={{background:C.greenBg,borderBottom:`1px solid ${C.border}`}}>
                <span className="text-base font-bold" style={{color:C.green}}>PREÇO DE REVENDA SUGERIDO</span>
                <span className="text-xl font-bold" style={{color:C.green}}>{R$(current.precoRevenda)}</span>
              </div>
              <Row label={`Valor Total da Compra (${current.qtdCompra} peças)`} value={R$(current.valorTotalAtacado)} accent={C.purpleLt}/>
              <Row label={`Lucro Total do Cliente (${current.qtdCompra} peças)`} value={R$(current.lucroTotalCliente)} bold accent={C.green}/>
            </div>
            <div className="px-5 py-3" style={{borderTop:`1px solid ${C.border}`}}>
              <button onClick={()=>printFicha(current)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{background:C.purpleBg,border:`1px solid ${C.purple}`,color:C.purple}}>
                <Printer size={13}/> Ficha de Revenda desta peça (PDF)
              </button>
            </div>
          </div>
        ):(
          <div className="flex-1 flex items-center justify-center"
            style={{border:`1px solid ${C.border}`,borderRadius:12,color:C.muted}}>
            Selecione um modelo na lista
          </div>
        )}
      </div>
    </div>
  )
}
