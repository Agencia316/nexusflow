# Modernização da Stack — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar o NexusFlow de Next 14 / React 18 / Tailwind 3 / ESLint 8 para Next 16 / React 19 / Tailwind 4 / ESLint 10 sem nenhuma mudança de comportamento visível, com uma suíte de smoke tests em Playwright provando isso a cada etapa.

**Architecture:** Três PRs em sequência, cada um mergeado e em produção antes do próximo começar. PR 1 cria a rede de segurança (Playwright) contra o código atual. PR 2 roda o codemod oficial do Next e sobe as dependências. PR 3 roda a ferramenta de upgrade do Tailwind e reescreve à mão o motor de tema (`@theme inline`).

**Tech Stack:** Next.js 16.3, React 19.2, Tailwind CSS 4.3 + `@tailwindcss/postcss`, ESLint 10 (flat config) + `eslint-config-next` 16, `@playwright/test` 1.62, Node 24, TypeScript 5.x.

**Spec:** `docs/superpowers/specs/2026-09-02-modernizacao-stack-design.md`

## Global Constraints

- Nenhuma mudança de comportamento ou visual perceptível ao usuário.
- TypeScript permanece no 5.x (não subir para 7).
- React Compiler **desligado**; fontes continuam via `<link>` do Google; `strict: false` no tsconfig não muda; não adotar `cacheComponents`.
- Cada PR: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` verdes + preview da Vercel testado à mão antes do merge.
- Commits e PRs terminam com o rodapé de atribuição da sessão (ver instruções do harness).
- Todo trabalho em branch própria a partir de `main` atualizada. Nunca commitar `.env.local`.
- Shell: PowerShell 7 no Windows; nos comandos abaixo, `npx` e `npm` funcionam igual. Onde a sintaxe difere, o comando bash vem primeiro e o PowerShell entre parênteses.

---

## Mapa de arquivos

**PR 1 (branch `chore/smoke-tests`)**
- Create: `playwright.config.ts` — sobe o app e define baseURL; carrega `.env.local` no processo de teste.
- Create: `tests/smoke/publico.spec.ts` — 4 testes sem credencial.
- Create: `tests/smoke/autenticado.spec.ts` — login + varredura das rotas `/app/*` (pula sem `E2E_*`).
- Modify: `package.json` — script `test:e2e`; devDependency `@playwright/test`.
- Modify: `.gitignore` — artefatos do Playwright.
- Modify: `.env.example` — documenta `E2E_SLUG`, `E2E_EMAIL`, `E2E_PASSWORD`.
- Modify: `.github/workflows/ci.yml` — Node 24 + passo de smoke tests.
- Modify: `docs/QA-MATRIZ-E2E.md` — nota apontando o que já está automatizado.

**PR 2 (branch `chore/next-16`)**
- Modify: `package.json` (versões, script `lint`), `package-lock.json`.
- Rename: `src/middleware.ts` → `src/proxy.ts` (codemod) + comentário atualizado.
- Create: `eslint.config.mjs`; Delete: `.eslintrc.json`.
- Modify: `next.config.js` — `outputFileTracingIncludes` no topo.
- Modify: `AGENTS.md` — bloco gerado pelo Next 16.
- Modify: arquivos `.tsx` que o typecheck apontar (React 19 / lucide 1.x).

**PR 3 (branch `chore/tailwind-4`)**
- Create: `tests/visual/capturas.spec.ts` — captura telas nos dois temas (pula sem `E2E_SHOT_DIR`).
- Modify: `src/app/globals.css` — `@import "tailwindcss"` + `@theme inline` + camada base de compatibilidade.
- Modify: `postcss.config.js` — plugin `@tailwindcss/postcss`.
- Delete: `tailwind.config.js`.
- Modify: `.tsx` com classes renomeadas (ferramenta de upgrade).
- Modify: `.gitignore` — pasta `capturas/`.

---

# PR 1 — Rede de segurança (Playwright)

### Task 1: Instalar Playwright e escrever o primeiro teste (landing)

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/smoke/publico.spec.ts`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Produces: `playwright.config.ts` com `baseURL = http://localhost:3000`, projeto `chromium`, `webServer` que roda `npm run dev` localmente e `npm run start` no CI. Tasks 2, 3 e 8 dependem disso.

- [ ] **Step 1: Criar a branch**

```bash
git checkout main && git pull && git checkout -b chore/smoke-tests
```

- [ ] **Step 2: Instalar o Playwright e o Chromium**

```bash
npm i -D @playwright/test@1.62.1
npx playwright install chromium
```

Expected: `package.json` ganha `"@playwright/test": "^1.62.1"` em devDependencies; o Chromium é baixado para o cache do usuário.

- [ ] **Step 3: Escrever `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

// As envs E2E_* (credenciais do smoke test autenticado) ficam no .env.local.
// O Next carrega esse arquivo para o servidor, mas o processo do Playwright
// não — por isso lemos aqui. Node 20.12+ tem loadEnvFile nativo; no CI o
// arquivo não existe e o try/catch mantém o grupo autenticado pulando.
try { process.loadEnvFile('.env.local') } catch {}

const PORT = 3000
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // No CI o build já rodou no passo anterior; localmente o dev server basta.
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
```

- [ ] **Step 4: Escrever o teste da landing**

`tests/smoke/publico.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

/**
 * Smoke tests SEM credencial. Rodam em qualquer ambiente, inclusive no CI
 * com envs placeholder do Supabase (nenhuma chamada de rede precisa dar certo).
 */

test('landing renderiza título e botão de entrar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Documente processos')
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
})
```

- [ ] **Step 5: Adicionar script e gitignore**

Em `package.json`, dentro de `"scripts"`, depois de `"typecheck"`:

```json
    "test:e2e": "playwright test"
```

Ao final de `.gitignore`:

```
# Playwright
test-results/
playwright-report/
playwright/.cache/
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

```bash
npm run test:e2e
```

Expected: `1 passed`. O Playwright sobe `npm run dev` sozinho (leva ~30 s na primeira vez). Se já houver um `next dev` rodando na porta 3000, ele reutiliza.

Rodar também `npm run typecheck`: o `tsc` inclui `playwright.config.ts` e `tests/**`. Se reclamar que `loadEnvFile` não existe em `Process`, subir os tipos do Node (`npm i -D @types/node@20`, precisa ser ≥ 20.12).

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts tests/smoke/publico.spec.ts package.json package-lock.json .gitignore
git commit -m "test(e2e): Playwright + smoke test da landing"
```

---

### Task 2: Testes sem credencial restantes (redirects e 401)

**Files:**
- Modify: `tests/smoke/publico.spec.ts`

**Interfaces:**
- Consumes: `playwright.config.ts` da Task 1.

- [ ] **Step 1: Adicionar os três testes**

Acrescentar ao final de `tests/smoke/publico.spec.ts`:

```ts
test('/app/dashboard sem sessão volta para a home', async ({ page }) => {
  await page.goto('/app/dashboard')
  // AppLayout detecta ausência de usuário e faz router.push('/').
  await expect(page).toHaveURL(/\/$/)
})

test('/pillar no deploy principal redireciona para a home', async ({ page }) => {
  // Comportamento do middleware/proxy: sem NEXT_PUBLIC_BRAND, /pillar não existe.
  await page.goto('/pillar')
  expect(new URL(page.url()).pathname).toBe('/')
})

test('POST /api/chat sem token responde 401', async ({ request }) => {
  const res = await request.post('/api/chat', {
    data: { messages: [{ role: 'user', content: 'oi' }] },
  })
  expect(res.status()).toBe(401)
})
```

- [ ] **Step 2: Rodar e confirmar que os 4 passam**

```bash
npm run test:e2e
```

Expected: `4 passed`. Se `/pillar` falhar, confira que `NEXT_PUBLIC_BRAND` **não** está definida no `.env.local` (ela só existe no deploy Campos Pillar).

- [ ] **Step 3: Commit**

```bash
git add tests/smoke/publico.spec.ts
git commit -m "test(e2e): redirects de /app e /pillar + 401 em /api/chat"
```

---

### Task 3: Testes com credencial (login + varredura de rotas)

**Files:**
- Create: `tests/smoke/autenticado.spec.ts`
- Modify: `.env.example`, `.env.local` (local, não versionado), `docs/QA-MATRIZ-E2E.md`

**Interfaces:**
- Consumes: `playwright.config.ts` (carrega `.env.local`).
- Produces: padrão de login reutilizado pela Task 8 (`tests/visual/capturas.spec.ts`): ir a `/{E2E_SLUG}`, preencher `getByPlaceholder('seu@email.com')` e `getByPlaceholder('Sua senha')`, clicar `getByRole('button', { name: 'Entrar' })`, esperar URL `/app/dashboard`.

- [ ] **Step 1: Documentar as envs no `.env.example`**

Acrescentar ao final de `.env.example`:

```
# Smoke tests autenticados (npm run test:e2e). Sem estas três, o grupo
# autenticado é pulado. Use um usuário admin de uma firma de teste.
E2E_SLUG=climadek
E2E_EMAIL=usuario@exemplo.com
E2E_PASSWORD=senha
```

- [ ] **Step 2: Preencher no `.env.local` (não versionado)**

Adicionar ao `.env.local` as três linhas com a conta admin Climadek (slug, e-mail e senha estão na memória `acesso-links-app`). Conferir o slug real com:

```bash
grep -rn "climadek" supabase/ scripts/ 2>/dev/null | head -3
```

Se o slug não aparecer, abrir `https://nexusflow-lake.vercel.app` → "Já sou cliente" e ver qual slug o usuário costuma digitar, ou consultar `select slug from nf_firms` no Supabase.

- [ ] **Step 3: Escrever o teste autenticado**

`tests/smoke/autenticado.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

/**
 * Smoke test COM credencial: login pela rota /{slug} e uma passada por cada
 * tela de /app/*. Pula sozinho quando as envs E2E_* não estão definidas
 * (ex.: CI sem segredos). Automatiza os itens 1.1 e 1.2 de
 * docs/QA-MATRIZ-E2E.md; o resto da matriz continua manual.
 */

const SLUG = process.env.E2E_SLUG
const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

// Rotas visíveis a um admin de firma solar (não super admin). /app/admin fica
// de fora porque exige super admin.
const ROTAS = [
  '/app/dashboard',
  '/app/docs',
  '/app/docs/new',
  '/app/chat',
  '/app/training',
  '/app/templates',
  '/app/ferramentas',
  '/app/orcamentos',
  '/app/team',
  '/app/permissoes',
  '/app/alertas',
  '/app/reports',
  '/app/configuracoes',
  '/app/conta',
]

test.skip(!SLUG || !EMAIL || !PASSWORD, 'defina E2E_SLUG, E2E_EMAIL e E2E_PASSWORD no .env.local')

async function login(page: Page) {
  await page.goto(`/${SLUG}`)
  // A marca da firma carrega antes do formulário (item 1.1 da matriz de QA).
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Empresa não encontrada')
  await page.getByPlaceholder('seu@email.com').fill(EMAIL!)
  await page.getByPlaceholder('Sua senha').fill(PASSWORD!)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/app\/dashboard/)
}

test('login pelo slug cai no dashboard', async ({ page }) => {
  await login(page)
  await expect(page.getByRole('navigation')).toBeVisible()
})

test('todas as telas de /app abrem sem erro de aplicação', async ({ page }) => {
  const errosDePagina: string[] = []
  page.on('pageerror', err => errosDePagina.push(err.message))

  await login(page)

  for (const rota of ROTAS) {
    await test.step(rota, async () => {
      await page.goto(rota)
      // Não pode ter sido expulso para a home nem para o login.
      await expect(page).toHaveURL(new RegExp(rota.replace(/\//g, '\\/')))
      // O layout autenticado (sidebar) tem que estar de pé.
      await expect(page.getByRole('navigation')).toBeVisible()
      // Erro de renderização em produção mostra este texto.
      await expect(page.getByText('Application error')).toHaveCount(0)
    })
  }

  expect(errosDePagina, `erros JS não tratados: ${errosDePagina.join(' | ')}`).toEqual([])
})
```

- [ ] **Step 4: Rodar e confirmar que os 6 passam**

```bash
npm run test:e2e
```

Expected: `6 passed`. Se a varredura falhar em uma rota específica, abrir essa rota no navegador logado e ver se é um bug real ou se a página demora mais que 15 s (nesse caso subir `expect.timeout` no config para 30 000).

- [ ] **Step 5: Confirmar que o grupo pula sem credencial**

```bash
E2E_SLUG= E2E_EMAIL= E2E_PASSWORD= npx playwright test tests/smoke/autenticado.spec.ts
```

(PowerShell: `$env:E2E_SLUG=''; $env:E2E_EMAIL=''; $env:E2E_PASSWORD=''; npx playwright test tests/smoke/autenticado.spec.ts` e depois `Remove-Item Env:E2E_SLUG,Env:E2E_EMAIL,Env:E2E_PASSWORD`.)

Expected: `2 skipped`.

- [ ] **Step 6: Anotar na matriz de QA**

No topo de `docs/QA-MATRIZ-E2E.md`, logo abaixo do bloco de citação inicial, acrescentar:

```markdown
> **Automatizado desde 2026-09:** `npm run test:e2e` cobre 1.1, 1.2 e uma
> passada por todas as telas de `/app/*` (ver `tests/smoke/`). O restante
> continua manual.
```

- [ ] **Step 7: Commit**

```bash
git add tests/smoke/autenticado.spec.ts .env.example docs/QA-MATRIZ-E2E.md
git commit -m "test(e2e): login por slug + varredura das telas de /app (pula sem E2E_*)"
```

---

### Task 4: CI com Node 24 e smoke tests; abrir e mergear o PR 1

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Atualizar o workflow**

Substituir o conteúdo de `.github/workflows/ci.yml` por:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

# O build só precisa das envs NEXT_PUBLIC_* para instanciar o client do
# Supabase no escopo do módulo. Nenhuma chamada de rede acontece aqui, então
# valores placeholder bastam e o CI não precisa de nenhum secret. Os smoke
# tests sem credencial também não fazem rede útil; o grupo autenticado pula.
env:
  NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - run: npm ci

      # `next lint` sai com 0 quando só há warnings, então este passo barra
      # apenas erros.
      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Build
        run: npm run build

      - name: Instalar Chromium do Playwright
        run: npx playwright install --with-deps chromium

      # Sobe `npm run start` em cima do build acima (ver playwright.config.ts).
      - name: Smoke tests
        run: npm run test:e2e

      - name: Relatório do Playwright (só em falha)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Commit e push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: Node 24 + smoke tests Playwright depois do build"
git push -u origin chore/smoke-tests
```

- [ ] **Step 3: Abrir o PR**

```bash
gh pr create --title "test(e2e): rede de segurança com Playwright antes do upgrade da stack" --body-file - <<'EOF'
## O que muda
- Playwright configurado (`playwright.config.ts`, `npm run test:e2e`).
- 4 smoke tests sem credencial: landing, redirect de `/app/dashboard` sem sessão, redirect de `/pillar`, 401 em `/api/chat`.
- 2 smoke tests com credencial (login por slug + varredura de 14 telas de `/app/*`), pulados automaticamente sem `E2E_*`.
- CI: Node 20 → 24 e passo de smoke tests após o build.

## Por quê
PR 1 de 3 do sub-projeto "Stack" da modernização (spec em `docs/superpowers/specs/2026-09-02-modernizacao-stack-design.md`). Sem testes automatizados, o upgrade Next 14 → 16 e Tailwind 3 → 4 dependeria só de clique manual.

## Como testar
`npm run test:e2e` (6 passam com `E2E_*` no `.env.local`; 4 passam + 2 pulam sem).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01WkPCXFcq3g2s1J3s2zkKVe
EOF
```

- [ ] **Step 4: Esperar o CI e mergear**

```bash
gh pr checks --watch
gh pr merge --squash --delete-branch
```

Expected: CI verde (`4 passed, 2 skipped` no passo de smoke). Se `npm run start` falhar no CI por porta, conferir que nenhum outro passo usa a 3000.

- [ ] **Step 5: Voltar para main atualizada**

```bash
git checkout main && git pull
```

---

# PR 2 — Next 16 + React 19 + ESLint 10 + dependências

### Task 5: Rodar o codemod de upgrade do Next

**Files:**
- Modify: `package.json`, `package-lock.json`, `next.config.js`
- Rename: `src/middleware.ts` → `src/proxy.ts`
- Create: `eslint.config.mjs`

**Interfaces:**
- Produces: projeto em Next 16.3.x / React 19.2.x com `proxy.ts` e `eslint.config.mjs`. Task 6 continua daqui.

- [ ] **Step 1: Criar a branch**

```bash
git checkout main && git pull && git checkout -b chore/next-16
```

- [ ] **Step 2: Rodar o codemod (não interativo)**

```bash
npx @next/codemod@canary upgrade latest --yes
```

Expected: instala `next@16.3.x`, `react@19.2.x`, `react-dom@19.2.x`, `@types/react@19`, `@types/react-dom@19`; aplica `middleware-to-proxy`, `next-lint-to-eslint-cli`, `remove-unstable-prefix` e `remove-experimental-ppr` (os dois últimos sem efeito aqui). Leva alguns minutos.

- [ ] **Step 3: Revisar o diff**

```bash
git status && git diff -- package.json next.config.js && ls src/proxy.ts eslint.config.mjs
```

Expected: `src/proxy.ts` existe (função exportada chama `proxy`); `eslint.config.mjs` existe; `package.json` tem `"lint": "eslint ."`. Se `src/middleware.ts` ainda existir, rodar à mão:

```bash
npx @next/codemod@latest middleware-to-proxy .
```

Se `eslint.config.mjs` não existir, rodar à mão:

```bash
npx @next/codemod@canary next-lint-to-eslint-cli .
```

- [ ] **Step 4: Ajustar `next.config.js`**

Substituir o conteúdo por:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Garante que o HTML privado do dashboard Campos Pillar (fora de /public)
  // seja empacotado na função serverless de /api/pillar/dashboard na Vercel.
  // (Era experimental.outputFileTracingIncludes até o Next 14.)
  outputFileTracingIncludes: {
    '/api/pillar/dashboard': ['./private/**'],
  },
}
module.exports = nextConfig
```

- [ ] **Step 5: Substituir o `eslint.config.mjs` pela forma oficial (sem FlatCompat)**

O codemod gera uma config via `@eslint/eslintrc`. A forma recomendada no Next 16 dispensa isso. Substituir o conteúdo de `eslint.config.mjs` por:

```js
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
```

Remover a config antiga e a dependência que o codemod pode ter adicionado:

```bash
git rm -q .eslintrc.json
npm uninstall @eslint/eslintrc
```

- [ ] **Step 6: Atualizar o comentário do `src/proxy.ts`**

No cabeçalho do arquivo, trocar a linha que diz "o middleware só cuida do que cada DEPLOY expõe" por:

```ts
 * Obs.: a autenticação por usuário continua client-side (localStorage), igual
 * ao resto do app — o proxy (ex-middleware, renomeado no Next 16) só cuida do
 * que cada DEPLOY expõe, não de quem está logado.
```

- [ ] **Step 7: Commit parcial (ainda pode não buildar)**

```bash
git add -A
git commit -m "chore(next): codemod upgrade para Next 16 / React 19; middleware→proxy; ESLint CLI"
```

---

### Task 6: Subir dependências menores e fazer typecheck/lint/build passarem

**Files:**
- Modify: `package.json`, `package-lock.json`, `AGENTS.md`, `tsconfig.json` (se o Next ajustar), arquivos `.tsx` apontados pelo typecheck

**Interfaces:**
- Consumes: estado da Task 5.
- Produces: `npm run typecheck && npm run lint && npm run build` verdes.

- [ ] **Step 1: Subir as dependências**

```bash
npm i -D eslint@10 eslint-config-next@16 typescript@5 @types/node@24
npm i @supabase/supabase-js@2 lucide-react@1 react-markdown@10 remark-gfm@4 @anthropic-ai/sdk@0.123
```

Expected: `package.json` com `eslint ^10`, `eslint-config-next ^16`, `typescript ^5.9` (ou 5.x mais alto publicado), `lucide-react ^1`, `react-markdown ^10`.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Corrigir o que aparecer. Casos esperados no React 19 / lucide 1.x:

- `useRef<T>()` sem argumento → `useRef<T | null>(null)`.
- `JSX.Element` global → `React.JSX.Element` (ou trocar por `React.ReactNode`).
- Ícone renomeado no lucide → o erro diz `Module '"lucide-react"' has no exported member 'X'`; procurar o nome novo em `node_modules/lucide-react/dist/lucide-react.d.ts` (`grep -n "declare const X" node_modules/lucide-react/dist/lucide-react.d.ts`) e trocar o import.
- `@anthropic-ai/sdk`: se `src/lib/ai/anthropic.ts` reclamar de tipo em `messages.create`, conferir a assinatura em `node_modules/@anthropic-ai/sdk/resources/messages.d.ts` e ajustar só o tipo, não o comportamento.

Expected ao final: sem erros.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: sem erros (warnings aceitáveis). Se o ESLint reclamar de `scripts/*.mjs` (código Node fora do app), incluir `'scripts/**'` no `globalIgnores` do `eslint.config.mjs`.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: build com Turbopack conclui; a rota `/api/pillar/dashboard` aparece como dinâmica. O Next 16 pode reescrever `tsconfig.json` (ex.: `target`, `plugins`) e `next-env.d.ts`; aceitar as mudanças em `tsconfig.json`.

- [ ] **Step 5: Gerar o bloco do AGENTS.md**

```bash
npm run dev
```

Deixar subir até aparecer "Ready", encerrar com Ctrl+C. O Next 16 insere em `AGENTS.md` um bloco `<!-- BEGIN:nextjs-agent-rules -->` apontando para `node_modules/next/dist/docs/`. Conferir:

```bash
grep -n "nextjs-agent-rules" AGENTS.md
```

Expected: duas linhas (BEGIN e END).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(deps): ESLint 10, lucide 1.x, react-markdown 10, supabase-js, SDK Anthropic; typecheck/lint/build verdes no Next 16"
```

---

### Task 7: Verificar, abrir e mergear o PR 2

- [ ] **Step 1: Smoke tests locais com credencial**

```bash
npm run test:e2e
```

Expected: `6 passed`.

- [ ] **Step 2: Push e PR**

```bash
git push -u origin chore/next-16
gh pr create --title "chore(stack): Next 16 + React 19 + ESLint 10 (PR 2/3 da modernização)" --body-file - <<'EOF'
## O que muda
- Next 14.2 → 16.3, React 18 → 19.2 (codemod oficial `upgrade`).
- `middleware.ts` → `proxy.ts` (convenção nova; runtime Node, como já era).
- `next lint` (removido no 16) → ESLint 10 com `eslint.config.mjs` flat.
- `outputFileTracingIncludes` sai de `experimental`.
- Deps: eslint-config-next 16, lucide-react 1.x, react-markdown 10, supabase-js, SDK Anthropic. TypeScript fica no 5.x.
- Turbopack passa a ser o bundler padrão (dev e build).

## Sem mudança de comportamento
Não usamos `cookies()/headers()/params` no servidor, então as APIs assíncronas do 15/16 não afetam o código. React Compiler desligado.

## Como testar
`npm run typecheck && npm run lint && npm run build && npm run test:e2e`. Preview da Vercel: login por slug, DocuChat responde, gerar proposta solar, `/app/configuracoes` salva.

Spec: `docs/superpowers/specs/2026-09-02-modernizacao-stack-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01WkPCXFcq3g2s1J3s2zkKVe
EOF
gh pr checks --watch
```

- [ ] **Step 3: Testar o preview da Vercel à mão**

Pegar a URL do preview no PR (`gh pr view --json url` e abrir o link "Vercel" nos checks). Checklist, marcando cada item no comentário do PR:

1. `/{slug}` → login → dashboard com dados da firma.
2. `/app/chat` → enviar "olá" → resposta da IA (a firma precisa ter chave configurada).
3. `/app/orcamentos` → abrir uma proposta salva → visualizar.
4. `/app/configuracoes` → alterar e salvar um campo inofensivo (ex.: persona do chat) → recarregar → persistiu.
5. `/pillar` no preview do app geral → redireciona para `/`.

Se o preview não tiver `SUPABASE_JWT_SECRET`, o login falha com mensagem clara de configuração (comportamento do PR #11); nesse caso testar em produção depois do merge.

- [ ] **Step 4: Mergear e conferir produção**

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull
```

Abrir `https://nexusflow-lake.vercel.app` depois do deploy e repetir os itens 1 e 5 do checklist. Também abrir `https://campos-pillar.vercel.app/pillar/marketing` logado como super admin e confirmar que o dashboard HTML privado carrega (é a rota que depende de `outputFileTracingIncludes`).

---

# PR 3 — Tailwind 4

### Task 8: Spec de capturas de tela e captura "antes"

**Files:**
- Create: `tests/visual/capturas.spec.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: padrão de login da Task 3 (placeholders `seu@email.com` / `Sua senha`, botão `Entrar`).
- Produces: pasta `capturas/<antes|depois>/<tema>/<nome>.png`, comparada na Task 11.

- [ ] **Step 1: Criar a branch**

```bash
git checkout main && git pull && git checkout -b chore/tailwind-4
```

- [ ] **Step 2: Escrever o spec de capturas**

`tests/visual/capturas.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'

/**
 * Captura telas nos dois temas para comparação antes/depois de mudanças de
 * CSS. NÃO é teste de regressão automática (screenshots dependem de
 * fonte/OS); é ferramenta de inspeção. Só roda com E2E_SHOT_DIR definido.
 *
 *   E2E_SHOT_DIR=capturas/antes npx playwright test tests/visual
 */

const DIR = process.env.E2E_SHOT_DIR
const SLUG = process.env.E2E_SLUG
const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

test.skip(!DIR, 'defina E2E_SHOT_DIR para capturar telas')

const PUBLICAS = [
  { nome: 'landing', rota: '/' },
  { nome: 'login-slug', rota: `/${SLUG}` },
]
const LOGADAS = [
  { nome: 'dashboard', rota: '/app/dashboard' },
  { nome: 'docs', rota: '/app/docs' },
  { nome: 'chat', rota: '/app/chat' },
  { nome: 'orcamentos', rota: '/app/orcamentos' },
  { nome: 'configuracoes', rota: '/app/configuracoes' },
]

async function login(page: Page) {
  await page.goto(`/${SLUG}`)
  await page.getByPlaceholder('seu@email.com').fill(EMAIL!)
  await page.getByPlaceholder('Sua senha').fill(PASSWORD!)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/app\/dashboard/)
}

async function capturar(page: Page, tema: string, nome: string, rota: string) {
  await page.goto(rota)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: path.join(DIR!, tema, `${nome}.png`), fullPage: true })
}

for (const tema of ['dark', 'light']) {
  test.describe(`tema ${tema}`, () => {
    test.beforeEach(async ({ page }) => {
      // Mesmo mecanismo do ThemeToggle: o layout lê nf_theme antes da 1ª pintura.
      await page.addInitScript(t => localStorage.setItem('nf_theme', t), tema)
    })

    test('telas públicas', async ({ page }) => {
      for (const { nome, rota } of PUBLICAS) await capturar(page, tema, nome, rota)
    })

    test('telas logadas', async ({ page }) => {
      test.skip(!SLUG || !EMAIL || !PASSWORD, 'precisa de E2E_SLUG/E2E_EMAIL/E2E_PASSWORD')
      await login(page)
      for (const { nome, rota } of LOGADAS) await capturar(page, tema, nome, rota)
    })
  })
}
```

- [ ] **Step 3: Ignorar a pasta de capturas**

Acrescentar ao `.gitignore`:

```
# Capturas de tela para comparação visual (locais)
capturas/
```

- [ ] **Step 4: Capturar o "antes" (ainda em Tailwind 3)**

```bash
E2E_SHOT_DIR=capturas/antes npx playwright test tests/visual
```

(PowerShell: `$env:E2E_SHOT_DIR='capturas/antes'; npx playwright test tests/visual; Remove-Item Env:E2E_SHOT_DIR`)

Expected: `4 passed`; 14 arquivos em `capturas/antes/dark/` e `capturas/antes/light/`. Conferir:

```bash
find capturas/antes -name "*.png" | wc -l
```

Expected: `14`.

- [ ] **Step 5: Commit (só o spec e o gitignore)**

```bash
git add tests/visual/capturas.spec.ts .gitignore
git commit -m "test(visual): spec de capturas de tela nos dois temas (ferramenta de inspeção)"
```

---

### Task 9: Rodar a ferramenta de upgrade do Tailwind

**Files:**
- Modify: `package.json`, `package-lock.json`, `postcss.config.js`, `src/app/globals.css`, `tailwind.config.js`, arquivos `.tsx` com classes renomeadas

**Interfaces:**
- Produces: projeto em Tailwind 4 com `@import "tailwindcss"` e classes renomeadas; Task 10 substitui o motor de tema.

- [ ] **Step 1: Rodar a ferramenta (exige árvore git limpa)**

```bash
git status --porcelain
npx @tailwindcss/upgrade
```

Expected: instala `tailwindcss@4.x` e `@tailwindcss/postcss`, remove `autoprefixer` (o v4 já prefixa); `postcss.config.js` passa a usar `'@tailwindcss/postcss': {}`; `globals.css` começa com `@import "tailwindcss"` e, provavelmente, uma linha `@config "../../tailwind.config.js"`; nos `.tsx`, `outline-none` → `outline-hidden` e `shadow` → `shadow-sm`.

- [ ] **Step 2: Conferir os renomes**

```bash
grep -rn "outline-none" src | wc -l
grep -rn "outline-hidden" src | wc -l
grep -rhoE "\bshadow(-[a-z]+)?\b" src | sort | uniq -c
```

Expected: `outline-none` = 0, `outline-hidden` = 68; `shadow-sm` = 9 e nenhum `shadow` solto.

- [ ] **Step 3: Commit do resultado da ferramenta**

```bash
git add -A
git commit -m "chore(tailwind): @tailwindcss/upgrade — v4, postcss plugin, renomes de classe"
```

---

### Task 10: Reescrever o motor de tema em CSS e apagar `tailwind.config.js`

**Files:**
- Modify: `src/app/globals.css` (só o cabeçalho; os blocos `:root`, temas, `.badge-*`, `.prose-nexus`, scrollbar ficam iguais)
- Delete: `tailwind.config.js`

- [ ] **Step 1: Substituir o cabeçalho do `globals.css`**

Trocar tudo que vem antes do comentário `SISTEMA DE CORES` (o `@import "tailwindcss"` e a eventual linha `@config`) por:

```css
@import "tailwindcss";

/* ──────────────────────────────────────────────────────────────
   TOKENS DO TAILWIND (substitui o tailwind.config.js do v3)

   `inline` é obrigatório: faz cada utility carregar o valor
   rgb(var(--c-slate-N)) em vez de apontar para --color-slate-N, de modo
   que a troca das variáveis --c-* (abaixo) re-tematiza o app inteiro em
   tempo de execução. Modificadores de opacidade (bg-slate-900/50) seguem
   funcionando: o v4 resolve via color-mix().
   ────────────────────────────────────────────────────────────── */
@theme inline {
  --color-white: rgb(var(--c-white));
  --color-slate-50: rgb(var(--c-slate-50));
  --color-slate-100: rgb(var(--c-slate-100));
  --color-slate-200: rgb(var(--c-slate-200));
  --color-slate-300: rgb(var(--c-slate-300));
  --color-slate-400: rgb(var(--c-slate-400));
  --color-slate-500: rgb(var(--c-slate-500));
  --color-slate-600: rgb(var(--c-slate-600));
  --color-slate-700: rgb(var(--c-slate-700));
  --color-slate-800: rgb(var(--c-slate-800));
  --color-slate-900: rgb(var(--c-slate-900));
  --color-slate-950: rgb(var(--c-slate-950));

  --color-brand-dark: #0f172a;
  --color-brand-gold: #d4a017;
  --color-brand-gold-light: #f0c040;

  --font-sans: Inter, sans-serif;
  --font-mono: 'Fira Code', monospace;
}

/* Compatibilidade com o preflight do v3, para o visual não mudar:
   - v4 põe cursor:default em <button>; o v3 usava pointer.
   - v4 usa currentColor como cor padrão de borda; o v3 usava gray-200.
     Aqui o padrão do app é slate-700 (bordas), que já é o que todo
     `border` sem cor explícita renderizava no tema escuro. */
@layer base {
  button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }
  *, ::before, ::after { border-color: rgb(var(--c-slate-700)); }
}
```

Observação: se a ferramenta de upgrade já tiver inserido um bloco `@layer base` de compatibilidade de bordas, manter só um (o acima).

- [ ] **Step 2: Apagar a config JS**

```bash
git rm -q tailwind.config.js
grep -n "@config" src/app/globals.css
```

Expected: nenhuma linha `@config` restante (se houver, remover).

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: build verde. Erro típico: "Cannot apply unknown utility class" em algum `@apply` do `.prose-nexus` → a classe foi renomeada no v4; consultar a tabela de renomes na spec e ajustar.

- [ ] **Step 4: Verificar o tema no navegador**

```bash
npm run dev
```

Abrir `http://localhost:3000`, alternar o tema pelo botão (sol/lua) e confirmar: fundo escuro ↔ claro, cards, bordas e texto trocam; botão dourado mantém texto escuro nos dois temas. Encerrar o dev.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(tailwind): motor de tema em @theme inline; remove tailwind.config.js"
```

---

### Task 11: Comparação visual, PR 3 e merge

- [ ] **Step 1: Smoke tests**

```bash
npm run typecheck && npm run lint && npm run test:e2e
```

Expected: tudo verde, `6 passed`.

- [ ] **Step 2: Capturar o "depois"**

```bash
E2E_SHOT_DIR=capturas/depois npx playwright test tests/visual
```

(PowerShell: `$env:E2E_SHOT_DIR='capturas/depois'; npx playwright test tests/visual; Remove-Item Env:E2E_SHOT_DIR`)

Expected: 14 arquivos em `capturas/depois/`.

- [ ] **Step 3: Comparar lado a lado**

Para cada um dos 14 pares, abrir `capturas/antes/<tema>/<nome>.png` e `capturas/depois/<tema>/<nome>.png` (a ferramenta Read renderiza PNG) e anotar numa tabela:

| tema | tela | diferença | ação |
|---|---|---|---|
| dark | landing | nenhuma | — |
| … | … | … | … |

Diferenças aceitáveis: nenhuma. Diferenças típicas do v4 e como corrigir:
- Sombra mais fraca/forte → renome errado (`shadow` vs `shadow-sm`); ajustar a classe.
- Cor de placeholder de input mudou → adicionar em `@layer base`: `::placeholder { color: rgb(var(--c-slate-500)); }`.
- Espaçamento em listas com `space-y-*` mudou → v4 usa `:not(:last-child)`; se algum item usa `hidden`, trocar `space-y-*` por `flex flex-col gap-*` nesse container.
- Cursor de botão → já coberto pela camada base da Task 10.

Corrigir, recapturar o "depois", repetir até a tabela ficar toda "nenhuma". Commitar cada correção:

```bash
git add -A && git commit -m "fix(tailwind): <o que foi ajustado>"
```

- [ ] **Step 4: Enviar as capturas ao dono do produto**

Montar uma imagem ou pasta com os pares mais relevantes (dashboard e docs nos dois temas) e enviar via `SendUserFile`, com a tabela do passo 3 na mensagem.

- [ ] **Step 5: Push e PR**

```bash
git push -u origin chore/tailwind-4
gh pr create --title "chore(stack): Tailwind 4 (PR 3/3 da modernização)" --body-file - <<'EOF'
## O que muda
- Tailwind 3.4 → 4.3 via `@tailwindcss/upgrade` (`@tailwindcss/postcss`, `@import "tailwindcss"`, `outline-none`→`outline-hidden`, `shadow`→`shadow-sm`).
- `tailwind.config.js` eliminado; o mapeamento de `slate`/`white` para as variáveis `--c-*` (motor do tema claro/escuro) virou `@theme inline` no `globals.css`.
- Camada base de compatibilidade: cursor pointer em botões e cor padrão de borda, iguais ao v3.

## Verificação visual
14 capturas (7 telas × 2 temas) antes e depois, comparadas lado a lado: nenhuma diferença perceptível. (Tabela no comentário abaixo.)

## Como testar
`npm run build && npm run test:e2e`; alternar o tema no app e navegar.

Spec: `docs/superpowers/specs/2026-09-02-modernizacao-stack-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01WkPCXFcq3g2s1J3s2zkKVe
EOF
gh pr checks --watch
```

Publicar a tabela de comparação como comentário no PR:

```bash
gh pr comment --body-file - <<'EOF'
## Comparação visual antes/depois
| tema | tela | diferença |
|---|---|---|
| dark | landing | nenhuma |
| ... | ... | ... |
EOF
```

- [ ] **Step 6: Preview, merge e produção**

No preview da Vercel: login, alternar tema, abrir dashboard, docs, chat, orçamentos, configurações nos dois temas. Depois:

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull
```

Conferir em `https://nexusflow-lake.vercel.app` (tema claro e escuro) e em `https://campos-pillar.vercel.app/pillar`.

- [ ] **Step 7: Encerrar o sub-projeto**

Atualizar a memória `modernizacao-programa.md` marcando o sub-projeto 1 como concluído (data e PRs) e apontar que o próximo é o sub-projeto 2 (arquitetura e segurança), que começa por brainstorming e spec própria.
