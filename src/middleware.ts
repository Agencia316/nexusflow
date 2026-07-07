import { NextResponse, type NextRequest } from 'next/server'

/**
 * Trava de roteamento por marca (ver src/lib/brand.ts).
 *
 * Deploy branded "dashboard-only" (ex.: NEXT_PUBLIC_BRAND=campos-pillar):
 *   tudo vive sob /pillar. Qualquer outra rota de página redireciona pra lá,
 *   escondendo o app principal (/app/*, /login, /[slug]).
 * Deploy principal (sem a var): esconde a superfície /pillar.
 *
 * Obs.: a autenticação por usuário continua client-side (localStorage), igual
 * ao resto do app — o middleware só cuida do que cada DEPLOY expõe, não de quem
 * está logado.
 */

const BRAND = process.env.NEXT_PUBLIC_BRAND || ''
const DASHBOARD_ONLY_BRANDS = new Set(['campos-pillar'])

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (DASHBOARD_ONLY_BRANDS.has(BRAND)) {
    const allowed =
      pathname.startsWith('/pillar') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/ferramentas') || // dashboard.html embutido no iframe
      pathname.startsWith('/_next') ||
      pathname === '/favicon.ico'
    if (!allowed) {
      const url = req.nextUrl.clone()
      url.pathname = '/pillar'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // Deploy principal: /pillar não existe como produto — manda pra home.
  if (pathname.startsWith('/pillar')) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Roda em tudo, menos assets estáticos do Next e o favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
