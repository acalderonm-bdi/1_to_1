'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()

  const [tab, setTab] = useState<'email' | 'google'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }

    router.push('/colaborador')
    router.refresh()
  }

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        scopes: 'https://www.googleapis.com/auth/calendar',
      },
    })

    if (oauthError) {
      setError('Error al conectar con Google')
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-screen__brand-side">
        <div className="auth-screen__brand-mark-row">
          <div className="sidebar__brand-mark" style={{ width: 36, height: 36, fontSize: 17 }}>1</div>
          <div>
            <div className="sidebar__brand-name" style={{ color: 'white' }}>1to1</div>
            <div className="sidebar__brand-tag">B-Drive</div>
          </div>
        </div>
        <div className="auth-screen__quote">
          <div className="auth-screen__quote-mark">&ldquo;</div>
          <p>
            Las mejores 1:1 son las que se preparan con tiempo, se conducen con escucha y
            cierran con compromisos claros. Esta plataforma existe para que esa práctica sea consistente.
          </p>
          <cite>— Equipo de Arquitectura Humana</cite>
        </div>
        <div className="u-muted" style={{ position: 'relative', zIndex: 1, fontSize: 12, color: 'var(--text-on-dark-muted)' }}>
          B-Drive · Sistema interno · {new Date().getFullYear()}
        </div>
      </div>

      <div className="auth-screen__form-side">
        <div className="auth-card">
          <h1 className="auth-card__title">Bienvenida</h1>
          <p className="auth-card__subtitle">Ingresa con tu cuenta corporativa para continuar.</p>

          <div className="tabs">
            <button type="button" data-active={tab === 'email'} onClick={() => setTab('email')}>Correo</button>
            <button type="button" data-active={tab === 'google'} onClick={() => setTab('google')}>Google</button>
          </div>

          {tab === 'email' ? (
            <form onSubmit={handleEmailLogin} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label className="ui-label" htmlFor="email">Correo electrónico</label>
                <input
                  id="email"
                  className="ui-input"
                  type="email"
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="ui-label" htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  className="ui-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && <p style={{ fontSize: 13, color: 'var(--red-700)', margin: 0 }}>{error}</p>}
              <button type="submit" className="ui-btn ui-btn--primary ui-btn--block" disabled={loading}>
                {loading ? <span className="spinner" /> : null}
                {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
              </button>
            </form>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Inicia sesión con tu cuenta de Google Workspace de la organización.
              </p>
              {error && <p style={{ fontSize: 13, color: 'var(--red-700)', margin: 0 }}>{error}</p>}
              <button type="button" className="ui-btn ui-btn--outline ui-btn--block" onClick={handleGoogleLogin} disabled={loading}>
                {loading ? <span className="spinner" /> : null}
                {loading ? 'Conectando…' : 'Continuar con Google'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
