'use client'
import { useState } from 'react'
import { X, RefreshCw } from 'lucide-react'

interface SyncResult { total_found: number; total_new: number; total_updated: number }

export default function ContratosSyncModal({
  firmId, userId, onClose, onComplete,
}: { firmId: string; userId: string; onClose: () => void; onComplete: () => void }) {
  const [token, setToken] = useState(process.env.NEXT_PUBLIC_ZAPSIGN_DEFAULT_TOKEN ?? '')
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState('')

  const sync = async () => {
    setSyncing(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/contratos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, firm_id: firmId, user_id: userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro na sincronização')
      setResult(data); onComplete()
    } catch (e: any) { setError(e.message) }
    finally { setSyncing(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-400" />Sincronizar ZapSign
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Token ZapSign</label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Cole o token da API ZapSign"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {result && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-green-400">Sincronização concluída</p>
              <p className="text-xs text-slate-400">Encontrados: <span className="text-white">{result.total_found}</span></p>
              <p className="text-xs text-slate-400">Novos: <span className="text-white">{result.total_new}</span></p>
              <p className="text-xs text-slate-400">Atualizados: <span className="text-white">{result.total_updated}</span></p>
            </div>
          )}

          <button
            onClick={sync}
            disabled={syncing || !token}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-medium transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      </div>
    </div>
  )
}
