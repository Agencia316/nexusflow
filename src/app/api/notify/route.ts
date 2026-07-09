import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { getSession, resolveFirmId } from '@/lib/api-auth'

export const runtime = 'nodejs'

// Envia notificação via Resend (email) + alerta interno
export async function POST(req: NextRequest) {
  // Escreve alerta e dispara e-mail pela service role: sem sessão, um anônimo
  // criava alertas em qualquer firma e mandava e-mail para qualquer usuário.
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Sessão ausente ou inválida.' }, { status: 401 })

  const { type, userId, firmId: requestedFirmId, title, message, link, sendEmail } = await req.json()
  const firmId = resolveFirmId(session, requestedFirmId)

  // O destinatário precisa ser da mesma firma — senão o alerta (e o e-mail)
  // atravessariam o tenant.
  const { data: target } = await supabase
    .from('nf_users')
    .select('id, email, name, email_notifications')
    .eq('id', userId)
    .eq('firm_id', firmId)
    .maybeSingle()

  if (!target) return NextResponse.json({ error: 'Destinatário inválido.' }, { status: 404 })

  // 1. Salvar alerta interno sempre
  await supabase.from('nf_alerts').insert({
    firm_id: firmId,
    user_id: userId,
    type,
    title,
    message,
    link,
  })

  // 2. Se sendEmail e tiver RESEND_API_KEY, envia e-mail
  if (sendEmail && process.env.RESEND_API_KEY) {
    const user = target
    if (user?.email_notifications && user?.email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'NexusFlow <noreply@nexusflow.com.br>',
          to: [user.email],
          subject: title,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:white;border-radius:12px;overflow:hidden">
              <div style="background:#d4a017;padding:20px 24px">
                <h1 style="margin:0;font-size:18px;color:#0f172a;font-weight:800">NexusFlow</h1>
              </div>
              <div style="padding:28px 24px">
                <h2 style="margin:0 0 12px;font-size:16px;color:white">${title}</h2>
                <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;line-height:1.6">${message}</p>
                ${link ? `<a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://nexusflow-campos-pillar.vercel.app'}${link}" 
                  style="display:inline-block;background:#d4a017;color:#0f172a;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
                  Ver no NexusFlow →
                </a>` : ''}
              </div>
              <div style="padding:16px 24px;border-top:1px solid #1e293b">
                <p style="margin:0;color:#334155;font-size:12px">NexusFlow · Campos Pillar Advocacia</p>
              </div>
            </div>
          `,
        }),
      })
    }
  }

  return NextResponse.json({ ok: true })
}
