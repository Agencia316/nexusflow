import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

// Equivale ao antigo .eslintrc.json ({ "extends": "next/core-web-vitals" }).
// Sem `eslint-config-next/typescript` de propósito: o projeto roda com
// strict:false e adicionar regras de TS agora fugiria do escopo do upgrade.
const eslintConfig = defineConfig([
  ...nextVitals,
  {
    // Regras novas do eslint-plugin-react-hooks 7 (derivadas do React
    // Compiler). Apontam 15 ocorrências pré-existentes de setState dentro de
    // useEffect e mutação de objeto durante render. Não são regressões do
    // upgrade; ficam como aviso até as telas serem refeitas nos sub-projetos
    // 2 e 3 da modernização, quando voltam a ser erro.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
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
