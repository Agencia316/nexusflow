/** @type {import('tailwindcss').Config} */

// slate + white são remapeados para variáveis CSS (definidas em globals.css)
// para que TODO o app troque entre claro/escuro sem editar cada arquivo.
// O formato `rgb(var(--x) / <alpha-value>)` preserva os modificadores de
// opacidade do Tailwind (ex.: bg-slate-900/50, border-slate-700/20).
const themedSlate = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(shade => [
    shade,
    `rgb(var(--c-slate-${shade}) / <alpha-value>)`,
  ]),
)

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  // Troca controlada por atributo data-theme (com fallback para o SO via
  // prefers-color-scheme, resolvido no globals.css).
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      colors: {
        white: 'rgb(var(--c-white) / <alpha-value>)',
        slate: themedSlate,
        brand: {
          dark: '#0f172a',
          gold: '#d4a017',
          'gold-light': '#f0c040',
        },
      },
    },
  },
  plugins: [],
}
