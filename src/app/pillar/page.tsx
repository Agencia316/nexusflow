'use client'
import DashboardKPIs from '@/components/DashboardKPIs'

/**
 * Painel Operacional do produto Campos Pillar — os mesmos KPIs do app, porém
 * em modo leitura (sem drill-down pras telas que não existem neste produto).
 */
export default function PillarOperacional() {
  return <DashboardKPIs drilldown={false} />
}
