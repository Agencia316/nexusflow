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
