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
  purpleBg: '#1E1B35',
  teal:     '#4ECDC4',
  tealBg:   '#152828',
  pink:     '#E879A0',
  pinkBg:   '#1F1220',
  yellow:   '#F6C90E',
  yellowBg: '#1C1A0E',
}

interface ColorData { cor: string; consumo: number; pecas: number }
interface FabricEntry {
  tecido: string; consumoTotal: number; qtdPecas: number; qtdCores: number
  cores: string[]; colorBreakdown: ColorData[]
}

interface Props { rows: FabricRow[] }

export default function TotalsTab({ rows }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const summary = useMemo<FabricEntry[]>(() => {
    const map = new Map<string, { consumo: number; codes: Set<string>; colorMap: Map<string, { consumo: number; codes: Set<string> }> }>()
    for (const row of rows) {
      if (!map.has(row.tecido))
        map.set(row.tecido, { consumo: 0, codes: new Set(), colorMap: new Map() })
      const s = map.get(row.tecido)!
      s.consumo += row.consumoTotal
      s.codes.add(row.codigo)
      const cor = row.cor || '(sem cor)'
      const c = s.colorMap.get(cor) ?? { consumo: 0, codes: new Set<string>() }
      c.consumo += row.consumoTotal
      c.codes.add(row.codigo)
      s.colorMap.set(cor, c)
    }
    return [...map.entries()]
      .map(([tecido, s]) => {
        const breakdown = [...s.colorMap.entries()]
          .map(([cor, d]) => ({ cor, consumo: Math.round(d.consumo * 1000) / 1000, pecas: d.codes.size }))
          .sort((a, b) => b.consumo - a.consumo)
        return {
          tecido,
          consumoTotal: Math.round(s.consumo * 1000) / 1000,
          qtdPecas: s.codes.size,
          qtdCores: s.colorMap.size,
          cores: breakdown.map(b => b.cor),
          colorBreakdown: breakdown,
        }
      })
      .sort((a, b) => b.consumoTotal - a.consumoTotal)
  }, [rows])

  const consumoGeral = useMemo(
    () => Math.round(summary.reduce((s, r) => s + r.consumoTotal, 0) * 1000) / 1000,
    [summary]
  )

  const totalPecas = useMemo(
    () => new Set(rows.map(r => r.codigo)).size,
    [rows]
  )

  const toggle = (tecido: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(tecido) ? next.delete(tecido) : next.add(tecido)
      return next
    })

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Consumo Total Geral" value={consumoGeral.toFixed(3)} unit="kg"
          bg={C.tealBg} border={C.teal} text={C.teal} />
        <StatCard label="Total de Peças" value={String(totalPecas)}
          bg={C.purpleBg} border={C.purple} text={C.purpleLt} />
        <StatCard label="Total de Tecidos" value={String(summary.length)}
          bg={C.pinkBg} border={C.pink} text={C.pink} />
        <StatCard label="Total de Variantes" value={String(new Set(rows.map(r => r.variante)).size)}
          bg={C.yellowBg} border={C.yellow} text={C.yellow} />
      </div>

      <div className="rounded-xl overflow-auto shadow-sm"
        style={{ border: `1px solid ${C.border}`, maxHeight: 'calc(100vh - 420px)' }}>
        <table className="w-full text-sm border-collapse">
          <thead style={{ position: 'sticky', top: 0 }}>
            <tr>
              {['','Tecido','Consumo Total (kg)','Qtd. Peças','Qtd. Cores','Cores'].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left font-semibold text-xs"
                  style={{ background: C.surface2, borderBottom: `1px solid ${C.border}`, color: C.muted }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.map((s, i) => {
              const isOpen = expanded.has(s.tecido)
              return (
                <>
                  <tr key={s.tecido}
                    style={{ background: i % 2 === 0 ? C.surface : '#161829', borderBottom: isOpen ? 'none' : `1px solid ${C.border}` }}
                    className="hover:bg-[#1E2138] transition-colors cursor-pointer"
                    onClick={() => toggle(s.tecido)}>
                    <td className="px-3 py-2.5 w-8 text-center" style={{ color: C.muted, fontSize: 10 }}>
                      {isOpen ? '▼' : '▶'}
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: C.text }}>{s.tecido}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-bold text-base" style={{ color: C.teal }}>{s.consumoTotal.toFixed(3)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold" style={{ color: C.purpleLt }}>{s.qtdPecas}</td>
                    <td className="px-4 py-2.5 text-right font-semibold" style={{ color: C.pink }}>{s.qtdCores}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {s.cores.map(c => (
                          <span key={c} className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}>
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr key={`${s.tecido}-breakdown`}
                      style={{ background: '#111520', borderBottom: `1px solid ${C.border}` }}>
                      <td />
                      <td colSpan={5} className="px-4 py-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {s.colorBreakdown.map(cb => (
                            <div key={cb.cor} className="rounded-lg px-3 py-2 text-xs"
                              style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
                              <p className="font-medium truncate" style={{ color: C.text }}>{cb.cor}</p>
                              <p className="font-bold mt-0.5" style={{ color: C.teal }}>{cb.consumo.toFixed(3)} kg</p>
                              <p style={{ color: C.muted }}>{cb.pecas} peças</p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, unit, bg, border, text }: {
  label: string; value: string; unit?: string; bg: string; border: string; text: string
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
      <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: text, opacity: 0.7 }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: text }}>
        {value}
        {unit && <span className="text-sm font-normal ml-1" style={{ opacity: 0.6 }}>{unit}</span>}
      </p>
    </div>
  )
}
