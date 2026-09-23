import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const ZAPSIGN_BASE = 'https://api.zapsign.com.br/api/v1'

interface ZapDoc {
  token: string
  name: string
  status: string
  created_at: string
  signers?: Array<{ name: string; email: string; phone_country: string; phone_number: string }>
  folder_path?: string
}

async function fetchAllDocs(token: string): Promise<ZapDoc[]> {
  const docs: ZapDoc[] = []
  let url: string | null = `${ZAPSIGN_BASE}/docs/?status=signed&page_size=100`
  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Token ${token}` },
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`ZapSign API error: ${res.status}`)
    const data = await res.json()
    docs.push(...(data.results ?? data.data ?? []))
    url = data.next ?? null
  }
  return docs
}

function parseContrato(doc: ZapDoc, firmId: string) {
  const signer = doc.signers?.[0]
  const phone = signer ? `${signer.phone_country || ''}${signer.phone_number || ''}` : ''
  const name = doc.name ?? ''
  const isProcuracao = /procura/i.test(name) || /procu/i.test(doc.folder_path ?? '')

  let categoria = 'Geral'
  if (/acidente/i.test(name)) categoria = 'Auxílio Acidente'
  else if (/doença/i.test(name) || /doenca/i.test(name)) categoria = 'Auxílio Doença'
  else if (/aposentadoria/i.test(name)) categoria = 'Aposentadoria'

  return {
    firm_id: firmId,
    zapsign_token: doc.token,
    nome: signer?.name ?? name,
    tipo: isProcuracao ? 'procuracao' : 'contrato',
    categoria,
    telefone: phone,
    email: signer?.email ?? '',
    data_assinatura: doc.created_at ? doc.created_at.slice(0, 10) : null,
    synced_at: new Date().toISOString(),
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, firm_id, user_id } = await req.json()
    if (!token || !firm_id) {
      return NextResponse.json({ error: 'token e firm_id obrigatórios' }, { status: 400 })
    }

    const docs = await fetchAllDocs(token)

    let total_new = 0
    let total_updated = 0

    for (const doc of docs) {
      const payload = parseContrato(doc, firm_id)
      const { data: existing } = await supabaseAdmin
        .from('nf_contratos')
        .select('id')
        .eq('firm_id', firm_id)
        .eq('zapsign_token', doc.token)
        .maybeSingle()

      if (existing) {
        await supabaseAdmin.from('nf_contratos').update(payload).eq('id', existing.id)
        total_updated++
      } else {
        await supabaseAdmin.from('nf_contratos').insert(payload)
        total_new++
      }
    }

    await supabaseAdmin.from('nf_contratos_sync_log').insert({
      firm_id,
      synced_by: user_id || null,
      total_found: docs.length,
      total_new,
      total_updated,
      status: 'success',
    })

    return NextResponse.json({ total_found: docs.length, total_new, total_updated })
  } catch (e: any) {
    console.error('[contratos/sync]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
