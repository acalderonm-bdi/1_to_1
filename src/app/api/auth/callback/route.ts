import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_EMAIL_DOMAIN = '@b-drive.com.mx'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_error`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  // Solo cuentas corporativas. Cualquier cuenta Google puede completar el OAuth;
  // si el correo no es del dominio, cerrar sesión y eliminar el usuario recién
  // creado (defensa adicional al hardening de handle_new_user) antes de rechazar.
  if (!user.email?.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN)) {
    await supabase.auth.signOut()
    try {
      await createAdminClient().auth.admin.deleteUser(user.id)
    } catch {
      // best-effort: aunque falle, handle_new_user no creó fila en public.users
    }
    return NextResponse.redirect(`${origin}/login?error=dominio`)
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'collaborator'
  const destination = role === 'hr'
    ? '/arquitectura-humana'
    : role === 'leader'
    ? '/lider'
    : '/colaborador'

  return NextResponse.redirect(`${origin}${destination}`)
}
