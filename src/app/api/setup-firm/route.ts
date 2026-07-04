import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Seed de categorias por segmento
const CATEGORIES: Record<string, any[]> = {
  advocacia: [
    { name: 'Processos Operacionais', icon: '⚙️', color: '#3b82f6', sort_order: 1 },
    { name: 'Scripts de Atendimento', icon: '💬', color: '#10b981', sort_order: 2 },
    { name: 'Jurídico', icon: '⚖️', color: '#8b5cf6', sort_order: 3 },
    { name: 'Políticas Internas', icon: '📋', color: '#f59e0b', sort_order: 4 },
    { name: 'Onboarding', icon: '🎓', color: '#ef4444', sort_order: 5 },
  ],
  solar: [
    { name: 'Processos de Venda', icon: '💰', color: '#f59e0b', sort_order: 1 },
    { name: 'Instalação Técnica', icon: '🔧', color: '#3b82f6', sort_order: 2 },
    { name: 'Documentação e Projetos', icon: '📐', color: '#8b5cf6', sort_order: 3 },
    { name: 'Políticas e RH', icon: '📋', color: '#10b981', sort_order: 4 },
    { name: 'Onboarding', icon: '🎓', color: '#ef4444', sort_order: 5 },
  ],
}

// Documentos por segmento
const DOCS: Record<string, any[]> = {
  advocacia: [
    {
      cat: 0, title: 'Fluxo Operacional — Captação ao Protocolo INSS',
      tags: ['fluxo','operacional','captação'],
      requires_reading: true,
      content: `# Fluxo Operacional — Auxílio-Acidente\n\n## Etapa 1 — Captação (SDR de Captação)\n- Lead chega via tráfego pago\n- Primeiro contato em até 5 minutos\n- Qualificação inicial: acidente? sequela? INSS?\n- Se qualificado: encaminha para SDR de Qualificação\n\n## Etapa 2 — Qualificação Jurídica (SDR de Qualificação)\n- Verificar critérios J1–J5\n- J1: Qualidade de segurado\n- J2: Acidente de qualquer natureza\n- J3: Sequela permanente\n- J4: Não aposentado por invalidez pelo mesmo acidente\n- J5: Dentro do prazo de 5 anos\n- Se aprovado: encaminha para Closer\n\n## Etapa 3 — Documentação (Closer)\n- Solicitar documentos via checklist\n- Montar dossiê completo\n- Enviar ao Advogado Responsável\n\n## Etapa 4 — Análise e Contrato (Advogado Responsável)\n- Confirmar viabilidade\n- Calcular valor estimado\n- Assinar contrato com cliente\n\n## Etapa 5 — Protocolo INSS / Ação Judicial\n- Advogado conduz o processo jurídico\n- Gestor acompanha via dashboard`,
    },
    {
      cat: 1, title: 'Script de Primeiro Contato — WhatsApp',
      tags: ['script','whatsapp','captação'],
      requires_reading: true,
      content: `# Script de Primeiro Contato — WhatsApp\n\n## Abertura (até 5 min após lead entrar)\n\n> "Olá, [Nome]! Aqui é da [Escritório]. Vi que você tem interesse em verificar seu direito ao Auxílio-Acidente INSS. Posso te fazer 3 perguntas rápidas?"\n\n## Perguntas de Qualificação\n1. Você sofreu algum acidente (trabalho, trânsito, queda)?\n2. Ficou com alguma sequela permanente?\n3. Contribui ou contribuía para o INSS?\n\n## Se qualificado\n> "Ótimo! Você pode ter direito a um benefício mensal vitalício do INSS. Vou conectar você com nossa especialista. Posso agendar?"\n\n## Objeções\n\n**"Já faz muito tempo"** → O prazo é de 5 anos. Dentro desse período ainda tem direito.\n\n**"Já recebi do INSS"** → Auxílio-acidente é diferente do auxílio-doença. São cumuláveis.\n\n**"Vou pensar"** → A avaliação é gratuita. Só paga se ganhar (honorários de êxito).`,
    },
    {
      cat: 2, title: 'Qualificação Jurídica — Critérios J1 a J5',
      tags: ['jurídico','qualificação','b36','b94'],
      requires_reading: true,
      content: `# Qualificação Jurídica — Critérios J1 a J5\n\n## Valores 2026\n- Benefício: 50% do salário de benefício\n- Piso: R$ 810,50 | Teto: R$ 4.237,78\n- Duração: Vitalício até aposentadoria | Carência: Zero\n\n## Critério J1 — Qualidade de Segurado\nCLT, autônomo contribuinte, MEI, rural, doméstico.\nPeríodo de graça: 12 a 36 meses após última contribuição.\n\n## Critério J2 — Tipo de Acidente\n- B-36: acidente de qualquer natureza (sem CAT)\n- B-94: acidente de trabalho ou doença ocupacional (com CAT)\n\n## Critério J3 — Sequela Permanente\nDeve reduzir a capacidade para o trabalho habitual. Redução parcial já qualifica.\n\n## Critério J4 — Não Aposentado por Invalidez\nSe já aposentado por invalidez pelo mesmo acidente, não qualifica.\n\n## Critério J5 — Prescrição\nPrazo: 5 anos da data do acidente (Súmula 85 STJ).`,
    },
    {
      cat: 2, title: 'Checklist de Documentação — B-36 e B-94',
      tags: ['documentação','checklist','inss'],
      requires_reading: false,
      content: `# Checklist de Documentação\n\n## Documentos Universais\n- [ ] RG ou CNH (frente e verso)\n- [ ] CPF\n- [ ] Comprovante de residência (últimos 3 meses)\n- [ ] Extrato CNIS (app Meu INSS ou tel. 135)\n\n## B-36 — Acidente Não-Laboral\n- [ ] Laudo médico com CID e sequela descrita 🔴 Bloqueante\n- [ ] Exames de imagem com laudo do radiologista\n- [ ] Prontuário hospitalar do atendimento\n- [ ] Boletim de Ocorrência (se trânsito)\n\n## B-94 — Acidente de Trabalho\n- [ ] CAT — Comunicação de Acidente de Trabalho 🔴 Bloqueante\n- [ ] PPP — Perfil Profissiográfico Previdenciário 🔴 Bloqueante\n- [ ] Laudo médico com CID 🔴 Bloqueante\n- [ ] CTPS — Carteira de Trabalho\n\n## Dicas\n- Laudo sem CID: pedir ao médico que refaça\n- CAT não emitida: substituir por BO + prontuário + testemunhas\n- PPP: empregador tem 15 dias para fornecer`,
    },
    {
      cat: 3, title: 'Política de Honorários — Êxito Previdenciário',
      tags: ['honorários','política'],
      requires_reading: true, requires_signature: true,
      content: `# Política de Honorários\n\n## Modelo: Exclusivamente Êxito\nO cliente não paga nada antecipado. Honorários são cobrados apenas com resultado positivo.\n\n## Percentual\n30% sobre o valor total recebido (retroativo + 12 parcelas futuras).\n\n## O que está incluído\n- Análise de viabilidade (gratuita)\n- Instrução documental\n- Protocolo ou ajuizamento\n- Acompanhamento até recebimento\n\n## Repasse\n- Data: todo dia 10 do mês\n- Base: receita líquida do mês anterior`,
    },
    {
      cat: 4, title: 'Onboarding — SDR de Captação',
      tags: ['onboarding','captação','treinamento'],
      requires_reading: true,
      content: `# Onboarding — SDR de Captação\n\n## Bem-vindo(a)!\nSeu papel é o primeiro contato com o lead. Velocidade e empatia são fundamentais.\n\n## Sua missão\n1. Atender em até 5 minutos após o lead entrar\n2. Fazer as 3 perguntas de qualificação\n3. Encaminhar qualificados para o SDR de Qualificação\n\n## Leia nesta ordem\n1. 📄 Fluxo Operacional — entenda o processo completo\n2. 📄 Script de Primeiro Contato — aprenda o roteiro\n3. 📄 Qualificação Jurídica — entenda o produto\n\n## Metas\n- 100% dos leads atendidos no mesmo dia\n- Tempo de primeira resposta: < 5 minutos\n- Taxa de qualificação: ≥ 25%`,
    },
  ],

  solar: [
    {
      cat: 0, title: 'Fluxo Completo de Vendas — Energia Solar',
      tags: ['fluxo','vendas','solar'],
      requires_reading: true,
      content: `# Fluxo Completo de Vendas — Energia Solar\n\n## Etapa 1 — Captação\n- Lead chega via tráfego pago, indicação ou prospecção ativa\n- Primeiro contato em até 15 minutos\n- Qualificação: tipo de imóvel, conta de luz, forma de pagamento\n- Se qualificado: agendar visita técnica\n\n## Etapa 2 — Visita Técnica\n- Consultor vai ao local\n- Avalia: telhado, orientação, sombreamento, estrutura\n- Coleta conta de luz dos últimos 12 meses\n- Faz proposta técnica personalizada\n\n## Etapa 3 — Proposta e Fechamento\n- Apresentar: sistema, produção, economia, payback\n- Tratar objeções\n- Assinar contrato e cobrar entrada (se houver)\n\n## Etapa 4 — Projeto e Aprovação\n- Engenheiro elabora projeto elétrico\n- ART emitida\n- Protocolo na concessionária (prazo: 15–45 dias)\n\n## Etapa 5 — Instalação\n- Equipe técnica instala o sistema\n- Duração: 1 a 3 dias\n- Vistoria da concessionária\n\n## Etapa 6 — Pós-Venda\n- Acompanhamento da energização\n- Treinamento do cliente no app de monitoramento\n- Retorno em 30 dias para verificação`,
    },
    {
      cat: 0, title: 'Script de Abordagem — Primeiro Contato Solar',
      tags: ['script','captação','solar'],
      requires_reading: true,
      content: `# Script de Primeiro Contato — Energia Solar\n\n## Abertura (até 15 min após lead entrar)\n\n> "Olá, [Nome]! Aqui é da [Empresa]. Vi que você tem interesse em energia solar. Posso fazer algumas perguntas rápidas para verificar se faz sentido para o seu caso?"\n\n## Perguntas de Qualificação\n1. Qual é o valor médio da sua conta de luz por mês?\n2. É residência ou empresa?\n3. O imóvel é próprio ou alugado?\n4. Tem preferência por pagamento à vista ou financiado?\n\n## Perfis de qualificação\n- Conta ≥ R$200/mês: forte candidato\n- Imóvel próprio: ideal para instalação\n- À vista ou financiamento: ambos funcionam\n\n## Se qualificado\n> "Perfeito! Com esse consumo você pode economizar entre [X]% e [Y]% na conta todo mês. Quero te mostrar os números exatos. Posso agendar uma visita técnica gratuita?"\n\n## Objeções comuns\n\n**"É muito caro"**\n> Com financiamento a parcela fica menor que a economia mensal. É custo zero ou até lucro desde o primeiro mês.\n\n**"Minha conta é pequena"**\n> Com conta acima de R$200 já compensa. Vamos calcular o retorno específico para o seu caso.\n\n**"Vou pensar"**\n> Claro! A visita é gratuita e sem compromisso. Posso ligar amanhã para agendarmos?`,
    },
    {
      cat: 1, title: 'Checklist de Visita Técnica',
      tags: ['técnico','visita','instalação'],
      requires_reading: true,
      content: `# Checklist de Visita Técnica\n\n## Documentos para levar\n- [ ] Tablet ou laptop para apresentação da proposta\n- [ ] Trena ou medidor a laser\n- [ ] Câmera (ou celular com boa câmera)\n- [ ] Bússola (ou app de bússola)\n- [ ] Material da empresa (folder, cartão)\n\n## Avaliação do telhado\n- [ ] Orientação: Norte é ideal no Brasil / Sul é ineficiente\n- [ ] Inclinação: 15° a 25° é o ideal\n- [ ] Sombreamento: checar árvores, construções vizinhas, caixa d'água\n- [ ] Tipo de telha: cerâmica, metálica, fibrocimento, laje\n- [ ] Estrutura: verificar integridade (sem rachaduras ou folgas)\n- [ ] Área disponível: medir espaço útil para os painéis\n- [ ] Acesso para manutenção: escada ou trapeira disponível?\n\n## Elétrica\n- [ ] Localização do quadro de distribuição\n- [ ] Padrão de entrada da concessionária (monofásico/bifásico/trifásico)\n- [ ] Espaço para o inversor (local seco, ventilado, sombra)\n- [ ] Distância quadro → local do inversor\n\n## Coleta de dados\n- [ ] Conta de luz dos últimos 12 meses (foto ou valor médio)\n- [ ] CPF e dados do titular da conta de energia\n- [ ] Contato do responsável pela instalação (se diferente)\n\n## Fotos obrigatórias\n- [ ] Vista geral do telhado\n- [ ] Local de instalação dos painéis\n- [ ] Quadro elétrico\n- [ ] Padrão de entrada (relógio/medidor)\n- [ ] Local do inversor`,
    },
    {
      cat: 1, title: 'Processo de Instalação — Passo a Passo',
      tags: ['instalação','técnico','processo'],
      requires_reading: true,
      content: `# Processo de Instalação — Energia Solar\n\n## Cronograma de Entregas\n\n| Etapa | Prazo |\n|---|---|\n| Projeto elétrico + ART | Até 5 dias após contrato |\n| Protocolo na concessionária | Até 7 dias após projeto |\n| Aprovação da concessionária | 15–45 dias |\n| Compra de equipamentos | 5–10 dias após aprovação |\n| Instalação | 1–3 dias |\n| Vistoria da concessionária | 15–30 dias após instalação |\n| Energização | No dia da vistoria |\n\n## Instalação — Ordem de execução\n\n### Dia 1\n1. Instalar estrutura de fixação (trilhos/suportes)\n2. Montar os painéis fotovoltaicos\n3. Conexão dos strings (série/paralelo conforme projeto)\n\n### Dia 2\n4. Instalar inversor no local definido\n5. Passar cabeamento CC (painéis → inversor)\n6. Passar cabeamento CA (inversor → quadro)\n7. Instalar dispositivos de proteção (DPS, disjuntores)\n\n### Finalização\n8. Ligar sistema e verificar operação\n9. Configurar monitoramento remoto\n10. Registrar fotos de toda a instalação\n11. Preencher laudo técnico\n\n## Documentação pós-instalação\n- [ ] Fotos de toda a instalação\n- [ ] Laudo técnico assinado\n- [ ] Manual do sistema entregue ao cliente\n- [ ] App de monitoramento configurado\n- [ ] Solicitação de vistoria protocolada`,
    },
    {
      cat: 2, title: 'Documentação do Projeto Elétrico',
      tags: ['projeto','documentação','concessionária'],
      requires_reading: false,
      content: `# Documentação do Projeto Elétrico\n\n## Documentos necessários para protocolo na concessionária\n\n### Do cliente\n- [ ] RG ou CNH do titular da unidade consumidora\n- [ ] CPF do titular\n- [ ] Conta de energia recente\n- [ ] Escritura ou contrato de aluguel do imóvel\n\n### Técnicos\n- [ ] ART do engenheiro responsável\n- [ ] Projeto elétrico (unifilar + memorial descritivo)\n- [ ] Especificações dos equipamentos (datasheet dos painéis e inversor)\n- [ ] Nota fiscal dos equipamentos\n- [ ] Formulário da concessionária preenchido\n\n## Normas aplicáveis\n- ABNT NBR 16149: instalação de sistemas fotovoltaicos\n- ABNT NBR 16274: desempenho de sistemas fotovoltaicos\n- Resolução ANEEL 482/2012 e 687/2015 (microgeração)\n- REN 1000/2021 (nova regulamentação ANEEL)\n\n## Prazos legais\n- Concessionária tem 30 dias para análise do projeto\n- Após aprovação: 30 dias para vistoria\n- Após vistoria aprovada: 7 dias para troca do medidor\n\n## Exigências comuns que geram reprovação\n- ART sem anotação no CREA\n- Especificação de equipamentos divergente do instalado\n- Potência total acima do permitido sem parecer técnico\n- Falta de DPS (dispositivo de proteção contra surtos)`,
    },
    {
      cat: 3, title: 'Política de Garantia e Pós-Venda',
      tags: ['garantia','pós-venda','política'],
      requires_reading: true, requires_signature: true,
      content: `# Política de Garantia e Pós-Venda\n\n## Garantias do Sistema\n\n| Item | Garantia de Produto | Garantia de Desempenho |\n|---|---|---|\n| Painéis fotovoltaicos | 10–12 anos | 25–30 anos (≥80% da potência nominal) |\n| Inversor string | 5–10 anos | — |\n| Microinversor | 10–25 anos | — |\n| Estrutura de fixação | 10 anos | — |\n| Mão de obra / instalação | 1 ano | — |\n\n## O que cobre a garantia\n- Defeitos de fabricação\n- Falha prematura sem causa externa\n- Queda de desempenho abaixo do especificado\n\n## O que NÃO cobre\n- Danos por raio, granizo, incêndio (seguro patrimonial)\n- Vandalismo ou roubo\n- Manutenção inadequada (sujeira, sombreamento não informado)\n- Modificações feitas sem nossa autorização\n\n## Protocolo de Acionamento\n1. Cliente abre chamado via WhatsApp ou e-mail\n2. Técnico analisa remotamente (monitoramento)\n3. Se necessário: visita técnica em até 72h úteis\n4. Peças com defeito: substituídas sem custo dentro da garantia\n\n## Manutenção Preventiva Recomendada\n- Limpeza dos painéis: a cada 6 meses (seco) ou 3 meses (muita poeira)\n- Inspeção visual: anual\n- Verificação elétrica: a cada 2 anos`,
    },
    {
      cat: 3, title: 'Política Interna — Código de Conduta',
      tags: ['conduta','política','rh'],
      requires_reading: true, requires_signature: true,
      content: `# Código de Conduta\n\n## Valores da Empresa\n1. **Honestidade** — Nunca prometer economia ou geração que o sistema não pode entregar\n2. **Qualidade técnica** — Instalações dentro das normas ABNT, sem atalhos\n3. **Respeito** — Ao cliente, ao imóvel e à equipe\n4. **Comprometimento** — Prazos são sagrados. Atrasos devem ser comunicados com antecedência\n\n## Regras para o Consultor de Vendas\n- Não forçar fechamento. Cliente que fecha por pressão cancela.\n- Não prometer economia superior ao calculado\n- Não assinar contrato sem visita técnica realizada\n- Não disparar proposta sem aprovação do engenheiro\n\n## Regras para a Equipe Técnica\n- Chegar no horário combinado com o cliente\n- Limpar o local após a instalação\n- Foto de cada etapa da instalação (obrigatório)\n- Nunca improvisar — seguir o projeto aprovado\n- Dúvida técnica: ligar para o engenheiro antes de agir\n\n## Uso de EPI\nUso obrigatório em toda instalação:\n- Capacete\n- Cinto de segurança (em altura)\n- Luvas isolantes\n- Calçado com solado isolante`,
    },
    {
      cat: 4, title: 'Onboarding — Consultor de Vendas Solar',
      tags: ['onboarding','vendas','solar','treinamento'],
      requires_reading: true,
      content: `# Onboarding — Consultor de Vendas Solar\n\n## Bem-vindo(a)!\nVocê vai representar a empresa na ponta com o cliente. Credibilidade e conhecimento técnico básico fazem toda a diferença.\n\n## Sua missão\n1. Qualificar leads e agendar visitas técnicas\n2. Realizar a visita técnica e apresentar proposta\n3. Fechar contratos e passar para o time de instalação\n\n## Leia nesta ordem\n1. 📄 Fluxo Completo de Vendas — entenda o processo\n2. 📄 Script de Abordagem — aprenda a abordar o lead\n3. 📄 Checklist de Visita Técnica — saiba o que avaliar\n4. 📄 Política Interna — Código de Conduta\n\n## O que você precisa saber\n- Como funciona energia solar (básico)\n- Como calcular payback para o cliente\n- O que influencia na geração (orientação, sombreamento)\n- Como usar o app de monitoramento\n\n## Metas\n- Taxa de agendamento: ≥ 60% dos leads qualificados\n- Taxa de fechamento: ≥ 30% das visitas técnicas\n- NPS do cliente: ≥ 8`,
    },
    {
      cat: 4, title: 'Onboarding — Técnico Instalador Solar',
      tags: ['onboarding','técnico','instalação','treinamento'],
      requires_reading: true,
      content: `# Onboarding — Técnico Instalador\n\n## Bem-vindo(a)!\nVocê é responsável pela qualidade da instalação. Uma instalação bem feita gera indicações. Uma mal feita gera problema por anos.\n\n## Sua missão\n1. Instalar o sistema dentro das normas ABNT\n2. Documentar toda a instalação com fotos\n3. Treinar o cliente no uso do sistema\n\n## Leia nesta ordem\n1. 📄 Processo de Instalação — Passo a Passo\n2. 📄 Checklist de Visita Técnica\n3. 📄 Documentação do Projeto Elétrico\n4. 📄 Política de Garantia e Pós-Venda\n5. 📄 Código de Conduta\n\n## Equipamentos e EPIs obrigatórios\n- Cinto de segurança + talabarte\n- Capacete com jugular\n- Luvas isolantes classe 00\n- Calçado de segurança com solado isolante\n- Kit de ferramentas (chaves, alicate, multímetro)\n\n## Regra de ouro\nNunca improvisar. Se o projeto não está claro, ligue para o engenheiro ANTES de agir.\n\n## Metas de qualidade\n- Zero instalações fora da norma ABNT\n- 100% das instalações com fotos documentadas\n- Prazo de instalação: máximo 3 dias úteis`,
    },
  ],
}

// Trilhas de treinamento por segmento
const TRAINING_PATHS: Record<string, any[]> = {
  advocacia: [
    {
      title: 'Onboarding — SDR de Captação',
      description: 'Trilha completa para novos SDRs de captação. Cobre scripts, fluxo e qualificação básica.',
      target_role: 'member',
      steps: [0, 1, 2], // índices dos docs
    },
    {
      title: 'Onboarding — SDR de Qualificação',
      description: 'Trilha para qualificadores. Foco nos critérios J1–J5 e documentação.',
      target_role: 'member',
      steps: [0, 2, 3],
    },
    {
      title: 'Processos e Políticas Internas',
      description: 'Trilha obrigatória para toda a equipe.',
      target_role: 'member',
      steps: [0, 4],
    },
  ],
  solar: [
    {
      title: 'Onboarding — Consultor de Vendas',
      description: 'Trilha completa para consultores de vendas. Scripts, visita técnica e processo de venda.',
      target_role: 'member',
      steps: [0, 1, 2],
    },
    {
      title: 'Onboarding — Técnico Instalador',
      description: 'Trilha para técnicos. Processo de instalação, normas e documentação.',
      target_role: 'member',
      steps: [3, 4, 5],
    },
    {
      title: 'Processos e Políticas da Empresa',
      description: 'Trilha obrigatória para toda a equipe.',
      target_role: 'member',
      steps: [0, 6],
    },
  ],
}

// Quizzes por segmento e step
const QUIZZES: Record<string, any[]> = {
  advocacia: [
    { q: 'Qual é o prazo máximo para primeiro contato com o lead?', opts: ['5 minutos','15 minutos','1 hora','24 horas'], a: 0 },
    { q: 'O critério J3 verifica o quê?', opts: ['Qualidade de segurado','Tipo de acidente','Sequela permanente','Prazo de prescrição'], a: 2 },
    { q: 'Qual é o prazo de prescrição do Auxílio-Acidente?', opts: ['1 ano','3 anos','5 anos','10 anos'], a: 2 },
    { q: 'O Auxílio-Acidente impede o segurado de trabalhar?', opts: ['Sim, sempre','Não, é pago além do salário','Depende da sequela','Apenas por 12 meses'], a: 1 },
    { q: 'Qual documento é bloqueante absoluto em ambas modalidades B-36 e B-94?', opts: ['CAT','CNIS','Laudo médico com CID','Boletim de Ocorrência'], a: 2 },
  ],
  solar: [
    { q: 'Qual orientação do telhado é ideal para energia solar no Brasil?', opts: ['Sul','Norte','Leste','Oeste'], a: 1 },
    { q: 'Qual é a inclinação ideal para painéis solares?', opts: ['0° a 5°','5° a 15°','15° a 25°','30° a 45°'], a: 2 },
    { q: 'Qual documento técnico é obrigatório para protocolo na concessionária?', opts: ['RG do cliente','ART do engenheiro','Nota fiscal do inversor','Foto do telhado'], a: 1 },
    { q: 'Em quantos dias a concessionária deve analisar o projeto após protocolo?', opts: ['7 dias','15 dias','30 dias','60 dias'], a: 2 },
    { q: 'O que o técnico deve fazer se o projeto não estiver claro antes de instalar?', opts: ['Improvisar com bom senso','Aguardar o cliente resolver','Ligar para o engenheiro antes de agir','Instalar e ajustar depois'], a: 2 },
  ],
}

export async function POST(req: NextRequest) {
  const { firmId, segment } = await req.json()

  if (!firmId || !segment) {
    return NextResponse.json({ error: 'firmId e segment são obrigatórios' }, { status: 400 })
  }

  const cats = CATEGORIES[segment] || CATEGORIES.advocacia
  const docs = DOCS[segment] || DOCS.advocacia
  const paths = TRAINING_PATHS[segment] || TRAINING_PATHS.advocacia
  const quizzes = QUIZZES[segment] || QUIZZES.advocacia

  try {
  
  // 0.5. Criar cargos por segmento
  const ROLES: Record<string, any[]> = {
    advocacia: [
      { name: 'Advogado Responsável', access_level: 'admin',  is_default: false, sort_order: 1 },
      { name: 'Gestor Operacional',   access_level: 'admin',  is_default: false, sort_order: 2 },
      { name: 'SDR de Captação',      access_level: 'member', is_default: true,  sort_order: 3 },
      { name: 'SDR de Qualificação',  access_level: 'member', is_default: false, sort_order: 4 },
      { name: 'Closer e Documentação',access_level: 'editor', is_default: false, sort_order: 5 },
    ],
    solar: [
      { name: 'Gestor Comercial',     access_level: 'admin',  is_default: false, sort_order: 1 },
      { name: 'Consultor de Vendas',  access_level: 'member', is_default: true,  sort_order: 2 },
      { name: 'Técnico de Instalação',access_level: 'member', is_default: false, sort_order: 3 },
      { name: 'Coordenador Técnico',  access_level: 'editor', is_default: false, sort_order: 4 },
      { name: 'Analista de Projetos', access_level: 'editor', is_default: false, sort_order: 5 },
    ],
  }
  const segmentRoles = ROLES[segment] || ROLES.advocacia
  await supabase.from('nf_roles').insert(
    segmentRoles.map(r => ({ ...r, firm_id: firmId, segment }))
  )

  // 1. Criar categorias
    const { data: createdCats } = await supabase
      .from('nf_categories')
      .insert(cats.map(c => ({ ...c, firm_id: firmId })))
      .select()

    const catIds = (createdCats || []).map(c => c.id)

    // 2. Criar documentos
    const docsToInsert = docs.map((d, i) => ({
      firm_id: firmId,
      category_id: catIds[d.cat] || null,
      title: d.title,
      content: d.content,
      status: 'published',
      tags: d.tags || [],
      requires_reading: d.requires_reading || false,
      requires_signature: d.requires_signature || false,
      allowed_roles: ['admin', 'editor', 'member'],
      view_count: 0,
    }))

    const { data: createdDocs } = await supabase
      .from('nf_documents')
      .insert(docsToInsert)
      .select()

    const docIds = (createdDocs || []).map(d => d.id)

    // 3. Criar trilhas de treinamento
    for (const path of paths) {
      const { data: createdPath } = await supabase
        .from('nf_training_paths')
        .insert({
          firm_id: firmId,
          title: path.title,
          description: path.description,
          target_role: path.target_role,
          is_active: true,
        })
        .select()
        .single()

      if (!createdPath) continue

      // Criar steps com quizzes
      const steps = path.steps
        .map((docIdx: number, stepOrder: number) => ({
          path_id: createdPath.id,
          document_id: docIds[docIdx] || null,
          title: docs[docIdx]?.title || `Etapa ${stepOrder + 1}`,
          description: `Leia o documento e responda o quiz para avançar.`,
          step_order: stepOrder + 1,
          quiz_json: {
            questions: quizzes
              .slice(stepOrder * 2, stepOrder * 2 + 3)
              .map(q => ({ q: q.q, options: q.opts, answer: q.a }))
          },
        }))

      await supabase.from('nf_training_steps').insert(steps)
    }

    // 4. Criar settings da firma
    await supabase.from('nf_firm_settings').upsert({
      firm_id: firmId,
      brand_color: segment === 'solar' ? '#f59e0b' : '#d4a017',
    }, { onConflict: 'firm_id' })

    return NextResponse.json({
      ok: true,
      created: {
        categories: catIds.length,
        documents: docIds.length,
        training_paths: paths.length,
      }
    })

  } catch (error: any) {
    console.error('Setup error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
