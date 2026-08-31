import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, RefreshCw, Table2, BarChart3, Sigma, Tag, ShoppingCart, AlertCircle, CheckCircle2, History, LogOut, Link2 } from 'lucide-react'
import UploadZone from './components/UploadZone'
import DataTable from './components/DataTable'
import AnalysisTab from './components/AnalysisTab'
import TotalsTab from './components/TotalsTab'
import PricingTab from './components/PricingTab'
import type { AtacadoPreco } from './components/PricingTab'
import ResaleTab from './components/ResaleTab'
import HistoryTab from './components/HistoryTab'
import { importExcel } from './utils/excelImport'
import { exportExcel } from './utils/excelExport'
import { trpc } from './lib/trpc'
import type { FabricRow, ImportResult } from './types'

type Tab = 'dados' | 'analise' | 'totais' | 'precificacao' | 'revenda' | 'historico'

const C = {
  bg:       '#0A0C14',
  surface:  '#12141F',
  surface2: '#1A1D2E',
  border:   '#252A45',
  text:     '#E2E8F0',
  muted:    '#8892B0',
  purple:   '#7C6FCD',
  purpleBg: '#1E1B35',
  teal:     '#4ECDC4',
  pink:     '#E879A0',
  yellow:   '#F6C90E',
}

const STORAGE_KEY = 'preconsumo-state-v1'

interface PersistedState {
  result: ImportResult
  clientName: string
  colecao: string
  tab: Tab
  currentProjectId?: number | null
  pricingConfig?: unknown
  revendaConfig?: unknown
}

function loadPersisted(): PersistedState | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (!s) return null
    return JSON.parse(s) as PersistedState
  } catch { return null }
}

// pricingJson guarda { pricing, revenda } desde que a aba Revenda foi criada.
// Projetos salvos antes disso têm o objeto de precificação "cru" nesse campo
// (sem essas duas chaves) — trata como pricing legado, sem config de revenda.
function splitPricingJson(raw: string | null | undefined): { pricing: unknown; revenda: unknown } {
  if (!raw) return { pricing: null, revenda: null }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && ('pricing' in parsed || 'revenda' in parsed)) {
      return { pricing: parsed.pricing ?? null, revenda: parsed.revenda ?? null }
    }
    return { pricing: parsed, revenda: null }
  } catch { return { pricing: null, revenda: null } }
}

export default function App() {
  const persisted = loadPersisted()
  const [result, setResult] = useState<ImportResult | null>(persisted?.result ?? null)
  const [rows, setRows] = useState<FabricRow[]>(persisted?.result?.rows ?? [])
  const [tab, setTab] = useState<Tab>(persisted?.tab ?? 'dados')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [clientName, setClientName] = useState(persisted?.clientName ?? '')
  const [colecao, setColecao] = useState(persisted?.colecao ?? '')
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(persisted?.currentProjectId ?? null)
  const [erpQuoteNumber, setErpQuoteNumber] = useState<string | null>(null)
  const [pricingConfig, setPricingConfig] = useState<unknown>(persisted?.pricingConfig ?? null)
  const [revendaConfig, setRevendaConfig] = useState<unknown>(persisted?.revendaConfig ?? null)
  const [atacadoPrecos, setAtacadoPrecos] = useState<AtacadoPreco[]>([])
  const [pricingKey, setPricingKey] = useState(0)

  const me = trpc.auth.me.useQuery()
  const isAdmin = me.data?.role === 'admin'
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => window.location.reload() })
  const saveProject = trpc.projects.save.useMutation({ onSuccess: ({ id }) => setCurrentProjectId(id) })
  const utils = trpc.useUtils()
  const loadProject = utils.projects.get

  const handleOpenHistoryProject = useCallback(async (id: number) => {
    setLoading(true)
    try {
      const p = await loadProject.fetch({ id })
      const data = JSON.parse(p.dataJson) as ImportResult
      const { pricing, revenda } = splitPricingJson(p.pricingJson)
      setResult(data)
      setRows(data.rows)
      setClientName(p.clientName)
      setColecao(p.colecao)
      setCurrentProjectId(p.id)
      setErpQuoteNumber((p as any).erpQuoteNumber ?? null)
      setPricingConfig(pricing)
      setRevendaConfig(revenda)
      setPricingKey(k => k + 1)
      setTab('dados')
    } catch {
      setError('Não foi possível carregar este projeto.')
    } finally {
      setLoading(false)
    }
  }, [loadProject])

  // Link direto do ERP ("Ver projeto no Préconsumo") — ?project=123 na URL abre
  // esse projeto sozinho, sem precisar procurar no Histórico.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const projectId = params.get('project')
    if (projectId) handleOpenHistoryProject(Number(projectId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

useEffect(() => {
    if (!result) { localStorage.removeItem(STORAGE_KEY); return }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        result: { ...result, rows }, clientName, colecao, tab, currentProjectId, pricingConfig, revendaConfig,
      }))
    } catch { /* quota excedida, ignora */ }
  }, [result, rows, clientName, colecao, tab, currentProjectId, pricingConfig, revendaConfig])

  // Autosave na nuvem (histórico compartilhado) — debounced
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  useEffect(() => {
    if (!result) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      // Evita disparar um segundo "criar projeto" (id ainda nulo) enquanto o
      // primeiro salvamento da importação ainda não voltou do servidor.
      if (savingRef.current) return
      savingRef.current = true
      saveProject.mutate({
        id: currentProjectId ?? undefined,
        clientName, colecao,
        dataJson: JSON.stringify({ ...result, rows, clientName, colecao }),
        pricingJson: (pricingConfig || revendaConfig) ? JSON.stringify({ pricing: pricingConfig, revenda: revendaConfig }) : undefined,
      }, { onSettled: () => { savingRef.current = false } })
    }, 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // saveProject (objeto da mutation) muda de identidade a cada chamada —
    // inclui-lo aqui faz o efeito reagendar o salvamento sem parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, rows, clientName, colecao, pricingConfig, revendaConfig, currentProjectId])

  const handleFile = useCallback(async (file: File) => {
    setLoading(true); setError(null)
    try {
      const imported = await importExcel(file)
      setResult(imported); setRows(imported.rows)
      setClientName(imported.clientName); setColecao(imported.colecao)
      setCurrentProjectId(null); setPricingConfig(null); setRevendaConfig(null); setPricingKey(k => k + 1)
      setTab('dados')
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])

  const handleUpdateQtade = useCallback((id: string, qtade: number) => {
    setRows(prev => prev.map(r =>
      r.id === id ? { ...r, qtadeACortar: qtade, consumoTotal: Math.round(r.consumo * qtade * 1000) / 1000 } : r
    ))
  }, [])

  const handleBulkUpdateQtade = useCallback((ids: string[], qtade: number) => {
    const idSet = new Set(ids)
    setRows(prev => prev.map(r =>
      idSet.has(r.id) ? { ...r, qtadeACortar: qtade, consumoTotal: Math.round(r.consumo * qtade * 1000) / 1000 } : r
    ))
  }, [])

  const handleExport = async () => {
    setExporting(true)
    try { await exportExcel(rows, clientName, colecao) } finally { setExporting(false) }
  }

  const handleReset = () => {
    setResult(null); setRows([]); setError(null); setClientName(''); setColecao('')
    setCurrentProjectId(null); setPricingConfig(null); setRevendaConfig(null); setPricingKey(k => k + 1)
    localStorage.removeItem(STORAGE_KEY)
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'dados',         label: 'Dados',         icon: <Table2 size={14} /> },
    { key: 'analise',      label: 'Análise',        icon: <BarChart3 size={14} /> },
    { key: 'totais',       label: 'Totalizações',   icon: <Sigma size={14} /> },
    { key: 'precificacao', label: 'Precificação', icon: <Tag size={14} /> },
    { key: 'revenda',      label: 'Revenda',        icon: <ShoppingCart size={14} /> },
    { key: 'historico',    label: 'Histórico',      icon: <History size={14} /> },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>

      {/* Neon accent line */}
      <div style={{ height: 3, background: 'linear-gradient(to right, #7C6FCD, #E879A0, #F6C90E, #4ECDC4)' }} />

      {/* Header */}
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}
        className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-lg px-3 py-1.5" style={{ background: '#FFFFFF' }}>
            <img src="/logo.png" alt="Samanta Gomes" className="h-9 w-auto" />
          </div>
          <div style={{ width: 1, height: 26, background: C.border }} />
          <div>
            <p className="text-sm font-medium leading-tight" style={{ color: C.text }}>
              Pré Consumo de Tecidos
            </p>
            <p className="text-xs" style={{ color: C.muted }}>aba "Tecidos de variantes"</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {result && (
            <>
              <button onClick={handleReset}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ border: `1px solid ${C.border}`, color: C.muted, background: 'transparent' }}>
                <RefreshCw size={12} /> Novo arquivo
              </button>

              <button onClick={handleExport} disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
                style={{ background: C.surface2, color: C.text, border: `1px solid ${C.border}` }}>
                <Download size={14} style={{ color: C.teal }} />
                {exporting ? 'Exportando...' : 'Salvar como Excel'}
              </button>

              <div style={{ width: 1, height: 26, background: C.border }} />
            </>
          )}

          {me.data && (
            <span className="text-xs" style={{ color: C.muted }}>
              {me.data.name}
            </span>
          )}
          <button onClick={() => logout.mutate()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ border: `1px solid ${C.border}`, color: C.muted, background: 'transparent' }}>
            <LogOut size={12} /> Sair
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 flex flex-col gap-4 max-w-screen-2xl mx-auto w-full">
        {!result ? (
          <div className="flex flex-col gap-6 max-w-xl mx-auto w-full mt-14">
            <div className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <h2 className="text-2xl font-semibold" style={{ color: C.text }}>Importar Planilha</h2>
                <p className="text-sm mt-1" style={{ color: C.muted }}>
                  Selecione o arquivo Excel do cliente para iniciar a análise
                </p>
              </div>
              <UploadZone onFile={handleFile} loading={loading} />
              {error && (
                <div className="flex items-start gap-3 rounded-xl p-4 text-sm"
                  style={{ background: '#1F1215', border: '1px solid #7F1D1D' }}>
                  <AlertCircle size={17} style={{ color: '#F87171' }} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium" style={{ color: '#FCA5A5' }}>Erro ao importar</p>
                    <p className="mt-0.5 whitespace-pre-line" style={{ color: '#F87171' }}>{error}</p>
                  </div>
                </div>
              )}
            </div>
            <div style={{ borderTop: `1px solid ${C.border}` }} className="pt-6">
              <HistoryTab currentProjectId={currentProjectId} onOpen={handleOpenHistoryProject} canDelete={isAdmin} />
            </div>
          </div>
        ) : (
          <>
            {/* Info bar */}
            <div className="flex items-center gap-4 rounded-xl px-4 py-3 text-sm"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <CheckCircle2 size={16} style={{ color: C.teal }} className="shrink-0" />
              <div className="flex gap-6 flex-wrap items-center text-sm">
                <span style={{ color: C.muted }}>
                  Cliente:{' '}
                  <input
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="—"
                    size={Math.max((clientName || '—').length, 4)}
                    className="font-semibold bg-transparent focus:outline-none border-b border-transparent hover:border-current focus:border-current transition-colors"
                    style={{ color: C.text, borderColor: undefined }}
                  />
                </span>
                <span style={{ color: C.muted }}>
                  Coleção:{' '}
                  <input
                    value={colecao}
                    onChange={e => setColecao(e.target.value)}
                    placeholder="—"
                    size={Math.max((colecao || '—').length, 4)}
                    className="font-semibold bg-transparent focus:outline-none border-b border-transparent hover:border-current focus:border-current transition-colors"
                    style={{ color: C.text }}
                  />
                </span>
                <span style={{ color: C.muted }}>
                  Registros: <strong style={{ color: C.purple }}>{rows.length}</strong>
                </span>
                <span style={{ color: C.muted }}>
                  Tecidos únicos: <strong style={{ color: C.pink }}>{new Set(rows.map(r => r.tecido)).size}</strong>
                </span>
              </div>
              <div className="ml-auto">
                <ErpLinkWidget
                  projectId={currentProjectId}
                  linkedNumber={erpQuoteNumber}
                  onLinked={(number) => setErpQuoteNumber(number)}
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl p-1 w-fit"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={tab === t.key
                    ? { background: C.purple, color: '#fff' }
                    : { color: C.muted, background: 'transparent' }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1">
              {tab === 'dados'         && <DataTable rows={rows} onUpdate={handleUpdateQtade} onBulkUpdate={handleBulkUpdateQtade} />}
              {tab === 'analise'      && <AnalysisTab rows={rows} />}
              {tab === 'totais'       && <TotalsTab rows={rows} />}
              {tab === 'precificacao' && <PricingTab key={pricingKey} rows={rows} plmData={result?.plmData} importId={result?.importId} initialConfig={pricingConfig as Parameters<typeof PricingTab>[0]['initialConfig']} onConfigChange={setPricingConfig} onResultsChange={setAtacadoPrecos} />}
              {tab === 'revenda'      && <ResaleTab key={pricingKey} precos={atacadoPrecos} initialConfig={revendaConfig as Parameters<typeof ResaleTab>[0]['initialConfig']} onConfigChange={setRevendaConfig} />}
              {tab === 'historico'    && <HistoryTab currentProjectId={currentProjectId} onOpen={handleOpenHistoryProject} canDelete={isAdmin} />}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// Busca e vincula um pedido do ERP a este projeto — nasce aqui (não digita nome
// à mão do lado do ERP): busca por número/cliente, seleciona, trava.
function ErpLinkWidget({ projectId, linkedNumber, onLinked }: {
  projectId: number | null
  linkedNumber: string | null
  onLinked: (number: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchQuery = trpc.erpBridge.searchPedidos.useQuery({ search }, { enabled: open && search.length >= 2 })
  const linkPedido = trpc.erpBridge.linkPedido.useMutation({
    onSuccess: (_r, vars) => { onLinked(vars.quoteNumber); setOpen(false) },
  })

  if (linkedNumber) {
    return (
      <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: C.purpleBg, color: C.purple }}>
        <Link2 size={12} /> Pedido {linkedNumber}
      </span>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={!projectId}
        title={!projectId ? 'Aguardando salvar o projeto...' : undefined}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        style={{ border: `1px solid ${C.border}`, color: C.muted, background: 'transparent' }}
      >
        <Link2 size={12} /> Vincular pedido do ERP
      </button>
    )
  }

  return (
    <div className="relative">
      <input
        autoFocus
        value={search}
        onChange={e => setSearch(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar pedido ou cliente..."
        className="text-xs px-3 py-1.5 rounded-lg focus:outline-none"
        style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, width: 220 }}
      />
      {search.length >= 2 && (
        <div className="absolute right-0 mt-1 rounded-lg overflow-hidden z-10" style={{ background: C.surface2, border: `1px solid ${C.border}`, width: 260 }}>
          {searchQuery.isFetching && (
            <div className="px-3 py-2 text-xs" style={{ color: C.muted }}>Buscando...</div>
          )}
          {searchQuery.error && (
            <div className="px-3 py-2 text-xs" style={{ color: '#F87171' }}>
              Erro: {(searchQuery.error as any)?.message ?? 'falha ao buscar no ERP.'}
            </div>
          )}
          {!searchQuery.isFetching && !searchQuery.error && searchQuery.data?.length === 0 && (
            <div className="px-3 py-2 text-xs" style={{ color: C.muted }}>
              Nenhum pedido aprovado encontrado com esse número/nome. Só aparecem pedidos raiz (sem sufixo -01, -02...) já aprovados.
            </div>
          )}
          {searchQuery.data && searchQuery.data.length > 0 && searchQuery.data.map(p => (
            <button
              key={p.id}
              onMouseDown={() => projectId && linkPedido.mutate({ projectId, quoteId: p.id, quoteNumber: p.number })}
              className="block w-full text-left px-3 py-2 text-xs hover:opacity-100"
              style={{ color: C.text, opacity: 0.85 }}
            >
              <div className="font-semibold">{p.number}</div>
              <div style={{ color: C.muted }}>{p.clientName}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
