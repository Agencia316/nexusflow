'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { useFirm } from '@/lib/firm-context'
import ContratosTable from '@/components/contratos/ContratosTable'
import ContratosHeader from '@/components/contratos/ContratosHeader'
import ContratosSyncModal from '@/components/contratos/ContratosSyncModal'
import ContratosAccessModal from '@/components/contratos/ContratosAccessModal'
import type { NfContrato } from '@/types/contratos'

export default function ContratosPage() {
  const user = getUser()
  const { firmId } = useFirm()
  const isAdmin = user?.role === 'admin' || !!user?.is_super_admin

  const [contratos, setContratos] = useState<NfContrato[]>([])
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [showSync, setShowSync] = useState(false)
  const [showAccess, setShowAccess] = useState(false)

  // Verifica acesso ao módulo
  useEffect(() => {
    if (!user || !firmId) return
    async function checkAccess() {
      if (user!.role === 'admin' || user!.is_super_admin) {
        setHasAccess(true)
        return
      }
      const { data } = await supabase
        .from('nf_contratos_access')
        .select('id')
        .eq('firm_id', firmId)
        .eq('user_id', user!.id)
        .maybeSingle()
      setHasAccess(!!data)
    }
    checkAccess()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmId])

  const loadContratos = useCallback(async () => {
    if (!firmId || !hasAccess) return
    setLoading(true)
    const { data } = await supabase
      .from('nf_contratos')
      .select('*')
      .eq('firm_id', firmId)
      .order('data_assinatura', { ascending: false })
    setContratos(data ?? [])
    setLoading(false)
  }, [firmId, hasAccess])

  useEffect(() => {
    if (hasAccess) loadContratos()
    else setLoading(false)
  }, [hasAccess, loadContratos])

  const updateContrato = async (id: number, patch: Partial<NfContrato>) => {
    await supabase.from('nf_contratos').update(patch).eq('id', id)
    setContratos(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  if (!loading && !hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-4">
        <span className="text-4xl">🔒</span>
        <p className="text-lg font-medium text-white">Acesso não autorizado</p>
        <p className="text-sm text-slate-400">
          Solicite ao administrador acesso ao módulo Contratos.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <ContratosHeader
        total={contratos.length}
        isAdmin={isAdmin}
        onSync={() => setShowSync(true)}
        onManageAccess={() => setShowAccess(true)}
      />

      <ContratosTable
        contratos={contratos}
        loading={loading}
        onUpdate={updateContrato}
      />

      {showSync && (
        <ContratosSyncModal
          firmId={firmId}
          userId={user?.id ?? ''}
          onClose={() => setShowSync(false)}
          onComplete={loadContratos}
        />
      )}

      {showAccess && isAdmin && (
        <ContratosAccessModal
          firmId={firmId}
          onClose={() => setShowAccess(false)}
        />
      )}
    </div>
  )
}
