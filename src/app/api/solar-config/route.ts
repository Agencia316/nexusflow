import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import crypto from 'crypto'

// Config global da calculadora solar (tarifas/HSP, marcas, faixas de preço).
// Como os dados são compartilhados por todas as firmas, a ESCRITA é restrita a
// super admin — verificada pela assinatura do JWT emitido no login.

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function verifySuperAdmin(token: string | null): boolean {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!token || !secret) return false
  const [h, b, s] = token.split('.')
  if (!h || !b || !s) return false
  const expected = b64url(crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest())
  // Comparação em tempo constante para não vazar a assinatura.
  const a = Buffer.from(s), e = Buffer.from(expected)
  if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) return false
  try {
    const payload = JSON.parse(Buffer.from(b.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
    if (payload.exp && Date.now() / 1000 > payload.exp) return false
    return payload.is_super_admin === true
  } catch { return false }
}

export async function GET() {
  const [tariffs, brands, pricing] = await Promise.all([
    supabase.from('nf_solar_tariffs').select('*').order('sort_order'),
    supabase.from('nf_solar_brands').select('*').order('sort_order'),
    supabase.from('nf_solar_pricing').select('*').order('sort_order'),
  ])
  return NextResponse.json({
    tariffs: tariffs.data || [], brands: brands.data || [], pricing: pricing.data || [],
  })
}

const NONE = '00000000-0000-0000-0000-000000000000'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null
  if (!verifySuperAdmin(auth)) {
    return NextResponse.json({ error: 'Apenas super admin pode editar a configuração solar.' }, { status: 403 })
  }

  const body = await req.json()

  // Sanitiza para apenas as colunas permitidas (evita injeção de colunas arbitrárias).
  const num = (v: any) => (v === '' || v == null ? null : Number(v))
  const tariffs = (body.tariffs || []).map((t: any, i: number) => ({
    uf: String(t.uf || 'PR'), region_label: String(t.region_label || '').trim(),
    concessionaria: t.concessionaria ? String(t.concessionaria) : null,
    tariff_kwh: num(t.tariff_kwh) ?? 0, hsp: num(t.hsp) ?? 4.6,
    active: t.active !== false, sort_order: i + 1,
  })).filter((t: any) => t.region_label)
  const brands = (body.brands || []).map((b: any, i: number) => ({
    name: String(b.name || '').trim(),
    type: ['painel', 'inversor', 'distribuidor'].includes(b.type) ? b.type : 'painel',
    is_partner: !!b.is_partner, panel_watt: num(b.panel_watt),
    price_factor: num(b.price_factor) ?? 1.0, active: b.active !== false, sort_order: i + 1,
  })).filter((b: any) => b.name)
  const pricing = (body.pricing || []).map((p: any, i: number) => ({
    min_kwp: num(p.min_kwp) ?? 0, max_kwp: num(p.max_kwp),
    price_per_kwp: num(p.price_per_kwp) ?? 0, sort_order: i + 1,
  }))

  try {
    // Tabelas pequenas e sem referências externas: substituição completa.
    await supabase.from('nf_solar_tariffs').delete().neq('id', NONE)
    await supabase.from('nf_solar_brands').delete().neq('id', NONE)
    await supabase.from('nf_solar_pricing').delete().neq('id', NONE)
    if (tariffs.length) await supabase.from('nf_solar_tariffs').insert(tariffs)
    if (brands.length) await supabase.from('nf_solar_brands').insert(brands)
    if (pricing.length) await supabase.from('nf_solar_pricing').insert(pricing)
    return NextResponse.json({ ok: true, tariffs: tariffs.length, brands: brands.length, pricing: pricing.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
