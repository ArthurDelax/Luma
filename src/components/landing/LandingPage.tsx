"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LuBell,
  LuCalendarDays,
  LuChartColumn,
  LuCircleCheck,
  LuFilePenLine,
  LuFileUp,
  LuLock,
  LuMenu,
  LuReceipt,
  LuRepeat,
  LuScanText,
  LuX,
  LuChevronDown,
  LuMonitorSmartphone,
} from "react-icons/lu";
import { addDays, todayISO } from "@/lib/dates";
import { href } from "@/lib/paths";
import { Ribbon, type RibbonEvent } from "../app/Ribbon";
import { cx, Logo } from "../ui";

const APP = href("/app/");

function CTA({ children = "Experimentar demonstração", variant = "light", className }: { children?: React.ReactNode; variant?: "light" | "dark"; className?: string }) {
  return (
    <a
      href={APP}
      className={cx(
        "inline-flex h-12 items-center justify-center rounded-xl px-6 text-[15px] font-semibold transition-colors",
        variant === "light" ? "bg-white text-ink hover:bg-sky-100" : "bg-ink text-white hover:bg-navy-700",
        className,
      )}
    >
      {children}
    </a>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const links = [
    ["#funcionalidades", "Funcionalidades"],
    ["#boletos", "Leitura de boletos"],
    ["#como-funciona", "Como funciona"],
    ["#perguntas", "Perguntas"],
  ];
  return (
    <header className={cx("fixed inset-x-0 top-0 z-40 transition-colors", scrolled || open ? "bg-navy-900/95 backdrop-blur-md" : "bg-transparent")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <a href={href("/")} aria-label="Luma — início">
          <Logo tone="light" />
        </a>
        <nav aria-label="Seções" className="ml-6 hidden gap-1 md:flex">
          {links.map(([h, l]) => (
            <a key={h} href={h} className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white">
              {l}
            </a>
          ))}
        </nav>
        <a href={APP} className="ml-auto hidden h-10 items-center rounded-[10px] bg-white px-4 text-sm font-semibold text-ink hover:bg-sky-100 sm:inline-flex">
          Experimentar demonstração
        </a>
        <button className="ml-auto grid size-10 place-items-center rounded-lg text-white md:hidden sm:ml-0" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <LuX className="size-6" /> : <LuMenu className="size-6" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-white/10 px-4 pb-5 pt-2 md:hidden">
          {links.map(([h, l]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-base font-medium text-white/85 hover:bg-white/5">
              {l}
            </a>
          ))}
          <CTA className="mt-3 w-full" />
        </nav>
      )}
    </header>
  );
}

function useSampleEvents(today: string): RibbonEvent[] {
  return useMemo(
    () => [
      { id: "a", date: addDays(today, -3), kind: "vencida", label: "Manutenção do ar-condicionado", amount: 640 },
      { id: "b", date: addDays(today, 1), kind: "conta", label: "Fornecedor de embalagens — 2ª parcela", amount: 5420 },
      { id: "c", date: addDays(today, 3), kind: "documento", label: "Certificado digital e-CNPJ" },
      { id: "d", date: addDays(today, 4), kind: "conta", label: "Energia elétrica", amount: 821.75 },
      { id: "e", date: addDays(today, 7), kind: "recorrente", label: "Internet fibra", amount: 289.9 },
      { id: "f", date: addDays(today, 7), kind: "conta", label: "Simples Nacional", amount: 3412.9 },
      { id: "g", date: addDays(today, 9), kind: "conta", label: "Água e esgoto", amount: 174.55 },
      { id: "h", date: addDays(today, 12), kind: "contrato", label: "Contrato de suporte de TI" },
      { id: "i", date: addDays(today, 15), kind: "recorrente", label: "Aluguel do escritório", amount: 4800 },
      { id: "j", date: addDays(today, 16), kind: "conta", label: "Consultoria jurídica", amount: 2800 },
      { id: "k", date: addDays(today, 20), kind: "recorrente", label: "Honorários contábeis", amount: 1350 },
      { id: "l", date: addDays(today, 22), kind: "recorrente", label: "Sistema de notas fiscais", amount: 189 },
      { id: "m", date: addDays(today, 26), kind: "contrato", label: "Contrato de locação" },
      { id: "n", date: addDays(today, 27), kind: "conta", label: "Pró-labore e encargos", amount: 8900 },
    ],
    [today],
  );
}

function Hero() {
  const [today, setToday] = useState("2026-01-15");
  useEffect(() => setToday(todayISO()), []);
  const events = useSampleEvents(today);
  return (
    <section className="relative overflow-hidden bg-navy-900 pb-16 pt-28 text-white sm:pb-24 sm:pt-36">
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-[radial-gradient(circle,rgba(106,168,234,0.28),transparent_65%)]" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <h1 className="font-display text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.02em] sm:text-[4.2rem]">
            Sua empresa.
            <br />
            Tudo sob controle.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
            A Luma reúne contas a pagar, boletos, despesas recorrentes, contratos e documentos em um só painel — e avisa antes de cada vencimento.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <CTA />
            <a href="#funcionalidades" className="inline-flex h-12 items-center justify-center rounded-xl px-5 text-[15px] font-semibold text-white/85 ring-1 ring-inset ring-white/20 hover:bg-white/5">
              Ver funcionalidades
            </a>
          </div>
          <p className="mt-4 text-sm text-white/50">Demonstração gratuita, sem cadastro. Os dados ficam salvos só no seu navegador.</p>
        </div>

        <div className="mt-14 rounded-[20px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold">Os próximos 30 dias, de relance</p>
              <p className="text-sm text-white/55">Exemplo com dados fictícios. Toque em um dia para ver o que vence.</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">Faixa de vencimentos</span>
          </div>
          <Ribbon today={today} events={events} tone="dark" />
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  const bars = [62, 74, 58, 81, 69, 88, 40];
  const months = ["mai", "jun", "jul", "ago", "set", "out", "nov"];
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[var(--shadow-pop)]" aria-label="Representação do painel da Luma" role="img">
      <div className="flex">
        <div className="hidden w-40 shrink-0 flex-col gap-1 bg-navy-900 p-3 xl:flex">
          <div className="mb-3 flex items-center gap-2 px-1">
            <span className="size-5 rounded-md bg-white/90" />
            <span className="h-2.5 w-12 rounded bg-white/70" />
          </div>
          {["Painel", "Contas a pagar", "Recorrentes", "Contratos", "Calendário", "Alertas", "Relatórios"].map((l, i) => (
            <span key={l} className={cx("rounded-md px-2 py-1.5 text-[11px] font-medium", i === 0 ? "bg-white/10 text-white" : "text-white/55")}>
              {l}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <p className="font-display text-sm font-semibold text-ink">Visão geral</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Contas a pagar", "10", "bg-sky-100"],
              ["Vencidas", "3", "bg-overdue-soft"],
              ["Vencem em 7 dias", "5", "bg-soon-soft"],
              ["Pagas no mês", "6", "bg-paid-soft"],
            ].map(([l, v, c]) => (
              <div key={l} className="rounded-lg border border-line bg-white p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted">{l}</span>
                  <span className={cx("size-4 rounded", c)} />
                </div>
                <p className="mt-1 font-display text-lg font-semibold text-ink">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1.4fr_1fr]">
            <div className="rounded-lg border border-line bg-white p-3">
              <p className="text-[10px] font-semibold text-muted">Despesas por mês</p>
              <div className="mt-2 flex h-24 items-end gap-2">
                {bars.map((h, i) => (
                  <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <div className="flex w-full flex-col-reverse overflow-hidden rounded-t" style={{ height: `${h}%` }}>
                      <span className="bg-navy-800" style={{ flex: i === 6 ? 0 : 3 }} />
                      <span className="bg-overdue" style={{ flex: i === 5 ? 1 : 0 }} />
                      <span className="bg-sky-300" style={{ flex: i >= 5 ? 2 : 0 }} />
                    </div>
                    <span className="text-[9px] text-muted">{months[i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-white p-3">
              <p className="text-[10px] font-semibold text-muted">Próximos vencimentos</p>
              {[
                ["Energia elétrica", "R$ 821,75", "bg-soon"],
                ["Embalagens — 2ª parcela", "R$ 5.420,00", "bg-soon"],
                ["Consultoria jurídica", "R$ 2.800,00", "bg-sky-400"],
                ["Água e esgoto", "R$ 174,55", "bg-sky-400"],
              ].map(([l, v, c]) => (
                <div key={l} className="mt-2 flex items-center gap-2 text-[11px]">
                  <span className={cx("size-1.5 rounded-full", c)} />
                  <span className="min-w-0 flex-1 truncate text-ink">{l}</span>
                  <span className="font-semibold tabular text-ink">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: <LuReceipt />, title: "Contas a pagar", text: "Cadastre, edite, filtre e marque como paga. Contas vencidas são identificadas automaticamente, e cadastros duplicados são bloqueados.", wide: true },
  { icon: <LuFileUp />, title: "Importação de boletos", text: "Selecione o PDF e a Luma preenche beneficiário, CNPJ, valor, vencimento e linha digitável para você conferir." },
  { icon: <LuRepeat />, title: "Despesas recorrentes", text: "Aluguel, internet, contabilidade e assinaturas com frequência mensal, trimestral ou anual." },
  { icon: <LuFilePenLine />, title: "Contratos e documentos", text: "Validade de contratos, certificados digitais, licenças, alvarás e seguros em um só lugar." },
  { icon: <LuBell />, title: "Central de alertas", text: "Avisos 30, 15, 7 e 3 dias antes, no dia e depois do vencimento." },
  { icon: <LuCalendarDays />, title: "Calendário financeiro", text: "Contas, recorrências, contratos e documentos no mês, com cores por tipo." },
  { icon: <LuChartColumn />, title: "Relatórios", text: "Despesas por período e categoria, contas pagas, pendentes e vencidas, evolução mensal. Exporte em CSV ou imprima.", wide: true },
];

function Features() {
  return (
    <section id="funcionalidades" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.08]">Tudo o que vence na sua empresa, organizado</h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">Um painel único para o financeiro do dia a dia: o que pagar, quando pagar e o que está prestes a expirar.</p>
          </div>
          <ProductPreview />
        </div>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className={cx("bg-white p-6", f.wide && "lg:col-span-2")}>
              <span className="grid size-10 place-items-center rounded-xl bg-sky-100 text-navy-700 [&>svg]:size-5">{f.icon}</span>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{f.text}</p>
            </div>
          ))}
          <div className="flex flex-col justify-between bg-navy-900 p-6 text-white sm:col-span-2 lg:col-span-2">
            <p className="font-display text-lg font-semibold">Veja funcionando</p>
            <a href={APP} className="mt-4 inline-flex h-10 w-fit items-center rounded-[10px] bg-white px-4 text-sm font-semibold text-ink hover:bg-sky-100">
              Abrir demonstração
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Boletos() {
  const fields = [
    ["Beneficiário", "Exemplo Serviços de Tecnologia Ltda", true],
    ["CNPJ", "11.222.333/0001-81", true],
    ["Valor", "R$ 389,90", true],
    ["Vencimento", "20/11/2026", true],
    ["Nº do documento", "000981", true],
    ["Pagador", "—", false],
  ] as const;
  return (
    <section id="boletos" className="scroll-mt-20 bg-paper py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div className="order-2 min-w-0 lg:order-1">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <LuScanText className="size-5 text-soon" />
              <div>
                <p className="text-sm font-semibold">Leitura parcial — confira antes de salvar</p>
                <p className="text-xs text-muted">boleto-fornecedor.pdf</p>
              </div>
            </div>
            <dl className="divide-y divide-line">
              {fields.map(([k, v, ok]) => (
                <div key={k} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <dt className="w-28 shrink-0 text-muted sm:w-36">{k}</dt>
                  <dd className={cx("min-w-0 flex-1 truncate font-medium", !ok && "text-muted")}>{ok ? v : "não identificado — preencha"}</dd>
                  {ok ? <LuCircleCheck className="size-4 shrink-0 text-paid" /> : <span className="size-4 shrink-0 rounded-full border-2 border-dashed border-soon" />}
                </div>
              ))}
            </dl>
            <div className="border-t border-line bg-paid-soft/60 px-5 py-3">
              <p className="break-all font-mono text-[12px] text-ink">23790.00017 23456.789017 72345.678903 1 77160000038990</p>
              <p className="mt-0.5 text-xs font-semibold text-paid">Dígitos verificadores conferem</p>
            </div>
          </div>
        </div>
        <div className="order-1 min-w-0 lg:order-2">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.08]">Do PDF para a conta a pagar, sem digitar</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Selecione o boleto e a Luma lê o texto do documento, encontra a linha digitável e confere os dígitos verificadores — de boletos bancários e de contas de consumo.
          </p>
          <ul className="mt-6 space-y-3 text-[15px]">
            <li className="flex gap-3">
              <LuLock className="mt-0.5 size-5 shrink-0 text-navy-600" />
              <span>
                <strong>Processado no seu navegador.</strong> O arquivo não é enviado a nenhum servidor.
              </span>
            </li>
            <li className="flex gap-3">
              <LuCircleCheck className="mt-0.5 size-5 shrink-0 text-navy-600" />
              <span>
                <strong>Você confirma tudo.</strong> Nada é cadastrado automaticamente, e campos não encontrados ficam em branco.
              </span>
            </li>
            <li className="flex gap-3">
              <LuReceipt className="mt-0.5 size-5 shrink-0 text-navy-600" />
              <span>
                <strong>Sem pagar duas vezes.</strong> A mesma linha digitável não pode ser cadastrada de novo.
              </span>
            </li>
          </ul>
          <p className="mt-6 text-sm text-muted">
            Linha digitável válida indica que os números foram lidos corretamente — não que o boleto seja legítimo. Confira sempre o beneficiário. PDFs escaneados (imagem) ainda não são lidos.
          </p>
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  const items = [
    ["Menos multas e juros", "Avisos escalonados antes de cada vencimento, e uma faixa visual com tudo o que vence nos próximos 30 dias."],
    ["Documentos sempre válidos", "Certificado digital, alvará ou contrato expirando deixam de ser surpresa."],
    ["Visão clara do caixa", "Quanto está em aberto, o que já foi pago e para onde vai o dinheiro, por categoria e por mês."],
    ["Simples para qualquer pessoa", "Interface em português, formatos brasileiros de data e moeda, e funciona bem no celular."],
  ];
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.08]">Feita para pequenas e médias empresas, escritórios e prestadores de serviço</h2>
        <dl className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {items.map(([t, d]) => (
            <div key={t} className="border-t-2 border-ink pt-5">
              <dt className="font-display text-xl font-semibold">{t}</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ["Abra a demonstração", "Não precisa de cadastro. A Luma já vem com dados fictícios para você explorar."],
    ["Cadastre ou importe", "Inclua contas manualmente, importe boletos em PDF e registre despesas recorrentes, contratos e documentos."],
    ["Acompanhe e aja", "Veja alertas, o calendário e os relatórios. Marque contas como pagas e exporte o que precisar."],
  ];
  return (
    <section id="como-funciona" className="scroll-mt-20 bg-navy-900 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem]">Como funciona</h2>
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="relative">
              <span className="font-display text-5xl font-semibold text-sky-400/90">{i + 1}</span>
              <h3 className="mt-3 font-display text-xl font-semibold">{t}</h3>
              <p className="mt-2 leading-relaxed text-white/65">{d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 flex items-center gap-3 rounded-2xl bg-white/5 p-5 text-sm text-white/70">
          <LuMonitorSmartphone className="size-6 shrink-0 text-sky-300" />
          Funciona no computador e no celular, direto no navegador. Nada para instalar.
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  ["A Luma é gratuita?", "Esta versão demonstrativa é gratuita e não exige cadastro. Ela serve para conhecer o produto."],
  ["Onde ficam os meus dados?", "Somente no navegador que você está usando (armazenamento local). Eles não são enviados para servidores e não aparecem em outros dispositivos. Se você limpar os dados do navegador, eles serão apagados — use a opção de backup em “Dados e ajustes”."],
  ["Os boletos em PDF são enviados para algum lugar?", "Não. A leitura acontece dentro do seu navegador, com a biblioteca PDF.js. Se você optar por anexar o PDF à conta, ele também fica guardado apenas no navegador."],
  ["A Luma paga os boletos?", "Não. A Luma organiza e lembra dos vencimentos. O pagamento continua sendo feito no seu banco; depois, basta marcar a conta como paga."],
  ["Quais boletos a leitura automática reconhece?", "Boletos bancários (linha digitável de 47 dígitos) e documentos de arrecadação, como contas de consumo e tributos (48 dígitos), desde que o PDF tenha texto. PDFs digitalizados como imagem precisam ser preenchidos manualmente."],
  ["Recebo alertas por e-mail ou WhatsApp?", "Ainda não. Nesta versão os alertas aparecem dentro da Luma, no ícone de notificações e na central de alertas."],
  ["Posso usar com mais de uma pessoa?", "Nesta demonstração não há login nem compartilhamento. Cada navegador tem seus próprios dados."],
];

function Faq() {
  return (
    <section id="perguntas" className="scroll-mt-20 bg-paper py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.08]">Perguntas frequentes</h2>
          <p className="mt-4 text-muted">O que você precisa saber sobre esta versão.</p>
        </div>
        <div className="divide-y divide-line rounded-2xl border border-line bg-white">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-5 py-1 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <LuChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-5 leading-relaxed text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Experimente a Luma agora</h2>
          <p className="mt-2 max-w-xl text-muted">Versão demonstrativa: sem login, sem servidor, com dados armazenados localmente no seu navegador.</p>
        </div>
        <CTA variant="dark" />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-navy-950 py-12 text-white/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-3 text-sm">Sua empresa. Tudo sob controle.</p>
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-white/45">Versão demonstrativa. Os dados ficam armazenados apenas no navegador de quem usa. Não há autenticação, banco de dados on-line, envio de notificações ou cobrança.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Produto</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a className="hover:text-white" href="#funcionalidades">Funcionalidades</a></li>
            <li><a className="hover:text-white" href="#boletos">Leitura de boletos</a></li>
            <li><a className="hover:text-white" href={APP}>Demonstração</a></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Ajuda</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a className="hover:text-white" href="#como-funciona">Como funciona</a></li>
            <li><a className="hover:text-white" href="#perguntas">Perguntas frequentes</a></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-6xl border-t border-white/10 px-4 pt-6 text-xs text-white/40 sm:px-6">© {new Date().getFullYear()} Luma. Projeto demonstrativo.</div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <Boletos />
        <Benefits />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
