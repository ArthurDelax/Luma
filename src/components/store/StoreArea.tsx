"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { LuChevronRight, LuCircleCheck, LuLock, LuMailCheck, LuMessageCircle, LuStore, LuTriangleAlert } from "react-icons/lu";
import { whatsappLink, whatsappPaymentLink } from "@/lib/contact";
import { menuUrl } from "@/lib/menu/links";
import { CloudMenuRepo } from "@/lib/menu/repo";
import { ROLE_LABEL, type OrgInfo } from "@/lib/orgs";
import { href } from "@/lib/paths";
import {
  currentSession,
  requestPasswordReset,
  rpc,
  sessionFromUrlHash,
  signIn,
  signOut,
  supabaseConfigured,
  updatePassword,
  type Session,
} from "@/lib/supabase";
import { WorkspaceProvider, type Workspace } from "@/lib/workspace";
import { MenuEditor } from "../menu/editor/MenuEditor";
import { Button, Field, Input, Logo } from "../ui";

const LAST_ORG_KEY = "luma:last-org";
const PENDING_INVITE_KEY = "luma:pending-invite";

type Stage = "loading" | "unconfigured" | "login" | "forgot" | "reset" | "reset-invalid" | "choose" | "no-org" | "error" | "blocked" | "app";

const MIN_PASSWORD = 10;

/** Lê o retorno do link de redefinição de senha (#access_token=…&type=recovery ou #error=…). */
function recoveryHash(): "recovery" | "error" | null {
  const p = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (p.get("type") === "recovery" && p.get("access_token")) return "recovery";
  if (p.get("error_code") || p.get("error_description")) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return "error";
  }
  return null;
}

const STATUS_LABEL: Record<OrgInfo["status"], string> = {
  ativa: "Ativa",
  inadimplente: "Pagamento pendente",
  suspensa: "Acesso suspenso",
  cancelada: "Cancelada",
};

function remember(orgId: string) {
  try {
    window.localStorage.setItem(LAST_ORG_KEY, orgId);
  } catch {
    /* ignorado */
  }
}

export function StoreArea() {
  const [stage, setStage] = useState<Stage>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [error, setError] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  /** Retorno do link de redefinição, lido uma única vez (o endereço é limpo logo em seguida). */
  const recovery = useRef<{ kind: "error" } | { kind: "recovery"; session: Promise<Session | null> } | null | undefined>(undefined);

  const open = useCallback((o: OrgInfo) => {
    remember(o.org_id);
    setOrg(o);
    // Empresa suspensa pelo administrador (inadimplência): mostra o aviso em vez do painel.
    setStage(o.status === "suspensa" ? "blocked" : "app");
  }, []);

  const afterLogin = useCallback(
    async (s: Session | null) => {
      if (!s) {
        setStage("login");
        return;
      }
      setSession(s);
      try {
        const list = (await rpc<OrgInfo[]>("my_organizations", {}, s)).filter((o) => o.status !== "cancelada");
        setOrgs(list);
        if (list.length === 0) {
          setStage("no-org");
          return;
        }
        let last: string | null = null;
        try {
          last = window.localStorage.getItem(LAST_ORG_KEY);
        } catch {
          /* ignorado */
        }
        const pick = list.length === 1 ? list[0] : list.find((o) => o.org_id === last);
        if (pick) open(pick);
        else setStage("choose");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível carregar suas lojas.");
        setStage("error");
      }
    },
    [open],
  );

  useEffect(() => {
    if (!supabaseConfigured()) {
      setStage("unconfigured");
      return;
    }
    if (recovery.current === undefined) {
      const kind = recoveryHash();
      recovery.current = kind === "recovery" ? { kind, session: sessionFromUrlHash() } : kind === "error" ? { kind } : null;
    }
    const r = recovery.current;
    if (r?.kind === "error") {
      setStage("reset-invalid");
      return;
    }
    if (r?.kind === "recovery") {
      r.session
        .then((s) => {
          if (!s) return setStage("reset-invalid");
          setSession(s);
          setStage("reset");
        })
        .catch(() => setStage("reset-invalid"));
      return;
    }
    currentSession()
      .then(afterLogin)
      .catch(() => setStage("login"));
  }, [afterLogin]);

  const logout = useCallback(async () => {
    await signOut();
    setSession(null);
    setOrg(null);
    setStage("login");
    window.location.hash = "";
  }, []);

  // Com o painel aberto, confere de tempos em tempos se o administrador suspendeu a empresa.
  const orgId = org?.org_id;
  useEffect(() => {
    if (stage !== "app" || !orgId) return;
    const check = async () => {
      const s = await currentSession();
      if (!s) return;
      try {
        const fresh = (await rpc<OrgInfo[]>("my_organizations", {}, s)).find((o) => o.org_id === orgId);
        if (fresh?.status === "suspensa") {
          setOrg(fresh);
          setStage("blocked");
        }
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    };
    const t = setInterval(check, 5 * 60_000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [stage, orgId]);

  const orgName = org?.name;
  const repo = useMemo(() => (orgId && orgName ? new CloudMenuRepo(orgId, orgName) : undefined), [orgId, orgName]);

  if (stage === "app" && org && repo) {
    const switchOrg = orgs.length > 1 ? () => setStage("choose") : undefined;
    const workspace: Workspace = { mode: "cloud", orgId: org.org_id, orgName: org.name, role: org.role, status: org.status, email: session?.user.email, logout, switchOrg };
    const pay = whatsappPaymentLink(org.name);
    return (
      <WorkspaceProvider value={workspace}>
        <MenuEditor
          key={org.org_id}
          repo={repo}
          orgName={org.name}
          readOnly={org.role === "consulta"}
          publicUrl={menuUrl}
          session={{
            kind: "client",
            email: session?.user.email,
            roleLabel: ROLE_LABEL[org.role],
            onLogout: logout,
            switchOrg,
            banner:
              org.status === "inadimplente" ? (
                <div className="bg-soon-soft px-4 py-2.5 text-center text-sm font-medium text-soon">
                  Há uma mensalidade em aberto na assinatura da loja.{" "}
                  {pay && (
                    <a href={pay} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                      Regularizar pelo WhatsApp
                    </a>
                  )}
                </div>
              ) : undefined,
          }}
        />
      </WorkspaceProvider>
    );
  }

  const wa = whatsappLink();

  return (
    <div className="dot-grid flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <a href={href("/")} className="mb-8" aria-label="Luma — início">
        <Logo />
      </a>
      <div className="card w-full max-w-md p-6 sm:p-8">
        {stage === "loading" && <p className="text-center text-sm text-muted">Carregando…</p>}

        {stage === "unconfigured" && <p className="text-center text-sm text-muted">O acesso de clientes ainda não está disponível.</p>}

        {stage === "login" && (
          <ClientLogin
            email={loginEmail}
            onEmailChange={setLoginEmail}
            onDone={afterLogin}
            onForgot={() => setStage("forgot")}
          />
        )}

        {stage === "forgot" && <ForgotPassword initialEmail={loginEmail} onBack={() => setStage("login")} />}

        {stage === "reset" && session && <ResetPassword session={session} onDone={() => afterLogin(session)} />}

        {stage === "reset-invalid" && (
          <div className="text-center">
            <LuTriangleAlert className="mx-auto size-10 text-soon" />
            <h1 className="mt-3 font-display text-xl font-semibold">Link inválido ou expirado</h1>
            <p className="mt-2 text-sm text-muted">O link de redefinição de senha já foi usado ou expirou. Peça um novo.</p>
            <Button className="mt-6 w-full" onClick={() => setStage("forgot")}>
              Pedir novo link
            </Button>
            <Button variant="secondary" className="mt-2 w-full" onClick={() => setStage("login")}>
              Voltar para o login
            </Button>
          </div>
        )}

        {stage === "choose" && (
          <div>
            <h1 className="font-display text-xl font-semibold">Escolha a loja</h1>
            <p className="mt-1 text-sm text-muted">Sua conta tem acesso a mais de uma loja.</p>
            <ul className="mt-5 space-y-2">
              {orgs.map((o) => (
                <li key={o.org_id}>
                  <button type="button" onClick={() => open(o)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left transition-colors hover:border-ink/30">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper">
                      <LuStore className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{o.name}</span>
                      <span className="block text-xs text-muted">
                        {ROLE_LABEL[o.role]} · {STATUS_LABEL[o.status]}
                      </span>
                    </span>
                    <LuChevronRight className="size-5 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
            <Button variant="secondary" className="mt-5 w-full" onClick={logout}>
              Sair
            </Button>
          </div>
        )}

        {stage === "blocked" && org && (
          <div className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-overdue-soft">
              <LuLock className="size-7 text-overdue" />
            </span>
            <h1 className="mt-4 font-display text-xl font-semibold">Acesso suspenso por pendência de pagamento</h1>
            <p className="mt-3 text-sm text-muted">
              O painel e o cardápio da <strong className="text-ink">{org.name}</strong> estão temporariamente fora do ar porque identificamos mensalidades em aberto na assinatura.
            </p>
            <p className="mt-3 text-sm text-muted">
              <strong className="text-ink">O cardápio, as fotos e os preços estão guardados e nada foi apagado.</strong> Assim que o pagamento for regularizado, tudo volta ao ar como estava.
            </p>
            {whatsappPaymentLink(org.name) ? (
              <a
                href={whatsappPaymentLink(org.name)!}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-paper hover:bg-navy-700"
              >
                <LuMessageCircle className="size-4" /> Regularizar pelo WhatsApp
              </a>
            ) : (
              <p className="mt-6 text-sm font-semibold text-ink">Entre em contato com a Luma para regularizar o pagamento.</p>
            )}
            {orgs.length > 1 && (
              <Button variant="secondary" className="mt-2 w-full" onClick={() => setStage("choose")}>
                Escolher outra loja
              </Button>
            )}
            <Button variant="secondary" className="mt-2 w-full" onClick={logout}>
              Sair
            </Button>
            <p className="mt-4 text-xs text-muted">Se você já pagou, envie o comprovante pelo WhatsApp para agilizar a liberação.</p>
          </div>
        )}

        {stage === "no-org" && (
          <div className="text-center">
            <h1 className="font-display text-xl font-semibold">Nenhuma loja vinculada</h1>
            <p className="mt-2 text-sm text-muted">Sua conta ainda não tem acesso a nenhuma loja ativa na Luma.</p>
            {hasPendingInvite() ? (
              <a href={href("/convite/")} className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-ink px-6 text-sm font-semibold text-paper hover:bg-navy-700">
                Concluir ativação do convite
              </a>
            ) : (
              <p className="mt-2 text-sm text-muted">Se você recebeu um link de ativação, abra-o para liberar o acesso.</p>
            )}
            <Button variant="secondary" className="mt-4 w-full" onClick={logout}>
              Sair
            </Button>
          </div>
        )}

        {stage === "error" && (
          <div className="text-center">
            <h1 className="font-display text-xl font-semibold">Algo deu errado</h1>
            <p className="mt-2 text-sm text-muted">{error}</p>
            <div className="mt-6 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={logout}>
                Sair
              </Button>
              <Button className="flex-1" onClick={() => currentSession().then(afterLogin)}>
                Tentar de novo
              </Button>
            </div>
          </div>
        )}
      </div>

      {stage === "login" && (
        <div className="mt-6 max-w-md text-center text-xs text-muted">
          <p>
            Ainda não é cliente?{" "}
            <a href={href("/planos/")} className="font-semibold text-ink underline-offset-2 hover:underline">
              Conheça os planos
            </a>{" "}
            ou{" "}
            <a href={href("/app/")} className="font-semibold text-ink underline-offset-2 hover:underline">
              veja a demonstração
            </a>
            .
          </p>
          {wa && (
            <p className="mt-2">
              Precisa de ajuda?{" "}
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-ink underline-offset-2 hover:underline">
                <LuMessageCircle className="size-3.5" /> Fale com a Luma
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function hasPendingInvite(): boolean {
  try {
    return !!window.localStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return false;
  }
}

function ClientLogin({
  email,
  onEmailChange: setEmail,
  onDone,
  onForgot,
}: {
  email: string;
  onEmailChange: (email: string) => void;
  onDone: (s: Session) => void;
  onForgot: () => void;
}) {
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
        <h1 className="font-display text-xl font-semibold">Entrar no painel da loja</h1>
        <p className="mt-1 text-sm text-muted">Edite o cardápio, os preços e as fotos da sua loja.</p>
      </div>
      <Field label="E-mail" htmlFor="cli-email">
        <Input id="cli-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required data-autofocus />
      </Field>
      <Field label="Senha" htmlFor="cli-pass">
        <Input id="cli-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <div className="-mt-2 text-right">
        <button type="button" onClick={onForgot} className="text-sm font-semibold text-ink underline-offset-4 hover:underline">
          Esqueceu a senha?
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Entrando…" : "Entrar"}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <LuLock className="size-3.5" /> Conexão segura · acesso exclusivo da sua loja
      </p>
    </form>
  );
}

function ErrorMessage({ children }: { children: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">
      {children}
    </p>
  );
}

function ForgotPassword({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const to = email.trim();
      await requestPasswordReset(to, `${window.location.origin}${href("/empresa/")}`);
      setSentTo(to);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o link.");
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <div className="text-center">
        <LuMailCheck className="mx-auto size-10" />
        <h1 className="mt-3 font-display text-xl font-semibold">Confira seu e-mail</h1>
        <p className="mt-2 text-sm text-muted">
          Se houver uma conta Luma com <strong className="text-ink">{sentTo}</strong>, você vai receber um link para criar uma nova senha. Verifique também a caixa de spam.
        </p>
        <Button variant="secondary" className="mt-6 w-full" onClick={onBack}>
          Voltar para o login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">Esqueceu a senha?</h1>
        <p className="mt-1 text-sm text-muted">Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha.</p>
      </div>
      <Field label="E-mail" htmlFor="forgot-email">
        <Input id="forgot-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required data-autofocus />
      </Field>
      <ErrorMessage>{error}</ErrorMessage>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Enviando…" : "Enviar link"}
      </Button>
      <button type="button" onClick={onBack} className="w-full text-center text-sm font-semibold text-ink underline-offset-4 hover:underline">
        Voltar para o login
      </button>
    </form>
  );
}

function ResetPassword({ session, onDone }: { session: Session; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < MIN_PASSWORD) return setError(`A senha deve ter pelo menos ${MIN_PASSWORD} caracteres.`);
    if (password !== password2) return setError("As senhas não conferem.");
    setBusy(true);
    try {
      await updatePassword(session, password);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <div className="text-center">
        <LuCircleCheck className="mx-auto size-10 text-paid" />
        <h1 className="mt-3 font-display text-xl font-semibold">Senha alterada</h1>
        <p className="mt-2 text-sm text-muted">Sua nova senha já está valendo. Use-a nos próximos acessos.</p>
        <Button className="mt-6 w-full" onClick={onDone}>
          Entrar no painel
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">Crie uma nova senha</h1>
        <p className="mt-1 text-sm text-muted">
          Conta: <strong className="text-ink">{session.user.email}</strong>
        </p>
      </div>
      <Field label="Nova senha" htmlFor="reset-pass" hint={`Mínimo de ${MIN_PASSWORD} caracteres.`}>
        <Input id="reset-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required data-autofocus />
      </Field>
      <Field label="Confirme a nova senha" htmlFor="reset-pass2">
        <Input id="reset-pass2" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
      </Field>
      <ErrorMessage>{error}</ErrorMessage>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}
