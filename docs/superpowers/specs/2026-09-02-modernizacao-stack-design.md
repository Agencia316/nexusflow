# Modernização do NexusFlow — Sub-projeto 1: Stack

**Data:** 2026-09-02
**Status:** aprovado pelo dono do produto (sessão de brainstorming)
**Escopo deste documento:** o primeiro dos quatro sub-projetos do programa de modernização.

## Contexto

O NexusFlow roda em Next.js 14.2 + React 18 + Tailwind 3.4, com ESLint 8 e config
legada (`.eslintrc.json`). Não existe suíte de testes automatizados; a única
verificação é o script `scripts/prova-isolamento.mjs` (isolamento por tenant).

O programa de modernização foi decomposto em quatro sub-projetos, nesta ordem:

1. **Stack** (este documento): Next 16, React 19, Tailwind 4, ESLint 10.
2. **Arquitetura e segurança**: sessão em cookie httpOnly, guarda de rota no
   servidor, Server Components.
3. **Visual**: shadcn/ui como base de componentes, refazer telas.
4. **Funcionalidades / IA**: brainstorm separado.

A stack vai primeiro porque tudo o que vem depois usa as APIs novas e porque o
shadcn/ui atual é feito para Tailwind 4. Cada sub-projeto tem sua própria spec.

## Objetivo

Levar o projeto às versões atuais das ferramentas de base **sem nenhuma mudança
de comportamento visível ao usuário**, com uma rede de segurança automatizada
que prove isso a cada etapa.

## Não-objetivos (de propósito)

- Ligar o React Compiler.
- Migrar fontes de `<link>` do Google para `next/font` (muda renderização; PR próprio).
- Mudar `strict: false` no `tsconfig.json`.
- Subir para TypeScript 7 (o Next 16 exige só 5.1+; o ecossistema de lint ainda
  está se ajustando ao compilador novo). Fica no 5.x mais recente.
- Adotar `cacheComponents` / PPR.
- Qualquer refatoração de páginas, autenticação ou visual.

## Estratégia: três PRs em sequência

Cada PR passa pela mesma verificação, vai para produção sozinho, e o seguinte só
começa quando o anterior estiver no ar. Se algo regredir, sabemos qual camada.

### PR 1 — Rede de segurança (smoke tests em Playwright)

**Por quê:** não há testes. Um upgrade de duas versões maiores sem verificação
automatizada depende só de clique manual. Já existe um roteiro manual em
`docs/QA-MATRIZ-E2E.md`; esta suíte automatiza os itens 1.1 e 1.2 dele e a
passada pelas rotas. O restante da matriz (papéis, permissões, super-admin)
continua manual e é executado no preview de cada PR.

**O que entra:**

- `@playwright/test` como devDependency; `playwright.config.ts` sobe o app
  (`next dev`) e aponta `baseURL` para ele.
- Testes em `tests/smoke/`, dois grupos:
  - **Sem credencial** (rodam em qualquer ambiente, inclusive CI com envs
    placeholder):
    - `/` renderiza a landing (marca visível, botão de entrar).
    - `/app/dashboard` sem sessão redireciona para `/`.
    - `/pillar` no deploy principal redireciona para `/` (comportamento do proxy).
    - `POST /api/chat` sem token responde 401.
  - **Com credencial** (pulam automaticamente se `E2E_SLUG`, `E2E_EMAIL`,
    `E2E_PASSWORD` não estiverem definidas):
    - Login pela rota `/{slug}` termina em `/app/dashboard`.
    - Cada uma das rotas `/app/*` abre sem erro de aplicação e renderiza um
      título. Rotas: dashboard, docs, chat, training, templates, ferramentas,
      orcamentos, team, permissoes, alertas, reports, configuracoes, conta.
- Script `npm run test:e2e`.
- CI (`.github/workflows/ci.yml`): Node 20 → 24; novo passo `test:e2e` depois do
  build. No CI só o grupo sem credencial roda.
- As envs `E2E_*` ficam no `.env.local` do desenvolvedor (já no `.gitignore`),
  usando a conta admin Climadek já existente.

**Fora:** testes unitários, cobertura, screenshots versionados no repositório
(dependem de fonte/OS e gerariam ruído).

### PR 2 — Next 16 + React 19 + ESLint 10 + dependências

**Fatos verificados nos guias oficiais (16.3.4, atualizados em 2026-08-25):**

- Next 16 exige React 19, Node 20.9+, TypeScript 5.1+.
- `next lint` foi removido; o `eslint` do `next.config` também. Lint passa a ser
  a CLI do ESLint com config flat.
- `middleware.ts` está deprecado em favor de `proxy.ts` (runtime Node, único).
  O projeto não usa runtime edge, então a troca é segura.
- Turbopack é o bundler padrão em `dev` e `build`. Não há config `webpack`
  custom no projeto.
- APIs de request (`cookies`, `headers`, `params`, `searchParams`) são
  obrigatoriamente assíncronas. O código atual não as usa no servidor
  (`params` só via `useParams` no cliente; `searchParams` só via
  `req.nextUrl` em route handler), então não há migração aqui.
- `experimental.outputFileTracingIncludes` virou top-level
  `outputFileTracingIncludes` (mudança do 15).
- `fetch` e `GET` em route handlers deixaram de ser cacheados por padrão no 15.
  O projeto não depende de cache implícito (tudo é dinâmico por sessão).

**Passos:**

1. `npx @next/codemod@canary upgrade latest` — instala Next 16 / React 19 /
   tipos, renomeia `middleware` → `proxy`, gera `eslint.config.mjs`, ajusta
   `next.config.js`.
2. Ajuste manual do `next.config.js`: mover `outputFileTracingIncludes` para o
   topo; remover `experimental` vazio.
3. `package.json`: `lint` → `eslint .`; manter `dev`/`build` sem flags.
4. Subir dependências menores para as versões atuais publicadas:
   `@supabase/supabase-js` 2.114, `lucide-react` 1.x (40 ícones em uso, todos
   com nome padrão), `react-markdown` 10 (uso básico: `remarkPlugins` apenas),
   `remark-gfm` 4.0.1, `@anthropic-ai/sdk` 0.123, `eslint` 10,
   `eslint-config-next` 16, `typescript` 5.x mais recente, `@types/*`.
5. Corrigir o que `typecheck`/`lint` apontarem (React 19 tipa `useRef` sem
   argumento como erro; `JSX` global virou `React.JSX`).
6. Atualizar o comentário do `proxy.ts` e o `AGENTS.md` (o Next 16 gera um bloco
   apontando para os docs em `node_modules/next/dist/docs/`).

**Verificação:** `npm run typecheck`, `npm run lint`, `npm run build`,
`npm run test:e2e` (com credencial, local), preview na Vercel aberto e testado
manualmente (login, chat com IA, gerar proposta solar) antes do merge.

### PR 3 — Tailwind 4

**Fatos verificados no guia oficial de upgrade:**

- Plugin PostCSS vira `@tailwindcss/postcss`; `@tailwind base/components/
  utilities` vira `@import "tailwindcss"`.
- Config em CSS (`@theme`); `tailwind.config.js` só funciona com `@config`
  explícito. Vamos eliminar o arquivo.
- Renomes que atingem o projeto: `outline-none` → `outline-hidden` (68 usos),
  `shadow` → `shadow-sm` (9 usos). `ring` não é usado.
- Cor padrão de `border` passou de `gray-200` para `currentColor`; a ferramenta
  de upgrade insere uma camada de compatibilidade.
- Modificadores de opacidade (`bg-slate-900/50`) funcionam com cores definidas
  como `rgb(var(--x))` porque o v4 resolve via `color-mix()`.

**Passos:**

1. `npx @tailwindcss/upgrade` — deps, `postcss.config.js`, import, renomes de
   classe, posição do `!`.
2. Reescrever à mão o motor de tema em `globals.css`:
   - `@theme inline { --color-white: rgb(var(--c-white)); --color-slate-50:
     rgb(var(--c-slate-50)); … --color-slate-950; --color-brand-dark;
     --color-brand-gold; --color-brand-gold-light; --font-sans; --font-mono }`.
     `inline` é obrigatório para que as utilities leiam as variáveis
     `--c-slate-*` em tempo de execução (é assim que o tema troca).
   - O `darkMode: ['selector', …]` da config atual **não** ganha substituto:
     nenhum arquivo usa o variante `dark:` (verificado por grep). O tema
     funciona só pela troca das variáveis `--c-*`.
   - Os blocos `:root`, `@media (prefers-color-scheme: light)`,
     `[data-theme='light'|'dark']`, `.badge-*`, `.prose-nexus` e scrollbar
     continuam iguais. `@apply` segue funcionando no arquivo principal.
3. Apagar `tailwind.config.js`.

**Verificação:** além de typecheck/lint/build/smoke, capturas de tela das telas
principais (landing, login por slug, dashboard, docs, chat, orçamentos,
configurações) nos dois temas, antes e depois, comparadas lado a lado e mostradas
ao dono do produto. Critério de aceite: nenhuma diferença visual perceptível.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Codemod do Next não cobre algo e o build quebra | Codebase pequeno (60 arquivos); typecheck + build apontam o resto. |
| `lucide-react` 1.x renomeou algum ícone | Typecheck falha no import; troca pontual. |
| Tema claro/escuro regride no Tailwind 4 | Screenshots antes/depois nos dois temas; `@theme inline` testado na landing antes de seguir. |
| Turbopack trata `private/**` (HTML do Pillar) diferente do Webpack | O teste sem credencial de `/pillar` + verificação manual da rota `/api/pillar/dashboard` no preview. |
| Preview da Vercel sem `SUPABASE_JWT_SECRET` | Já diagnosticável: login falha cedo com erro claro (PR #11). |

## Critérios de conclusão do sub-projeto

- Os três PRs mergeados e em produção em `nexusflow-lake.vercel.app`.
- `npm run test:e2e` verde local (com credencial) e no CI (sem credencial).
- Nenhuma diferença visual perceptível nas telas comparadas.
- Deploy branded Campos Pillar (`/pillar`) continua funcionando.

## Próximo passo

Depois do PR 3 no ar: brainstorm e spec do sub-projeto 2 (arquitetura e
segurança).
