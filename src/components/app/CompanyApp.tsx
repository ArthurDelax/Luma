"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { LuBuilding2, LuChevronRight, LuLock, LuMessageCircle } from "react-icons/lu";
import { CloudSync, type OrgInfo } from "@/lib/cloud";
import { whatsappLink } from "@/lib/contact";
import { href } from "@/lib/paths";
import { currentSession, rpc, signIn, signOut, supabaseConfigured, type Session } from "@/lib/supabase";
import { ROLE_LABEL, type Workspace } from "@/lib/workspace";
import { Button, Field, Input, Logo } from "../ui";
import { LumaApp } from "./LumaApp";

const LAST_ORG_KEY = "luma:last-org";
const PENDING_INVITE_KEY = "luma:pending-invite";

type Stage = "loading" | "unconfigured" | "login" | "choose" | "no-org" | "error" | "app";

const STATUS_LABEL: Record<OrgInfo["status"], string> = {
  ativa: "Ativa",
  inadimplente: "Pagamento pendente",
  suspensa: "Suspensa",
  cancelada: "Cancelada",
};

function remember(orgId: string) {
  try {
    window.localStorage.setItem(LAST_ORG_KEY, orgId);
  } catch {
    /* ignorado */
  }
}

export function CompanyApp() {
  const [stage, setStage] = useState<Stage>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [error, setError] = useState("");

  const open = useCallback((o: OrgInfo) => {
    remember(o.org_id);
    setOrg(o);
    setStage("app");
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
        setError(e instanceof Error ? e.message : "Não foi possível carregar suas empresas.");
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

  const cloud = useMemo(() => (org ? new CloudSync(org.org_id) : undefined), [org]);

  if (stage === "app" && org && cloud) {
    const readOnlyReason = org.status === "suspensa" ? "suspensa" : org.role === "consulta" ? "consulta" : undefined;
    const workspace: Workspace = {
      mode: "cloud",
      orgName: org.name,
      role: org.role,
      status: org.status,
      email: session?.user.email,
      readOnlyReason,
      logout,
      switchOrg: orgs.length > 1 ? () => setStage("choose") : undefined,
    };
    return <LumaApp key={org.org_id} cloud={cloud} readOnly={!!readOnlyReason} workspace={workspace} />;
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

        {stage === "login" && <ClientLogin onDone={afterLogin} />}

        {stage === "choose" && (
          <div>
            <h1 className="font-display text-xl font-semibold">Escolha a empresa</h1>
            <p className="mt-1 text-sm text-muted">Sua conta tem acesso a mais de uma empresa.</p>
            <ul className="mt-5 space-y-2">
              {orgs.map((o) => (
                <li key={o.org_id}>
                  <button type="button" onClick={() => open(o)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left transition-colors hover:border-ink/30">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper">
                      <LuBuilding2 className="size-5" />
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

        {stage === "no-org" && (
          <div className="text-center">
            <h1 className="font-display text-xl font-semibold">Nenhuma empresa vinculada</h1>
            <p className="mt-2 text-sm text-muted">Sua conta ainda não tem acesso a nenhuma empresa ativa na Luma.</p>
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
              Esqueceu a senha?{" "}
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

function ClientLogin({ onDone }: { onDone: (s: Session) => void }) {
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
        <h1 className="font-display text-xl font-semibold">Entrar na Luma</h1>
        <p className="mt-1 text-sm text-muted">Acesse o painel da sua empresa.</p>
      </div>
      <Field label="E-mail" htmlFor="cli-email">
        <Input id="cli-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required data-autofocus />
      </Field>
      <Field label="Senha" htmlFor="cli-pass">
        <Input id="cli-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error && (
        <p role="alert" className="rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Entrando…" : "Entrar"}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <LuLock className="size-3.5" /> Conexão segura · dados exclusivos da sua empresa
      </p>
    </form>
  );
}
