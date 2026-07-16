import { useMemo, useState, useCallback } from 'react'
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel,
  flexRender, type ColumnDef, type SortingState, type ColumnFiltersState, type Column,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import type { FabricRow } from '../types'

interface Props { rows: FabricRow[]; onUpdate: (id: string, qtade: number) => void; onBulkUpdate: (ids: string[], qtade: number) => void }

const C = {
  bg:       '#0A0C14',
  surface:  '#12141F',
  surface2: '#1A1D2E',
  surface3: '#1E2138',
  border:   '#252A45',
  text:     '#E2E8F0',
  muted:    '#8892B0',
  purple:   '#7C6FCD',
  purpleBg: '#1E1B35',
  purpleLt: '#9D8FE0',
  teal:     '#4ECDC4',
  tealBg:   '#152828',
}

export default function DataTable({ rows, onUpdate, onBulkUpdate }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [bulkQtade, setBulkQtade] = useState('')

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const all = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-qtade-input]'))
      const next = all[all.indexOf(e.currentTarget) + 1]
      if (next) { next.focus(); next.select() }
    }
  }, [])

  const columns = useMemo<ColumnDef<FabricRow>[]>(() => [
    { accessorKey: 'tipoPeca',     header: 'Tipo Peça',      size: 110, enableColumnFilter: true },
    { accessorKey: 'colecao',      header: 'Coleção',        size: 150, enableColumnFilter: true },
    { accessorKey: 'codigo',       header: 'Código',         size: 90,  enableColumnFilter: true },
    { accessorKey: 'tema',         header: 'Tema',           size: 150, enableColumnFilter: true },
    { accessorKey: 'tecido',       header: 'Tecido',         size: 220, enableColumnFilter: true },
    {
      accessorKey: 'consumo', header: 'Consumo', size: 88, enableColumnFilter: false,
      cell: ({ getValue }) => <span style={{ color: C.muted }}>{(getValue() as number).toFixed(3)}</span>,
    },
    { accessorKey: 'cor',          header: 'Cor',            size: 180, enableColumnFilter: true },
    {
      accessorKey: 'qtadeACortar', header: 'QTADE À CORTAR', size: 140, enableColumnFilter: false,
      cell: ({ row }) => (
        <input
          data-qtade-input="true" type="number" min={0} step={1}
          value={row.original.qtadeACortar}
          onChange={e => onUpdate(row.original.id, e.target.value === '' ? 0 : Number(e.target.value))}
          onFocus={e => e.target.select()}
          onKeyDown={handleKeyDown}
          className="w-full text-right px-2 py-1 rounded-md font-semibold text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          style={{ background: C.purpleBg, border: `1px solid #3D3560`, color: C.purpleLt }}
        />
      ),
    },
    {
      accessorKey: 'consumoTotal', header: 'Consumo Total', size: 130, enableColumnFilter: false,
      cell: ({ getValue }) => (
        <span className="font-semibold" style={{ color: C.teal }}>
          {(getValue() as number).toFixed(3)}
        </span>
      ),
    },
  ], [onUpdate, handleKeyDown])

  const table = useReactTable({
    data: rows, columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <input type="text" placeholder="Buscar em todos os campos..."
          value={globalFilter} onChange={e => setGlobalFilter(e.target.value)}
          className="flex-1 rounded-lg px-4 py-2 text-sm focus:outline-none"
          style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }}
        />
        <span className="text-sm whitespace-nowrap" style={{ color: C.muted }}>
          {table.getFilteredRowModel().rows.length} linhas
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ background: C.purpleBg, border: `1px solid #3D3560` }}>
        <span className="text-sm" style={{ color: C.purpleLt }}>QTADE À CORTAR para as linhas filtradas:</span>
        <input
          type="number" min={0} step={1} value={bulkQtade}
          onChange={e => setBulkQtade(e.target.value)}
          onFocus={e => e.target.select()}
          placeholder="ex: 30"
          className="w-24 text-right px-2 py-1 rounded-md font-semibold text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          style={{ background: C.surface, border: `1px solid #3D3560`, color: C.purpleLt }}
        />
        <button
          onClick={() => {
            const value = bulkQtade === '' ? 0 : Number(bulkQtade)
            const ids = table.getFilteredRowModel().rows.map(r => r.original.id)
            if (ids.length > 0) onBulkUpdate(ids, value)
          }}
          disabled={bulkQtade === ''}
          className="text-sm font-medium px-3 py-1.5 rounded-md transition-opacity disabled:opacity-40"
          style={{ background: C.purple, color: '#fff' }}
        >
          Aplicar a {table.getFilteredRowModel().rows.length} linha(s)
        </button>
      </div>

      <div className="rounded-xl overflow-auto shadow-sm"
        style={{ border: `1px solid ${C.border}`, maxHeight: 'calc(100vh - 320px)' }}>
        <table className="w-full border-collapse text-sm" style={{ minWidth: '1200px' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const isQtd   = header.column.id === 'qtadeACortar'
                  const isTotal = header.column.id === 'consumoTotal'
                  return (
                    <th key={header.id} style={{
                      width: header.getSize(),
                      background: isQtd ? '#1A1830' : isTotal ? '#121E1E' : C.surface2,
                      borderBottom: `1px solid ${C.border}`,
                    }} className="px-3 text-left font-semibold">
                      <div className="flex items-center gap-1 cursor-pointer select-none py-2"
                        style={{ color: isQtd ? C.purpleLt : isTotal ? C.teal : C.muted }}
                        onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc'  ? <ChevronUp size={12} /> :
                         header.column.getIsSorted() === 'desc' ? <ChevronDown size={12} /> :
                         <ChevronsUpDown size={12} style={{ opacity: 0.3 }} />}
                      </div>
                      {header.column.getCanFilter() && (
                        <div className="pb-1.5">
                          <ColumnSelect column={header.column} rows={rows} />
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr key={row.id}
                style={{ background: i % 2 === 0 ? C.surface : '#161829', borderBottom: `1px solid ${C.border}` }}
                className="hover:bg-[#1E2138] transition-colors">
                {row.getVisibleCells().map(cell => {
                  const isQtd   = cell.column.id === 'qtadeACortar'
                  const isTotal = cell.column.id === 'consumoTotal'
                  return (
                    <td key={cell.id} className="px-3 py-1.5"
                      style={{
                        color: C.text,
                        background: isQtd ? '#161428' : isTotal ? '#111E1E' : undefined,
                      }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ColumnSelect({ column, rows }: { column: Column<FabricRow, unknown>; rows: FabricRow[] }) {
  const key = column.id as keyof FabricRow
  const options = useMemo(
    () => [...new Set(rows.map(r => String(r[key] ?? '')))].filter(Boolean).sort(),
    [rows, key]
  )
  return (
    <select
      value={(column.getFilterValue() as string) ?? ''}
      onChange={e => column.setFilterValue(e.target.value || undefined)}
      onClick={e => e.stopPropagation()}
      className="w-full rounded px-1.5 py-0.5 text-xs cursor-pointer focus:outline-none font-normal"
      style={{ background: '#0A0C14', border: `1px solid #252A45`, color: '#8892B0' }}
    >
      <option value="">Todos</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
