import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NexusFlow — Documente e treine com IA',
  description: 'Plataforma de gestão de conhecimento e treinamento para escritórios e empresas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  )
}
