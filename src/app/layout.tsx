import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NexusFlow — Documente e treine com IA',
  description: 'Plataforma de gestão de conhecimento e treinamento para escritórios e empresas',
}

// Aplica o tema salvo antes da primeira pintura, evitando "flash" de cor.
// Sem valor salvo (ou 'system'), o prefers-color-scheme do dispositivo decide.
const themeScript = `(function(){try{var t=localStorage.getItem('nf_theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Fontes via link do Google (Inter + Fira Code). Migrar para next/font
            mudaria a renderização e pede revisão visual — fica para um PR próprio. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  )
}
