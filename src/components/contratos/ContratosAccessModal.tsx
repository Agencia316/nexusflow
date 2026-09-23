'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Shield } from 'lucide-react'

interface NfUser { id: string; name: string; email: string; role: string; has_access: boolean }

export default function ContratosAccessModal({
  firmId,
  onClose,
}: { firmId: string; onClose: () => void }) {
  const [users, setUsers] = useState<NfUser[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ data: allUsers }, { data: accessList }] = await Promise.all([
        supabase.from('nf_users').select('id,name,email,role').eq('firm_id', firmId).eq('is_active', true).order('name'),
        supabase.from('nf_contratos_access').select('user_id').eq('firm_id', firmId),
      ])
      const accessSet = new Set((accessList ?? []).map((a: any) => a.user_id))
      setUsers(
        (allUsers ?? []).map((u: any) => ({
          ...u,
          has_access: u.role === 'admin' || accessSet.has(u.id),
        }))
      )
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmId])

  const toggle = async (user: NfUser) => {
    if (user.role === 'admin') return
    setSaving(user.id)
    if (user.has_access) {
      await supabase.from('nf_contratos_access').delete()
        .eq('firm_id', firmId).eq('user_id', user.id)
    } else {
      await supabase.from('nf_contratos_access').insert({ firm_id: firmId, user_id: user.id })
    }
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, has_access: !u.has_access } : u))
    setSaving(null)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            Acesso ao módulo Contratos
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-800 rounded-lg animate-pulse" />)}
            </div>
          )}
          {!loading && users.map(u => (
            <div key={u.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-800 transition">
              <div>
                <p className="text-sm font-medium text-white">{u.name}</p>
                <p className="text-xs text-slate-500">{u.email} · <span className="capitalize">{u.role}</span></p>
              </div>
              <button
                onClick={() => toggle(u)}
                disabled={u.role === 'admin' || saving === u.id}
                title={u.role === 'admin' ? 'Admin sempre tem acesso' : undefined}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                  u.has_access ? 'bg-green-500' : 'bg-slate-600'
                } ${u.role === 'admin' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  u.has_access ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800">
          <p className="text-xs text-slate-500">Admins sempre têm acesso. As alterações são imediatas.</p>
        </div>
      </div>
    </div>
  )
}
