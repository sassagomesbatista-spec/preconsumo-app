import { useCallback, useState } from 'react'
import { Upload, FileSpreadsheet } from 'lucide-react'

interface Props { onFile: (file: File) => void; loading: boolean }

export default function UploadZone({ onFile, loading }: Props) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && /\.xlsx?$/i.test(file.name)) onFile(file)
  }, [onFile])

  return (
    <label
      className="flex flex-col items-center justify-center gap-3 rounded-2xl p-12 cursor-pointer transition-all"
      style={{
        border: `2px dashed ${dragging ? '#7C6FCD' : '#252A45'}`,
        background: dragging ? '#1E1B35' : '#12141F',
        opacity: loading ? 0.6 : 1,
        pointerEvents: loading ? 'none' : 'auto',
      }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input type="file" accept=".xlsx,.xls" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />

      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 animate-spin"
            style={{ borderColor: '#7C6FCD', borderTopColor: 'transparent' }} />
          <span className="text-sm" style={{ color: '#8892B0' }}>Importando...</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={36} style={{ color: '#4ECDC4' }} />
            <Upload size={20} style={{ color: '#7C6FCD' }} />
          </div>
          <div className="text-center">
            <p className="font-medium" style={{ color: '#E2E8F0' }}>Arraste o arquivo Excel aqui</p>
            <p className="text-sm mt-1" style={{ color: '#8892B0' }}>ou clique para selecionar</p>
            <p className="text-xs mt-2" style={{ color: '#525A8C' }}>
              Suporta .xlsx e .xls · Aba "Tecidos de variantes"
            </p>
          </div>
        </>
      )}
    </label>
  )
}
