'use client'
import { useState } from 'react'
import { getUser } from '@/lib/auth'
import { getToken } from '@/lib/session'
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, User } from 'lucide-react'

export default function ContaPage() {
  const user = getUser()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function submit() {
    setMsg(null)
    if (!current || !next) { setMsg({ kind: 'error', text: 'Preencha a senha atual e a nova.' }); return }
    if (next.length < 6) { setMsg({ kind: 'error', text: 'A nova senha precisa ter pelo menos 6 caracteres.' }); return }
    if (next !== confirm) { setMsg({ kind: 'error', text: 'A confirmação não bate com a nova senha.' }); return }

    setSaving(true)
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg({ kind: 'ok', text: 'Senha alterada com sucesso.' })
        setCurrent(''); setNext(''); setConfirm('')
      } else {
        setMsg({ kind: 'error', text: data.error || 'Não foi possível alterar a senha.' })
      }
    } catch {
      setMsg({ kind: 'error', text: 'Erro de conexão. Tente novamente.' })
    }
    setSaving(false)
  }

  const field = (label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <div>
      <label className="text-xs text-slate-400 block mb-1.5">{label}</label>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} onChange={e => set(e.target.value)}
          placeholder={placeholder} autoComplete="off"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"/>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <User className="w-5 h-5 text-amber-400"/>
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Minha conta</h1>
          <p className="text-slate-400 text-xs mt-0.5">{user?.name} · {user?.email}</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-slate-400"/> Alterar senha
        </h2>

        <div className="space-y-3">
          {field('Senha atual', current, setCurrent, 'Sua senha de hoje')}
          {field('Nova senha', next, setNext, 'Mínimo 6 caracteres')}
          {field('Confirmar nova senha', confirm, setConfirm, 'Repita a nova senha')}

          <button type="button" onClick={() => setShow(s => !s)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition">
            {show ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
            {show ? 'Ocultar senhas' : 'Mostrar senhas'}
          </button>

          {msg && (
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2.5 ${
              msg.kind === 'ok'
                ? 'text-green-400 bg-green-400/10 border border-green-400/20'
                : 'text-red-400 bg-red-400/10 border border-red-400/20'
            }`}>
              {msg.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0"/> : <AlertCircle className="w-4 h-4 shrink-0"/>}
              {msg.text}
            </div>
          )}

          <button onClick={submit} disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-onaccent font-semibold py-2.5 rounded-xl transition">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin"/> Salvando...</> : <>Alterar senha</>}
          </button>
        </div>
      </div>
    </div>
  )
}
