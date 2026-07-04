/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      colors: {
        brand: {
          dark: '#0f172a',
          gold: '#d4a017',
          'gold-light': '#f0c040',
        }
      }
    },
  },
  plugins: [],
}
