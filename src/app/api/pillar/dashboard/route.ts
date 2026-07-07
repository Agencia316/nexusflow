import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import crypto from 'crypto'
import { CAMPOS_PILLAR_FIRM_ID } from '@/lib/brand'

/**
 * Serve o dashboard de marketing da Campos Pillar (Histórico Diário / CPL /
 * Meta Ads) SOMENTE para quem tem sessão válida e autorizada. O HTML vive fora
 * de /public (private/), então não é mais alcançável por URL crua — o único
 * caminho é este endpoint, que valida o JWT emitido em /api/session/login.
 *
 * A auth do app é client-side (localStorage), então o token chega no header
 * Authorization enviado pelo componente /pillar/marketing.
 */

export const runtime = 'nodejs'

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/** Verifica assinatura HS256 + expiração e devolve o payload, ou null. */
function verifyJwt(token: string, secret: string): Record<string, any> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, b, s] = parts
  const expected = b64url(crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest())
  const sig = Buffer.from(s)
  const exp = Buffer.from(expected)
  if (sig.length !== exp.length || !crypto.timingSafeEqual(sig, exp)) return null
  let payload: Record<string, any>
  try {
    payload = JSON.parse(Buffer.from(b.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
  } catch { return null }
  if (typeof payload.exp === 'number' && Date.now() / 1000 >= payload.exp) return null
  return payload
}

function autorizado(payload: Record<string, any>): boolean {
  return payload.is_super_admin === true || payload.firm_id === CAMPOS_PILLAR_FIRM_ID
}

// Lido uma vez por instância (cold start) e reaproveitado.
let cachedHtml: string | null = null
function loadHtml(): string {
  if (cachedHtml === null) {
    cachedHtml = readFileSync(join(process.cwd(), 'private', 'campos-pillar-dashboard.html'), 'utf8')
  }
  return cachedHtml
}

export async function GET(req: NextRequest) {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Servidor sem SUPABASE_JWT_SECRET configurado.' }, { status: 500 })
  }

  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) {
    return NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 })
  }

  const payload = verifyJwt(token, secret)
  if (!payload) {
    return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })
  }
  if (!autorizado(payload)) {
    return NextResponse.json({ error: 'Acesso exclusivo da Campos Pillar.' }, { status: 403 })
  }

  let html: string
  try { html = loadHtml() }
  catch { return NextResponse.json({ error: 'Dashboard indisponível.' }, { status: 500 }) }

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
