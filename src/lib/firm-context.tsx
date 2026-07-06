'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getUser, type User } from './auth'
import { supabase } from './supabase'

/** Fallback só para dev/SSR — nunca é a fonte de verdade em runtime no cliente. */
const FALLBACK_FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || ''

function readFirmId(): string {
  if (typeof window === 'undefined') return FALLBACK_FIRM_ID
  return localStorage.getItem('nf_firm_id') || FALLBACK_FIRM_ID
}

export interface FirmOption {
  id: string
  name: string
  segment: string
}

export interface FirmContextValue {
  /** Firma ativa no momento (respeita "entrar como cliente" do super-admin). */
  firmId: string
  firmName: string
  firmSegment: string
  isSuperAdmin: boolean
  /** true quando o super-admin está visualizando uma firma diferente da sua. */
  isImpersonating: boolean
  /** Todas as firmas — preenchido apenas para super-admin; caso contrário []. */
  firms: FirmOption[]
  /** Super-admin: passa a operar como a firma informada. */
  setActiveFirm: (firmId: string) => void
  /** Volta para a firma original do usuário logado. */
  resetFirm: () => void
}

const FirmContext = createContext<FirmContextValue | null>(null)

export function FirmProvider({ children }: { children: React.ReactNode }) {
  // Inicialização síncrona a partir do localStorage: preserva o comportamento
  // anterior (a antiga const FIRM_ID) sem esperar um efeito, evitando flicker.
  const [firmId, setFirmId] = useState<string>(() => readFirmId())
  const [user, setUser] = useState<User | null>(() =>
    typeof window !== 'undefined' ? getUser() : null,
  )

  // Nome/segmento da firma ATIVA (resolvidos do banco), para que sigam a
  // impersonation em vez de refletirem sempre a firma do usuário logado.
  const [activeFirm, setActiveFirmData] = useState<{ name: string; segment: string } | null>(null)

  // Lista de firmas para o seletor do super-admin.
  const [firms, setFirms] = useState<FirmOption[]>([])

  const isSuperAdmin = !!user?.is_super_admin

  useEffect(() => {
    // Sincroniza caso o login tenha ocorrido depois da montagem do provider.
    setUser(getUser())
    setFirmId(readFirmId())

    // Reage a login/logout/troca de firma feitos em outra aba.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nf_firm_id' || e.key === 'nf_user' || e.key === null) {
        setUser(getUser())
        setFirmId(readFirmId())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Resolve nome + segmento da firma ativa sempre que ela muda.
  useEffect(() => {
    if (!firmId) { setActiveFirmData(null); return }
    let cancelled = false
    supabase
      .from('nf_firms')
      .select('name, segment')
      .eq('id', firmId)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setActiveFirmData({ name: data.name, segment: data.segment })
      })
    return () => { cancelled = true }
  }, [firmId])

  // Carrega todas as firmas apenas para o super-admin (fonte do seletor).
  useEffect(() => {
    if (!isSuperAdmin) { setFirms([]); return }
    let cancelled = false
    supabase
      .from('nf_firms')
      .select('id, name, segment')
      .order('name')
      .then(({ data }) => {
        if (!cancelled && data) setFirms(data as FirmOption[])
      })
    return () => { cancelled = true }
  }, [isSuperAdmin])

  const setActiveFirm = useCallback((id: string) => {
    if (typeof window !== 'undefined') localStorage.setItem('nf_firm_id', id)
    setFirmId(id)
  }, [])

  const resetFirm = useCallback(() => {
    const original = user?.firm_id || FALLBACK_FIRM_ID
    if (typeof window !== 'undefined') localStorage.setItem('nf_firm_id', original)
    setFirmId(original)
  }, [user])

  const value: FirmContextValue = {
    firmId,
    // Prioriza os dados resolvidos do banco (seguem a impersonation);
    // cai para os dados do usuário logado enquanto a busca não retorna.
    firmName: activeFirm?.name || user?.firm_name || '',
    firmSegment: activeFirm?.segment || user?.firm_segment || 'advocacia',
    isSuperAdmin,
    isImpersonating: !!user && !!user.firm_id && firmId !== user.firm_id,
    firms,
    setActiveFirm,
    resetFirm,
  }

  return <FirmContext.Provider value={value}>{children}</FirmContext.Provider>
}

export function useFirm(): FirmContextValue {
  const ctx = useContext(FirmContext)
  if (!ctx) throw new Error('useFirm() precisa estar dentro de <FirmProvider>')
  return ctx
}

/** Rótulo legível do segmento, útil para montar contexto de IA e UI. */
export function segmentLabel(segment?: string): string {
  switch (segment) {
    case 'solar':
      return 'energia solar fotovoltaica'
    case 'advocacia':
      return 'advocacia'
    default:
      return segment || 'advocacia'
  }
}
