import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Envia notificação via Resend (email) + alerta interno
export async function POST(req: NextRequest) {
  const { type, userId, firmId, title, message, link, sendEmail } = await req.json()

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
    const userRes = await supabase
      .from('nf_users')
      .select('email, name, email_notifications')
      .eq('id', userId)
      .single()

    const user = userRes.data
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
