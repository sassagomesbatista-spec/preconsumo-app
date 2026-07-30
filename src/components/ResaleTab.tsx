import { useEffect, useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
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
interface Config { margemCliente:number; custosCliente:CustoItem[] }

function uid(){ return Math.random().toString(36).slice(2,9) }

// Custos típicos de quem compra peça pronta no atacado pra revender —
// ponto de partida editável, não valores reais dela.
const CUSTOS_DEFAULT:CustoItem[] = [
  {id:uid(),nome:'Marketing / divulgação (redes sociais, anúncios)', qtd:1,preco:5},
  {id:uid(),nome:'Frete até o cliente final',                       qtd:1,preco:8},
  {id:uid(),nome:'Embalagem para revenda',                          qtd:1,preco:2},
  {id:uid(),nome:'Taxa de cartão/maquininha',                       qtd:1,preco:3},
]

const SUGESTOES = [
  'Marketing / divulgação (redes sociais, anúncios)','Frete até o cliente final',
  'Embalagem para revenda','Taxa de cartão/maquininha','Comissão de vendedor(a)',
  'Taxa de marketplace','Fotos/conteúdo para anúncio','Outro',
]

const DEFAULT:Config = { margemCliente:40, custosCliente:CUSTOS_DEFAULT }

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
    if(initialConfig) return {...DEFAULT,...initialConfig,custosCliente:initialConfig.custosCliente??CUSTOS_DEFAULT}
    try{
      const s=localStorage.getItem('revenda-v1')
      if(s) return {...DEFAULT,...JSON.parse(s)}
    }catch{}
    return DEFAULT
  })
  const [selectedCod,setSelectedCod] = useState<string|null>(precos[0]?.cod??null)

  useEffect(()=>{localStorage.setItem('revenda-v1',JSON.stringify(cfg)); onConfigChange?.(cfg)},[cfg])
  useEffect(()=>{if(!selectedCod&&precos.length>0) setSelectedCod(precos[0].cod)},[precos,selectedCod])

  const setCustos=(fn:(arr:CustoItem[])=>CustoItem[])=>
    setCfg(p=>({...p,custosCliente:fn(p.custosCliente)}))

  const custosTotal = useMemo(()=>cfg.custosCliente.reduce((s,i)=>s+i.qtd*i.preco,0),[cfg.custosCliente])
  const fator = 1-cfg.margemCliente/100

  const resultados = useMemo(()=>precos.map(p=>{
    const custoCliente = p.precoAtacado+custosTotal
    const precoRevenda = fator>0?custoCliente/fator:custoCliente
    const lucroCliente = precoRevenda-custoCliente
    return {...p,custoCliente,precoRevenda,lucroCliente}
  }),[precos,custosTotal,fator])

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
    <th>Código</th><th>Tipo</th><th>Preço de Atacado</th><th>Preço de Revenda Sugerido</th><th>Qtd. Peças</th>
  </tr></thead>
  <tbody>
  ${resultados.map(r=>`
    <tr>
      <td class="left">${r.cod}</td>
      <td class="left">${r.tipo}</td>
      <td>${R$(r.precoAtacado)}</td>
      <td class="price">${R$(r.precoRevenda)}</td>
      <td>${r.totalPecas}</td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="footer">Samanta Gomes Fashion Office &nbsp;·&nbsp; Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
<script>setTimeout(()=>window.print(),300)</script>
</body></html>`)
    w.document.close()
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
        <button onClick={printProposta}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ml-auto"
          style={{background:C.purpleBg,border:`1px solid ${C.purple}`,color:C.purple}}>
          <Printer size={13}/> Proposta de Revenda (PDF)
        </button>
      </div>

      <div className="rounded-xl p-4 flex flex-col gap-4" style={{background:C.surface2,border:`1px solid ${C.border}`}}>
        <div className="flex items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide" style={{color:C.muted}}>Margem de Lucro do Cliente (%)</label>
            <NInput v={cfg.margemCliente} set={v=>setCfg(p=>({...p,margemCliente:v}))} step={1} color={C.green} bg={C.greenBg} w="w-20"/>
          </div>
          <p className="text-xs" style={{color:C.muted}}>Ajuste conforme o perfil de cada cliente — este valor vale pra todos os modelos.</p>
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
            </div>
            <div>
              <Row label="Preço de Atacado" sub="(preço já calculado na aba Precificação)" value={R$(current.precoAtacado)} accent={C.purpleLt}/>
              <Row label="Custos do Cliente" value={R$(custosTotal)} accent={C.yellow}/>
              <Row label="Custo Total do Cliente" bold value={R$(current.custoCliente)}/>
              <div className="flex items-center justify-between px-5 py-3"
                style={{background:C.greenBg,borderBottom:`1px solid ${C.border}`}}>
                <span className="text-base font-bold" style={{color:C.green}}>PREÇO DE REVENDA SUGERIDO</span>
                <span className="text-xl font-bold" style={{color:C.green}}>{R$(current.precoRevenda)}</span>
              </div>
              <Row label="Lucro do Cliente" value={`${R$(current.lucroCliente)} (${cfg.margemCliente.toFixed(1)}%)`} bold accent={C.green}/>
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
