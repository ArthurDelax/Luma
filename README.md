# Luma

**O cardápio digital que faz o cliente pedir.**

Luma é uma plataforma de cardápio digital para hamburguerias, pizzarias, lanchonetes e restaurantes que vendem pelo WhatsApp. Cada loja tem um link próprio com fotos, vídeos, adicionais, entrega por bairro ou retirada e cupons. O cliente monta a sacola e o pedido chega pronto no WhatsApp da loja, sem comissão.

## O que tem

- **Site** (`/`) com apresentação, como funciona, recursos, planos e perguntas frequentes.
- **Cardápio público** (`/c/?l=endereco-da-loja`): topo com foto ou vídeos em sequência (estilo stories), aberto/fechado pelo horário, entrega ou retirada, destaques, busca, produto com adicionais obrigatórios e limite de escolhas, observação, sacola, cupom, pedido mínimo, frete grátis, taxa por bairro, CEP que preenche a rua (ViaCEP), pagamento (Pix, cartão, dinheiro com troco) e a mensagem do pedido aberta no WhatsApp.
- **Painel da loja** (`/empresa/`): login do cliente; telas Início (link, publicar, checklist), Cardápio (categorias e produtos, esgotado, destaque, ordem), Adicionais, Loja (textos, cor, logo, capa, vídeos, horário, endereço, promoções) e Pedidos e entrega (WhatsApp, bairros e taxas, retirada, pagamentos, cupons). Prévia antes de publicar.
- **Administração** (`/admin/`, com verificação em duas etapas): lojas, assinaturas, bloqueio por inadimplência, suporte, histórico, **criar loja com cardápio vazio**, **montar o cardápio de qualquer loja** antes de entregar e **trocar o responsável** antes da ativação.
- **Demonstrações públicas**: cardápio de exemplo (`/demo/`) e painel de exemplo (`/app/`, as alterações ficam só no navegador).

## Executar no seu computador

Requisitos: [Node.js](https://nodejs.org) 22 ou superior.

```bash
npm install
npm run dev
```

Abra http://localhost:3000 (site), http://localhost:3000/demo/ (cardápio de exemplo) e http://localhost:3000/app/ (painel de exemplo). Para o login das lojas e o admin funcionarem localmente, defina `SUPABASE_URL` e `SUPABASE_ANON_KEY` (valores públicos, os mesmos do workflow).

Variáveis de build:

| Variável | Uso |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | projeto Supabase (URL e chave pública) |
| `WHATSAPP_NUMBER` | WhatsApp comercial da Luma, com DDI e DDD (ex.: `5511999999999`) |

Outros comandos:

```bash
npm test          # regras do pedido, cupons, entrega, horário e preços
npm run typecheck # verificação de TypeScript
npm run build     # gera o site estático na pasta out/
```

## Publicação

Cada `push` na branch `main` executa o workflow `.github/workflows/deploy.yml`, que roda os testes, verifica o TypeScript, gera o site estático e publica no GitHub Pages. Antes de publicar esta versão, aplique `supabase/migrations/0007_cardapio.sql` no Supabase ([docs/SUPABASE.md](docs/SUPABASE.md)).

## Estrutura

```
src/
  app/                 páginas (site, /c, /demo, /app, /empresa, /admin, /convite)
  components/
    landing/           site institucional
    menu/              cardápio público e painel da loja (menu/editor)
    store/             login e acesso das lojas
    admin/             administração da plataforma
    support/           central de ajuda
    ui/                componentes de interface
  lib/
    menu/              tipos, regras do pedido, exemplo, gravação no Supabase
supabase/migrations/   banco (0007 = cardápio)
tests/                 testes automatizados
public/demo/           fotos (Unsplash) e vídeos (Mixkit) da loja de exemplo
```
