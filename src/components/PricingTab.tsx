import { useMemo, useState, useEffect, useRef } from 'react'
import { Upload, FileText, Printer, FileSpreadsheet, ChevronDown, ChevronUp } from 'lucide-react'
import type { FabricRow, PlmData } from '../types'
import { countOperationsByCode } from '../utils/pdfOperations'
import { extractPlmData } from '../utils/excelImport'

/* ─── Paleta ──────────────────────────────────────────────── */
const C = {
  bg:'#0A0C14', surface:'#12141F', surface2:'#1A1D2E', border:'#252A45',
  text:'#E2E8F0', muted:'#8892B0',
  purple:'#7C6FCD', purpleLt:'#9D8FE0', purpleBg:'#1E1B35',
  teal:'#4ECDC4', tealBg:'#152828',
  pink:'#E879A0', pinkBg:'#1F1220',
  yellow:'#F6C90E',
  green:'#4ADE80', greenBg:'#0F2018',
}

/* ─── Tipos ───────────────────────────────────────────────── */
interface BaseCoef  { facil:number; medio:number; dificil:number }
interface FabricCost{ preco:number; unidade:'kg'|'metro'; gramatura:number }
interface CustoItem { id:string; nome:string; qtd:number; preco:number }
interface Config {
  custoCorte:number; custoMinuto:number
  impostos:number; comissao:number; frete:number; encargos:number; lucro:number
  base:        Record<string,BaseCoef>
  tecidos:     Record<string,FabricCost>
  dificuldade: Record<string,'FACIL'|'MEDIO'|'DIFICIL'>
  outrosCustos:Record<string,CustoItem[]>
  outrosCustosGlobais: CustoItem[]      // aplicados a todos os produtos
  nrOp:        Record<string,number>
  precoReal:   Record<string,number>   // preço de venda aprovado por código
  lastPlmImportId?: string
}

const BASE_DEFAULT:Record<string,BaseCoef> = {
  BERMUDA:{facil:.60,medio:.70,dificil:.80}, BIQUINE:{facil:.60,medio:.70,dificil:.80},
  BLUSA:{facil:.60,medio:.70,dificil:.80},   BODY:{facil:.60,medio:.70,dificil:.80},
  CALCINHA:{facil:.50,medio:.60,dificil:.70},CAMISOLA:{facil:.60,medio:.70,dificil:.80},
  CASACO:{facil:.60,medio:.70,dificil:.80},  LEGGING:{facil:.55,medio:.60,dificil:.65},
  MACAQUINHO:{facil:.60,medio:.70,dificil:.80},MAIO:{facil:.60,medio:.70,dificil:.80},
  SHORT:{facil:.60,medio:.70,dificil:.80},   'SHORT DOOL':{facil:.60,medio:.70,dificil:.80},
  SOUTIEN:{facil:.60,medio:.70,dificil:.80}, TOP:{facil:.60,medio:.70,dificil:.80},
  VESTIDO:{facil:.60,medio:.70,dificil:.80},
}

const OC_GLOBAL_DEFAULT:CustoItem[] = [
  {id:uid(),nome:'Linha/fio',                            qtd:1,preco:1.5},
  {id:uid(),nome:'Embalagem produto',                    qtd:1,preco:1},
  {id:uid(),nome:'Etiqueta composição termocolante',     qtd:1,preco:1},
  {id:uid(),nome:'Kit (durex/etq interna e adesiva/papel)',qtd:1,preco:1},
  {id:uid(),nome:'Lacre cordão',                         qtd:1,preco:1},
  {id:uid(),nome:'Embalagem de envio',                   qtd:1,preco:2},
]

const DEFAULT:Config = {
  custoCorte:2, custoMinuto:1.10,
  impostos:6, comissao:5, frete:4, encargos:4, lucro:20,
  base:BASE_DEFAULT, tecidos:{}, dificuldade:{}, outrosCustos:{}, outrosCustosGlobais:OC_GLOBAL_DEFAULT, nrOp:{}, precoReal:{},
}

const SUGESTOES = [
  'Linha/fio','Embalagem produto','Embalagem de envio','Etiqueta composição termocolante',
  'Etiqueta marca','Etiqueta preço','Kit (durex/etq interna/papel)','Lacre cordão',
  'Termocolante','Transfer','Botão','Zíper','Elástico','Outro',
]

/* ─── Helpers ─────────────────────────────────────────────── */
const R$  = (n:number) => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const pct = (n:number) => n.toFixed(2)+'%'
function uid(){ return Math.random().toString(36).slice(2,9) }

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

/* ─── Lista editável de "Outros Custos" ───────────────────── */
function OutrosCustosList({items,onChange}:{
  items:CustoItem[]; onChange:(fn:(arr:CustoItem[])=>CustoItem[])=>void
}){
  return(
    <>
      {items.map((item,idx)=>(
        <div key={item.id} className="flex items-center gap-3 px-5 py-1.5"
          style={{borderBottom:`1px solid ${C.border}`}}>
          <input list="sug-oc" value={item.nome}
            onChange={e=>onChange(arr=>arr.map((x,i)=>i===idx?{...x,nome:e.target.value}:x))}
            className="flex-1 rounded px-2 py-1 text-sm focus:outline-none"
            style={{background:C.surface2,border:`1px solid ${C.border}`,color:C.text}}
            placeholder="Nome do item"/>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{color:C.muted}}>Qtd</span>
            <NInput v={item.qtd} set={v=>onChange(arr=>arr.map((x,i)=>i===idx?{...x,qtd:v}:x))}
              step={1} color={C.text} bg={C.surface2} w="w-14"/>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{color:C.muted}}>R$</span>
            <NInput v={item.preco} set={v=>onChange(arr=>arr.map((x,i)=>i===idx?{...x,preco:v}:x))}
              step={0.01} color={C.yellow} bg="#1C1A0E" w="w-24"/>
          </div>
          <span className="text-sm font-semibold w-20 text-right" style={{color:C.yellow}}>
            {R$(item.qtd*item.preco)}
          </span>
          <button onClick={()=>onChange(arr=>arr.filter((_,i)=>i!==idx))}
            className="text-xs px-2 py-0.5 rounded" style={{color:C.pink,background:C.pinkBg}}>
            ✕
          </button>
        </div>
      ))}
      <div className="px-5 py-2" style={{borderBottom:`1px solid ${C.border}`}}>
        <button onClick={()=>onChange(arr=>[...arr,{id:uid(),nome:'',qtd:1,preco:0}])}
          className="text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{color:C.teal,border:`1px solid ${C.teal}`,background:C.tealBg}}>
          + Adicionar custo
        </button>
      </div>
    </>
  )
}

/* ─── Linha de custo na ficha ─────────────────────────────── */
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

/* ─── Componente principal ────────────────────────────────── */
interface Props { rows:FabricRow[]; plmData?:PlmData; importId?:string; initialConfig?:Partial<Config>|null; onConfigChange?:(cfg:Config)=>void }

export default function PricingTab({rows,plmData,importId,initialConfig,onConfigChange}:Props){
  const plmRef  = useRef<HTMLInputElement>(null)
  const pdfRef  = useRef<HTMLInputElement>(null)
  const [cfg,setCfg] = useState<Config>(()=>{
    if(initialConfig){
      const p=initialConfig
      return{...DEFAULT,...p,
        base:{...BASE_DEFAULT,...(p.base??{})},
        outrosCustos:p.outrosCustos??{},
        outrosCustosGlobais:p.outrosCustosGlobais??OC_GLOBAL_DEFAULT,
        nrOp:p.nrOp??{},
        precoReal:p.precoReal??{},
        tecidos:p.tecidos??{},
      }
    }
    // Tenta versão atual, depois versões anteriores para migrar dados
    for(const key of ['prec-v9','prec-v8','prec-v7','prec-v6','prec-v5','precificacao-v4','precificacao-v3']){
      try{
        const s=localStorage.getItem(key)
        if(s){
          const p=JSON.parse(s)
          return{...DEFAULT,...p,
            base:{...BASE_DEFAULT,...(p.base??{})},
            outrosCustos:p.outrosCustos??{},
            outrosCustosGlobais:p.outrosCustosGlobais??OC_GLOBAL_DEFAULT,
            nrOp:p.nrOp??{},
            precoReal:p.precoReal??{},
            // Migra aviamentos/embalagem antigos para outrosCustos se existirem
            tecidos:p.tecidos??{},
          }
        }
      }catch{}
    }
    return DEFAULT
  })
  const [openSettings,setOpenSettings] = useState(false)
  const [toast,setToast] = useState<{msg:string;ok:boolean}|null>(null)
  const [selectedCod,setSelectedCod] = useState<string|null>(null)

  useEffect(()=>{localStorage.setItem('prec-v9',JSON.stringify(cfg)); onConfigChange?.(cfg)},[cfg])

  const uniqTecidos = useMemo(()=>[...new Set(rows.map(r=>r.tecido))].filter(Boolean).sort(),[rows])
  const uniqPecas   = useMemo(()=>[...new Set(rows.map(r=>r.tipoPeca))].filter(Boolean).sort(),[rows])
  const uniqCodigos = useMemo(()=>{
    const m=new Map<string,FabricRow[]>()
    rows.forEach(r=>{if(!m.has(r.codigo))m.set(r.codigo,[]);m.get(r.codigo)!.push(r)})
    return [...m.entries()].sort(([a],[b])=>a.localeCompare(b))
  },[rows])

  // Auto-init
  useEffect(()=>{
    setCfg(p=>{
      const n={...p,tecidos:{...p.tecidos},dificuldade:{...p.dificuldade},
               outrosCustos:{...p.outrosCustos},nrOp:{...p.nrOp},precoReal:{...p.precoReal}}
      let ch=false
      if(!n.outrosCustosGlobais){n.outrosCustosGlobais=OC_GLOBAL_DEFAULT;ch=true}
      uniqTecidos.forEach(t=>{if(!n.tecidos[t]){n.tecidos[t]={preco:0,unidade:'kg',gramatura:200};ch=true}})
      uniqPecas.forEach(p=>{
        if(!n.dificuldade[p]){n.dificuldade[p]='MEDIO';ch=true}
        if(!n.outrosCustos[p]){n.outrosCustos[p]=[];ch=true}
      })
      uniqCodigos.forEach(([c])=>{if(n.nrOp[c]===undefined){n.nrOp[c]=0;ch=true}})
      // Remove itens de "Outros Custos" duplicados (mesmo nome) que tenham
      // ficado de importações anteriores ao filtro de duplicidade
      const dedupe=(items:CustoItem[])=>{
        const seen=new Set<string>(); const out:CustoItem[]=[]
        for(const it of items){ if(seen.has(it.nome)) continue; seen.add(it.nome); out.push(it) }
        return out
      }
      Object.keys(n.outrosCustos).forEach(tp=>{
        const dd=dedupe(n.outrosCustos[tp])
        if(dd.length!==n.outrosCustos[tp].length){n.outrosCustos[tp]=dd;ch=true}
      })
      if(n.outrosCustosGlobais){
        const dd=dedupe(n.outrosCustosGlobais)
        if(dd.length!==n.outrosCustosGlobais.length){n.outrosCustosGlobais=dd;ch=true}
      }
      return ch?n:p
    })
    if(uniqCodigos.length>0&&!selectedCod) setSelectedCod(uniqCodigos[0][0])
  },[uniqTecidos,uniqPecas,uniqCodigos])

  const setG  =<K extends keyof Config>(k:K,v:Config[K])=>setCfg(p=>({...p,[k]:v}))
  const setTec=(t:string,f:keyof FabricCost,v:number|string)=>
    setCfg(p=>({...p,tecidos:{...p.tecidos,[t]:{...p.tecidos[t],[f]:v}}}))
  const setOC =(peca:string,fn:(arr:CustoItem[])=>CustoItem[])=>
    setCfg(p=>({...p,outrosCustos:{...p.outrosCustos,[peca]:fn(p.outrosCustos[peca]??[])}}))
  const setOCG=(fn:(arr:CustoItem[])=>CustoItem[])=>
    setCfg(p=>({...p,outrosCustosGlobais:fn(p.outrosCustosGlobais??[])}))

  const getCoef=(tipo:string,dif:'FACIL'|'MEDIO'|'DIFICIL')=>{
    const up=tipo.toUpperCase()
    const k=Object.keys(cfg.base).find(x=>x===up||up.includes(x)||x.includes(up))
    return k?cfg.base[k][dif.toLowerCase() as keyof BaseCoef]:0
  }

  const precoPorKg=useMemo(()=>{
    const r:Record<string,number>={}
    Object.entries(cfg.tecidos).forEach(([t,c])=>
      r[t]=c.unidade==='kg'?c.preco:c.gramatura>0?c.preco/(c.gramatura/1000):0)
    return r
  },[cfg.tecidos])

  const totalDesp=cfg.impostos+cfg.comissao+cfg.frete+cfg.encargos+cfg.lucro

  /* ── Cálculo por código ──────────────────────────── */
  const calcModel=(cod:string,crs:FabricRow[])=>{
    const tipo  = crs[0].tipoPeca
    const dif   = cfg.dificuldade[tipo]??'MEDIO'
    const coef  = getCoef(tipo,dif)
    const nr    = cfg.nrOp[cod]??0
    const tempo = nr*coef

    const fabricsMap=new Map<string,number>()
    crs.forEach(r=>{if(!fabricsMap.has(r.tecido))fabricsMap.set(r.tecido,r.consumo)})
    const tecidoItens=[...fabricsMap.entries()].map(([t,c])=>({
      tecido:t, consumo:c, preco:precoPorKg[t]??0, total:c*(precoPorKg[t]??0)
    }))
    const custoTecido=tecidoItens.reduce((s,i)=>s+i.total,0)

    const ocItensGlobais=cfg.outrosCustosGlobais??[]
    const ocItensTipo=cfg.outrosCustos[tipo]??[]
    const ocItens=[...ocItensGlobais,...ocItensTipo]
    const custoOC=ocItens.reduce((s,i)=>s+i.qtd*i.preco,0)

    const custoMP   = custoTecido+custoOC
    const custoMOD  = cfg.custoCorte+tempo*cfg.custoMinuto
    const custoTotal= custoMP+custoMOD
    const fator     = 1-totalDesp/100
    const precoProp = fator>0?custoTotal/fator:0
    const markup    = custoTotal>0?precoProp/custoTotal:0
    const precoReal = cfg.precoReal[cod]??precoProp
    const lucroReal = precoReal>0?((precoReal-custoTotal)/precoReal)*100:0

    // Total de peças cortadas (soma da QTADE À CORTAR por cor, sem somar tecidos repetidos da mesma cor)
    const corMap=new Map<string,number>()
    crs.forEach(r=>{
      const cor=r.cor||'(sem cor)'
      corMap.set(cor,Math.max(corMap.get(cor)??0,r.qtadeACortar))
    })
    const totalPecas=[...corMap.values()].reduce((s,v)=>s+v,0)
    const valorTotalCliente=totalPecas*precoReal

    return{tipo,dif,coef,nr,tempo,tecidoItens,ocItens,ocItensGlobais,ocItensTipo,custoTecido,custoOC,
           custoMP,custoMOD,custoTotal,precoProp,markup,precoReal,lucroReal,totalPecas,valorTotalCliente}
  }

  const allResults=useMemo(()=>
    uniqCodigos.map(([cod,crs])=>({cod,...calcModel(cod,crs)}))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ,[uniqCodigos,cfg,precoPorKg,totalDesp])

  const toast_=(msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),4000)}

  /* ── Importar/aplicar dados de PLM (preços de tecido e outros custos) ── */
  const applyPlmData=(plm:PlmData)=>{
    const hasData=Object.keys(plm.tecidos).length>0||Object.keys(plm.outrosCustos).length>0
    if(!hasData) return false
    setCfg(p=>{
      const nt={...p.tecidos}
      Object.entries(plm.tecidos).forEach(([nome,info])=>{
        nt[nome]={...info,gramatura:nt[nome]?.gramatura??info.gramatura}
      })
      const mergedOC={...p.outrosCustos}
      Object.entries(plm.outrosCustos).forEach(([tp,itens])=>{
        const ex=mergedOC[tp]??[]
        const exNames=new Set(ex.map(i=>i.nome))
        mergedOC[tp]=[...ex,...itens.filter(i=>!exNames.has(i.nome)).map(i=>({id:uid(),...i}))]
      })
      return{...p,tecidos:nt,outrosCustos:mergedOC}
    })
    return true
  }

  // Aplica automaticamente os dados de PLM já presentes no arquivo importado na aba "Dados"
  useEffect(()=>{
    if(!importId||!plmData) return
    if(cfg.lastPlmImportId===importId) return
    const applied=applyPlmData(plmData)
    setCfg(p=>({...p,lastPlmImportId:importId}))
    if(applied) toast_('✓ Preços de tecido e outros custos carregados automaticamente do arquivo importado.')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[importId])

  const handlePlm=async(file:File)=>{
    try{
      const{read}=await import('xlsx')
      const wb=read(await file.arrayBuffer())
      if(!wb.Sheets['Tecidos']){toast_('Aba "Tecidos" não encontrada.',false);return}
      const plm=extractPlmData(wb)
      applyPlmData(plm)
      toast_('✓ PLM importado — preços de tecido e outros custos atualizados.')
    }catch{toast_('Erro ao ler PLM.',false)}
  }

  const handlePdf=async(file:File)=>{
    window.open(URL.createObjectURL(file),'_blank')
    try{
      const counts=await countOperationsByCode(file)
      const codigos=new Set(uniqCodigos.map(([cod])=>cod))
      const matched=Object.entries(counts).filter(([cod])=>codigos.has(cod))
      if(matched.length===0){
        toast_('PDF aberto — não encontrei sequências operacionais reconhecíveis para os modelos atuais.',false)
        return
      }
      setCfg(p=>({...p,nrOp:{...p.nrOp,...Object.fromEntries(matched)}}))
      toast_(`✓ Nº de Operações atualizado para ${matched.length} modelo(s): ${matched.map(([cod,n])=>`${cod} (${n})`).join(', ')}`)
    }catch{
      toast_('PDF aberto — não consegui ler as operações automaticamente, preencha o Nº Op manualmente.',false)
    }
  }

  /* ── Print modelo ────────────────────────────────── */
  const printModel=(cod:string,m:ReturnType<typeof calcModel>,colecao:string)=>{
    const w=window.open('','_blank','width=820,height=960')
    if(!w) return
    const logoUrl=`${window.location.origin}/logo.png`
    w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Ficha de Custo — ${cod}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1C1C1E;background:#fff;padding:36px 40px;font-size:12.5px;line-height:1.5}
  /* ── Header ── */
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:0;padding-bottom:18px;border-bottom:3px solid #1C1C1E}
  .logo-wrap{background:#fff;padding:6px 10px;border:1px solid #E5E5E5;border-radius:4px;display:inline-flex;align-items:center}
  .logo-wrap img{height:38px;width:auto;display:block}
  .ref{text-align:right}
  .ref .doc-title{font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:4px}
  .ref h2{font-size:26px;font-weight:800;letter-spacing:-0.5px;color:#1C1C1E}
  .ref p{color:#666;font-size:11px;margin-top:2px}
  /* ── Accent bar ── */
  .accent-bar{height:3px;background:linear-gradient(to right,#C9A96E,#E8D5B0,#C9A96E);margin-bottom:22px}
  /* ── Sections ── */
  .section{margin-bottom:14px}
  .section-title{display:flex;align-items:center;gap:8px;padding:7px 12px;background:#F7F5F2;border-left:4px solid #C9A96E;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#4A3728;margin-bottom:0}
  .row{display:flex;justify-content:space-between;align-items:center;padding:5px 12px;border-bottom:1px solid #F0EDEA}
  .row.sub{padding-left:24px;color:#555;font-size:12px}
  .row.subtotal{background:#FAF8F5;font-weight:600;font-size:12.5px;color:#1C1C1E}
  /* ── Totals ── */
  .row.custo-total{background:#1C1C1E;color:#fff;font-weight:700;font-size:14px;padding:10px 14px;margin:16px 0 16px}
  /* ── Pricing ── */
  .row.price-proposto{background:#F7F5F2;color:#666;font-size:12px;padding:7px 14px}
  .row.markup{background:#FAF8F5;color:#888;font-size:11.5px;padding:5px 14px}
  .row.price-real{background:linear-gradient(135deg,#C9A96E 0%,#B8864E 100%);color:#fff;font-size:20px;font-weight:800;padding:14px 14px;letter-spacing:-0.3px;border-radius:2px;margin-top:2px}
  .row.price-real .label{display:flex;flex-direction:column}
  .row.price-real .label small{font-size:9px;font-weight:400;letter-spacing:1.5px;text-transform:uppercase;opacity:.85;margin-bottom:1px}
  .row.lucro-real{background:#FBF8F3;color:#8C6D46;font-size:12px;padding:6px 14px;border:1px solid #EAD9BF;border-top:none}
  /* ── Note ── */
  .note{font-size:10px;color:#999;display:block;line-height:1.3}
  /* ── Footer ── */
  .footer{margin-top:28px;padding-top:10px;border-top:1px solid #E5E5E5;font-size:9.5px;color:#BBBBBB;display:flex;justify-content:space-between}
  @media print{body{padding:20px 24px}button{display:none}.row.custo-total{-webkit-print-color-adjust:exact;print-color-adjust:exact}.row.price-real{-webkit-print-color-adjust:exact;print-color-adjust:exact}.section-title{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head><body>

<div class="header">
  <div class="logo-wrap"><img src="${logoUrl}" alt="Samanta Gomes"/></div>
  <div class="ref">
    <div class="doc-title">Ficha de Custo</div>
    <h2>REF ${cod}</h2>
    <p>${m.tipo} &nbsp;·&nbsp; Coleção ${colecao}</p>
    <p>Dificuldade: ${m.dif==='FACIL'?'Fácil':m.dif==='MEDIO'?'Médio':'Difícil'}</p>
  </div>
</div>
<div class="accent-bar"></div>

<div class="section">
  <div class="section-title">Matéria Prima — Tecidos</div>
  ${m.tecidoItens.map(i=>`
  <div class="row sub">
    <span>${i.tecido}<span class="note">${i.consumo.toFixed(3)} kg × ${R$(i.preco)}/kg</span></span>
    <span>${R$(i.total)}</span>
  </div>`).join('')}
  <div class="row subtotal"><span>Subtotal Tecidos</span><span>${R$(m.custoTecido)}</span></div>
</div>

${m.ocItens.length>0?`<div class="section">
  <div class="section-title">Outros Custos</div>
  ${m.ocItens.map(i=>`
  <div class="row sub">
    <span>${i.nome}<span class="note">${i.qtd} un × ${R$(i.preco)}</span></span>
    <span>${R$(i.qtd*i.preco)}</span>
  </div>`).join('')}
  <div class="row subtotal"><span>Subtotal Outros Custos</span><span>${R$(m.custoOC)}</span></div>
</div>`:''}

<div class="section">
  <div class="section-title">Mão de Obra</div>
  <div class="row sub"><span>Custo de Corte</span><span>${R$(cfg.custoCorte)}</span></div>
  <div class="row sub">
    <span>${m.nr} operações × ${m.coef.toFixed(2)} min/op = ${m.tempo.toFixed(1)} min
      <span class="note">× ${R$(cfg.custoMinuto)}/min</span></span>
    <span>${R$(m.tempo*cfg.custoMinuto)}</span>
  </div>
  <div class="row subtotal"><span>Subtotal Mão de Obra</span><span>${R$(m.custoMOD)}</span></div>
</div>

<div class="row custo-total"><span>CUSTO TOTAL DE PRODUÇÃO</span><span>${R$(m.custoTotal)}</span></div>

<div class="section">
  <div class="section-title">Despesas sobre o Preço de Venda</div>
  <div class="row sub"><span>Impostos</span><span>${pct(cfg.impostos)}</span></div>
  <div class="row sub"><span>Comissão</span><span>${pct(cfg.comissao)}</span></div>
  <div class="row sub"><span>Frete</span><span>${pct(cfg.frete)}</span></div>
  <div class="row sub"><span>Encargos</span><span>${pct(cfg.encargos)}</span></div>
  <div class="row sub"><span>Lucro</span><span>${pct(cfg.lucro)}</span></div>
  <div class="row subtotal"><span>Total Despesas</span><span>${pct(totalDesp)}</span></div>
</div>

<div class="row price-proposto"><span>Preço de Venda Proposto</span><span>${R$(m.precoProp)}</span></div>
<div class="row markup"><span>Mark-Up</span><span>${m.markup.toFixed(2)}×</span></div>
<div class="row price-real">
  <span class="label"><small>Preço de Venda</small>VALOR FINAL</span>
  <span>${R$(m.precoReal)}</span>
</div>
<div class="row lucro-real"><span>Lucro Real</span><span>${pct(m.lucroReal)}</span></div>

<div class="footer">
  <span>Samanta Gomes Fashion Office</span>
  <span>Gerado em ${new Date().toLocaleDateString('pt-BR')}</span>
</div>
<script>setTimeout(()=>window.print(),300)</script>
</body></html>`)
    w.document.close()
  }

  /* ── Relatório geral (todos os modelos) ────────────── */
  const printAllModels=()=>{
    const colecao = rows[0]?.colecao ?? ''
    const w=window.open('','_blank','width=1100,height=900')
    if(!w) return
    w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Relatório de Precificação — ${colecao}</title>
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
<h1>Relatório de Precificação</h1>
<p class="sub">Coleção: ${colecao} &nbsp;·&nbsp; ${allResults.length} modelo(s) &nbsp;·&nbsp; Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
<table>
  <thead><tr>
    <th>Código</th><th>Tipo</th><th>Dificuldade</th><th>Custo Tecidos</th><th>Custo Outros</th>
    <th>Custo MOD</th><th>Custo Total</th><th>Preço Proposto</th><th>Mark-up</th><th>Preço de Venda</th><th>Lucro Real</th>
    <th>Qtd. Peças</th><th>Valor Total</th>
  </tr></thead>
  <tbody>
  ${allResults.map(m=>`
    <tr>
      <td class="left">${m.cod}</td>
      <td class="left">${m.tipo}</td>
      <td>${m.dif==='FACIL'?'Fácil':m.dif==='MEDIO'?'Médio':'Difícil'}</td>
      <td>${R$(m.custoTecido)}</td>
      <td>${R$(m.custoOC)}</td>
      <td>${R$(m.custoMOD)}</td>
      <td>${R$(m.custoTotal)}</td>
      <td>${R$(m.precoProp)}</td>
      <td>${m.markup.toFixed(2)}×</td>
      <td class="price">${R$(m.precoReal)}</td>
      <td>${pct(m.lucroReal)}</td>
      <td>${m.totalPecas}</td>
      <td class="price">${R$(m.valorTotalCliente)}</td>
    </tr>`).join('')}
  </tbody>
  <tfoot>
    <tr style="font-weight:700">
      <td class="left" colspan="11">VALOR TOTAL DO PEDIDO</td>
      <td>${allResults.reduce((s,m)=>s+m.totalPecas,0)}</td>
      <td class="price">${R$(allResults.reduce((s,m)=>s+m.valorTotalCliente,0))}</td>
    </tr>
  </tfoot>
</table>
<div class="footer">Samanta Gomes Fashion Office &nbsp;·&nbsp; Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
<script>setTimeout(()=>window.print(),300)</script>
</body></html>`)
    w.document.close()
  }

  /* ── Relatório para o cliente (sem custos/dificuldade) ── */
  const printClientReport=()=>{
    const colecao = rows[0]?.colecao ?? ''
    const w=window.open('','_blank','width=1100,height=900')
    if(!w) return
    w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Proposta de Preços — ${colecao}</title>
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
<h1>Proposta de Preços</h1>
<p class="sub">Coleção: ${colecao} &nbsp;·&nbsp; ${allResults.length} modelo(s) &nbsp;·&nbsp; Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
<table>
  <thead><tr>
    <th>Código</th><th>Tipo</th><th>Preço de Venda</th><th>Qtd. Peças</th><th>Valor Total</th>
  </tr></thead>
  <tbody>
  ${allResults.map(m=>`
    <tr>
      <td class="left">${m.cod}</td>
      <td class="left">${m.tipo}</td>
      <td class="price">${R$(m.precoReal)}</td>
      <td>${m.totalPecas}</td>
      <td class="price">${R$(m.valorTotalCliente)}</td>
    </tr>`).join('')}
  </tbody>
  <tfoot>
    <tr style="font-weight:700">
      <td class="left" colspan="3">VALOR TOTAL DO PEDIDO</td>
      <td>${allResults.reduce((s,m)=>s+m.totalPecas,0)}</td>
      <td class="price">${R$(allResults.reduce((s,m)=>s+m.valorTotalCliente,0))}</td>
    </tr>
  </tfoot>
</table>
<div class="footer">Samanta Gomes Fashion Office &nbsp;·&nbsp; Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
<script>setTimeout(()=>window.print(),300)</script>
</body></html>`)
    w.document.close()
  }

  const exportPricingExcel=async()=>{
    const ExcelJS=(await import('exceljs')).default
    const colecao = rows[0]?.colecao ?? ''
    const wb=new ExcelJS.Workbook()
    wb.creator='Pré Consumo App'
    const ws=wb.addWorksheet('Precificação')

    ws.columns=[
      {header:'Código',         key:'cod',        width:12},
      {header:'Tipo Peça',      key:'tipo',       width:18},
      {header:'Dificuldade',    key:'dif',        width:12},
      {header:'Custo Tecidos',  key:'custoTecido',width:14},
      {header:'Custo Outros',   key:'custoOC',    width:14},
      {header:'Custo MOD',      key:'custoMOD',   width:14},
      {header:'Custo Total',    key:'custoTotal', width:14},
      {header:'Preço Proposto', key:'precoProp',  width:16},
      {header:'Mark-up',        key:'markup',     width:10},
      {header:'Preço de Venda', key:'precoReal',  width:16},
      {header:'Lucro Real',     key:'lucroReal',  width:12},
      {header:'Qtd. Peças',     key:'totalPecas', width:12},
      {header:'Valor Total',    key:'valorTotalCliente', width:16},
    ]

    const hRow=ws.getRow(1)
    hRow.height=22
    hRow.eachCell(cell=>{
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A1A1A'}}
      cell.font={name:'Calibri',size:10,bold:true,color:{argb:'FFFFFFFF'}}
      cell.alignment={horizontal:'center',vertical:'middle'}
    })

    allResults.forEach((m,i)=>{
      const r=ws.addRow({
        cod:m.cod, tipo:m.tipo,
        dif:m.dif==='FACIL'?'Fácil':m.dif==='MEDIO'?'Médio':'Difícil',
        custoTecido:m.custoTecido, custoOC:m.custoOC, custoMOD:m.custoMOD,
        custoTotal:m.custoTotal, precoProp:m.precoProp, markup:m.markup,
        precoReal:m.precoReal, lucroReal:m.lucroReal/100,
        totalPecas:m.totalPecas, valorTotalCliente:m.valorTotalCliente,
      })
      const bg=i%2===0?'FFFFFFFF':'FFF7F7F7'
      r.eachCell((cell,col)=>{
        cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}}
        cell.font={name:'Calibri',size:9}
        cell.alignment={vertical:'middle',horizontal:col<=2?'left':'right'}
        if(col>=4&&col<=8) cell.numFmt='"R$" #,##0.00'
        if(col===9) cell.numFmt='0.00"x"'
        if(col===11) cell.numFmt='0.0%'
        if(col===12) cell.numFmt='#,##0'
        if(col===13) cell.numFmt='"R$" #,##0.00'
      })
    })

    const totalRow=ws.addRow({
      tipo:'VALOR TOTAL DO PEDIDO',
      totalPecas:allResults.reduce((s,m)=>s+m.totalPecas,0),
      valorTotalCliente:allResults.reduce((s,m)=>s+m.valorTotalCliente,0),
    })
    totalRow.eachCell((cell,col)=>{
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE0E0E0'}}
      cell.font={name:'Calibri',size:9,bold:true}
      cell.alignment={vertical:'middle',horizontal:col<=2?'left':'right'}
      if(col===12) cell.numFmt='#,##0'
      if(col===13) cell.numFmt='"R$" #,##0.00'
    })

    ws.autoFilter={from:'A1',to:'M1'}
    ws.views=[{state:'frozen',xSplit:0,ySplit:1}]

    const buffer=await wb.xlsx.writeBuffer()
    const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a')
    a.href=url
    a.download=`Precificacao_${(colecao||'Colecao').replace(/[^\w\s-]/g,'').trim()}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const currentModel = selectedCod
    ? uniqCodigos.find(([c])=>c===selectedCod)
    : null
  const currentResult = currentModel
    ? allResults.find(r=>r.cod===selectedCod)
    : null

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return(
    <div className="flex flex-col gap-4">

      {/* ── Barra de ações ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3"
        style={{background:C.surface2,border:`1px solid ${C.border}`}}>
        <input ref={plmRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={e=>{const f=e.target.files?.[0];if(f)handlePlm(f);e.target.value=''}}/>
        <input ref={pdfRef} type="file" accept=".pdf" className="hidden"
          onChange={e=>{const f=e.target.files?.[0];if(f)handlePdf(f);e.target.value=''}}/>
        <button onClick={()=>plmRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{background:C.purple,color:'#fff'}}>
          <Upload size={13}/> Importar PLM (Excel)
        </button>
        <button onClick={()=>pdfRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{background:C.tealBg,color:C.teal,border:`1px solid ${C.teal}`}}>
          <FileText size={13}/> Abrir Ficha Técnica (PDF)
        </button>
        <div style={{width:1,height:24,background:C.border}}/>
        <button onClick={printAllModels}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted}}>
          <Printer size={13}/> Relatório Geral (PDF)
        </button>
        <button onClick={exportPricingExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{background:C.greenBg,border:`1px solid ${C.green}`,color:C.green}}>
          <FileSpreadsheet size={13}/> Relatório Geral (Excel)
        </button>
        <button onClick={printClientReport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{background:C.purpleBg,border:`1px solid ${C.purple}`,color:C.purple}}>
          <Printer size={13}/> Proposta para Cliente (PDF)
        </button>
        <button onClick={()=>setOpenSettings(s=>!s)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm ml-auto"
          style={{color:C.muted,border:`1px solid ${C.border}`}}>
          {openSettings?<ChevronUp size={13}/>:<ChevronDown size={13}/>} Configurações
        </button>
        {toast&&<p className="text-xs w-full" style={{color:toast.ok?C.teal:C.pink}}>{toast.msg}</p>}
      </div>

      {/* ── Configurações (colapsível) ── */}
      {openSettings&&(
        <div className="rounded-xl p-4 flex flex-col gap-4"
          style={{background:C.surface2,border:`1px solid ${C.border}`}}>

          {/* Parâmetros globais */}
          <div className="flex flex-wrap gap-4 items-end">
            {[
              {lb:'Custo Corte (R$/peça)',k:'custoCorte' as const,c:C.purpleLt,bg:C.purpleBg,step:0.5},
              {lb:'Custo Minuto (R$/min)', k:'custoMinuto' as const,c:C.teal,bg:C.tealBg,step:0.01},
            ].map(({lb,k,c,bg,step})=>(
              <div key={k} className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-wide" style={{color:C.muted}}>{lb}</label>
                <NInput v={cfg[k] as number} set={v=>setG(k,v)} step={step} color={c} bg={bg}/>
              </div>
            ))}
            <div style={{width:1,height:36,background:C.border}}/>
            {[
              {lb:'Impostos %',k:'impostos' as const,c:C.pink,bg:C.pinkBg},
              {lb:'Comissão %',k:'comissao' as const,c:C.yellow,bg:'#1C1A0E'},
              {lb:'Frete %',   k:'frete'    as const,c:C.teal,bg:C.tealBg},
              {lb:'Encargos %',k:'encargos' as const,c:C.purpleLt,bg:C.purpleBg},
              {lb:'Lucro %',   k:'lucro'    as const,c:C.green,bg:C.greenBg},
            ].map(({lb,k,c,bg})=>(
              <div key={k} className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-wide" style={{color:C.muted}}>{lb}</label>
                <NInput v={cfg[k] as number} set={v=>setG(k,v)} step={0.5} color={c} bg={bg} w="w-16"/>
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide" style={{color:C.muted}}>Total</label>
              <div className="w-16 rounded px-2 py-1 text-sm font-bold text-right"
                style={{background:C.bg,border:`1px solid ${C.border}`,
                  color:totalDesp>=100?C.pink:C.text}}>
                {totalDesp.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Tecidos */}
          <div>
            <p className="text-xs uppercase tracking-wide mb-2" style={{color:C.muted}}>Preço dos Tecidos</p>
            <div className="flex flex-wrap gap-3">
              {uniqTecidos.map(t=>{
                const tc=cfg.tecidos[t]??{preco:0,unidade:'kg',gramatura:200}
                const pkg=precoPorKg[t]??0
                return(
                  <div key={t} className="flex items-center gap-2 rounded-lg px-3 py-2"
                    style={{background:C.bg,border:`1px solid ${C.border}`}}>
                    <span className="text-sm font-medium" style={{color:C.text}}>{t}</span>
                    <select value={tc.unidade} onChange={e=>setTec(t,'unidade',e.target.value)}
                      className="rounded px-1.5 py-1 text-xs focus:outline-none cursor-pointer"
                      style={{background:C.surface2,border:`1px solid ${C.border}`,color:C.text}}>
                      <option value="kg">R$/kg</option>
                      <option value="metro">R$/metro</option>
                    </select>
                    <NInput v={tc.preco} set={v=>setTec(t,'preco',v)} step={0.01}
                      color={C.purpleLt} bg={C.purpleBg} w="w-24"/>
                    {pkg>0&&<span className="text-xs font-semibold" style={{color:C.teal}}>= {R$(pkg)}/kg</span>}
                    {tc.unidade==='metro'&&(
                      <div className="flex items-center gap-1">
                        <span className="text-xs" style={{color:C.muted}}>g/m²</span>
                        <NInput v={tc.gramatura} set={v=>setTec(t,'gramatura',v)} step={1}
                          color={C.text} bg={C.surface} w="w-16"/>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ ÁREA PRINCIPAL: FICHAS DE CUSTO ═══════════════ */}
      <div className="flex gap-4" style={{minHeight:0}}>

        {/* Lista de modelos (esquerda) */}
        <div className="flex flex-col gap-1 shrink-0" style={{width:200}}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{color:C.muted}}>Modelos</p>
          {allResults.map(r=>(
            <button key={r.cod} onClick={()=>setSelectedCod(r.cod)}
              className="flex flex-col items-start px-3 py-2 rounded-lg text-left transition-all"
              style={{
                background:selectedCod===r.cod?C.purpleBg:C.surface,
                border:`1px solid ${selectedCod===r.cod?C.purple:C.border}`,
              }}>
              <span className="font-mono text-xs" style={{color:selectedCod===r.cod?C.purple:C.muted}}>
                {r.cod}
              </span>
              <span className="text-sm font-medium" style={{color:C.text}}>{r.tipo}</span>
              <span className="text-xs font-bold mt-0.5" style={{color:C.green}}>
                {r.precoProp>0?R$(r.precoReal):'—'}
              </span>
            </button>
          ))}
        </div>

        {/* Ficha de custo do modelo selecionado */}
        {currentResult&&currentModel?(()=>{
          const m=currentResult
          const cod=currentResult.cod
          const colecao=currentModel[1][0]?.colecao??''
          return(
            <div className="flex-1 min-w-0 rounded-xl overflow-hidden"
              style={{border:`1px solid ${C.border}`}}>

              {/* Header da ficha */}
              <div className="flex items-center justify-between px-5 py-4"
                style={{background:C.surface2,borderBottom:`1px solid ${C.border}`}}>
                <div>
                  <p className="text-xs uppercase tracking-widest mb-0.5" style={{color:C.muted}}>
                    Ficha de Custo
                  </p>
                  <h2 className="text-xl font-bold" style={{color:C.text}}>REF: {cod}</h2>
                  <p className="text-sm mt-0.5" style={{color:C.muted}}>
                    {m.tipo} &nbsp;·&nbsp; Coleção: {colecao} &nbsp;·&nbsp;
                    Dificuldade:{' '}
                    <span style={{color:C.text}}>
                      {m.dif==='FACIL'?'Fácil':m.dif==='MEDIO'?'Médio':'Difícil'}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Dificuldade */}
                  <select value={cfg.dificuldade[m.tipo]??'MEDIO'}
                    onChange={e=>setCfg(p=>({...p,dificuldade:{...p.dificuldade,[m.tipo]:e.target.value as 'FACIL'|'MEDIO'|'DIFICIL'}}))}
                    className="rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer"
                    style={{background:C.bg,border:`1px solid ${C.border}`,color:C.text}}>
                    <option value="FACIL">Fácil</option>
                    <option value="MEDIO">Médio</option>
                    <option value="DIFICIL">Difícil</option>
                  </select>
                  <button onClick={()=>printModel(cod,m,colecao)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                    style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted}}>
                    <Printer size={14}/> Imprimir / PDF
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto" style={{maxHeight:'calc(100vh - 360px)'}}>

                {/* ── Matéria Prima ── */}
                <div>
                  <div className="px-5 py-2 text-xs font-bold uppercase tracking-widest"
                    style={{background:C.bg,color:C.muted,borderBottom:`1px solid ${C.border}`}}>
                    Matéria Prima — Tecidos
                  </div>
                  {m.tecidoItens.map(i=>(
                    <Row key={i.tecido} label={i.tecido}
                      sub={`${i.consumo.toFixed(3)} kg × ${R$(i.preco)}/kg`}
                      value={i.total>0?R$(i.total):'sem preço cadastrado'}
                      accent={i.total>0?C.purpleLt:C.muted}/>
                  ))}
                  <Row label="Subtotal Tecidos" value={R$(m.custoTecido)} bold accent={C.purpleLt}/>
                </div>

                {/* ── Outros Custos (todos os produtos) ── */}
                <div>
                  <div className="px-5 py-2 text-xs font-bold uppercase tracking-widest"
                    style={{background:C.bg,color:C.muted,borderBottom:`1px solid ${C.border}`}}>
                    Outros Custos — Todos os Produtos
                  </div>
                  <datalist id="sug-oc">
                    {SUGESTOES.map(s=><option key={s} value={s}/>)}
                  </datalist>
                  <OutrosCustosList items={cfg.outrosCustosGlobais??[]} onChange={setOCG}/>
                  <Row label="Subtotal (todos os produtos)"
                    value={R$(m.ocItensGlobais.reduce((s,i)=>s+i.qtd*i.preco,0))} accent={C.yellow}/>
                </div>

                {/* ── Outros Custos (específicos do tipo de peça) ── */}
                <div>
                  <div className="px-5 py-2 text-xs font-bold uppercase tracking-widest"
                    style={{background:C.bg,color:C.muted,borderBottom:`1px solid ${C.border}`}}>
                    Outros Custos — {m.tipo}
                  </div>
                  <OutrosCustosList items={cfg.outrosCustos[m.tipo]??[]} onChange={fn=>setOC(m.tipo,fn)}/>
                  <Row label="Subtotal Outros Custos" value={R$(m.custoOC)} bold accent={C.yellow}/>
                </div>

                {/* ── Mão de Obra ── */}
                <div>
                  <div className="px-5 py-2 text-xs font-bold uppercase tracking-widest"
                    style={{background:C.bg,color:C.muted,borderBottom:`1px solid ${C.border}`}}>
                    Mão de Obra
                  </div>
                  <Row label="Custo de Corte" value={R$(cfg.custoCorte)} accent={C.teal}/>
                  <div className="flex items-center justify-between py-1.5 px-5"
                    style={{borderBottom:`1px solid ${C.border}`}}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm" style={{color:C.muted}}>Nº Operações</span>
                      <NInput v={cfg.nrOp[cod]??0}
                        set={v=>setCfg(p=>({...p,nrOp:{...p.nrOp,[cod]:v}}))}
                        step={1} color={C.pink} bg={C.pinkBg} w="w-16"/>
                      {m.nr>0&&(
                        <span className="text-xs" style={{color:C.muted}}>
                          × {m.coef.toFixed(2)} min/op = <strong style={{color:C.yellow}}>{m.tempo.toFixed(1)} min</strong>
                          &nbsp;× {R$(cfg.custoMinuto)}/min
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold" style={{color:C.teal}}>
                      {R$(m.tempo*cfg.custoMinuto)}
                    </span>
                  </div>
                  <Row label="Subtotal Mão de Obra" value={R$(m.custoMOD)} bold accent={C.teal}/>
                </div>

                {/* ── Custo Total ── */}
                <div className="px-5 py-4 flex justify-between items-center"
                  style={{background:C.surface2,borderBottom:`1px solid ${C.border}`}}>
                  <span className="text-base font-bold" style={{color:C.text}}>CUSTO TOTAL DE PRODUÇÃO</span>
                  <span className="text-xl font-bold" style={{color:C.text}}>{R$(m.custoTotal)}</span>
                </div>

                {/* ── Despesas ── */}
                <div>
                  <div className="px-5 py-2 text-xs font-bold uppercase tracking-widest"
                    style={{background:C.bg,color:C.muted,borderBottom:`1px solid ${C.border}`}}>
                    Despesas sobre o Preço de Venda
                  </div>
                  <Row label="Impostos"  value={pct(cfg.impostos)}  accent={C.pink}/>
                  <Row label="Comissão"  value={pct(cfg.comissao)}  accent={C.yellow}/>
                  <Row label="Frete"     value={pct(cfg.frete)}     accent={C.teal}/>
                  <Row label="Encargos"  value={pct(cfg.encargos)}  accent={C.purpleLt}/>
                  <Row label="Lucro"     value={pct(cfg.lucro)}     accent={C.green}/>
                  <Row label="Total Despesas" value={pct(totalDesp)} bold
                    accent={totalDesp>=100?C.pink:C.text}/>
                </div>

                {/* ── Resultado ── */}
                <div>
                  <Row label="Preço de Venda Proposto" value={R$(m.precoProp)} bold accent={C.purpleLt}/>
                  <Row label="Mark-Up" value={`${m.markup.toFixed(2)}×`} accent={C.muted}/>

                  {/* Preço Real editável */}
                  <div className="flex items-center justify-between px-5 py-3"
                    style={{background:C.greenBg,borderBottom:`1px solid ${C.border}`}}>
                    <span className="text-base font-bold" style={{color:C.green}}>PREÇO DE VENDA</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{color:C.green,opacity:.7}}>R$</span>
                      <input type="number" step={0.01} min={0}
                        value={cfg.precoReal[cod]??m.precoProp.toFixed(2)}
                        onChange={e=>setCfg(p=>({...p,precoReal:{...p.precoReal,[cod]:Number(e.target.value)}}))}
                        onFocus={e=>{if(!cfg.precoReal[cod])setCfg(p=>({...p,precoReal:{...p.precoReal,[cod]:m.precoProp}}));e.target.select()}}
                        className="w-32 rounded-lg px-3 py-1.5 text-xl font-bold text-right focus:outline-none
                          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                          [&::-webkit-inner-spin-button]:appearance-none"
                        style={{background:'rgba(255,255,255,0.1)',border:`1px solid ${C.green}`,color:C.green}}/>
                    </div>
                  </div>
                  <Row label="Lucro Real" value={pct(m.lucroReal)}
                    bold accent={m.lucroReal>0?C.green:C.pink}/>
                </div>
              </div>
            </div>
          )
        })():<div className="flex-1 flex items-center justify-center"
          style={{border:`1px solid ${C.border}`,borderRadius:12,color:C.muted}}>
          Selecione um modelo na lista
        </div>}
      </div>
    </div>
  )
}
