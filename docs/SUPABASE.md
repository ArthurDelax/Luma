# Luma — configurar o Supabase (painel do administrador)

Guia para ligar o painel `/admin/` e a ativação de clientes `/convite/` ao Supabase.
Nenhum passo exige enviar senhas a ninguém.

## O que é público e o que é secreto

| Item | Pode ir para o site/GitHub? |
|---|---|
| Project URL (`https://xxxx.supabase.co`) | Sim — é público |
| Publishable key (`sb_publishable_…`) ou anon key | Sim — é público; a proteção está no banco (RLS) |
| Senha do banco (Database password) | **Nunca** |
| Secret key (`sb_secret_…`) / service_role | **Nunca** |

## 1. Criar a estrutura do banco

1. Supabase → **SQL Editor** → **New query**.
2. Copie o arquivo [`supabase/migrations/0001_plataforma.sql`](../supabase/migrations/0001_plataforma.sql) inteiro (no GitHub, botão **Raw** → selecionar tudo → copiar), cole e clique em **Run**.
3. Deve aparecer "Success. No rows returned". Pode rodar de novo sem problema.

### 1b. Dados das empresas e anexos

Repita o mesmo procedimento com [`supabase/migrations/0002_dados_empresa.sql`](../supabase/migrations/0002_dados_empresa.sql).
Ele cria a tabela onde ficam as contas, recorrentes, contratos e documentos de cada empresa
(isolados por empresa no próprio banco) e a pasta privada `anexos` para os PDFs.

## 2. Configurar os endereços de login

Supabase → **Authentication** → **URL Configuration**:

- **Site URL:** endereço do site (ex.: `https://arthurdelax.github.io/Luma/` ou, com domínio próprio, `https://xn--gestoluma-o2a.com.br/`)
- **Redirect URLs:** adicionar
  - `<endereço do site>/convite/`
  - `<endereço do site>/admin/`

## 3. Criar o usuário administrador (você)

1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Seu e-mail + uma senha forte (só você sabe). Marque **Auto Confirm User**.
3. **SQL Editor** → rode (trocando o e-mail):

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'seu-email@exemplo.com'
on conflict do nothing;
```

## 4. Primeiro acesso

1. No site, rodapé → **Acesso restrito**.
2. Entre com o e-mail e a senha.
3. O painel pede a **verificação em duas etapas**: escaneie o QR Code com um app autenticador (Google Authenticator, Microsoft Authenticator, Authy…) e digite o código de 6 dígitos.
4. A partir daí, todo login pede senha + código do app.

## Como funciona a criação manual de clientes

1. Painel → **Criar empresa** (nome, CNPJ, responsável, e-mail, licenças, valor, vencimento, origem da venda).
2. O sistema cria a empresa vazia e gera um **link de ativação** (válido por 7 dias, uso único).
3. Envie o link ao cliente (WhatsApp ou e-mail). Ele cria a própria senha — você nunca vê nem envia senhas.
4. O painel mostra "Convite pendente" até o cliente ativar, depois "Acesso ativado".

## Como o cliente entra na própria base

1. Depois de ativar o convite, o cliente usa o botão **Entrar** no topo do site (`/empresa/`).
2. E-mail + senha → abre direto o painel da empresa dele (se tiver mais de uma, escolhe qual).
3. Tudo o que ele cadastra fica no servidor e aparece em qualquer computador ou celular.

Permissões dentro da empresa:

| Situação | Pode ver | Pode alterar |
|---|---|---|
| Administrador / Financeiro, empresa ativa ou inadimplente | Sim | Sim |
| Somente consulta | Sim | Não (só marcar alertas como lidos) |
| Empresa **suspensa** | Sim | Não |
| Empresa **cancelada** ou usuário desativado | Não | Não |

O dono da plataforma **não** vê os dados financeiros dos clientes.

## Segurança (resumo)

- RLS ligada em todas as tabelas; o acesso é só por funções que verificam permissão.
- Painel exige estar em `platform_admins` **e** sessão com 2 etapas (`aal2`) — verificado no banco, não só na tela.
- Convites: token aleatório de 32 bytes, só o hash fica salvo, uso único, e-mail precisa coincidir.
- Sessão do painel encerra após 30 minutos sem uso.
- Testes: `supabase/tests/security_test.py` (32 verificações) e `supabase/tests/dados_test.py` (31 verificações de isolamento dos dados e anexos), em PostgreSQL local.

## Limites do plano grátis

500 MB de banco, 1 GB de arquivos, 50 mil usuários ativos/mês. O projeto **pausa após 1 semana sem uso** (reative no painel do Supabase). Plano Pro (US$ 25/mês) quando houver clientes pagando: sem pausa e com backup diário.
