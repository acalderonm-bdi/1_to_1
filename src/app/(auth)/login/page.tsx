'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/layout/brand-mark'
import { cn } from '@/lib/utils/cn'

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
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-background">
      {/* Lado izquierdo — brand side */}
      <div className="hidden md:flex bg-foreground text-background flex-col justify-between p-14 relative overflow-hidden">
        <div className="flex items-center gap-3 relative z-10">
          <div className="inline-flex items-center justify-center rounded-md bg-background text-foreground font-mono-numeric font-medium size-9 text-base">1</div>
          <div className="leading-tight">
            <div className="text-base font-medium">1to1</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-background/60">B-Drive</div>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <p className="text-[26px] leading-[1.35] tracking-tight text-background">
            Las mejores 1:1 son las que se preparan con tiempo, se conducen con escucha y cierran con compromisos claros.
          </p>
          <p className="text-[13px] text-background/55 mt-6 uppercase tracking-[0.12em]">
            Equipo de Arquitectura Humana
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[12px] text-background/60">
          <span>B-Drive · Sistema interno · {new Date().getFullYear()}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Operativo
          </span>
        </div>
      </div>

      {/* Lado derecho — form side */}
      <div className="flex items-center justify-center px-6 py-12 md:px-12">
        <div className="w-full max-w-[380px] anim-fade-in-up">
          {/* brand mark visible solo en móvil */}
          <div className="md:hidden mb-8">
            <BrandMark size={32} />
          </div>

          <h1 className="text-[26px] font-medium tracking-tight">Bienvenida</h1>
          <p className="text-sm text-muted-foreground mt-1.5 mb-8">Ingresa con tu cuenta corporativa para continuar.</p>

          {/* Tabs Correo / Google */}
          <div role="tablist" aria-label="Método de inicio de sesión" className="grid grid-cols-2 gap-0.5 p-0.5 rounded-md border bg-secondary/50 mb-6">
            {(['email', 'google'] as const).map(t => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  'text-[13px] font-medium rounded px-3 py-1.5 transition-colors',
                  tab === t ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'email' ? 'Correo' : 'Google'}
              </button>
            ))}
          </div>

          {tab === 'email' ? (
            <form onSubmit={handleEmailLogin} className="grid gap-4">
              <div>
                <Label htmlFor="email" className="mb-1.5 block">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <button
                    type="button"
                    onClick={() => setError('Contacta a Arquitectura Humana para restablecer tu contraseña')}
                    className="text-[12px] text-brand hover:underline"
                  >
                    ¿Olvidaste?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div role="alert" className="flex items-center gap-2 text-[12.5px] text-destructive">
                  <AlertCircle className="size-3.5" /> {error}
                </div>
              )}

              <Button type="submit" variant="brand" size="lg" className="w-full mt-1" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
                {!loading && <ArrowRight className="size-3.5" />}
              </Button>
            </form>
          ) : (
            <div className="grid gap-4">
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Inicia sesión con tu cuenta de Google Workspace de la organización. Sincronizaremos tu calendario para
                mostrar tus 1:1s automáticamente.
              </p>
              {error && (
                <div role="alert" className="flex items-center gap-2 text-[12.5px] text-destructive">
                  <AlertCircle className="size-3.5" /> {error}
                </div>
              )}
              <Button type="button" variant="outline" size="lg" onClick={handleGoogleLogin} disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                {loading ? 'Conectando…' : 'Continuar con Google'}
              </Button>
            </div>
          )}

          <div className="mt-8 text-center text-[12px] text-muted-foreground leading-relaxed">
            ¿Problemas para acceder?{' '}
            <a href="mailto:arquitectura.humana@b-drive.com.mx" className="text-foreground hover:underline">
              Contacta a Arquitectura Humana
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
