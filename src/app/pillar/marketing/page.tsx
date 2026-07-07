'use client'

/**
 * Painel de Marketing do produto Campos Pillar — embute o dashboard autocontido
 * (Histórico Diário, CPL, Meta Ads) que já vive em public/ferramentas/. Ele lê o
 * próprio Supabase (chxakvcpwluzzwdkwozc), independente do banco do app.
 */
export default function PillarMarketing() {
  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <iframe
        src="/ferramentas/dashboard.html"
        title="Dashboard de Marketing — Campos Pillar"
        className="w-full h-full border-0"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  )
}
