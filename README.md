# Luma

**Sua empresa. Tudo sob controle.**

Luma é uma plataforma de gestão empresarial para pequenas e médias empresas, escritórios e prestadores de serviço: contas a pagar, boletos, despesas recorrentes, contratos, documentos, alertas de vencimento, calendário e relatórios.

> **Demonstração pública.** O site publicado no GitHub Pages usa apenas dados fictícios e é **somente leitura**: navegar, pesquisar, filtrar, exportar e testar a leitura de boletos funciona; cadastrar, editar e excluir é bloqueado na camada de dados (`StoreProvider`) e mostra o aviso para assinantes. A contratação por Pix e o ambiente multiempresa ainda não existem — veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Funcionalidades

- **Site institucional** com apresentação, funcionalidades, como funciona e perguntas frequentes.
- **Planos** (`/planos`): R$ 99,90/mês até 2 usuários, R$ 29,90 por usuário adicional, até 10 usuários; calculadora interativa, botão "Contratar com Pix" (ainda informativo) e "Falar com um consultor" no WhatsApp (ativado ao configurar `WHATSAPP_NUMBER`). Regras em `src/lib/pricing.ts`.
- **Painel** com faixa de vencimentos dos próximos 30 dias, indicadores, despesas por mês e por categoria, próximos vencimentos, calendário e alertas.
- **Contas a pagar**: cadastrar, editar, excluir (com confirmação), marcar como paga, reabrir, buscar, filtrar (status, categoria, vencimento), ordenar (data, valor), anexar PDF, exportar CSV e bloqueio de duplicidades.
- **Importação de boletos em PDF** (PDF.js, 100% no navegador): beneficiário, CNPJ, pagador, valor, vencimento, linha digitável, nº do documento, banco, **chave Pix** e **Pix Copia e Cola** (lido do texto ou do QR Code, com validação do CRC16 e alerta quando o recebedor do Pix difere do beneficiário). Validação dos dígitos verificadores de boletos bancários (47 dígitos, módulo 10 + módulo 11) e de arrecadação (48 dígitos, módulo 10 ou 11 conforme o identificador de valor), incluindo o novo ciclo do fator de vencimento (a partir de 22/02/2025).
- **Despesas recorrentes** mensais, trimestrais ou anuais, com previsão de vencimentos e lançamento sem duplicar.
- **Contratos e documentos** com situação (vigente, a vencer, vencido) e anexo.
- **Central de alertas**: 30, 15, 7 e 3 dias antes, no dia e após o vencimento.
- **Calendário** mensal com cores por tipo de evento.
- **Relatórios** por período e categoria, pagas/pendentes/vencidas, evolução mensal, exportação CSV e impressão.
- **Dados e ajustes**: backup/restauração em JSON, restaurar dados de exemplo, apagar tudo.

## Executar no seu computador

Requisitos: [Node.js](https://nodejs.org) 22 ou superior.

```bash
npm install
npm run dev
```

Abra http://localhost:3000 (site) e http://localhost:3000/app/ (demonstração).

Para testar localmente com edição liberada (dados salvos no navegador):

```bash
DEMO_MODE=false npm run dev
```

Variáveis de build:

| Variável | Padrão | Uso |
|---|---|---|
| `DEMO_MODE` | `true` | `false` libera cadastro/edição (somente para desenvolvimento local) |
| `WHATSAPP_NUMBER` | vazio | número comercial com DDI e DDD (ex.: `5511999999999`); vazio deixa o botão desativado |

Outros comandos:

```bash
npm test          # testes da linha digitável e da leitura de boletos
npm run typecheck # verificação de TypeScript
npm run build     # gera o site estático na pasta out/
```

## Publicação

Cada `push` na branch `main` executa o workflow `.github/workflows/deploy.yml`, que roda os testes, verifica o TypeScript, gera o site estático e publica no GitHub Pages.

## Estrutura

```
src/
  app/                 páginas do Next.js (site em /, painel em /app/)
  components/
    landing/           site institucional
    app/               painel (shell, páginas, contas, boletos)
    charts/            gráficos em SVG
    ui/                componentes de interface
  lib/
    boleto/            linha digitável, extração de PDF, bancos
    domain.ts          regras: status, recorrências, alertas, duplicidades
    storage.ts         persistência (interface DataRepository + localStorage)
    store.tsx          estado da aplicação
tests/                 testes automatizados e PDFs fictícios de exemplo
```

Para adicionar um backend no futuro, implemente outra classe com a interface `DataRepository` (em `src/lib/storage.ts`) e passe-a ao `StoreProvider`.

## Aviso

Uma linha digitável com dígitos verificadores corretos indica apenas que foi lida ou digitada sem erros — **não** garante que o boleto seja legítimo. Os boletos em `tests/fixtures` e `public/exemplos` são fictícios.
