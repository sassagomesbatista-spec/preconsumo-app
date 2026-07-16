import { useMemo, useState } from 'react'
import type { FabricRow } from '../types'

const C = {
  surface:  '#12141F',
  surface2: '#1A1D2E',
  border:   '#252A45',
  text:     '#E2E8F0',
  muted:    '#8892B0',
  purple:   '#7C6FCD',
  purpleLt: '#9D8FE0',
  teal:     '#4ECDC4',
  tealBg:   '#152828',
}

interface Props { rows: FabricRow[] }

export default function AnalysisTab({ rows }: Props) {
  const [filters, setFilters] = useState({ tipoPeca: '', tecido: '', cor: '' })

  const options = useMemo(() => ({
    tipoPeca: [...new Set(rows.map(r => r.tipoPeca))].filter(Boolean).sort(),
    tecido:   [...new Set(rows.map(r => r.tecido))].filter(Boolean).sort(),
    cor:      [...new Set(rows.map(r => r.cor))].filter(Boolean).sort(),
  }), [rows])

  const filtered = useMemo(() => rows.filter(r =>
    (!filters.tipoPeca || r.tipoPeca === filters.tipoPeca) &&
    (!filters.tecido   || r.tecido   === filters.tecido)   &&
    (!filters.cor      || r.cor      === filters.cor)
  ), [rows, filters])

  const totals = useMemo(() => ({
    consumo: Math.round(filtered.reduce((s, r) => s + r.consumoTotal, 0) * 1000) / 1000,
    qtde:    filtered.reduce((s, r) => s + r.qtadeACortar, 0),
  }), [filtered])

  const setFilter = (k: keyof typeof filters, v: string) =>
    setFilters(f => ({ ...f, [k]: v }))

  const labels: Record<keyof typeof filters, string> = {
    tipoPeca: 'Tipo Peça', tecido: 'Tecido', cor: 'Cor',
  }

  const isFiltered = Object.values(filters).some(Boolean)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {(Object.keys(filters) as (keyof typeof filters)[]).map(key => (
          <div key={key}>
            <label className="block text-xs font-medium mb-1 uppercase tracking-wide" style={{ color: C.muted }}>
              {labels[key]}
            </label>
            <select
              value={filters[key]}
              onChange={e => setFilter(key, e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }}
            >
              <option value="">Todos</option>
              {options[key].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-6 rounded-xl px-4 py-2.5 text-sm"
        style={{ background: isFiltered ? C.tealBg : C.surface, border: `1px solid ${isFiltered ? C.teal : C.border}` }}>
        <span style={{ color: C.muted }}>{filtered.length} registros</span>
        {isFiltered && (
          <>
            <span style={{ color: C.muted }}>
              Consumo total: <strong style={{ color: C.teal }}>{totals.consumo.toFixed(3)} kg</strong>
            </span>
            {totals.qtde > 0 && (
              <span style={{ color: C.muted }}>
                QTADE total: <strong style={{ color: C.purpleLt }}>{totals.qtde}</strong>
              </span>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl overflow-auto shadow-sm" style={{ border: `1px solid ${C.border}`, maxHeight: 'calc(100vh - 390px)' }}>
        <table className="w-full text-sm border-collapse" style={{ minWidth: '700px' }}>
          <thead style={{ position: 'sticky', top: 0 }}>
            <tr>
              {['Tipo Peça','Coleção','Código','Tema','Tecido','Consumo','Cor','QTADE','Total'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold"
                  style={{ background: C.surface2, borderBottom: `1px solid ${C.border}`, color: C.muted }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={row.id}
                style={{ background: i % 2 === 0 ? C.surface : '#161829', borderBottom: `1px solid ${C.border}` }}
                className="hover:bg-[#1E2138] transition-colors">
                <td className="px-3 py-1.5" style={{ color: C.text }}>{row.tipoPeca}</td>
                <td className="px-3 py-1.5" style={{ color: C.text }}>{row.colecao}</td>
                <td className="px-3 py-1.5" style={{ color: C.muted }}>{row.codigo}</td>
                <td className="px-3 py-1.5" style={{ color: C.text }}>{row.tema}</td>
                <td className="px-3 py-1.5 font-medium" style={{ color: C.text }}>{row.tecido}</td>
                <td className="px-3 py-1.5 text-right" style={{ color: C.muted }}>{row.consumo.toFixed(3)}</td>
                <td className="px-3 py-1.5" style={{ color: C.text }}>{row.cor}</td>
                <td className="px-3 py-1.5 text-right font-semibold" style={{ color: C.purpleLt }}>{row.qtadeACortar}</td>
                <td className="px-3 py-1.5 text-right font-semibold" style={{ color: C.teal }}>{row.consumoTotal.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
