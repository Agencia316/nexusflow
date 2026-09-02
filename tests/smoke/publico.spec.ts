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
