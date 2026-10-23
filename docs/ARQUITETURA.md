# Luma — arquitetura do SaaS comercial

> **Atualização (out/2026):** a Luma passou a ser uma plataforma de **cardápio digital**. A estrutura de lojas
> (organizations), usuários, convites, administração com 2 etapas, bloqueio por inadimplência e suporte continua a mesma
> descrita abaixo; as telas de gestão financeira foram substituídas pelo cardápio (tabela `menus`, migração 0007).
> Os trechos sobre contas, boletos e documentos são históricos.

Este documento descreve como a Luma deixa de ser apenas uma demonstração estática e passa a ser um SaaS multiempresa, com contratação por Pix. Nada aqui está ativo ainda: é o plano técnico para as próximas etapas.

> **Regra de ouro:** o GitHub Pages continua hospedando só o site e a demonstração (dados fictícios, somente leitura). Tudo que envolve contas reais, dados de clientes, pagamentos e segredos roda em um backend seguro, fora do GitHub Pages.

---

## 1. Visão geral

```
                    ┌──────────────────────────────┐
  Visitante ───────▶│ GitHub Pages (estático)      │  site, planos, demonstração
                    └──────────────────────────────┘  (sem dados reais, sem segredos)

                    ┌──────────────────────────────┐
  Cliente ─────────▶│ App comercial (Next.js)      │  mesmo código das telas atuais
  (empresa)         │  + API (rotas de servidor)   │──┐
                    └──────────────────────────────┘  │
                                                      ├──▶ PostgreSQL (dados por empresa, RLS)
  Dono da Luma ────▶│ Painel administrativo        │──┤──▶ Armazenamento privado de PDFs
                    │ (área separada, MFA)         │  │──▶ E-mail transacional (convites, avisos)
                                                      │
  Provedor Pix ────▶│ Webhook /api/webhooks/pix    │──┘──▶ Fila/agendador (renovações, avisos)
```

- **Frontend:** reaproveita todas as telas atuais. A troca principal é o repositório de dados: hoje `LocalStorageRepository`/`MemoryRepository`; no SaaS, um `ApiRepository` que conversa com a API (a interface `DataRepository` já existe para isso).
- **Backend e banco: Supabase** (escolhido) — PostgreSQL gerenciado + autenticação (com verificação em duas etapas) + armazenamento de arquivos. O site estático conversa direto com o Supabase usando apenas a chave pública; a segurança fica no banco (RLS e funções que verificam permissão). Partes que exigem segredo (ex.: webhook do Pix) rodarão em Edge Functions do Supabase. Configuração: [SUPABASE.md](SUPABASE.md).
- **Arquivos (PDFs):** Supabase Storage em bucket privado, acesso só por URL assinada de curta duração.
- **Leitura de boletos:** continua no navegador (PDF.js), como hoje.

## 2. Modelo de dados multiempresa (multi-tenant)

Todas as tabelas de negócio têm `org_id` obrigatório.

| Tabela | Principais campos |
|---|---|
| `organizations` | id, nome, cnpj, status (`ativa`, `inadimplente`, `suspensa`, `cancelada`), licencas, origem (`pix`, `manual`), criado_em, `order_id` **único** |
| `users` | id, nome, e-mail (único), hash de senha ou login social, mfa_habilitado |
| `memberships` | org_id, user_id, papel, status (`ativo`, `convidado`, `desativado`) — único (org_id, user_id) |
| `invitations` | org_id, e-mail, papel, **hash** do token, expira_em, usado_em |
| `subscriptions` | org_id, usuarios_contratados, valor_mensal_centavos, proximo_vencimento, status, carencia_ate |
| `orders` | id, dados do comprador, usuarios, valor_centavos, status (`pendente`, `pago`, `expirado`, `cancelado`), idempotency_key **única** |
| `charges` | order_id/subscription_id, provedor, **txid único**, valor, qr_code, copia_e_cola, vencimento, status |
| `payment_events` | provedor, **event_id único**, payload, recebido_em, processado_em |
| `bills`, `recurring_expenses`, `documents`, `attachments`, `alert_reads` | os mesmos campos de hoje + `org_id` |
| `audit_log` | quem, org_id, ação, alvo, data, IP |
| `platform_admins` | administradores da Luma (separados dos usuários das empresas) |

**Isolamento entre empresas (duas camadas):**
1. **Aplicação:** cada requisição identifica o usuário pela sessão, carrega a *membership* ativa e só consulta dados daquela `org_id`. O `org_id` nunca vem do navegador como fonte de verdade.
2. **Banco:** *Row-Level Security* do PostgreSQL em todas as tabelas de negócio (`org_id = current_setting('app.org_id')`). Mesmo um erro de código não vaza dados de outra empresa.
3. **Testes automatizados específicos:** usuário da empresa A tentando ler/alterar/excluir dados da empresa B (por ID direto, filtro, exportação CSV e anexos) deve receber 404/403 em todos os casos.

## 3. Autenticação e permissões

- **Login:** provedor de autenticação consolidado (ex.: Auth.js, Clerk, Supabase Auth ou Keycloak). Senhas com hash forte (argon2id/bcrypt) — nunca criptografia própria.
- **Sessão:** cookie `httpOnly`, `Secure`, `SameSite=Lax`, expiração e revogação; limite de tentativas de login.
- **MFA (TOTP):** obrigatório para o painel do dono da Luma e para administradores de empresa; opcional para os demais.
- **Convites:** token aleatório de 32 bytes, guardado apenas como hash, uso único, validade de 72 h. O convidado define a própria senha — **nunca** enviamos senhas por e-mail ou WhatsApp.

**Papéis dentro da empresa:**

| Papel | Pode |
|---|---|
| Administrador | tudo, inclusive usuários, permissões e assinatura |
| Financeiro | cadastrar, editar, pagar e excluir contas, recorrentes, contratos e documentos |
| Consulta | apenas visualizar e exportar |

- Licenças: número de *memberships* ativas ≤ licenças contratadas (verificado no backend ao convidar/reativar).
- Empresas com 1 licença não veem a gestão de equipe; com 2 ou mais, o menu "Usuários e permissões" aparece para o administrador.
- Toda verificação de permissão acontece no backend; a interface apenas esconde o que o papel não pode usar.

## 4. Contratação por Pix (fluxo seguro)

**Provedor: a definir (etapa adiada).** O Banco Inter foi descartado por exigir conta PJ; a recomendação é o **Asaas**, que aceita CPF, gera cobrança Pix com QR Code e copia e cola e avisa por webhook. A chave da API ficará **somente** no servidor (Edge Function), a integração começa em ambiente de testes (sandbox) e só vai para produção com sua autorização.

```
1. Cliente escolhe usuários na calculadora
2. POST /api/checkout { usuarios, dados da empresa, e-mail }
   → backend RECALCULA o preço (src/lib/pricing.ts) — o valor do navegador é ignorado
   → cria order "pendente" com idempotency_key
3. Backend cria a cobrança no provedor (txid único) → devolve QR Code + copia e cola
4. Cliente paga no app do banco
5. Provedor chama POST /api/webhooks/pix
   → valida assinatura/mTLS do provedor
   → grava payment_event (event_id único: evento repetido é ignorado)
   → CONSULTA a cobrança na API do provedor (não confia só no corpo do webhook)
   → confere txid, valor e status "CONCLUIDA"
6. Em UMA transação (SELECT … FOR UPDATE na order):
   → se a order já está "paga", termina (idempotente)
   → marca a order como paga
   → cria a organização (order_id único impede duplicidade), vazia
   → cria a assinatura com as licenças contratadas
   → cria o convite do administrador
7. E-mail com o link de ativação; o cliente define senha + MFA
8. A tela de checkout só acompanha o status consultando o backend
   (GET /api/checkout/:id) — o navegador nunca libera acesso sozinho
```

## 5. Renovação mensal, inadimplência e suspensão

| Quando | O que acontece |
|---|---|
| D-10 | Gera a cobrança Pix do próximo mês (com vencimento) |
| D-7, D-3, D0 | Avisos por e-mail e dentro do sistema |
| D+1 a D+7 | **Carência:** acesso normal + aviso de pagamento pendente |
| D+8 | **Suspensa:** somente leitura e exportação; nada é apagado |
| Pagamento a qualquer momento | Reativação automática pelo mesmo webhook |

- **Nunca** excluímos dados automaticamente por atraso. Exclusão só a pedido do cliente (LGPD), com confirmação e prazo de retenção definido em contrato.
- Mudança de licenças: aumento vale a partir do próximo ciclo (ou cobrança proporcional, se você preferir); redução não pode deixar mais usuários ativos que licenças.

## 6. Painel administrativo do dono da Luma

- Área separada (ex.: `admin.seudominio.com.br`), usuários em `platform_admins`, **MFA obrigatório**, sessão curta, opcionalmente restrita por IP.
- Funções: empresas, assinaturas, pagamentos confirmados e pendentes, licenças, ativar/suspender, registrar venda externa, reenviar convite, histórico (audit_log).
- **Criar empresa manualmente:** formulário com nome da empresa, responsável, e-mail, licenças, valor mensal, vencimento, origem da venda e observações → usa o **mesmo serviço de provisionamento** do Pix (origem `manual`) → organização vazia + convite → botão "Copiar link de ativação" (e envio por e-mail quando houver integração).
- O painel administra contas e assinaturas, mas **não lê os dados financeiros dos clientes** por padrão. Suporte com acesso aos dados só com consentimento do cliente, por tempo limitado e registrado no histórico.

## 7. Segurança e conformidade

- HTTPS em tudo; cabeçalhos de segurança (CSP, HSTS); proteção CSRF; limites de requisição.
- Segredos (chaves do provedor Pix, banco, e-mail) **somente** nas variáveis de ambiente do servidor — nunca no repositório nem no GitHub Pages.
- Validação de entrada no servidor (ex.: Zod) e consultas parametrizadas.
- Anexos em bucket privado, com limite de tamanho e tipo (PDF).
- Backups diários criptografados e teste de restauração.
- LGPD: política de privacidade, termos de uso, registro de consentimento, canal para solicitações do titular.
- Antes de produção: revisão de segurança independente (pentest) e testes de isolamento entre empresas.

## 8. API prevista

| Método e rota | Uso |
|---|---|
| `POST /api/checkout` | cria pedido + cobrança Pix |
| `GET /api/checkout/:id` | status do pedido (para a tela de pagamento) |
| `POST /api/webhooks/pix` | confirmação do provedor |
| `POST /api/invitations/:token/accept` | ativação de conta |
| `GET/POST/PATCH/DELETE /api/bills…`, `/recurring…`, `/documents…` | dados da empresa (sempre filtrados por `org_id`) |
| `GET/POST/PATCH /api/team…` | usuários e permissões (somente administradores) |
| `/api/admin/…` | painel do dono da Luma (MFA + `platform_admins`) |

## 9. Etapas

| Etapa | Conteúdo | Situação |
|---|---|---|
| 1 | Preços, calculadora, botões de contratação, demonstração somente leitura | **Concluída** |
| 2 | Banco: organizações, administradores, papéis, licenças, convites, RLS e testes de segurança | **Pronto** |
| 3 | Painel administrativo, criação manual de empresas e links de ativação | **Pronto** |
| 3b | Área da empresa com dados no banco (contas, documentos, anexos), login do cliente e permissões por papel | **Pronto** |
| 3c | Tela de equipe: convidar usuários, trocar papéis e desativar (empresas com 2+ licenças) | Pendente |
| 4 | Integração Pix em **ambiente de testes (sandbox)** do provedor escolhido | Pendente — requer sua aprovação do provedor |
| 5 | Confirmação automática, provisionamento, renovação, carência e suspensão | Pendente |
| 6 | Revisão de segurança, LGPD, pentest e preparação para produção | Pendente |

**Decisões tomadas:** banco e autenticação no Supabase; WhatsApp comercial (62) 99304-7680; domínio gestãoluma.com.br (`xn--gestoluma-o2a.com.br`).

**Decisões pendentes:** provedor Pix (recomendação: Asaas) e provedor de e-mail.
