import { useState } from 'react'
import { Lock, Mail } from 'lucide-react'
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
}

export default function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const login = trpc.auth.login.useMutation({ onSuccess })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login.mutate({ email, password })
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <div style={{ height: 3, background: 'linear-gradient(to right, #7C6FCD, #E879A0, #F6C90E, #4ECDC4)', position: 'absolute', top: 0, left: 0, right: 0 }} />

      <div className="w-full max-w-sm rounded-2xl p-8" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="rounded-lg px-3 py-1.5 mb-6 w-fit" style={{ background: '#FFFFFF' }}>
          <img src="/logo.png" alt="Samanta Gomes" className="h-9 w-auto" />
        </div>

        <h1 className="text-lg font-semibold mb-1" style={{ color: C.text }}>Pré Consumo de Tecidos</h1>
        <p className="text-sm mb-6" style={{ color: C.muted }}>Entre com sua conta para acessar</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
            <Mail size={15} style={{ color: C.muted }} />
            <input
              type="email" required autoFocus placeholder="seu@email.com"
              value={email} onChange={e => setEmail(e.target.value)}
              className="flex-1 bg-transparent text-sm focus:outline-none"
              style={{ color: C.text }}
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
            <Lock size={15} style={{ color: C.muted }} />
            <input
              type="password" required placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              className="flex-1 bg-transparent text-sm focus:outline-none"
              style={{ color: C.text }}
            />
          </div>

          {login.isError && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: '#1F1215', color: '#F87171', border: '1px solid #7F1D1D' }}>
              {(login.error as any)?.message ?? 'E-mail ou senha incorretos.'}
            </p>
          )}

          <button
            type="submit" disabled={login.isPending}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 mt-1"
            style={{ background: C.purple, color: '#fff' }}
          >
            {login.isPending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: C.muted, opacity: 0.6 }}>
          Acesso restrito à equipe Samanta Gomes
        </p>
      </div>
    </div>
  )
}
