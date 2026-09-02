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
