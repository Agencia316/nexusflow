# Matriz E2E de UI por papel — roteiro de QA manual

> O isolamento **por firma** (o crítico de segurança) já é provado automaticamente
> por `scripts/prova-isolamento.mjs` (33/33). Este roteiro cobre o que só a UI valida:
> a jornada de cada papel e as permissões de documento (cargo + individual), que são
> aplicadas na camada da aplicação.
>
> Rodar em https://nexusflow-lake.vercel.app (ou `/<slug>` da firma). ~15 min.
> Marque cada linha: ✅ passou · ❌ falhou (anote o quê).

## Pré-requisitos
- 2 firmas com dados (ex.: Campos Pillar / Climadek).
- 1 usuário por papel em uma firma: **admin**, **editor**, **member**.
- 1 **super-admin** (Três16).
- Um documento restrito a um cargo específico e um com permissão individual, para testar a granularidade.

## 1. Sessão e isolamento (todos os papéis)
| # | Passo | Esperado |
|---|-------|----------|
| 1.1 | Abrir `/<slug>` da firma sem login | Marca (nome/cor) carrega **antes** do login |
| 1.2 | Login com usuário da Firma A | Cai no dashboard com dados **só da Firma A** |
| 1.3 | No DevTools → Application → localStorage | Existe `nf_token` (JWT). Sem ele o RLS bloquearia tudo |
| 1.4 | Deixar a aba aberta > exp do token (ou apagar `nf_token`) | App força novo login (auto-relogin), não mostra tela quebrada |
| 1.5 | Logout | `nf_token`, `nf_user`, `nf_firm_id` limpos do localStorage |

## 2. Papel ADMIN
| # | Passo | Esperado |
|---|-------|----------|
| 2.1 | Menu lateral | Vê **Admin**, **Configurações**, **Permissões**, **Team** |
| 2.2 | Configurações → salvar chave de IA da firma | Salva; a chave **nunca** volta ao cliente (campo fica mascarado) |
| 2.3 | Chat/IA | Responde usando a chave **daquela** firma |
| 2.4 | Criar documento e publicar | Aparece com badge **Publicado** (verde, legível no claro e escuro) |
| 2.5 | Permissões → restringir doc a um cargo | Salva a restrição |

## 3. Papel EDITOR
| # | Passo | Esperado |
|---|-------|----------|
| 3.1 | Menu lateral | **Não** vê Admin/Configurações/Permissões |
| 3.2 | Editar um documento | Consegue editar/salvar |
| 3.3 | Abrir doc restrito a cargo que ele **não** tem | Não aparece na lista / acesso negado |

## 4. Papel MEMBER
| # | Passo | Esperado |
|---|-------|----------|
| 4.1 | Menu lateral | Só leitura/treinamento; sem edição nem admin |
| 4.2 | Trilha de treinamento → ler doc + responder quiz | Avança de etapa; progresso salvo |
| 4.3 | Concluir trilha | Gera certificado |
| 4.4 | Doc com permissão **individual** concedida a ele | Aparece; um doc não concedido **não** aparece |

## 5. SUPER-ADMIN (Três16)
| # | Passo | Esperado |
|---|-------|----------|
| 5.1 | Login | Vê o **seletor de firmas** |
| 5.2 | "Entrar como cliente" na Firma B | Dashboard passa a mostrar dados da Firma B |
| 5.3 | Voltar (resetFirm) | Volta à firma original |
| 5.4 | Conferir `nf_impersonation_log` no banco | Há registro (super_user_id, firm_id) da entrada em 5.2 |

## 6. E-mail transacional (se Resend configurado)
| # | Passo | Esperado |
|---|-------|----------|
| 6.1 | Disparar um alerta / onboarding | E-mail chega (checar Resend → Logs) |

## 7. Cadastro de nova firma (fluxo corrigido)
| # | Passo | Esperado |
|---|-------|----------|
| 7.1 | `/cadastro` → criar firma nova → "Acessar minha empresa" | Entra **já com dados** (categorias/docs/trilhas) — **não** dashboard vazio |
| 7.2 | localStorage após 7.1 | `nf_token` presente (auto-login pelo caminho único) |

---
**Critério de "100%"**: seções 1–5 todas ✅. 6 e 7 conforme uso. Qualquer ❌ vira issue.
