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

// Defeito conhecido e pré-existente: as telas logadas leem localStorage durante
// a renderização, então o HTML do servidor difere do cliente e o React registra
// "hydration mismatch" (recuperável: ele re-renderiza no cliente). Não é
// quebra de tela. A causa some no sub-projeto 2 da modernização (sessão no
// servidor); até lá, a varredura ignora só esse tipo de erro.
const ERRO_IGNORADO = /hydrat/i

test('todas as telas de /app abrem sem erro de aplicação', async ({ page }) => {
  const errosDePagina: string[] = []
  page.on('pageerror', err => { if (!ERRO_IGNORADO.test(err.message)) errosDePagina.push(err.message) })

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
