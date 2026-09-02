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
