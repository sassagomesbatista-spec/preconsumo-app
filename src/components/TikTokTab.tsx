import { useEffect, useMemo, useState } from 'react'
import { Plus, Copy, Trash2, Settings, TriangleAlert, CircleAlert, RotateCcw } from 'lucide-react'
import type { AtacadoPreco } from './PricingTab'
import {
  TAXAS_TIKTOK_DEFAULT, precificar, custoUnitario, simularCenario, parseNumeroBR,
  fmtBRL as R$, fmtPct, fmtNumero,
  type TaxasTikTok, type EntradaTikTok, type Cenario, type SeloCenario,
} from '../utils/tiktokPricing'

/* ─── Paleta ──────────────────────────────────────────────── */
const C = {
  bg:'#0A0C14', surface:'#12141F', surface2:'#1A1D2E', border:'#252A45',
  text:'#E2E8F0', muted:'#8892B0',
  purple:'#7C6FCD', purpleLt:'#9D8FE0', purpleBg:'#1E1B35',
  teal:'#4ECDC4', tealBg:'#152828',
  pink:'#E879A0', pinkBg:'#1F1220',
  yellow:'#F6C90E', yellowBg:'#1C1A0E',
  green:'#4ADE80', greenBg:'#0F2018',
  red:'#F87171', redBg:'#1F1215', redBorder:'#7F1D1D',
  blue:'#60A5FA', orange:'#FB923C',
}

/* ─── Tipos / padrões ─────────────────────────────────────── */
interface Produto extends EntradaTikTok {
  id:string
  nome:string
  ref:string|null        // REF cadastrada de onde o custo foi puxado; null = produto avulso
  custoManual:boolean    // custo da REF sobrescrito à mão
  cenarios:Cenario[]
}

interface Estado { produtos:Produto[]; selecionadoId:string|null }

const STORAGE_PRODUTOS = 'tiktok-v1'
const STORAGE_TAXAS    = 'tiktok-taxas-v1'

function uid(){ return Math.random().toString(36).slice(2,9) }

const cenariosPadrao=():Cenario[]=>[
  {id:uid(),nome:'Preço cheio',  desconto:0},
  {id:uid(),nome:'Cupom',        desconto:10},
  {id:uid(),nome:'Liquidação',   desconto:25},
  {id:uid(),nome:'Black Friday', desconto:40},
]

function novoProduto(nome:string,ref:string|null,custo:number):Produto{
  return{
    id:uid(), nome, ref, custoManual:false, custoProducao:custo,
    embalagem:0, etiqueta:0, freteProprio:0, custosFixos:0, outros:0,
    imposto:6, afiliada:0, anuncios:0, devolucoes:3,
    usaFreteGratis:true,
    lucroDesejado:20, lucroMinimo:5, maiorDesconto:40,
    precoTeste:null, arredondar:true,
    cenarios:cenariosPadrao(),
  }
}

function loadEstado():Estado{
  try{
    const s=localStorage.getItem(STORAGE_PRODUTOS)
    if(s){
      const p=JSON.parse(s)
      const base=novoProduto('',null,0)
      const produtos:Produto[]=(Array.isArray(p.produtos)?p.produtos:[]).map((x:Partial<Produto>)=>({
        ...base,...x,cenarios:Array.isArray(x.cenarios)?x.cenarios:cenariosPadrao(),
      }))
      return{produtos,selecionadoId:p.selecionadoId??produtos[0]?.id??null}
    }
  }catch{ /* JSON inválido, começa vazio */ }
  return{produtos:[],selecionadoId:null}
}

function loadTaxas():TaxasTikTok{
  try{
    const s=localStorage.getItem(STORAGE_TAXAS)
    if(s) return{...TAXAS_TIKTOK_DEFAULT,...JSON.parse(s)}
  }catch{ /* JSON inválido, usa o padrão */ }
  return TAXAS_TIKTOK_DEFAULT
}

/* ─── Campos ──────────────────────────────────────────────── */
// Campo numérico que aceita vírgula como decimal ("77,90"). Enquanto a pessoa
// digita, mostra exatamente o texto digitado; ao sair do campo, volta pro
// número formatado.
function NumField({value,onChange,prefix,suffix,w='w-24',color=C.text,allowEmpty=false,placeholder}:{
  value:number|null; onChange:(n:number|null)=>void
  prefix?:string; suffix?:string; w?:string; color?:string; allowEmpty?:boolean; placeholder?:string
}){
  const [draft,setDraft]=useState<string|null>(null)
  const fmt=(n:number)=>prefix==='R$'&&!Number.isInteger(n)
    ?n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:false})
    :fmtNumero(n)
  const shown=draft??(value===null?'':fmt(value))
  return(
    <div className="flex items-center gap-1 rounded px-2 py-1"
      style={{background:C.surface2,border:`1px solid ${C.border}`}}>
      {prefix&&<span className="text-xs" style={{color:C.muted}}>{prefix}</span>}
      <input type="text" inputMode="decimal" value={shown} placeholder={placeholder}
        onFocus={e=>{setDraft(shown);e.target.select()}}
        onChange={e=>{
          const s=e.target.value
          setDraft(s)
          const n=parseNumeroBR(s)
          if(n!==null) onChange(Math.max(0,n))
          else if(s.trim()==='') onChange(allowEmpty?null:0)
        }}
        onBlur={()=>setDraft(null)}
        className={`${w} bg-transparent text-sm font-semibold text-right focus:outline-none`}
        style={{color}}/>
      {suffix&&<span className="text-xs" style={{color:C.muted}}>{suffix}</span>}
    </div>
  )
}

function Campo({label,hint,children}:{label:string;hint?:string;children:React.ReactNode}){
  return(
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-sm" style={{color:C.text}}>{label}</p>
        {hint&&<p className="text-xs" style={{color:C.muted}}>{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Check({checked,onChange,label}:{checked:boolean;onChange:(v:boolean)=>void;label:string}){
  return(
    <label className="flex items-center gap-2 py-1.5 text-sm cursor-pointer select-none" style={{color:C.text}}>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}
        className="w-4 h-4 cursor-pointer" style={{accentColor:C.purple}}/>
      {label}
    </label>
  )
}

function Secao({titulo,children}:{titulo:string;children:React.ReactNode}){
  return(
    <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${C.border}`}}>
      <div className="px-4 py-2 text-xs font-bold uppercase tracking-widest"
        style={{background:C.bg,color:C.muted,borderBottom:`1px solid ${C.border}`}}>
        {titulo}
      </div>
      <div className="px-4 py-2" style={{background:C.surface}}>{children}</div>
    </div>
  )
}

function Alerta({tipo,children}:{tipo:'erro'|'aviso';children:React.ReactNode}){
  const erro=tipo==='erro'
  return(
    <div className="flex items-start gap-3 rounded-xl p-3 text-sm"
      style={erro
        ?{background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red}
        :{background:C.yellowBg,border:`1px solid #6B5A0A`,color:C.yellow}}>
      {erro?<CircleAlert size={16} className="mt-0.5 shrink-0"/>:<TriangleAlert size={16} className="mt-0.5 shrink-0"/>}
      <div>{children}</div>
    </div>
  )
}

const SELO:Record<SeloCenario,{label:string;color:string;bg:string}>={
  lucro:   {label:'Lucro',      color:C.green, bg:C.greenBg},
  baixo:   {label:'Lucro baixo',color:C.yellow,bg:C.yellowBg},
  prejuizo:{label:'Prejuízo',   color:C.red,   bg:C.redBg},
}

/* ─── Configuração das taxas do TikTok ────────────────────── */
function TaxasPanel({taxas,onSave}:{taxas:TaxasTikTok;onSave:(t:TaxasTikTok)=>void}){
  const [d,setD]=useState(taxas)
  const set=<K extends keyof TaxasTikTok>(k:K,v:TaxasTikTok[K])=>setD(p=>({...p,[k]:v}))
  const mudou=JSON.stringify(d)!==JSON.stringify(taxas)
  const n=(v:number|null)=>v??0
  return(
    <div className="rounded-xl p-4 flex flex-col gap-3"
      style={{background:C.surface2,border:`1px solid ${C.border}`}}>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-semibold" style={{color:C.text}}>Taxas do TikTok Shop</p>
        <span className="text-xs" style={{color:C.muted}}>
          · valem para todos os produtos · última atualização:{' '}
          <strong style={{color:C.text}}>
            {taxas.atualizadoEm?new Date(taxas.atualizadoEm).toLocaleDateString('pt-BR'):'nunca (valores padrão)'}
          </strong>
        </span>
      </div>
      <Alerta tipo="aviso">
        Confira as taxas no Seller Center — o TikTok muda comissões e taxas de tempos em tempos.
        A faixa é definida pelo <strong>preço efetivo</strong> que o cliente paga, já com o desconto do vendedor.
      </Alerta>
      <div className="grid gap-x-8 gap-y-1" style={{gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))'}}>
        <Campo label="Limite entre faixas"><NumField value={d.limite} onChange={v=>set('limite',n(v))} prefix="R$"/></Campo>
        <div/>
        <Campo label="Abaixo do limite — comissão"><NumField value={d.comBaixo} onChange={v=>set('comBaixo',n(v))} suffix="%" w="w-16"/></Campo>
        <Campo label="Abaixo do limite — taxa fixa por item"><NumField value={d.fixBaixo} onChange={v=>set('fixBaixo',n(v))} prefix="R$"/></Campo>
        <Campo label="A partir do limite — comissão"><NumField value={d.comAlto} onChange={v=>set('comAlto',n(v))} suffix="%" w="w-16"/></Campo>
        <Campo label="A partir do limite — taxa fixa por item"><NumField value={d.fixAlto} onChange={v=>set('fixAlto',n(v))} prefix="R$"/></Campo>
        <Campo label="Programa de frete grátis"><NumField value={d.fretePct} onChange={v=>set('fretePct',n(v))} suffix="%" w="w-16"/></Campo>
        <Campo label="Teto do frete grátis por item"><NumField value={d.freteTeto} onChange={v=>set('freteTeto',n(v))} prefix="R$"/></Campo>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={()=>onSave({...d,atualizadoEm:new Date().toISOString()})}
          className="px-4 py-2 rounded-lg text-sm font-medium" style={{background:C.purple,color:'#fff'}}>
          Salvar taxas
        </button>
        {mudou&&<button onClick={()=>setD(taxas)}
          className="px-3 py-2 rounded-lg text-sm" style={{color:C.muted,border:`1px solid ${C.border}`}}>
          Descartar alterações
        </button>}
        <button onClick={()=>setD({...TAXAS_TIKTOK_DEFAULT,atualizadoEm:taxas.atualizadoEm})}
          className="px-3 py-2 rounded-lg text-sm ml-auto" style={{color:C.muted,border:`1px solid ${C.border}`}}>
          Restaurar valores padrão
        </button>
      </div>
    </div>
  )
}

/* ─── Barra "para onde vai o dinheiro" ────────────────────── */
function BarraDinheiro({v}:{v:NonNullable<ReturnType<typeof precificar>['cheio']>}){
  const partes=[
    {label:'Custo da peça',  valor:v.custoUnitario,color:C.purple},
    {label:'Taxas do TikTok',valor:v.taxasTikTok,  color:C.pink},
    {label:'Imposto',        valor:v.imposto,      color:C.yellow},
    {label:'Afiliada',       valor:v.afiliada,     color:C.orange},
    {label:'Anúncios',       valor:v.anuncios,     color:C.blue},
    {label:'Devoluções',     valor:v.devolucoes,   color:C.muted},
    {label:'Lucro',          valor:Math.max(0,v.lucro),color:C.green},
  ]
  // Com prejuízo, as saídas passam do preço: a barra mostra o total gasto e a
  // legenda mostra o prejuízo à parte.
  const total=partes.reduce((s,p)=>s+p.valor,0)||1
  return(
    <div className="flex flex-col gap-2">
      <div className="flex h-7 w-full rounded-lg overflow-hidden" style={{background:C.bg}}>
        {partes.filter(p=>p.valor>0).map(p=>(
          <div key={p.label} title={`${p.label}: ${R$(p.valor)}`}
            style={{width:`${p.valor/total*100}%`,background:p.color}}/>
        ))}
      </div>
      <div className="grid gap-x-4 gap-y-1" style={{gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))'}}>
        {partes.filter(p=>p.label!=='Lucro'||v.lucro>=0).map(p=>(
          <div key={p.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{background:p.color}}/>
            <span className="whitespace-nowrap" style={{color:C.muted}}>{p.label}</span>
            <span className="ml-auto font-semibold whitespace-nowrap" style={{color:C.text}}>{R$(p.valor)}</span>
            <span className="w-12 text-right" style={{color:C.muted}}>{fmtPct(v.preco>0?p.valor/v.preco*100:0)}</span>
          </div>
        ))}
        {v.lucro<0&&(
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{background:C.red}}/>
            <span style={{color:C.red}}>Prejuízo</span>
            <span className="ml-auto font-semibold whitespace-nowrap" style={{color:C.red}}>{R$(v.lucro)}</span>
            <span className="w-12 text-right" style={{color:C.red}}>{fmtPct(v.margem*100)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Componente principal ────────────────────────────────── */
interface Props { refs:AtacadoPreco[] }

export default function TikTokTab({refs}:Props){
  const [estado,setEstado]=useState<Estado>(loadEstado)
  const [taxas,setTaxas]=useState<TaxasTikTok>(loadTaxas)
  const [openTaxas,setOpenTaxas]=useState(false)
  const [novoRef,setNovoRef]=useState('')

  // REFs do projeto aberto com custo já calculado na aba Precificação
  const refsComCusto=useMemo(()=>refs.filter(r=>typeof r.custoTotal==='number'),[refs])
  const custoDaRef=useMemo(()=>new Map(refsComCusto.map(r=>[r.cod,r.custoTotal!])),[refsComCusto])

  // Enquanto não for sobrescrito à mão, o custo acompanha a ficha de custo da
  // REF (se ela está no projeto aberto); fora dele, fica o último valor puxado.
  const custoEfetivo=(p:Produto)=>
    p.ref&&!p.custoManual&&custoDaRef.has(p.ref)?custoDaRef.get(p.ref)!:p.custoProducao
  const comCusto=(p:Produto):Produto=>({...p,custoProducao:custoEfetivo(p)})

  useEffect(()=>{
    try{
      localStorage.setItem(STORAGE_PRODUTOS,JSON.stringify({
        ...estado,produtos:estado.produtos.map(comCusto),
      }))
    }catch{ /* quota excedida, ignora */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[estado,custoDaRef])
  useEffect(()=>{
    try{ localStorage.setItem(STORAGE_TAXAS,JSON.stringify(taxas)) }catch{ /* ignora */ }
  },[taxas])

  const {produtos,selecionadoId}=estado
  const produto=produtos.find(p=>p.id===selecionadoId)??null

  const resultados=useMemo(()=>new Map(produtos.map(p=>[p.id,precificar(comCusto(p),taxas)]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ,[produtos,taxas,custoDaRef])

  const setProduto=(id:string,fn:(p:Produto)=>Produto)=>
    setEstado(s=>({...s,produtos:s.produtos.map(p=>p.id===id?fn(p):p)}))
  const upd=<K extends keyof Produto>(k:K,v:Produto[K])=>{
    if(produto) setProduto(produto.id,p=>({...p,[k]:v}))
  }
  const adicionar=(p:Produto)=>setEstado(s=>({produtos:[...s.produtos,p],selecionadoId:p.id}))
  const duplicar=(p:Produto)=>adicionar({...comCusto(p),id:uid(),nome:`${p.nome} (cópia)`,
    cenarios:p.cenarios.map(c=>({...c,id:uid()}))})
  const excluir=(p:Produto)=>{
    if(!window.confirm(`Excluir "${p.nome||'produto sem nome'}" da lista do TikTok Shop?`)) return
    setEstado(s=>{
      const produtos=s.produtos.filter(x=>x.id!==p.id)
      return{produtos,selecionadoId:s.selecionadoId===p.id?(produtos[0]?.id??null):s.selecionadoId}
    })
  }

  const nomeDaRef=(cod:string)=>{
    const r=refs.find(x=>x.cod===cod)
    return r?`REF ${r.cod} — ${r.tipo}`:`REF ${cod}`
  }
  const criarDaRef=(cod:string)=>{
    if(!cod) return
    adicionar(novoProduto(nomeDaRef(cod),cod,custoDaRef.get(cod)??0))
    setNovoRef('')
  }
  const trocarRef=(cod:string)=>{
    if(!produto) return
    if(cod==='') { setProduto(produto.id,p=>({...comCusto(p),ref:null,custoManual:false})); return }
    setProduto(produto.id,p=>({...p,ref:cod,custoManual:false,custoProducao:custoDaRef.get(cod)??p.custoProducao,
      nome:!p.nome||p.nome.startsWith('REF ')||p.nome==='Produto avulso'?nomeDaRef(cod):p.nome}))
  }

  const setCenario=(id:string,campo:'nome'|'desconto',v:string|number)=>
    upd('cenarios',(produto?.cenarios??[]).map(c=>c.id===id?{...c,[campo]:v}:c))

  const r=produto?resultados.get(produto.id)!:null
  const e=produto?comCusto(produto):null

  return(
    <div className="flex flex-col gap-4">

      {/* ── Barra de ações ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3"
        style={{background:C.surface2,border:`1px solid ${C.border}`}}>
        <div>
          <p className="text-sm font-semibold" style={{color:C.text}}>TikTok Shop — marca própria</p>
          <p className="text-xs" style={{color:C.muted}}>Preço de venda no TikTok Shop Brasil a partir do custo de produção</p>
        </div>
        <div style={{width:1,height:28,background:C.border}}/>
        <select value={novoRef} onChange={ev=>criarDaRef(ev.target.value)}
          disabled={refsComCusto.length===0}
          title={refsComCusto.length===0?'Abra a aba Precificação de um projeto para calcular o custo das REFs':undefined}
          className="rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer disabled:opacity-40"
          style={{background:C.purple,color:'#fff',border:'none'}}>
          <option value="">+ Produto a partir de uma REF…</option>
          {refsComCusto.map(x=><option key={x.cod} value={x.cod}>{x.cod} — {x.tipo} ({R$(x.custoTotal!)})</option>)}
        </select>
        <button onClick={()=>adicionar(novoProduto('Produto avulso',null,0))}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{background:C.tealBg,color:C.teal,border:`1px solid ${C.teal}`}}>
          <Plus size={13}/> Produto avulso
        </button>
        <button onClick={()=>setOpenTaxas(o=>!o)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm ml-auto"
          style={{color:C.muted,border:`1px solid ${C.border}`}}>
          <Settings size={13}/> Taxas do TikTok
        </button>
        {refsComCusto.length===0&&(
          <p className="text-xs w-full" style={{color:C.muted}}>
            Para puxar o custo de uma REF, abra um projeto e passe pela aba Precificação — o custo total de produção de cada REF aparece aqui.
          </p>
        )}
      </div>

      {openTaxas&&<TaxasPanel key={taxas.atualizadoEm??'padrao'} taxas={taxas} onSave={t=>{setTaxas(t);setOpenTaxas(false)}}/>}

      <div className="flex gap-4 items-start">

        {/* ── Lista de produtos ── */}
        <div className="flex flex-col gap-1 shrink-0" style={{width:230}}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{color:C.muted}}>Produtos TikTok</p>
          {produtos.length===0&&(
            <p className="text-xs" style={{color:C.muted}}>Nenhum produto ainda — crie um a partir de uma REF ou avulso.</p>
          )}
          {produtos.map(p=>{
            const res=resultados.get(p.id)!
            const sel=p.id===selecionadoId
            return(
              <div key={p.id} onClick={()=>setEstado(s=>({...s,selecionadoId:p.id}))}
                className="flex flex-col px-3 py-2 rounded-lg cursor-pointer transition-all"
                style={{background:sel?C.purpleBg:C.surface,border:`1px solid ${sel?C.purple:C.border}`}}>
                <span className="text-sm font-medium truncate" style={{color:C.text}}>{p.nome||'Sem nome'}</span>
                <span className="font-mono text-xs" style={{color:C.muted}}>{p.ref?`REF ${p.ref}`:'avulso'}</span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs font-bold" style={{color:res.precoSugerido!==null?C.green:C.red}}>
                    {res.precoSugerido!==null?R$(res.precoSugerido):'sem preço'}
                  </span>
                  <span className="flex gap-1">
                    <button title="Duplicar" onClick={ev=>{ev.stopPropagation();duplicar(p)}}
                      className="p-1 rounded" style={{color:C.teal}}><Copy size={12}/></button>
                    <button title="Excluir" onClick={ev=>{ev.stopPropagation();excluir(p)}}
                      className="p-1 rounded" style={{color:C.pink}}><Trash2 size={12}/></button>
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {!produto||!r||!e?(
          <div className="flex-1 flex items-center justify-center py-20"
            style={{border:`1px solid ${C.border}`,borderRadius:12,color:C.muted}}>
            Crie ou selecione um produto
          </div>
        ):(
          <div className="flex-1 min-w-0 flex flex-wrap gap-4 items-start">

            {/* ═══ ENTRADAS ═══ */}
            <div className="flex flex-col gap-3 min-w-0" style={{flex:'5 1 360px'}}>
              <Secao titulo="Produto">
                <Campo label="Nome">
                  <input value={produto.nome} onChange={ev=>upd('nome',ev.target.value)}
                    className="w-56 rounded px-2 py-1 text-sm focus:outline-none"
                    style={{background:C.surface2,border:`1px solid ${C.border}`,color:C.text}}/>
                </Campo>
                <Campo label="REF cadastrada" hint={produto.ref&&!custoDaRef.has(produto.ref)
                  ?'REF fora do projeto aberto — usando o último custo puxado':undefined}>
                  <select value={produto.ref??''} onChange={ev=>trocarRef(ev.target.value)}
                    className="w-56 rounded px-2 py-1 text-sm focus:outline-none cursor-pointer"
                    style={{background:C.surface2,border:`1px solid ${C.border}`,color:C.text}}>
                    <option value="">Avulso (digitar o custo)</option>
                    {produto.ref&&!custoDaRef.has(produto.ref)&&<option value={produto.ref}>{produto.ref}</option>}
                    {refsComCusto.map(x=><option key={x.cod} value={x.cod}>{x.cod} — {x.tipo}</option>)}
                  </select>
                </Campo>
                <Campo label="Custo total de produção"
                  hint={produto.ref
                    ?(produto.custoManual?'sobrescrito à mão':'puxado da ficha de custo da REF')
                    :'digite o custo da peça'}>
                  <div className="flex items-center gap-1">
                    {produto.ref&&produto.custoManual&&custoDaRef.has(produto.ref)&&(
                      <button title={`Voltar ao custo da REF (${R$(custoDaRef.get(produto.ref)!)})`}
                        onClick={()=>setProduto(produto.id,p=>({...p,custoManual:false,custoProducao:custoDaRef.get(p.ref!)!}))}
                        className="p-1.5 rounded" style={{color:C.teal}}><RotateCcw size={13}/></button>
                    )}
                    <NumField value={e.custoProducao} prefix="R$" color={C.purpleLt}
                      onChange={v=>setProduto(produto.id,p=>({...p,custoProducao:v??0,custoManual:!!p.ref}))}/>
                  </div>
                </Campo>
              </Secao>

              <Secao titulo="Custos extras por peça (R$)">
                <Campo label="Embalagem"><NumField value={produto.embalagem} onChange={v=>upd('embalagem',v??0)} prefix="R$"/></Campo>
                <Campo label="Etiqueta / tag / brinde"><NumField value={produto.etiqueta} onChange={v=>upd('etiqueta',v??0)} prefix="R$"/></Campo>
                <Campo label="Frete pago por mim" hint="quando não uso o frete do TikTok"><NumField value={produto.freteProprio} onChange={v=>upd('freteProprio',v??0)} prefix="R$"/></Campo>
                <Campo label="Custos fixos rateados por peça"><NumField value={produto.custosFixos} onChange={v=>upd('custosFixos',v??0)} prefix="R$"/></Campo>
                <Campo label="Outros"><NumField value={produto.outros} onChange={v=>upd('outros',v??0)} prefix="R$"/></Campo>
                <Campo label="Custo unitário total">
                  <span className="text-sm font-bold" style={{color:C.purpleLt}}>{R$(custoUnitario(e))}</span>
                </Campo>
              </Secao>

              <Secao titulo="Percentuais sobre o preço (%)">
                <Campo label="Imposto sobre a venda"><NumField value={produto.imposto} onChange={v=>upd('imposto',v??0)} suffix="%" w="w-16"/></Campo>
                <Campo label="Comissão de afiliada"><NumField value={produto.afiliada} onChange={v=>upd('afiliada',v??0)} suffix="%" w="w-16"/></Campo>
                <Campo label="Anúncios"><NumField value={produto.anuncios} onChange={v=>upd('anuncios',v??0)} suffix="%" w="w-16"/></Campo>
                <Campo label="Reserva para trocas e devoluções"><NumField value={produto.devolucoes} onChange={v=>upd('devolucoes',v??0)} suffix="%" w="w-16"/></Campo>
                <Check checked={produto.usaFreteGratis} onChange={v=>upd('usaFreteGratis',v)}
                  label={`Participo do programa de frete grátis do TikTok (${fmtPct(taxas.fretePct)}, teto ${R$(taxas.freteTeto)})`}/>
              </Secao>

              <Secao titulo="Metas">
                <Campo label="Lucro desejado no preço cheio"><NumField value={produto.lucroDesejado} onChange={v=>upd('lucroDesejado',v??0)} suffix="%" w="w-16" color={C.green}/></Campo>
                <Campo label="Lucro mínimo aceitável em promoção"><NumField value={produto.lucroMinimo} onChange={v=>upd('lucroMinimo',v??0)} suffix="%" w="w-16" color={C.yellow}/></Campo>
                <Campo label="Maior desconto que vou dar"><NumField value={produto.maiorDesconto} onChange={v=>upd('maiorDesconto',Math.min(v??0,99))} suffix="%" w="w-16" color={C.pink}/></Campo>
                <Campo label="Testar um preço" hint="opcional — substitui o preço sugerido nos cálculos">
                  <NumField value={produto.precoTeste} onChange={v=>upd('precoTeste',v)} prefix="R$" allowEmpty placeholder="—"/>
                </Campo>
                <Check checked={produto.arredondar} onChange={v=>upd('arredondar',v)} label="Arredondar para terminar em ,90"/>
              </Secao>
            </div>

            {/* ═══ SAÍDAS ═══ */}
            <div className="flex flex-col gap-3 min-w-0" style={{flex:'7 1 480px'}}>
              {r.erros.map((m,i)=><Alerta key={i} tipo="aviso">{m}</Alerta>)}

              {/* Preço sugerido */}
              <div className="rounded-xl px-5 py-4" style={{background:C.greenBg,border:`1px solid ${C.green}`}}>
                <p className="text-xs uppercase tracking-widest" style={{color:C.green,opacity:.8}}>Preço sugerido</p>
                <p className="text-3xl font-bold" style={{color:C.green}}>
                  {r.precoSugerido!==null?R$(r.precoSugerido):'—'}
                </p>
                {r.definidoPor==='lucro'&&(
                  <p className="text-sm mt-1" style={{color:C.text}}>
                    Definido pela meta de <strong>{fmtPct(produto.lucroDesejado)}</strong> de lucro no preço cheio
                    {r.precoAlvoPromo!==null&&<> — mesmo com {fmtPct(produto.maiorDesconto)} de desconto ainda sobra pelo menos {fmtPct(produto.lucroMinimo)}</>}.
                    {produto.arredondar&&<> Arredondado para terminar em ,90.</>}
                  </p>
                )}
                {r.definidoPor==='promocao'&&(
                  <p className="text-sm mt-1" style={{color:C.text}}>
                    Definido pela promoção: para dar até <strong>{fmtPct(produto.maiorDesconto)}</strong> de desconto e ainda
                    ter <strong>{fmtPct(produto.lucroMinimo)}</strong> de lucro, o preço cheio precisa ser pelo menos {R$(r.precoAlvoPromo!)}
                    {' '}(só a meta de {fmtPct(produto.lucroDesejado)} pediria {R$(r.precoAlvoLucro!)}).
                    {produto.arredondar&&<> Arredondado para terminar em ,90.</>}
                  </p>
                )}
                {r.usandoTeste&&(
                  <p className="text-sm mt-2 font-semibold" style={{color:C.yellow}}>
                    Testando o preço {R$(r.precoUsado!)} — os números abaixo usam esse preço.
                  </p>
                )}
              </div>

              {r.usandoTeste&&r.cheio&&r.cheio.lucro<0&&(
                <Alerta tipo="erro">
                  O preço testado ({R$(r.cheio.preco)}) dá <strong>prejuízo de {R$(-r.cheio.lucro)}</strong> por peça.
                  {r.precoMinimo!==null&&<> O mínimo sem prejuízo é {R$(r.precoMinimo)}.</>}
                </Alerta>
              )}
              {r.maiorPromo&&r.maiorPromo.lucro<0&&!(r.usandoTeste&&r.cheio&&r.cheio.lucro<0)&&(
                <Alerta tipo="aviso">
                  Com o maior desconto planejado ({fmtPct(produto.maiorDesconto)}) o cliente paga {R$(r.maiorPromo.preco)} e
                  você tem <strong>prejuízo de {R$(-r.maiorPromo.lucro)}</strong> por peça.
                  {r.descontoMaximo!==null&&<> O desconto máximo sem prejuízo é {fmtPct(r.descontoMaximo*100)}.</>}
                </Alerta>
              )}

              {/* Indicadores */}
              {r.cheio&&(
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl px-4 py-3" style={{background:C.surface,border:`1px solid ${C.border}`}}>
                    <p className="text-xs" style={{color:C.muted}}>Lucro por peça no preço cheio</p>
                    <p className="text-lg font-bold" style={{color:r.cheio.lucro>=0?C.green:C.red}}>{R$(r.cheio.lucro)}</p>
                    <p className="text-xs font-semibold" style={{color:r.cheio.lucro>=0?C.green:C.red}}>{fmtPct(r.cheio.margem*100)}</p>
                  </div>
                  <div className="rounded-xl px-4 py-3" style={{background:C.surface,border:`1px solid ${C.border}`}}>
                    <p className="text-xs" style={{color:C.muted}}>Preço mínimo sem prejuízo</p>
                    <p className="text-lg font-bold" style={{color:C.text}}>{r.precoMinimo!==null?R$(r.precoMinimo):'—'}</p>
                  </div>
                  <div className="rounded-xl px-4 py-3" style={{background:C.surface,border:`1px solid ${C.border}`}}>
                    <p className="text-xs" style={{color:C.muted}}>Desconto máximo sem prejuízo</p>
                    <p className="text-lg font-bold" style={{color:r.descontoMaximo!==null?C.text:C.red}}>
                      {r.descontoMaximo!==null?fmtPct(r.descontoMaximo*100):'já dá prejuízo'}
                    </p>
                  </div>
                </div>
              )}

              {/* Para onde vai o dinheiro */}
              {r.cheio&&(
                <Secao titulo={`Para onde vai o dinheiro de cada venda (${R$(r.cheio.preco)})`}>
                  <div className="py-2"><BarraDinheiro v={r.cheio}/></div>
                  <p className="text-xs pb-1" style={{color:C.muted}}>
                    Taxas do TikTok = comissão {R$(r.cheio.comissao)} ({fmtPct(r.cheio.faixaBaixa?taxas.comBaixo:taxas.comAlto)},
                    faixa {r.cheio.faixaBaixa?`abaixo de ${R$(taxas.limite)}`:`a partir de ${R$(taxas.limite)}`})
                    {' '}+ taxa fixa {R$(r.cheio.taxaFixa)}{produto.usaFreteGratis&&<> + frete grátis {R$(r.cheio.frete)}</>}.
                  </p>
                </Secao>
              )}

              {/* Cenários de promoção */}
              {r.precoUsado!==null&&(
                <Secao titulo="Cenários de promoção">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{color:C.muted}} className="text-xs uppercase tracking-wide">
                          <th className="text-left py-2 font-medium">Cenário</th>
                          <th className="text-right py-2 px-2 font-medium">Desconto</th>
                          <th className="text-right py-2 px-2 font-medium">Cliente paga</th>
                          <th className="text-right py-2 px-2 font-medium">Taxas TikTok</th>
                          <th className="text-right py-2 px-2 font-medium">Lucro</th>
                          <th className="text-right py-2 px-2 font-medium">Margem</th>
                          <th className="py-2"/>
                          <th className="py-2"/>
                        </tr>
                      </thead>
                      <tbody>
                        {produto.cenarios.map(c=>{
                          const s=simularCenario(r.precoUsado!,c.desconto,e,taxas)
                          const selo=SELO[s.selo]
                          return(
                            <tr key={c.id} style={{borderTop:`1px solid ${C.border}`}}>
                              <td className="py-1.5 pr-2">
                                <input value={c.nome} onChange={ev=>setCenario(c.id,'nome',ev.target.value)}
                                  className="w-28 bg-transparent text-sm focus:outline-none border-b border-transparent focus:border-current"
                                  style={{color:C.text}}/>
                              </td>
                              <td className="py-1.5">
                                <div className="flex justify-end">
                                  <NumField value={c.desconto} onChange={v=>setCenario(c.id,'desconto',Math.min(v??0,100))} suffix="%" w="w-10"/>
                                </div>
                              </td>
                              <td className="py-1.5 px-2 text-right whitespace-nowrap" style={{color:C.text}}>
                                {R$(s.preco)}
                                {s.caiuDeFaixa&&(
                                  <div className="text-[10px] font-semibold whitespace-nowrap" style={{color:C.pink}}
                                    title={`Abaixo de ${R$(taxas.limite)} a comissão é ${fmtPct(taxas.comBaixo)} + ${R$(taxas.fixBaixo)} por item`}>
                                    faixa &lt; {R$(taxas.limite)}
                                  </div>
                                )}
                              </td>
                              <td className="py-1.5 px-2 text-right whitespace-nowrap" style={{color:C.pink}}>{R$(s.taxasTikTok)}</td>
                              <td className="py-1.5 px-2 text-right font-semibold whitespace-nowrap" style={{color:s.lucro>=0?C.green:C.red}}>{R$(s.lucro)}</td>
                              <td className="py-1.5 px-2 text-right whitespace-nowrap" style={{color:C.muted}}>{fmtPct(s.margem*100)}</td>
                              <td className="py-1.5 pl-2 text-right">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                                  style={{color:selo.color,background:selo.bg,border:`1px solid ${selo.color}`}}>
                                  {selo.label}
                                </span>
                              </td>
                              <td className="py-1.5 pl-1 text-right">
                                <button title="Remover cenário"
                                  onClick={()=>upd('cenarios',produto.cenarios.filter(x=>x.id!==c.id))}
                                  className="text-xs px-2 py-0.5 rounded" style={{color:C.pink,background:C.pinkBg}}>✕</button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="py-2">
                    <button onClick={()=>upd('cenarios',[...produto.cenarios,{id:uid(),nome:'Novo cenário',desconto:15}])}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{color:C.teal,border:`1px solid ${C.teal}`,background:C.tealBg}}>
                      + Adicionar cenário
                    </button>
                  </div>
                </Secao>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
