import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

// Fontes self-hosted (pacotes @fontsource): sem requisição ao Google em runtime
// nem em build. Subset latin cobre todo o português.
const inter = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-inter',
})
const firaCode = localFont({
  src: [
    { path: '../../node_modules/@fontsource/fira-code/files/fira-code-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/fira-code/files/fira-code-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-fira-code',
})

export const metadata: Metadata = {
  title: 'NexusFlow — Documente e treine com IA',
  description: 'Plataforma de gestão de conhecimento e treinamento para escritórios e empresas',
}

// Aplica o tema salvo antes da primeira pintura, evitando "flash" de cor.
// Sem valor salvo (ou 'system'), o prefers-color-scheme do dispositivo decide.
const themeScript = `(function(){try{var t=localStorage.getItem('nf_theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${firaCode.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  )
}
