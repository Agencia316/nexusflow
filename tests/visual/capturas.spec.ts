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
