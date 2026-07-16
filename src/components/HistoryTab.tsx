import { FolderOpen, Trash2, Clock } from 'lucide-react'
import { trpc } from '../lib/trpc'

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
}

interface Props {
  currentProjectId: number | null
  onOpen: (id: number) => void
  canDelete?: boolean
}

export default function HistoryTab({ currentProjectId, onOpen, canDelete }: Props) {
  const list = trpc.projects.list.useQuery()
  const utils = trpc.useUtils()
  const del = trpc.projects.delete.useMutation({ onSuccess: () => utils.projects.list.invalidate() })

  const fmtDate = (d: string | Date) => new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: C.text }}>Histórico de Projetos</h2>
        <span className="text-xs" style={{ color: C.muted }}>
          {list.data?.length ?? 0} projeto(s) salvo(s) na nuvem
        </span>
      </div>

      {list.isLoading && (
        <p className="text-sm" style={{ color: C.muted }}>Carregando histórico...</p>
      )}

      {list.data?.length === 0 && (
        <div className="rounded-xl p-6 text-center text-sm" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}>
          Nenhum projeto salvo ainda. Importe uma planilha — ela será salva automaticamente aqui.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {list.data?.map(p => (
          <div key={p.id}
            className="flex items-center gap-4 rounded-xl px-4 py-3"
            style={{
              background: p.id === currentProjectId ? C.purpleBg : C.surface,
              border: `1px solid ${p.id === currentProjectId ? C.purple : C.border}`,
            }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: C.text }}>
                {p.clientName || '(sem cliente)'}
                {p.id === currentProjectId && (
                  <span className="ml-2 text-xs font-normal" style={{ color: C.teal }}>● atual</span>
                )}
              </p>
              <p className="text-xs truncate" style={{ color: C.pink }}>{p.colecao || '(sem coleção)'}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs whitespace-nowrap" style={{ color: C.muted }}>
              <Clock size={12} /> {fmtDate(p.updatedAt)}
            </div>
            <button onClick={() => onOpen(p.id)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ background: C.purple, color: '#fff' }}>
              <FolderOpen size={13} /> Abrir
            </button>
            {canDelete && (
              <button onClick={() => { if (confirm('Excluir este projeto do histórico permanentemente?')) del.mutate({ id: p.id }) }}
                className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg"
                style={{ color: C.pink, border: `1px solid ${C.pink}` }}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
