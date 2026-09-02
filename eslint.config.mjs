import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

// Equivale ao antigo .eslintrc.json ({ "extends": "next/core-web-vitals" }).
// Sem `eslint-config-next/typescript` de propósito: o projeto roda com
// strict:false e adicionar regras de TS agora fugiria do escopo do upgrade.
const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
  ]),
])

export default eslintConfig
