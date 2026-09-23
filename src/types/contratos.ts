export interface NfContrato {
  id: number
  firm_id: string
  zapsign_token: string | null
  zapsign_proc_token: string | null
  nome: string
  tipo: 'contrato' | 'procuracao'
  categoria: string | null
  telefone: string | null
  email: string | null
  data_assinatura: string | null
  doc_juntado: boolean
  pericia_marcada: boolean
  pericia_data: string | null
  observacao: string | null
  synced_at: string
  created_at: string
  updated_at: string
}

export interface NfContratosAccess {
  id: number
  firm_id: string
  user_id: string
  granted_by: string | null
  created_at: string
}
