'use client'
import { useEffect, useState } from 'react'
import { getUser } from '@/lib/auth'
import { getToken } from '@/lib/session'
import { useRouter } from 'next/navigation'
import { Sun, Plus, Trash2, Save, Loader2, CheckCircle2, ArrowLeft, AlertCircle } from 'lucide-react'

type Row = Record<string, any>

export default function SolarConfigPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [tariffs, setTariffs] = useState<Row[]>([])
  const [brands, setBrands] = useState<Row[]>([])
  const [pricing, setPricing] = useState<Row[]>([])

  useEffect(() => {
    const u = getUser()
    if (!u?.is_super_admin) { router.push('/app/dashboard'); return }
    load()
  }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/solar-config')
    const d = await res.json()
    setTariffs(d.tariffs || []); setBrands(d.brands || []); setPricing(d.pricing || [])
    setLoading(false)
  }

  const upd = (set: any) => (i: number, k: string, v: any) =>
    set((rows: Row[]) => rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r))
  const del = (set: any) => (i: number) => set((rows: Row[]) => rows.filter((_, idx) => idx !== i))
  const add = (set: any, blank: Row) => () => set((rows: Row[]) => [...rows, { ...blank }])

  async function save() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch('/api/solar-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
        body: JSON.stringify({ tariffs, brands, pricing }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Erro ao salvar.'); setSaving(false); return }
      setSaved(true); setTimeout(() => setSaved(false), 3000)
      await load()
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  const inp = 'bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition w-full'
  const th = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-left pb-2 px-1'

  if (loading) return <div className="flex items-center justify-center h-full py-20"><Loader2 className="w-5 h-5 animate-spin text-amber-400" /></div>

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto pb-24">
      <button onClick={() => router.push('/app/admin')} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-4 transition">
        <ArrowLeft className="w-3.5 h-3.5" /> Administração
      </button>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
          <Sun className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Configuração da Calculadora Solar</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">Tarifas, marcas e preços usados por todas as empresas solar</p>
        </div>
      </div>
      <p className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2 mb-6">
        ⚠️ Estes dados são <strong>globais</strong> — valem para todas as empresas do segmento solar.
      </p>

      {/* TARIFAS */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-white">Tarifas por região (R$/kWh) e HSP</h2>
          <button onClick={add(setTariffs, { uf: 'PR', region_label: '', concessionaria: 'Copel', tariff_kwh: 0.99, hsp: 4.6, active: true })}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition"><Plus className="w-3.5 h-3.5" /> Adicionar</button>
        </div>
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-xl p-3">
          <table className="w-full min-w-[640px]">
            <thead><tr><th className={th} style={{ width: 60 }}>UF</th><th className={th}>Região</th><th className={th}>Concessionária</th><th className={th} style={{ width: 110 }}>R$/kWh</th><th className={th} style={{ width: 90 }}>HSP</th><th className={th} style={{ width: 40 }}></th></tr></thead>
            <tbody>
              {tariffs.map((r, i) => (
                <tr key={i}>
                  <td className="p-1"><input className={inp} value={r.uf || ''} onChange={e => upd(setTariffs)(i, 'uf', e.target.value)} /></td>
                  <td className="p-1"><input className={inp} value={r.region_label || ''} onChange={e => upd(setTariffs)(i, 'region_label', e.target.value)} placeholder="Irati e região" /></td>
                  <td className="p-1"><input className={inp} value={r.concessionaria || ''} onChange={e => upd(setTariffs)(i, 'concessionaria', e.target.value)} /></td>
                  <td className="p-1"><input type="number" step="0.01" className={inp} value={r.tariff_kwh ?? ''} onChange={e => upd(setTariffs)(i, 'tariff_kwh', e.target.value)} /></td>
                  <td className="p-1"><input type="number" step="0.1" className={inp} value={r.hsp ?? ''} onChange={e => upd(setTariffs)(i, 'hsp', e.target.value)} /></td>
                  <td className="p-1 text-center"><button onClick={() => del(setTariffs)(i)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* MARCAS */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-white">Marcas e fornecedores</h2>
          <button onClick={add(setBrands, { name: '', type: 'painel', panel_watt: 550, price_factor: 1.0, is_partner: false, active: true })}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition"><Plus className="w-3.5 h-3.5" /> Adicionar</button>
        </div>
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-xl p-3">
          <table className="w-full min-w-[640px]">
            <thead><tr><th className={th}>Nome</th><th className={th} style={{ width: 130 }}>Tipo</th><th className={th} style={{ width: 100 }}>Potência (W)</th><th className={th} style={{ width: 100 }}>Fator preço</th><th className={th} style={{ width: 80 }}>Parceiro</th><th className={th} style={{ width: 40 }}></th></tr></thead>
            <tbody>
              {brands.map((r, i) => (
                <tr key={i}>
                  <td className="p-1"><input className={inp} value={r.name || ''} onChange={e => upd(setBrands)(i, 'name', e.target.value)} /></td>
                  <td className="p-1">
                    <select className={inp} value={r.type} onChange={e => upd(setBrands)(i, 'type', e.target.value)}>
                      <option value="painel">Painel</option><option value="inversor">Inversor</option><option value="distribuidor">Distribuidor</option>
                    </select>
                  </td>
                  <td className="p-1"><input type="number" className={inp} value={r.panel_watt ?? ''} onChange={e => upd(setBrands)(i, 'panel_watt', e.target.value)} disabled={r.type !== 'painel'} placeholder={r.type !== 'painel' ? '—' : '585'} /></td>
                  <td className="p-1"><input type="number" step="0.01" className={inp} value={r.price_factor ?? ''} onChange={e => upd(setBrands)(i, 'price_factor', e.target.value)} /></td>
                  <td className="p-1 text-center"><input type="checkbox" checked={!!r.is_partner} onChange={e => upd(setBrands)(i, 'is_partner', e.target.checked)} className="w-4 h-4 accent-amber-500" /></td>
                  <td className="p-1 text-center"><button onClick={() => del(setBrands)(i)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* PREÇO POR kWp */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-white">Preço chave-na-mão por faixa (R$/kWp)</h2>
          <button onClick={add(setPricing, { min_kwp: 0, max_kwp: null, price_per_kwp: 3400 })}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition"><Plus className="w-3.5 h-3.5" /> Adicionar</button>
        </div>
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-xl p-3">
          <table className="w-full min-w-[480px]">
            <thead><tr><th className={th}>kWp de</th><th className={th}>até (vazio = sem limite)</th><th className={th}>R$/kWp</th><th className={th} style={{ width: 40 }}></th></tr></thead>
            <tbody>
              {pricing.map((r, i) => (
                <tr key={i}>
                  <td className="p-1"><input type="number" step="0.1" className={inp} value={r.min_kwp ?? ''} onChange={e => upd(setPricing)(i, 'min_kwp', e.target.value)} /></td>
                  <td className="p-1"><input type="number" step="0.1" className={inp} value={r.max_kwp ?? ''} onChange={e => upd(setPricing)(i, 'max_kwp', e.target.value === '' ? null : e.target.value)} placeholder="sem limite" /></td>
                  <td className="p-1"><input type="number" className={inp} value={r.price_per_kwp ?? ''} onChange={e => upd(setPricing)(i, 'price_per_kwp', e.target.value)} /></td>
                  <td className="p-1 text-center"><button onClick={() => del(setPricing)(i)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <button onClick={save} disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-onaccent font-semibold py-3 rounded-xl transition sticky bottom-4">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><CheckCircle2 className="w-4 h-4" /> Salvo!</> : <><Save className="w-4 h-4" /> Salvar configuração</>}
      </button>
    </div>
  )
}
