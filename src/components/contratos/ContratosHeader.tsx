'use client'

import { FileText, RefreshCw, Shield } from 'lucide-react'

interface Props {
  total: number
  isAdmin: boolean
  onSync: () => void
  onManageAccess: () => void
}

export default function ContratosHeader({ total, isAdmin, onSync, onManageAccess }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" />
          Contratos
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {total > 0 ? `${total} contrato${total !== 1 ? 's' : ''} sincronizado${total !== 1 ? 's' : ''}` : 'Nenhum contrato sincronizado'}
        </p>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2">
          <button
            onClick={onManageAccess}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition text-sm"
          >
            <Shield className="w-4 h-4" />
            Acessos
          </button>
          <button
            onClick={onSync}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium transition text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Sincronizar ZapSign
          </button>
        </div>
      )}
    </div>
  )
}
