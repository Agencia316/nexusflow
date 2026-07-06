# Plano para funcionar 100% — Segurança, isolamento por cliente e produção

> Objetivo: transformar a separação entre clientes (hoje **cosmética**, feita no
> cliente sobre RLS permissiva) numa **barreira real no banco**, sem quebrar o
> app em produção, e fechar as pontas soltas para operar com tranquilidade.

## O que significa "100%" (definição de pronto)

1. Um cliente **nunca** consegue ler/escrever dados de outro cliente — nem pela
   UI, nem chamando o Supabase direto com a anon key. **Provado por teste.**
2. Segredos (chave de IA, senhas) **nunca** chegam ao navegador. *(já feito p/ a chave de IA e senhas)*
3. Super-admin (Três16) enxerga tudo e faz "entrar como cliente" de forma
   **auditada** e **autorizada no servidor** (não só no localStorage).
4. Permissões de documento (cargo + individual) valem de verdade. *(já feito no cliente; vira barreira real aqui)*
5. App implantado (Vercel) com todas as envs; IA e e-mail funcionando por firma.
6. Sem código morto/duplicado no caminho de login (a causa de bugs como o do `is_super_admin`).

---

## Decisão de arquitetura

O app hoje **não usa Supabase Auth** — `nf_login` (bcrypt) valida e a "sessão" é
só `localStorage`. Toda requisição ao banco usa a **anon key** (que vai no bundle),
então o RLS não tem como saber "quem é" e por isso está liberado para todos.

Para o RLS enforçar por tenant, cada requisição precisa carregar uma **identidade
verificável**. Dois caminhos:

### ✅ Opção B (recomendada) — Sessão com JWT assinado (mantém o login atual)
- No login, o **servidor** valida via `nf_login` (bcrypt) e **emite um JWT assinado**
  com o segredo do projeto, contendo `firm_id`, `role='authenticated'`, `uid`,
  `user_role` e `is_super_admin`.
- O navegador passa esse JWT em toda chamada (`Authorization: Bearer`). O PostgREST
  valida a assinatura e expõe os claims via `auth.jwt()`.
- O RLS passa a exigir `firm_id = (auth.jwt()->>'firm_id')::uuid`.
- **Vantagens:** diff pequeno, preserva `nf_login`/bcrypt e a UX de login por slug;
  impersonation = reemitir token com escopo no servidor.
- **Custo:** não traz fluxos prontos de "esqueci a senha"/MFA (dá pra adicionar depois).

### Opção A (alternativa) — Supabase Auth completo
- Migrar `nf_users` para `auth.users` (importável com hash bcrypt via Admin API),
  login por `supabase.auth.signInWithPassword`, claims de `firm_id`/`is_super_admin`
  via **Auth Hook**. RLS por `auth.uid()`.
- **Vantagens:** padrão do ecossistema, ganha reset de senha/MFA/OAuth.
- **Custo:** migração maior (usuários, login, UX de slug, impersonation via hook).

> **Recomendação:** seguir a **Opção B** — mesmo resultado de isolamento com muito
> menos risco para um app já em uso. A Opção A fica como evolução futura se quiser
> os fluxos de e-mail nativos.

### Formato do JWT (Opção B)
```json
{
  "sub": "<nf_users.id>",
  "role": "authenticated",
  "aud": "authenticated",
  "firm_id": "<uuid da firma ativa>",
  "user_role": "admin | editor | member",
  "is_super_admin": false,
  "iat": 0, "exp": 0
}
```
Assinado em HS256 com o **JWT Secret** do projeto
(Supabase → Project Settings → API → JWT Settings). Guardar como env server-only
`SUPABASE_JWT_SECRET`.

---

## Fases (cada uma é entregável e reversível)

### Fase 0 — Rede de segurança (sem tocar em produção)
- [ ] Criar **branch de staging no Supabase** (banco isolado, cópia do schema) e
      apontar um `.env` de teste para ele. Todo o trabalho de RLS é validado lá antes de ir pra prod.
- [ ] Confirmar **backup / point-in-time recovery** ativo no projeto.
- [ ] Habilitar/confirmar o `SUPABASE_JWT_SECRET` (legacy JWT secret) — necessário
      para assinar tokens HS256 aceitos pelo PostgREST.

### Fase 1 — Sessão assinada (identidade verificável) — *sem mudar comportamento ainda*
- [ ] Env server-only: `SUPABASE_JWT_SECRET`.
- [ ] Rota `POST /api/session/login`: recebe email/senha → `nf_login` (bcrypt via
      service role) → assina JWT com os claims acima (exp 8h) → devolve `{ token, user }`.
- [ ] `[slug]/page.tsx` e `cadastro` passam a chamar essa rota (login vira **um só caminho** — remove o `nf_login` inline e o `auth.ts login()` morto).
- [ ] `src/lib/supabase.ts`: cliente do navegador passa a anexar o token
      (`global.headers.Authorization = Bearer <token>`); recriar/atualizar o header
      no login, logout e troca de firma.
- [ ] **Nesta fase o RLS ainda está permissivo** → nada quebra; só passamos a
      mandar identidade em toda request. Deploy e valide o login normal.

### Fase 2 — RLS por tenant (o coração) — *validar 100% no branch de staging*
Substituir as policies `anon ... using(true)` por policies de `authenticated`
escopadas por `firm_id`, com bypass de super-admin. Template:

```sql
-- Helper de super-admin
create or replace function auth_is_super() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_super_admin')::boolean, false)
$$;

-- Tabelas COM firm_id (padrão)
alter policy ... ;  -- (drop das antigas anon)
create policy tenant_rw on <tabela>
  for all to authenticated
  using ( firm_id = (auth.jwt() ->> 'firm_id')::uuid or auth_is_super() )
  with check ( firm_id = (auth.jwt() ->> 'firm_id')::uuid or auth_is_super() );
```

Checklist por tabela (levantado do banco):

**Com `firm_id` (direto):** `nf_alerts`, `nf_assignments`, `nf_categories`,
`nf_chat_messages`, `nf_chat_sessions`, `nf_documents`, `nf_embeddings`,
`nf_firm_settings`*, `nf_roles`, `nf_training_paths`, `nf_user_progress`, `nf_users`.
> *`nf_firm_settings`: manter a coluna `openai_api_key` fora do alcance do cliente
> (já feito por grants de coluna); a policy de linha entra por cima.

**Sem `firm_id` (derivar por join):**
- `nf_comments`, `nf_document_permissions`, `nf_document_versions` → firma via
  `document_id → nf_documents.firm_id`.
- `nf_training_steps` → via `path_id → nf_training_paths.firm_id`.
- `nf_certificates` → via `user_id → nf_users.firm_id` (ou `path_id`).
- `nf_firms` → `id = (auth.jwt()->>'firm_id')::uuid or auth_is_super()` (super-admin lê todas).

Template para as derivadas:
```sql
create policy tenant_rw on nf_comments
  for all to authenticated
  using ( auth_is_super() or exists (
    select 1 from nf_documents d
    where d.id = nf_comments.document_id
      and d.firm_id = (auth.jwt() ->> 'firm_id')::uuid ) )
  with check ( ... mesma condição ... );
```

Passos:
- [ ] Escrever todas as policies como **migration versionada** (`supabase/migrations/`).
- [ ] Aplicar **no branch de staging**, rodar o app inteiro contra ele (todas as
      telas, cada papel), corrigir o que quebrar.
- [ ] Só então **merge do branch** para produção.

### Fase 3 — Impersonation seguro + auditoria (super-admin)
- [ ] `setActiveFirm` deixa de ser só localStorage: chama `POST /api/session/impersonate`
      que **verifica no servidor** que o chamador é super-admin e **reemite** um JWT
      com `firm_id` = firma alvo (mantendo `is_super_admin=true`).
- [ ] `resetFirm` reemite com a firma original.
- [ ] Tabela `nf_impersonation_log (super_user_id, firm_id, started_at)` + registro a cada entrada.

### Fase 4 — Produção e credenciais
- [x] **Build de produção validado localmente** (`npm run build` → 28 rotas, exit 0).
- [x] **Checklist de deploy pronto**: `docs/DEPLOY-VERCEL.md` (envs, ordem, smoke test).
- [x] Confirmado que TODAS as rotas `/api/*` que tocam tenant usam service role
      (`supabaseAdmin`); só `/api/session/login` usa anon (correto — chama `nf_login`).
- [x] Vercel: envs já configuradas no projeto `nexusflow` (prj_LmpZKTlYi6oBstQDhRkZIhBQbQhZ,
      team agencia316). Confirmado indiretamente pelo smoke test (login server-side OK).
- [x] **Deploy de produção feito** (2026-07-06) via `vercel deploy --prod` →
      `dpl_6UpFp4W9EFtLbBzTagko48sy7GKZ` READY, aliased em https://nexusflow-lake.vercel.app.
      Smoke test: home 200; `/api/session/login` 400 (sem body) e 401 (credencial falsa,
      prova `nf_login` conectando ao banco). Falta o smoke test manual de UI (login real).
- [ ] Cada firma cadastra a própria chave de IA em Configurações (já isolada no servidor).
- [ ] E-mail transacional (Resend) validado (alertas/onboarding).

### Fase 5 — Limpeza e pontas soltas
- [x] Remover código morto: `auth.ts login()` (já removido antes), `FIRM_ID` estático
      em `supabase.ts` e `getFirmId()` em `auth.ts` (eram órfãos). `tsc --noEmit` verde.
- [x] `configuracoes` → usa `useFirm().firmId` (reativo) em vez de `getFirmId()`.
- [ ] Revisar `/cadastro` e `/api/setup-firm` para criarem firma já no novo modelo.
- [ ] Afinar contraste do tema claro nos poucos pontos restantes (badges de status).

### Fase 6 — Prova de isolamento (critério de aceite do "100%")
- [x] Script de teste: com o **token da Firma A**, tentar `select`/`update`/`delete`
      em linhas da **Firma B** em cada tabela → **tem que falhar** (0 linhas / erro).
      → `scripts/prova-isolamento.mjs` (forja tokens via JWT secret, roda contra o
      banco real, não-destrutivo). **Resultado: 33/33 PASS, 0 FAIL** (leitura e
      escrita cruzadas nas 2 direções em todas as 18 tabelas + derivadas por join).
- [x] Repetir com super-admin → **tem que passar** (vê todas as firmas). Validado,
      inclusive com teste negativo (a detecção pega vazamento quando ele existe).
- [ ] Matriz E2E: cada papel (admin/editor/member) em cada firma + super-admin;
      permissões de documento; IA por firma; e-mail. *(pendente — E2E de UI)*
- [x] O núcleo do "100%" (barreira real no banco) está **provado**. Falta só a
      matriz E2E de UI/papéis e as Fases 4 (deploy Vercel) e 5 (limpeza).

> **Nota de auditoria (Fase 3):** a rota `/api/session/impersonate` do plano não foi
> criada — decisão consciente. O super-admin bypassa o RLS pelo claim `is_super_admin`
> **assinado no servidor** (impossível forjar sem o `SUPABASE_JWT_SECRET`), e a trilha
> fica em `nf_impersonation_log`. Ver `0004_rls_tenant_isolation.sql` (linhas 24-27).

---

## Estratégia de risco / rollback
- Tudo de banco é feito **primeiro no branch de staging** do Supabase; produção só
  recebe via merge depois de verde.
- As Fases 1 e 2 são separadas de propósito: primeiro passamos a **enviar** identidade
  (sem mudar regras), depois **passamos a exigir** — se algo quebra na 2, é só reverter
  a migration de policies (as antigas ficam guardadas na migration).
- Point-in-time recovery cobre qualquer engano em dados.

## Estimativa (grosseira)
| Fase | Esforço |
|---|---|
| 0 — rede de segurança | pequeno |
| 1 — sessão JWT | médio |
| 2 — RLS por tenant (18 tabelas) | médio/grande |
| 3 — impersonation + auditoria | pequeno/médio |
| 4 — produção/envs | pequeno |
| 5 — limpeza | pequeno |
| 6 — prova de isolamento | pequeno/médio |

## Sequência recomendada de execução
**0 → 1 (deploy e valida login) → 2 no staging (valida tudo) → merge → 3 → 4 → 5 → 6.**
Cada seta é um ponto seguro de parada.
