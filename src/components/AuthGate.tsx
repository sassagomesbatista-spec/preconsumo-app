import { useState } from 'react'
import { trpc } from '../lib/trpc'
import LoginPage from './LoginPage'
import App from '../App'

const C = { bg: '#0A0C14', muted: '#8892B0' }

export default function AuthGate() {
  const me = trpc.auth.me.useQuery()
  const [loggedIn, setLoggedIn] = useState(false)

  if (me.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <p className="text-sm" style={{ color: C.muted }}>Carregando...</p>
      </div>
    )
  }

  if (!me.data && !loggedIn) {
    return <LoginPage onSuccess={() => { setLoggedIn(true); me.refetch() }} />
  }

  return <App />
}
