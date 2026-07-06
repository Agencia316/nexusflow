# Deploy na Vercel — Fase 4 (produção)

> Build de produção validado localmente (`npm run build` → 28 rotas, exit 0).
> Falta só configurar as envs na Vercel e apertar o deploy.

## 1. Variáveis de ambiente

Vercel → Project → **Settings → Environment Variables**. Marque **Production**
(e Preview, se for usar previews). Os valores reais estão no seu `.env.local`.

### ⚠️ Segredos — NUNCA com prefixo `NEXT_PUBLIC` (senão vazam no bundle do navegador)

| Nome | Onde pegar | Ambiente |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` | Production |
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → JWT Settings → JWT Secret | Production |
| `OPENAI_API_KEY` | (opcional) chave global de fallback de IA | Production |
| `RESEND_API_KEY` | Resend → API Keys (e-mail transacional) | Production |

### Públicas — vão para o navegador (por design)

| Nome | Valor | Ambiente |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bysrqusnzspphqxxqurm.supabase.co` | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key do projeto (Supabase → Settings → API) | Production |
| `NEXT_PUBLIC_FIRM_ID` | `00000000-0000-0000-0000-000000000001` (fallback) | Production |
| `NEXT_PUBLIC_RLS_ENFORCED` | **`true`** (liga o isolamento por tenant) | Production |

> `NEXT_PUBLIC_RLS_ENFORCED=true` só é seguro porque a migration `0004` já está
> aplicada em produção. Se apontar para um banco sem as policies, as telas ficam
> vazias.

## 2. Checklist antes de dar deploy

- [ ] As 4 chaves de segredo **não** têm `NEXT_PUBLIC`.
- [ ] `SUPABASE_JWT_SECRET` na Vercel é **idêntico** ao do Supabase (senão o
      PostgREST rejeita todo token → todos os usuários caem para anon → telas vazias).
- [ ] Migration `0004_rls_tenant_isolation.sql` aplicada no banco de produção (já está).
- [ ] Build local passou (`npm run build`).

## 3. Deploy

- Via Git: fazer push da `main` para o repositório conectado à Vercel → deploy automático.
- Via CLI: `vercel --prod` (na raiz do projeto).

## 4. Smoke test pós-deploy (ordem)

1. Abrir `/<slug>` de uma firma → a marca (nome/cor) carrega **antes** do login
   (leitura pública de `nf_firms`). ✅ se aparece.
2. Login com um usuário real → cai no `/app/dashboard` com os dados **daquela** firma.
3. Login como super-admin → seletor de firmas aparece; "entrar como cliente" troca os dados.
4. Configurações (admin) → salvar a chave de IA da firma; testar IA no `/app/chat`.
5. (Opcional) rodar `node scripts/prova-isolamento.mjs` apontando o `.env.local`
   para o banco de produção → deve dar **PASS** em tudo.

## 5. Pontas soltas conhecidas (não bloqueiam o deploy)

- Revisar `/cadastro` + `/api/setup-firm` para criar firma já no novo modelo (service role).
- Afinar contraste do tema claro em alguns badges de status.
- Matriz E2E de UI por papel (admin/editor/member) — validação manual.
