import Link from 'next/link'
import Image from 'next/image'

interface LogoProps {
  collapsed?: boolean
  href?: string
}

// Hasta que exista un asset `/logo-dark.png`, invertimos la luminosidad del
// logo light en dark mode vía CSS (clase `logo-img` definida en globals.css)
// para que se mantenga legible sobre el fondo oscuro.
export function Logo({ collapsed = false, href = '/' }: LogoProps) {
  return (
    <Link href={href} className="flex items-center gap-2 px-6 py-5">
      <Image
        src="/logo-light.png"
        alt="1to1"
        width={collapsed ? 32 : 80}
        height={collapsed ? 32 : 80}
        className={`logo-img ${collapsed ? 'h-8' : 'h-20'} w-auto shrink-0`}
        priority
      />
    </Link>
  )
}
