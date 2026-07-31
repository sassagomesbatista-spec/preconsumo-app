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
interface Config {
  modo:ModoPreco; margemCliente:number; markupCliente:number; custosCliente:CustoItem[]
  custosPercentuais:CustoPct[]      // taxas de venda em % do preço (plataforma, gateway etc.)
  qtdCompra:Record<string,number>   // quantidade que o cliente vai comprar, por código de modelo
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

const DEFAULT:Config = {
  modo:'margem', margemCliente:40, markupCliente:2,
  custosCliente:CUSTOS_DEFAULT, custosPercentuais:PERCENTUAIS_DEFAULT, qtdCompra:{},
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
      custosPercentuais:initialConfig.custosPercentuais??PERCENTUAIS_DEFAULT}
    try{
      const s=localStorage.getItem('revenda-v1')
      if(s){
        const p=JSON.parse(s)
        return {...DEFAULT,...p,
          custosCliente:p.custosCliente??CUSTOS_DEFAULT,
          custosPercentuais:p.custosPercentuais??PERCENTUAIS_DEFAULT}
      }
    }catch{}
    return DEFAULT
  })
  const [selectedCod,setSelectedCod] = useState<string|null>(precos[0]?.cod??null)

  useEffect(()=>{localStorage.setItem('revenda-v1',JSON.stringify(cfg)); onConfigChange?.(cfg)},[cfg])
  useEffect(()=>{if(!selectedCod&&precos.length>0) setSelectedCod(precos[0].cod)},[precos,selectedCod])

  const setCustos=(fn:(arr:CustoItem[])=>CustoItem[])=>
    setCfg(p=>({...p,custosCliente:fn(p.custosCliente)}))
  const setPercentuais=(fn:(arr:CustoPct[])=>CustoPct[])=>
    setCfg(p=>({...p,custosPercentuais:fn(p.custosPercentuais)}))

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
    const valorTotalRevenda = precoRevenda*qtdCompra
    const lucroTotalCliente = lucroCliente*qtdCompra
    return {...p,custoCliente,precoRevenda,lucroCliente,lucroPct,qtdCompra,valorTotalRevenda,lucroTotalCliente}
  }),[precos,custosTotal,fator,fatorPct,cfg.modo,cfg.markupCliente,cfg.qtdCompra])

  const setQtdCompra=(cod:string,qtd:number)=>setCfg(p=>({...p,qtdCompra:{...p.qtdCompra,[cod]:qtd}}))

  const current = selectedCod?resultados.find(r=>r.cod===selectedCod):null

  const printProposta = ()=>{
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
    <th>Código</th><th>Tipo</th><th>Preço de Atacado</th><th>Preço de Revenda Sugerido</th><th>Qtd.</th><th>Valor Total</th>
  </tr></thead>
  <tbody>
  ${resultados.map(r=>`
    <tr>
      <td class="left">${r.cod}</td>
      <td class="left">${r.tipo}</td>
      <td>${R$(r.precoAtacado)}</td>
      <td class="price">${R$(r.precoRevenda)}</td>
      <td>${r.qtdCompra}</td>
      <td class="price">${R$(r.valorTotalRevenda)}</td>
    </tr>`).join('')}
  </tbody>
  <tfoot>
    <tr style="font-weight:700">
      <td class="left" colspan="4">VALOR TOTAL DA COMPRA</td>
      <td>${resultados.reduce((s,r)=>s+r.qtdCompra,0)}</td>
      <td class="price">${R$(resultados.reduce((s,r)=>s+r.valorTotalRevenda,0))}</td>
    </tr>
  </tfoot>
</table>
<div class="footer">Samanta Gomes Fashion Office &nbsp;·&nbsp; Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
<script>setTimeout(()=>window.print(),300)</script>
</body></html>`)
    w.document.close()
  }

  const exportRevendaExcel=async()=>{
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
      {header:'Valor Total',                key:'total',  width:16},
    ]

    const hRow=ws.getRow(1)
    hRow.height=22
    hRow.eachCell(cell=>{
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A1A1A'}}
      cell.font={name:'Calibri',size:10,bold:true,color:{argb:'FFFFFFFF'}}
      cell.alignment={horizontal:'center',vertical:'middle',wrapText:true}
    })

    resultados.forEach((r,i)=>{
      const rowNum=i+2
      const row=ws.addRow({
        cod:r.cod, tipo:r.tipo, atacado:r.precoAtacado, revenda:r.precoRevenda, qtd:r.qtdCompra,
      })
      row.getCell('total').value={formula:`D${rowNum}*E${rowNum}`}
      const bg=i%2===0?'FFFFFFFF':'FFF7F7F7'
      row.eachCell((cell,col)=>{
        cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}}
        cell.font={name:'Calibri',size:10}
        cell.alignment={vertical:'middle',horizontal:col<=2?'left':'right'}
        if(col===3||col===4||col===6) cell.numFmt='"R$" #,##0.00'
        if(col===5) cell.numFmt='#,##0'
      })
    })

    const lastRow=resultados.length+1
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

      <div className="flex gap-4" style={{minHeight:0}}>
        <div className="flex flex-col gap-1 shrink-0" style={{width:200}}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{color:C.muted}}>Modelos</p>
          {resultados.map(r=>(
            <button key={r.cod} onClick={()=>setSelectedCod(r.cod)}
              className="flex flex-col items-start px-3 py-2 rounded-lg text-left transition-all"
              style={{
                background:selectedCod===r.cod?C.purpleBg:C.surface,
                border:`1px solid ${selectedCod===r.cod?C.purple:C.border}`,
              }}>
              <span className="font-mono text-xs" style={{color:selectedCod===r.cod?C.purple:C.muted}}>{r.cod}</span>
              <span className="text-sm font-medium" style={{color:C.text}}>{r.tipo}</span>
              <span className="text-xs font-bold mt-0.5" style={{color:C.green}}>{R$(r.precoRevenda)}</span>
            </button>
          ))}
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
              <Row label={`Valor Total da Compra (${current.qtdCompra} peças)`} value={R$(current.valorTotalRevenda)} accent={C.purpleLt}/>
              <Row label={`Lucro Total do Cliente (${current.qtdCompra} peças)`} value={R$(current.lucroTotalCliente)} bold accent={C.green}/>
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
