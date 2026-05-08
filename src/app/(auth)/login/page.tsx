'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Calendar, Sparkles, ShieldCheck } from 'lucide-react'
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
        <div className="auth-screen__brand-mark-row anim-fade-in-down" style={{ animationDelay: '0ms' }}>
          <div className="sidebar__brand-mark" style={{ width: 40, height: 40, fontSize: 19 }}>1</div>
          <div>
            <div className="sidebar__brand-name" style={{ color: 'white', fontSize: 20 }}>1to1</div>
            <div className="sidebar__brand-tag">B-Drive · Sistema interno</div>
          </div>
        </div>

        <div className="auth-screen__quote anim-fade-in-up" style={{ animationDelay: '120ms' }}>
          <div className="auth-screen__quote-mark">&ldquo;</div>
          <p>
            Las mejores 1:1 son las que se preparan con tiempo, se conducen
            con escucha y cierran con compromisos claros. Esta plataforma
            existe para que esa práctica sea consistente.
          </p>
          <cite>— Equipo de Arquitectura Humana</cite>

          <div
            style={{
              marginTop: 36,
              display: 'grid',
              gap: 14,
              maxWidth: 420,
            }}
          >
            {[
              { Icon: Calendar, label: 'Cadencias automáticas', hint: 'Sincronía con Google Calendar' },
              { Icon: Sparkles, label: 'Insights con IA', hint: 'Sugerencias contextuales en cada 1:1' },
              { Icon: ShieldCheck, label: 'Privacidad por diseño', hint: 'Minutas privadas, VoBo bilateral' },
            ].map(({ Icon, label, hint }, i) => (
              <div
                key={label}
                className="anim-fade-in-up"
                style={{
                  animationDelay: `${200 + i * 80}ms`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 'var(--r-md)',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, color-mix(in oklab, var(--accent-500) 30%, transparent), color-mix(in oklab, var(--accent-700) 18%, transparent))',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--accent-300)',
                    flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                >
                  <Icon size={15} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: 'white', letterSpacing: '-0.005em' }}>{label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-on-dark-muted)', marginTop: 2 }}>{hint}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="anim-fade-in"
          style={{
            animationDelay: '440ms',
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--text-on-dark-muted)',
            letterSpacing: '0.02em',
          }}
        >
          <span>B-Drive · Sistema interno · {new Date().getFullYear()}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              className="anim-pulse-ring"
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: 'var(--lime-400)',
                boxShadow: '0 0 0 0 color-mix(in oklab, var(--lime-400) 50%, transparent)',
              }}
            />
            Operativo
          </span>
        </div>
      </div>

      <div className="auth-screen__form-side">
        <div className="auth-card anim-fade-in-up">
          <div className="page__eyebrow" style={{ color: 'var(--accent-600)' }}>
            <ShieldCheck size={12} /> Acceso corporativo
          </div>
          <h1 className="auth-card__title">Bienvenida</h1>
          <p className="auth-card__subtitle">
            Ingresa con tu cuenta corporativa para continuar.
          </p>

          <div className="tabs">
            <button type="button" data-active={tab === 'email'} onClick={() => setTab('email')}>
              Correo
            </button>
            <button type="button" data-active={tab === 'google'} onClick={() => setTab('google')}>
              Google
            </button>
          </div>

          {tab === 'email' ? (
            <form onSubmit={handleEmailLogin} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label className="ui-label" htmlFor="email">
                  Correo electrónico
                </label>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="ui-label" htmlFor="password" style={{ marginBottom: 6 }}>
                    Contraseña
                  </label>
                  <button
                    type="button"
                    className="ui-link"
                    style={{ fontSize: 12 }}
                    onClick={() => setError('Contacta a Arquitectura Humana para restablecer tu contraseña')}
                  >
                    ¿Olvidaste?
                  </button>
                </div>
                <input
                  id="password"
                  className="ui-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <div className="ui-field-error" role="alert">
                  <AlertCircle size={13} /> {error}
                </div>
              )}
              <button type="submit" className="ui-btn ui-btn--accent ui-btn--lg ui-btn--block" disabled={loading}>
                {loading ? <span className="spinner" /> : null}
                <span>{loading ? 'Iniciando sesión…' : 'Iniciar sesión'}</span>
                {!loading && <ArrowRight size={14} />}
              </button>
            </form>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
                Inicia sesión con tu cuenta de Google Workspace de la organización.
                Sincronizaremos tu calendario para mostrar tus 1:1s automáticamente.
              </p>
              {error && (
                <div className="ui-field-error" role="alert">
                  <AlertCircle size={13} /> {error}
                </div>
              )}
              <button
                type="button"
                className="ui-btn ui-btn--outline ui-btn--lg ui-btn--block"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                {loading ? (
                  <span className="spinner" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                {loading ? 'Conectando…' : 'Continuar con Google'}
              </button>
            </div>
          )}

          <div className="auth-card__foot">
            ¿Problemas para acceder?{' '}
            <a href="mailto:arquitectura.humana@b-drive.com.mx" style={{ color: 'var(--accent-700)', textDecoration: 'none', fontWeight: 500 }}>
              Contacta a Arquitectura Humana
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
