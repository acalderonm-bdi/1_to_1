import { config } from 'dotenv'
import { existsSync } from 'fs'
import { execSync } from 'child_process'
import crypto from 'crypto'

config({ path: '.env.local' })

const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PROJECT_REF',
  'SUPABASE_DB_PASSWORD',
  'ADMIN_EMAIL',
  'ANTHROPIC_API_KEY',
]

const OPTIONAL_VARS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SLACK_BOT_TOKEN',
  'RESEND_API_KEY',
]

function log(prefix: string, msg: string) {
  console.log(`${prefix} ${msg}`)
}

async function main() {
  console.log('\n🚀 Setup del Sistema de 1:1s\n')

  // 1. Verificar .env.local
  log('1️⃣ ', 'Verificando variables de entorno...')
  if (!existsSync('.env.local')) {
    console.error('❌ Falta .env.local — copia .env.example y llena los valores.')
    process.exit(1)
  }

  const missing = REQUIRED_VARS.filter(v => !process.env[v])
  if (missing.length > 0) {
    console.error(`❌ Variables faltantes: ${missing.join(', ')}`)
    process.exit(1)
  }

  if (!process.env['ADMIN_PASSWORD']) {
    const generated =
      crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '') + 'A1!'
    process.env['ADMIN_PASSWORD'] = generated
    console.log(`\n⚠️  ADMIN_PASSWORD generado: ${generated}`)
    console.log('   Guárdalo — lo necesitas para entrar al sistema.\n')
  }

  log('✅', 'Variables OK')

  const optMissing = OPTIONAL_VARS.filter(v => !process.env[v])
  if (optMissing.length > 0) {
    log('⚠️ ', `Opcionales no configurados: ${optMissing.join(', ')} (el sistema funciona sin estos)`)
  }

  // 2. Aplicar migraciones
  log('2️⃣ ', 'Aplicando migraciones a Supabase...')
  try {
    execSync('pnpm db:push', { stdio: 'inherit' })
  } catch {
    console.error('❌ Error aplicando migraciones')
    process.exit(1)
  }
  log('✅', 'Migraciones aplicadas')

  // 3. Generar tipos TypeScript
  log('3️⃣ ', 'Generando tipos TypeScript desde el schema...')
  try {
    execSync('pnpm db:types', { stdio: 'inherit' })
  } catch {
    log('⚠️ ', 'No se pudieron regenerar tipos (usando los incluidos en el repo)')
  }
  log('✅', 'Tipos listos')

  // 4. Crear usuario admin
  log('4️⃣ ', 'Creando usuario administrador...')
  execSync('pnpm db:create-admin', { stdio: 'inherit' })
  log('✅', 'Admin creado')

  // 5. Seed de datos demo
  if (process.env['SEED_DEMO_DATA'] === 'true') {
    log('5️⃣ ', 'Sembrando datos de ejemplo...')
    execSync('pnpm db:seed', { stdio: 'inherit' })
    log('✅', 'Datos sembrados')
  }

  // 6. Verificar instalación
  log('6️⃣ ', 'Validando instalación...')
  execSync('pnpm verify', { stdio: 'inherit' })

  // Resumen final
  console.log('\n✅ Sistema listo. Inicia con: pnpm dev\n')
  console.log('🔐 Credenciales de acceso:')
  console.log(`   Email:    ${process.env['ADMIN_EMAIL']}`)
  console.log(`   Password: ${process.env['ADMIN_PASSWORD']}`)
  console.log('   Rol:      Arquitectura Humana (RH)\n')

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''
  const supabaseProject = supabaseUrl.replace('https://', '').replace('.supabase.co', '')

  console.log('🔗 Configura en Google Cloud > OAuth Credentials > Authorized redirect URIs:')
  console.log(`   - ${process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'}/api/auth/callback`)
  console.log(`   - https://${supabaseProject}.supabase.co/auth/v1/callback\n`)

  if (process.env['SEED_DEMO_DATA'] === 'true') {
    console.log('👥 Usuarios demo (password: Demo1234!):')
    console.log('   • lider.tech@demo.com (Líder — Tecnología)')
    console.log('   • lider.producto@demo.com (Líder — Producto)')
    console.log('   • lider.diseno@demo.com (Líder — Diseño)')
    console.log('   • dev1@demo.com (Colaborador)')
    console.log('   • pm1@demo.com (Colaborador)')
    console.log('   • designer1@demo.com (Colaborador)')
    console.log('   • ... y más — ver dashboard de RH\n')
  }
}

main().catch(err => {
  console.error('❌ Error en setup:', err)
  process.exit(1)
})
