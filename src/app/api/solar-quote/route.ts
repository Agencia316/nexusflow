import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import crypto from 'crypto'

// Salva/atualiza propostas de orçamento solar. A calculadora roda num iframe com
// a anon key (não pode escrever sob RLS), então a gravação passa por aqui: o JWT
// da sessão é verificado e o firm_id é derivado dele (nunca do input do cliente).

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function verifyToken(token: string | null): any | null {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!token || !secret) return null
  const [h, b, s] = token.split('.')
  if (!h || !b || !s) return null
  const expected = b64url(crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest())
  const a = Buffer.from(s), e = Buffer.from(expected)
  if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) return null
  try {
    const p = JSON.parse(Buffer.from(b.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
    if (p.exp && Date.now() / 1000 > p.exp) return null
    return p
  } catch { return null }
}

const num = (v: any) => (v === '' || v == null ? null : Number(v))

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null
  const p = verifyToken(auth)
  if (!p) return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })

  const body = await req.json()
  // Firma alvo: a do token; super admin pode gravar na firma que estiver operando.
  const firmId = body.firmId && (body.firmId === p.firm_id || p.is_super_admin) ? body.firmId : p.firm_id
  if (!firmId) return NextResponse.json({ error: 'Firma não identificada.' }, { status: 400 })

  const row = {
    firm_id: firmId,
    created_by: p.sub || null,
    created_by_name: body.created_by_name || null,
    cliente_nome: body.cliente_nome || null,
    cliente_zap: body.cliente_zap || null,
    cliente_cidade: body.cliente_cidade || null,
    regiao: body.regiao || null,
    concessionaria: body.concessionaria || null,
    tarifa: num(body.tarifa),
    painel: body.painel || null,
    painel_watt: num(body.painel_watt),
    inversor: body.inversor || null,
    distribuidor: body.distribuidor || null,
    kwp: num(body.kwp),
    n_paineis: num(body.n_paineis),
    geracao: num(body.geracao),
    cobertura: num(body.cobertura),
    consumo_kwh: num(body.consumo_kwh),
    investimento: num(body.investimento),
    parcela: num(body.parcela),
    n_parcelas: num(body.n_parcelas),
    economia_mes: num(body.economia_mes),
    economia_ano: num(body.economia_ano),
    payback_anos: num(body.payback_anos),
    economia_25: num(body.economia_25),
    status: 'novo',
  }

  const { data, error } = await supabase.from('nf_solar_quotes').insert(row).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
