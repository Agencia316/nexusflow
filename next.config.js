/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Garante que o HTML privado do dashboard Campos Pillar (fora de /public)
    // seja empacotado na função serverless de /api/pillar/dashboard na Vercel.
    outputFileTracingIncludes: {
      '/api/pillar/dashboard': ['./private/**'],
    },
  },
}
module.exports = nextConfig
