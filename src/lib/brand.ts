/**
 * Marca do deploy — definida por NEXT_PUBLIC_BRAND.
 *
 * O MESMO código roda em dois deploys da Vercel: o app principal (sem a var,
 * marca "nexusflow" padrão, comportamento intocado) e o produto "Campos Pillar"
 * (NEXT_PUBLIC_BRAND=campos-pillar), que serve só a superfície /pillar, com a
 * firma travada e acesso restrito a super-admin + usuários da própria firma.
 */

export interface Brand {
  key: string
  name: string
  tagline: string
  /** Firma travada neste produto (null = sem trava, escolhe pelo login). */
  firmId: string | null
  firmSlug: string | null
  /** Produto enxuto: só o painel, sem as telas do app principal. */
  dashboardOnly: boolean
}

/** Campos Pillar Advocacia — id fixo (é também a firma default do sistema). */
export const CAMPOS_PILLAR_FIRM_ID = '00000000-0000-0000-0000-000000000001'

const DEFAULT_BRAND: Brand = {
  key: 'nexusflow',
  name: 'NexusFlow',
  tagline: 'Documente e treine com IA',
  firmId: null,
  firmSlug: null,
  dashboardOnly: false,
}

const BRANDS: Record<string, Brand> = {
  'campos-pillar': {
    key: 'campos-pillar',
    name: 'Campos Pillar Advocacia',
    tagline: 'Painel de indicadores',
    firmId: CAMPOS_PILLAR_FIRM_ID,
    firmSlug: 'campos-pillar',
    dashboardOnly: true,
  },
}

export function resolveBrand(key?: string | null): Brand {
  if (!key) return DEFAULT_BRAND
  return BRANDS[key] || DEFAULT_BRAND
}

/** Marca ativa neste deploy. NEXT_PUBLIC_* é inlined no build (cliente e edge). */
export const BRAND = resolveBrand(process.env.NEXT_PUBLIC_BRAND)

/** true quando este deploy é um produto branded (ex.: Campos Pillar), não o app. */
export const isBrandedProduct = BRAND.key !== 'nexusflow'
