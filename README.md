# NexusFlow — SaaS de Gestão de Conhecimento e Treinamento com IA

Plataforma multi-tenant para gestão de conhecimento interno, treinamento de equipes e assistente de IA por empresa. Desenvolvido pela Três16 para Campos Pillar Advocacia e Climadek Energia Solar.

## Stack

- **Frontend:** Next.js 14 App Router + TypeScript + Tailwind CSS
- **Banco:** Supabase (PostgreSQL) — projeto `bysrqusnzspphqxxqurm` (sa-east-1)
- **IA:** OpenAI API (GPT-4o / GPT-4o-mini) — chave por empresa
- **Deploy:** Vercel — `nexusflow-plataforma.vercel.app`
- **Auth:** Bcrypt via pgcrypto — sessão de 8h no localStorage

## Estrutura de pastas

```
src/
├── app/
│   ├── [slug]/page.tsx          # Login dinâmico por empresa
│   ├── cadastro/page.tsx        # Cadastro público de nova empresa
│   ├── api/
│   │   ├── chat/route.ts        # DocuChat com RAG
│   │   ├── generate-doc/route.ts # Geração de docs com IA
│   │   ├── generate-quiz/route.ts # Quiz automático por IA
│   │   ├── import-doc/route.ts  # Importação de arquivos
│   │   ├── search/route.ts      # Busca semântica TF-IDF + IA
│   │   ├── notify/route.ts      # Alertas internos
│   │   ├── register/route.ts    # Cadastro de empresa
│   │   ├── setup-firm/route.ts  # Seed automático por segmento
│   │   └── test-ai/route.ts     # Teste de chave OpenAI
│   └── app/                     # Área autenticada
│       ├── dashboard/           # KPIs + alertas + progresso
│       ├── docs/                # Base de conhecimento
│       ├── chat/                # DocuChat (IA)
│       ├── training/            # Trilhas de treinamento
│       ├── ferramentas/         # Base Jurídica + Calculadora INSS
│       ├── templates/           # Modelos de documentos
│       ├── reports/             # Relatórios de progresso
│       ├── team/                # Gestão de equipe
│       ├── alertas/             # Notificações
│       ├── permissoes/          # Controle de acesso
│       └── configuracoes/       # Configurações da empresa
├── components/
│   └── Sidebar.tsx              # Navegação lateral
└── lib/
    ├── auth.ts                  # Login, sessão, logout
    └── supabase.ts              # Cliente Supabase + FIRM_ID dinâmico
public/
└── ferramentas/
    ├── juridico.html            # Base Jurídica standalone
    └── calculadora.html         # Calculadora Auxílio-Acidente INSS
```

## Empresas cadastradas

| Empresa | Slug | Segmento | Plano |
|---|---|---|---|
| Campos Pillar Advocacia | campos-pillar | advocacia | pro |
| Climadek Energia Solar | climadek | solar | trial |

## Usuários Campos Pillar

| Nome | E-mail | Role | Cargo |
|---|---|---|---|
| Will (Três16) | will@tres16.com.br | admin | Gestor Operacional |
| Dr. Diego Campos Pillar | diego@campospillar.adv.br | admin | Advogado Responsável |
| Alizandra | alizandra@campospillar.adv.br | editor | Closer e Documentação |
| Bruna | bruna@campospillar.adv.br | member | SDR de Captação |
| Jocelito | jocelito@campospillar.com.br | member | SDR de Qualificação |

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | ✅ | URL do projeto Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✅ | Chave anon do Supabase |
| OPENAI_API_KEY | ✅ | Chave global de fallback OpenAI |
| NEXT_PUBLIC_FIRM_ID | ✅ | UUID da firma padrão (fallback) |
| RESEND_API_KEY | ⬜ | E-mail transacional (opcional) |

## Rodando localmente

```bash
npm install
cp .env.example .env.local
# preencher .env.local com as credenciais
npm run dev
```

Acesse: http://localhost:3000/campos-pillar

## Deploy

Deploy automático via Vercel ao fazer push na branch `main`.

```bash
git push origin main
```

## Schema do banco (prefixo nf_)

| Tabela | Função |
|---|---|
| nf_firms | Empresas cadastradas |
| nf_firm_settings | Configurações de IA, chat, marca por empresa |
| nf_users | Usuários com bcrypt |
| nf_roles | Cargos personalizados por empresa/segmento |
| nf_categories | Categorias de documentos |
| nf_documents | Base de conhecimento (status: draft/published/archived/template) |
| nf_document_versions | Histórico de versões |
| nf_document_permissions | Permissões por usuário |
| nf_training_paths | Trilhas de treinamento |
| nf_training_steps | Etapas das trilhas |
| nf_user_progress | Progresso por usuário/etapa |
| nf_certificates | Certificados de conclusão |
| nf_assignments | Atribuições de trilha por usuário |
| nf_alerts | Notificações internas |
| nf_chat_messages | Histórico do DocuChat |
| nf_chat_sessions | Sessões de chat |
| nf_comments | Comentários em documentos |
| nf_embeddings | Embeddings para busca semântica |

## Funções SQL principais

| Função | Descrição |
|---|---|
| nf_login(email, password) | Login com bcrypt, retorna dados do usuário |
| nf_update_password(user_id, password) | Atualiza senha com bcrypt |
| nf_create_user(firm_id, name, email, password, role, job_role_id) | Cria usuário com bcrypt |
| nf_create_firm(slug, name, segment, admin_name, admin_email, admin_password) | Cria empresa em transação |

## Próximas features planejadas

- [ ] Painel super-admin (Três16) — ver e gerenciar todos os clientes
- [ ] FIRM_ID dinâmico via React context (corrigir bug multi-tenant)
- [ ] firmContext dinâmico na geração de IA (atualmente hardcoded)
- [ ] Reports com tabela por usuário + export CSV
- [ ] Stripe para cobrança de mensalidade
- [ ] Subdomínio por cliente (campos-pillar.nexusflow.com.br)
- [ ] E-mail transacional via Resend
- [ ] pgvector para busca semântica real

## Contato

Desenvolvido por **Will — Três16** | will@tres16.com.br
