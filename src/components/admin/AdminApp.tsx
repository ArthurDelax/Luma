"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  LuBuilding2,
  LuCircleCheck,
  LuCopy,
  LuHistory,
  LuKeyRound,
  LuLink,
  LuLogOut,
  LuMail,
  LuPencil,
  LuPlus,
  LuRefreshCw,
  LuSearch,
  LuShieldCheck,
  LuUsers,
} from "react-icons/lu";
import { formatDate, isValidISO, todayISO, addMonthsClamped } from "@/lib/dates";
import { amountToInput, formatBRL, formatCNPJ, isValidCNPJ, normalizeText, parseBRL } from "@/lib/format";
import { href } from "@/lib/paths";
import { MAX_USERS, MIN_USERS, monthlyPrice } from "@/lib/pricing";
import {
  currentSession,
  enrollTotp,
  getUser,
  rpc,
  sessionAal,
  signIn,
  signOut,
  supabaseConfigured,
  verifyTotp,
  type Session,
  type TotpEnrollment,
} from "@/lib/supabase";
import { Badge, Button, cx, EmptyState, Field, IconButton, Input, Logo, Modal, Segmented, Select, Textarea, ToastProvider, useToast, type Tone } from "../ui";

/* ------------------------------------------------------------------ */
/* Tipos                                                                */
/* ------------------------------------------------------------------ */

interface Org {
  id: string;
  name: string;
  cnpj: string | null;
  responsible_name: string;
  responsible_email: string;
  licenses: number;
  monthly_price_cents: number;
  next_due_date: string | null;
  status: "ativa" | "inadimplente" | "suspensa" | "cancelada";
  sale_origin: string;
  admin_notes: string | null;
  created_at: string;
  active_users: number;
  invite_status: "ativado" | "pendente" | "expirado";
}

interface Stats {
  total: number;
  ativas: number;
  inadimplentes: number;
  suspensas: number;
  canceladas: number;
  criadas_mes: number;
  licencas: number;
  usuarios_ativos: number;
  receita_mensal_centavos: number;
  convites_pendentes: number;
}

interface AuditRow {
  created_at: string;
  action: string;
  org_name: string | null;
  actor_email: string | null;
  details: Record<string, unknown>;
}

const STATUS_LABEL: Record<Org["status"], string> = { ativa: "Ativa", inadimplente: "Inadimplente", suspensa: "Suspensa", cancelada: "Cancelada" };
const STATUS_TONE: Record<Org["status"], Tone> = { ativa: "paid", inadimplente: "soon", suspensa: "overdue", cancelada: "neutral" };
const INVITE_LABEL: Record<Org["invite_status"], [string, Tone]> = { ativado: ["Acesso ativado", "paid"], pendente: ["Convite pendente", "info"], expirado: ["Convite expirado", "soon"] };
const ORIGINS = ["Venda direta", "WhatsApp", "Indicação", "Parceiro", "Evento", "Outro"];
const ACTION_LABEL: Record<string, string> = {
  empresa_criada: "Empresa criada",
  empresa_atualizada: "Empresa atualizada",
  convite_reenviado: "Novo link de ativação",
  convite_aceito: "Convite aceito",
};

const IDLE_LIMIT_MS = 30 * 60 * 1000;

function activationLink(token: string) {
  return `${window.location.origin}${href("/convite/")}#token=${token}`;
}

/* ------------------------------------------------------------------ */
/* Estrutura                                                            */
/* ------------------------------------------------------------------ */

export function AdminApp() {
  return (
    <ToastProvider>
      <AdminGate />
    </ToastProvider>
  );
}

type Stage = "loading" | "unconfigured" | "login" | "denied" | "mfa-enroll" | "mfa-verify" | "ready";

function AdminGate() {
  const [stage, setStage] = useState<Stage>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);

  const evaluate = useCallback(async (s: Session | null) => {
    if (!s) {
      setSession(null);
      setStage("login");
      return;
    }
    setSession(s);
    const isAdmin = await rpc<boolean>("am_i_platform_admin", {}, s).catch(() => false);
    if (!isAdmin) {
      setStage("denied");
      return;
    }
    if (sessionAal(s) === "aal2") {
      setStage("ready");
      return;
    }
    const user = await getUser(s);
    const verified = (user.factors ?? []).find((f) => f.factor_type === "totp" && f.status === "verified");
    if (verified) {
      setFactorId(verified.id);
      setStage("mfa-verify");
    } else {
      setStage("mfa-enroll");
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured()) {
      setStage("unconfigured");
      return;
    }
    currentSession().then(evaluate).catch(() => setStage("login"));
  }, [evaluate]);

  // Encerra a sessão após 30 minutos sem atividade.
  const lastActivity = useRef(Date.now());
  useEffect(() => {
    if (stage !== "ready") return;
    const bump = () => (lastActivity.current = Date.now());
    const events = ["mousemove", "keydown", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(async () => {
      if (Date.now() - lastActivity.current > IDLE_LIMIT_MS) {
        await signOut();
        setStage("login");
      }
    }, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(t);
    };
  }, [stage]);

  const logout = async () => {
    await signOut();
    setSession(null);
    setStage("login");
  };

  if (stage === "ready" && session) return <AdminDashboard session={session} onLogout={logout} onSessionExpired={() => setStage("login")} />;

  return (
    <div className="dot-grid flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <a href={href("/")} className="mb-8" aria-label="Luma — início">
        <Logo />
      </a>
      <div className="card w-full max-w-md p-6 sm:p-8">
        {stage === "loading" && <p className="text-center text-sm text-muted">Carregando…</p>}
        {stage === "unconfigured" && (
          <div className="text-center">
            <h1 className="font-display text-xl font-semibold">Painel ainda não conectado</h1>
            <p className="mt-2 text-sm text-muted">O banco de dados da plataforma ainda não foi configurado neste site.</p>
          </div>
        )}
        {stage === "login" && <LoginForm onDone={evaluate} />}
        {stage === "denied" && (
          <div className="text-center">
            <h1 className="font-display text-xl font-semibold">Acesso restrito</h1>
            <p className="mt-2 text-sm text-muted">Esta área é exclusiva da administração da plataforma Luma.</p>
            <Button className="mt-6" variant="secondary" onClick={logout}>
              Sair
            </Button>
          </div>
        )}
        {stage === "mfa-enroll" && session && <MfaEnroll session={session} onDone={evaluate} onCancel={logout} />}
        {stage === "mfa-verify" && session && factorId && <MfaVerify session={session} factorId={factorId} onDone={evaluate} onCancel={logout} />}
      </div>
      <p className="mt-6 flex items-center gap-1.5 text-xs text-muted">
        <LuShieldCheck className="size-3.5" /> Acesso protegido com verificação em duas etapas
      </p>
    </div>
  );
}

function LoginForm({ onDone }: { onDone: (s: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onDone(await signIn(email.trim(), password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">Administração da plataforma</h1>
        <p className="mt-1 text-sm text-muted">Entre com sua conta de administrador.</p>
      </div>
      <Field label="E-mail" htmlFor="adm-email">
        <Input id="adm-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Senha" htmlFor="adm-pass">
        <Input id="adm-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error && (
        <p role="alert" className="rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      id="mfa-code"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      placeholder="000000"
      className="text-center font-display text-2xl tracking-[0.4em]"
      data-autofocus
    />
  );
}

function MfaEnroll({ session, onDone, onCancel }: { session: Session; onDone: (s: Session) => void; onCancel: () => void }) {
  const [enroll, setEnroll] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    enrollTotp(session)
      .then(setEnroll)
      .catch((e) => setError(e instanceof Error ? e.message : "Não foi possível iniciar a verificação em duas etapas."));
  }, [session]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!enroll) return;
    setBusy(true);
    setError("");
    try {
      onDone(await verifyTotp(session, enroll.id, code));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">Ative a verificação em duas etapas</h1>
        <p className="mt-1 text-sm text-muted">Obrigatória para o painel. Escaneie o QR Code com um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy…) e digite o código de 6 dígitos.</p>
      </div>
      {enroll ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr_code} alt="QR Code para o aplicativo autenticador" className="size-44" />
          <div className="text-center">
            <p className="text-xs text-muted">Não conseguiu escanear? No aplicativo, escolha “inserir chave de configuração” e digite:</p>
            <p className="mt-1 select-all break-all font-mono text-sm font-semibold tracking-wider">{enroll.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
          </div>
        </div>
      ) : (
        !error && <p className="text-sm text-muted">Gerando QR Code…</p>
      )}
      <Field label="Código do aplicativo" htmlFor="mfa-code">
        <CodeInput value={code} onChange={setCode} />
      </Field>
      {error && (
        <p role="alert" className="rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Sair
        </Button>
        <Button type="submit" className="flex-1" disabled={busy || code.length !== 6 || !enroll}>
          {busy ? "Verificando…" : "Ativar e entrar"}
        </Button>
      </div>
    </form>
  );
}

function MfaVerify({ session, factorId, onDone, onCancel }: { session: Session; factorId: string; onDone: (s: Session) => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onDone(await verifyTotp(session, factorId, code));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">Verificação em duas etapas</h1>
        <p className="mt-1 text-sm text-muted">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>
      </div>
      <Field label="Código" htmlFor="mfa-code">
        <CodeInput value={code} onChange={setCode} />
      </Field>
      {error && (
        <p role="alert" className="rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Sair
        </Button>
        <Button type="submit" className="flex-1" disabled={busy || code.length !== 6}>
          {busy ? "Verificando…" : "Entrar"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Painel                                                               */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, sub, dark, icon }: { label: string; value: string; sub?: string; dark?: boolean; icon: ReactNode }) {
  return (
    <div className={cx("rounded-[20px] p-5", dark ? "dot-grid-light bg-ink text-paper shadow-[var(--shadow-pop)]" : "card")}>
      <div className="flex items-center gap-2">
        <span className={cx("grid size-8 place-items-center rounded-full [&>svg]:size-4", dark ? "bg-paper/10 text-paper" : "bg-sky-100 text-ink")}>{icon}</span>
        <span className={cx("text-[13px] font-semibold", dark ? "text-paper/60" : "text-muted")}>{label}</span>
      </div>
      <p className="mt-4 font-display text-[2rem] font-semibold leading-none tracking-[-0.03em] tabular">{value}</p>
      {sub && <p className={cx("mt-1.5 text-xs", dark ? "text-paper/50" : "text-muted")}>{sub}</p>}
    </div>
  );
}

function AdminDashboard({ session, onLogout, onSessionExpired }: { session: Session; onLogout: () => void; onSessionExpired: () => void }) {
  const toast = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [tab, setTab] = useState<"empresas" | "historico">("empresas");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"todas" | Org["status"]>("todas");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Org | null>(null);
  const [link, setLink] = useState<{ org: string; email: string; url: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const call = useCallback(
    async <T,>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
      const s = (await currentSession()) ?? session;
      try {
        return await rpc<T>(fn, args, s);
      } catch (e) {
        if (e instanceof Error && /jwt|token|401/i.test(e.message)) onSessionExpired();
        throw e;
      }
    },
    [session, onSessionExpired],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [st, list, hist] = await Promise.all([call<Stats>("admin_stats"), call<Org[]>("admin_list_organizations"), call<AuditRow[]>("admin_audit", { p_limit: 60 })]);
      setStats(st);
      setOrgs(list);
      setAudit(hist);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
    }
  }, [call, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const nq = normalizeText(q);
    return orgs.filter((o) => (status === "todas" || o.status === status) && (!nq || normalizeText(`${o.name} ${o.responsible_name} ${o.responsible_email} ${o.cnpj ?? ""}`).includes(nq)));
  }, [orgs, q, status]);

  const newLink = async (o: Org) => {
    try {
      const token = await call<string>("admin_regenerate_invite", { p_org: o.id });
      setLink({ org: o.name, email: o.responsible_email, url: activationLink(token) });
      void reload();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Não foi possível gerar o link.");
    }
  };

  const email = String(session.user.email ?? "");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Logo />
          <span className="hidden rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-paper sm:inline">Administração</span>
          <span className="ml-auto hidden text-sm text-muted sm:inline">{email}</span>
          <IconButton label="Atualizar" onClick={() => reload()}>
            <LuRefreshCw className={cx("size-4", loading && "animate-spin")} />
          </IconButton>
          <Button variant="secondary" size="sm" icon={<LuLogOut className="size-4" />} onClick={onLogout}>
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-[1.9rem] font-semibold tracking-[-0.03em] sm:text-[2.3rem]">Painel da plataforma</h1>
            <p className="text-sm text-muted">Empresas, assinaturas e ambientes criados na Luma.</p>
          </div>
          <Button icon={<LuPlus className="size-4" />} onClick={() => setCreating(true)}>
            Criar empresa
          </Button>
        </div>

        <section className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard dark label="Bases criadas" value={String(stats?.total ?? "—")} sub={stats ? `${stats.criadas_mes} neste mês` : undefined} icon={<LuBuilding2 />} />
          <StatCard label="Ativas" value={String(stats?.ativas ?? "—")} sub={stats ? `${stats.inadimplentes} inadimplentes · ${stats.suspensas} suspensas` : undefined} icon={<LuCircleCheck />} />
          <StatCard label="Receita mensal" value={stats ? formatBRL(stats.receita_mensal_centavos / 100) : "—"} sub="Empresas ativas e inadimplentes" icon={<LuKeyRound />} />
          <StatCard label="Licenças" value={String(stats?.licencas ?? "—")} sub={stats ? `${stats.usuarios_ativos} usuários ativos · ${stats.convites_pendentes} convites pendentes` : undefined} icon={<LuUsers />} />
        </section>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            label="Seção"
            value={tab}
            onChange={setTab}
            options={[
              { value: "empresas", label: "Empresas", count: orgs.length },
              { value: "historico", label: "Histórico" },
            ]}
          />
          {tab === "empresas" && (
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-64">
                <LuSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar empresa ou responsável" className="pl-9" aria-label="Buscar empresas" />
              </div>
              <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-auto" aria-label="Filtrar por situação">
                <option value="todas">Todas</option>
                {(Object.keys(STATUS_LABEL) as Org["status"][]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {tab === "empresas" ? (
          <div className="card overflow-hidden">
            {filtered.length === 0 ? (
              <EmptyState icon={<LuBuilding2 className="size-6" />} title={orgs.length ? "Nenhuma empresa encontrada" : "Nenhuma empresa criada ainda"} action={!orgs.length && <Button onClick={() => setCreating(true)}>Criar primeira empresa</Button>}>
                {orgs.length ? "Ajuste a busca ou o filtro." : "Crie o ambiente de um cliente e envie o link de ativação para o responsável."}
              </EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-paper/70 text-left text-xs font-semibold text-muted">
                      <th className="px-5 py-3">Empresa</th>
                      <th className="px-3 py-3">Situação</th>
                      <th className="px-3 py-3">Usuários</th>
                      <th className="px-3 py-3 text-right">Mensalidade</th>
                      <th className="px-3 py-3">Vencimento</th>
                      <th className="px-5 py-3 text-right">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map((o) => (
                      <tr key={o.id} className="hover:bg-sky-50/50">
                        <td className="px-5 py-3">
                          <p className="font-semibold">{o.name}</p>
                          <p className="text-xs text-muted">
                            {o.responsible_name} — {o.responsible_email}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <Badge tone={STATUS_TONE[o.status]} dot>
                              {STATUS_LABEL[o.status]}
                            </Badge>
                            <Badge tone={INVITE_LABEL[o.invite_status][1]}>{INVITE_LABEL[o.invite_status][0]}</Badge>
                          </div>
                        </td>
                        <td className="px-3 py-3 tabular">
                          {o.active_users} / {o.licenses}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular">{formatBRL(o.monthly_price_cents / 100)}</td>
                        <td className="px-3 py-3 tabular">{formatDate(o.next_due_date ?? undefined)}</td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-0.5">
                            {o.invite_status !== "ativado" && (
                              <IconButton label="Gerar novo link de ativação" onClick={() => newLink(o)}>
                                <LuLink className="size-4" />
                              </IconButton>
                            )}
                            <IconButton label="Editar assinatura" onClick={() => setEditing(o)}>
                              <LuPencil className="size-4" />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            {audit.length === 0 ? (
              <EmptyState icon={<LuHistory className="size-6" />} title="Nenhuma ação registrada" />
            ) : (
              <ul className="divide-y divide-line">
                {audit.map((a, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                    <span className="w-36 shrink-0 text-xs text-muted tabular">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
                    <span className="font-semibold">{ACTION_LABEL[a.action] ?? a.action}</span>
                    <span className="text-muted">{a.org_name ?? "—"}</span>
                    <span className="ml-auto text-xs text-muted">{a.actor_email ?? ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="mt-6 text-xs text-muted">
          Este painel administra empresas e assinaturas. Ele não dá acesso aos dados financeiros dos clientes. A sessão é encerrada após 30 minutos sem uso.
        </p>
      </main>

      {creating && (
        <CreateOrgModal
          call={call}
          onClose={() => setCreating(false)}
          onCreated={(org, mail, token) => {
            setCreating(false);
            setLink({ org, email: mail, url: activationLink(token) });
            void reload();
          }}
        />
      )}
      {editing && (
        <EditOrgModal
          org={editing}
          call={call}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast("success", "Assinatura atualizada.");
            void reload();
          }}
        />
      )}
      {link && <LinkModal {...link} onClose={() => setLink(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modais                                                               */
/* ------------------------------------------------------------------ */

type Caller = <T>(fn: string, args?: Record<string, unknown>) => Promise<T>;

function CreateOrgModal({ call, onClose, onCreated }: { call: Caller; onClose: () => void; onCreated: (org: string, email: string, token: string) => void }) {
  const [f, setF] = useState({
    name: "",
    cnpj: "",
    responsible: "",
    email: "",
    licenses: "2",
    price: amountToInput(monthlyPrice(2)),
    due: addMonthsClamped(todayISO(), 1),
    origin: ORIGINS[0],
    notes: "",
  });
  const [priceTouched, setPriceTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");
  const set = (k: keyof typeof f, v: string) => {
    setF((s) => {
      const next = { ...s, [k]: v };
      if (k === "licenses" && !priceTouched) {
        const n = Number(v);
        if (n >= MIN_USERS && n <= MAX_USERS) next.price = amountToInput(monthlyPrice(n));
      }
      return next;
    });
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    const licenses = Number(f.licenses);
    const price = parseBRL(f.price);
    if (f.name.trim().length < 2) err.name = "Informe o nome da empresa.";
    if (f.cnpj.trim() && !isValidCNPJ(f.cnpj)) err.cnpj = "CNPJ inválido.";
    if (f.responsible.trim().length < 2) err.responsible = "Informe o nome do responsável.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) err.email = "Informe um e-mail válido.";
    if (!Number.isInteger(licenses) || licenses < MIN_USERS || licenses > MAX_USERS) err.licenses = `Entre ${MIN_USERS} e ${MAX_USERS}.`;
    if (price === undefined || price < 0) err.price = "Informe o valor mensal.";
    if (!isValidISO(f.due)) err.due = "Informe a data de vencimento.";
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    setServerError("");
    try {
      const r = await call<{ org_id: string; token: string }>("admin_create_organization", {
        p_name: f.name.trim(),
        p_cnpj: f.cnpj.trim() || null,
        p_responsible_name: f.responsible.trim(),
        p_responsible_email: f.email.trim(),
        p_licenses: licenses,
        p_monthly_price_cents: Math.round(price! * 100),
        p_next_due_date: f.due,
        p_sale_origin: f.origin,
        p_admin_notes: f.notes.trim() || null,
      });
      onCreated(f.name.trim(), f.email.trim().toLowerCase(), r.token);
    } catch (e2) {
      setServerError(e2 instanceof Error ? e2.message : "Não foi possível criar a empresa.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Criar empresa"
      description="O ambiente é criado vazio e o responsável recebe um link para ativar o acesso."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="org-form" disabled={busy}>
            {busy ? "Criando…" : "Criar empresa"}
          </Button>
        </>
      }
    >
      <form id="org-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome da empresa" htmlFor="o-name" required error={errors.name} className="sm:col-span-2">
          <Input id="o-name" value={f.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} maxLength={120} />
        </Field>
        <Field label="CNPJ" htmlFor="o-cnpj" error={errors.cnpj} hint="Opcional">
          <Input id="o-cnpj" value={f.cnpj} onChange={(e) => set("cnpj", e.target.value)} onBlur={() => f.cnpj && set("cnpj", formatCNPJ(f.cnpj))} inputMode="numeric" invalid={!!errors.cnpj} />
        </Field>
        <Field label="Origem da venda" htmlFor="o-origin">
          <Select id="o-origin" value={f.origin} onChange={(e) => set("origin", e.target.value)}>
            {ORIGINS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
        <Field label="Nome do responsável" htmlFor="o-resp" required error={errors.responsible}>
          <Input id="o-resp" value={f.responsible} onChange={(e) => set("responsible", e.target.value)} invalid={!!errors.responsible} maxLength={120} />
        </Field>
        <Field label="E-mail do responsável" htmlFor="o-email" required error={errors.email} hint="O convite só pode ser aceito com este e-mail.">
          <Input id="o-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
        </Field>
        <Field label="Licenças (usuários)" htmlFor="o-lic" required error={errors.licenses}>
          <Input id="o-lic" type="number" min={MIN_USERS} max={MAX_USERS} value={f.licenses} onChange={(e) => set("licenses", e.target.value)} invalid={!!errors.licenses} />
        </Field>
        <Field label="Valor mensal (R$)" htmlFor="o-price" required error={errors.price} hint={priceTouched ? "Valor negociado" : "Preenchido pela tabela de preços"}>
          <Input
            id="o-price"
            value={f.price}
            inputMode="decimal"
            className="tabular"
            onChange={(e) => {
              setPriceTouched(true);
              set("price", e.target.value);
            }}
            invalid={!!errors.price}
          />
        </Field>
        <Field label="Vencimento da assinatura" htmlFor="o-due" required error={errors.due}>
          <Input id="o-due" type="date" value={f.due} onChange={(e) => set("due", e.target.value)} invalid={!!errors.due} />
        </Field>
        <Field label="Observações administrativas" htmlFor="o-notes" className="sm:col-span-2">
          <Textarea id="o-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} />
        </Field>
        {serverError && (
          <p role="alert" className="rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue sm:col-span-2">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}

function EditOrgModal({ org, call, onClose, onSaved }: { org: Org; call: Caller; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    licenses: String(org.licenses),
    price: amountToInput(org.monthly_price_cents / 100),
    due: org.next_due_date ?? "",
    status: org.status,
    notes: org.admin_notes ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const licenses = Number(f.licenses);
    const price = parseBRL(f.price);
    if (!Number.isInteger(licenses) || licenses < MIN_USERS || licenses > MAX_USERS) return setError(`Licenças devem estar entre ${MIN_USERS} e ${MAX_USERS}.`);
    if (price === undefined || price < 0) return setError("Informe o valor mensal.");
    setBusy(true);
    setError("");
    try {
      await call("admin_update_organization", {
        p_org: org.id,
        p_licenses: licenses,
        p_monthly_price_cents: Math.round(price * 100),
        p_next_due_date: f.due || null,
        p_status: f.status,
        p_admin_notes: f.notes,
      });
      onSaved();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={org.name}
      description={`Criada em ${new Date(org.created_at).toLocaleDateString("pt-BR")} · ${org.sale_origin}${org.cnpj ? ` · CNPJ ${formatCNPJ(org.cnpj)}` : ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-org" disabled={busy}>
            {busy ? "Salvando…" : "Salvar alterações"}
          </Button>
        </>
      }
    >
      <form id="edit-org" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Situação" htmlFor="e-status">
          <Select id="e-status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Org["status"] })}>
            {(Object.keys(STATUS_LABEL) as Org["status"][]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Licenças" htmlFor="e-lic" hint={`${org.active_users} em uso`}>
          <Input id="e-lic" type="number" min={MIN_USERS} max={MAX_USERS} value={f.licenses} onChange={(e) => setF({ ...f, licenses: e.target.value })} />
        </Field>
        <Field label="Valor mensal (R$)" htmlFor="e-price">
          <Input id="e-price" value={f.price} inputMode="decimal" onChange={(e) => setF({ ...f, price: e.target.value })} />
        </Field>
        <Field label="Vencimento" htmlFor="e-due">
          <Input id="e-due" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
        </Field>
        <Field label="Observações administrativas" htmlFor="e-notes" className="sm:col-span-2">
          <Textarea id="e-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <p className="text-xs text-muted sm:col-span-2">
          Suspender não apaga nenhum dado: a empresa pode ser reativada a qualquer momento. Responsável: {org.responsible_name} ({org.responsible_email}).
        </p>
        {error && (
          <p role="alert" className="rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function LinkModal({ org, email, url, onClose }: { org: string; email: string; url: string; onClose: () => void }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("success", "Link copiado.");
    } catch {
      toast("error", "Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  };
  const subject = encodeURIComponent(`Ative seu acesso à Luma — ${org}`);
  const body = encodeURIComponent(
    `Olá!\n\nO ambiente da ${org} na Luma está pronto.\n\nPara ativar seu acesso e criar sua senha, abra o link abaixo (válido por 7 dias e de uso único):\n${url}\n\nUse este e-mail (${email}) para criar a conta.\n\nEquipe Luma`,
  );
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Link de ativação"
      description={`${org} — enviar para ${email}`}
      footer={
        <>
          <a href={`mailto:${email}?subject=${subject}&body=${body}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-5 text-sm font-semibold hover:border-ink/30">
            <LuMail className="size-4" /> Enviar por e-mail
          </a>
          <Button icon={<LuCopy className="size-4" />} onClick={copy}>
            Copiar link
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="break-all rounded-xl border border-line bg-paper p-3 font-mono text-[12px]">{url}</p>
        <ul className="space-y-1 text-slate-600">
          <li>• Válido por 7 dias e utilizável uma única vez.</li>
          <li>• Só funciona com o e-mail {email}; o próprio responsável cria a senha.</li>
          <li>• Este link aparece só agora. Se perder, gere um novo — o anterior deixa de valer.</li>
        </ul>
      </div>
    </Modal>
  );
}
