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

### 1c. Categorias próprias das empresas

Repita o procedimento com [`supabase/migrations/0003_categorias.sql`](../supabase/migrations/0003_categorias.sql).
Ele libera o tipo de registro `category` usado pela tela **Categorias** do painel da empresa.
**Rode antes de publicar a versão do site que tem essa tela** — sem ele, o servidor recusa as categorias.

### 1d. Suporte ao cliente

Repita com [`supabase/migrations/0004_suporte.sql`](../supabase/migrations/0004_suporte.sql).
Ele cria os chamados de suporte: o cliente pede ajuda pelo botão **Ajuda** (ícone de boia) dentro do
painel da empresa, e você responde na aba **Suporte** do painel restrito. Cada empresa só vê os
próprios chamados; só o dono da plataforma (com 2 etapas) vê todos.

### 1e. Cardápio digital

Repita com [`supabase/migrations/0007_cardapio.sql`](../supabase/migrations/0007_cardapio.sql).
Ele cria a tabela `menus` (um cardápio por loja), a leitura pública do cardápio publicado
(`public_menu`), a troca de responsável antes da ativação e a pasta pública `cardapio` para as fotos
e vídeos. **Rode antes de publicar a versão do site de cardápios.** Só acrescenta: nenhum dado
existente é alterado.

Para conferir a segurança sem gravar nada: no SQL Editor, cole `begin;`, o arquivo 0007 e o
[`supabase/tests/cardapio_test.sql`](../supabase/tests/cardapio_test.sql) e clique em **Run**. O
resultado aparece como mensagem de erro (de propósito), e tudo é desfeito.

## 2. Configurar os endereços de login

Supabase → **Authentication** → **URL Configuration**:

- **Site URL:** `https://xn--gestoluma-o2a.com.br/` (gestãoluma.com.br — domínio do site desde 13/10/2026)
- **Redirect URLs:** adicionar
  - `<endereço do site>/convite/`
  - `<endereço do site>/admin/`
  - `<endereço do site>/empresa/` (retorno do link de "Esqueceu a senha?")

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

## Como montar a loja de um cliente

1. Painel → **Criar loja** (nome, responsável, e-mail, licenças, valor, vencimento, origem da venda).
   Se ainda não tiver o e-mail do cliente, use o seu: dá para trocar depois.
2. O sistema cria a loja com o cardápio **vazio e fora do ar** e gera um **link de ativação** (válido por 7 dias, uso único).
3. Clique em **Montar cardápio agora** (ou no ícone de talheres na lista de lojas). Você entra no mesmo painel
   que o cliente vai usar: monte do zero ou comece pelo modelo de hamburgueria, envie fotos, cadastre preços,
   adicionais, bairros, horário e o WhatsApp da loja. Use **Prévia** para ver como o cliente final vê.
4. Quando o cliente assinar: se o e-mail mudou, edite a loja (lápis) → **Trocar e gerar link**. Se o link de 7 dias
   venceu, gere outro (ícone de corrente).
5. Envie o link ao cliente (WhatsApp ou e-mail). Ele cria a própria senha — você nunca vê nem envia senhas — e
   já encontra o cardápio pronto. Publique você mesmo ou deixe o cliente publicar.
6. O link público do cardápio fica em `<endereço do site>/c/?l=<endereço-da-loja>`.

## Bloquear um cliente inadimplente

Na lista de empresas, o **cadeado** ao lado do lápis bloqueia o acesso (situação "Suspensa"). Ao entrar, os usuários
da empresa veem o aviso de pagamento pendente com o botão para falar no WhatsApp; quem já estava com o painel
aberto é levado ao aviso em até 5 minutos. Nada é apagado. Depois do pagamento, o **cadeado aberto** libera o acesso.

## Como o cliente entra na própria base

1. Depois de ativar o convite, o cliente usa o botão **Entrar** no topo do site (`/empresa/`).
2. E-mail + senha → abre direto o painel da empresa dele (se tiver mais de uma, escolhe qual).
3. Tudo o que ele cadastra fica no servidor e aparece em qualquer computador ou celular.
4. Esqueceu a senha: na tela de login, **Esqueceu a senha?** → informa o e-mail → recebe um link → cria a nova senha em `/empresa/`. O texto desse e-mail fica em **Authentication** → **Email Templates** → **Reset Password**.

Permissões dentro da empresa:

| Situação | Pode ver | Pode alterar |
|---|---|---|
| Administrador / Financeiro, empresa ativa ou inadimplente | Sim | Sim |
| Somente consulta | Sim | Não (só marcar alertas como lidos) |
| Empresa **suspensa** (bloqueada pelo administrador por inadimplência) | Não — vê o aviso de pagamento pendente com o botão do WhatsApp | Não |
| Empresa **cancelada** ou usuário desativado | Não | Não |

O dono da plataforma (com 2 etapas) pode ler e editar o cardápio de qualquer loja, para montar a base; fica
registrado quem salvou por último. Os dados antigos da gestão financeira (`org_records`) continuam guardados no
banco, mas o site não tem mais telas para eles.

## Segurança (resumo)

- RLS ligada em todas as tabelas; o acesso é só por funções que verificam permissão.
- Painel exige estar em `platform_admins` **e** sessão com 2 etapas (`aal2`) — verificado no banco, não só na tela.
- Convites: token aleatório de 32 bytes, só o hash fica salvo, uso único, e-mail precisa coincidir.
- Sessão do painel encerra após 30 minutos sem uso.
- Testes: `supabase/tests/security_test.py` (32 verificações) `supabase/tests/dados_test.py` (31 verificações de isolamento dos dados e anexos) e `supabase/tests/suporte_test.py` (27 verificações do suporte), em PostgreSQL local.

## Limites do plano grátis

500 MB de banco, 1 GB de arquivos, 50 mil usuários ativos/mês. O projeto **pausa após 1 semana sem uso** (reative no painel do Supabase). Plano Pro (US$ 25/mês) quando houver clientes pagando: sem pausa e com backup diário.
