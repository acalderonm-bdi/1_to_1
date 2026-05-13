import Link from 'next/link'
import Image from 'next/image'

interface LogoProps {
  collapsed?: boolean
  href?: string
}

// TODO(fusion): añadir variante dark (`/logo-dark.png`) cuando exista el asset.
// El codebase usa `[data-theme="dark"]` (no `.dark`), así que cualquier swap
// futuro debe hacerse vía atributo o vía conditional client-side, no con la
// variante `dark:` de Tailwind.
export function Logo({ collapsed = false, href = '/' }: LogoProps) {
  return (
    <Link href={href} className="flex items-center gap-2 px-6 py-5">
      <Image
        src="/logo-light.png"
        alt="1to1"
        width={collapsed ? 32 : 80}
        height={collapsed ? 32 : 80}
        className={`${collapsed ? 'h-8' : 'h-20'} w-auto shrink-0`}
        priority
      />
    </Link>
  )
}
