"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LuCircleCheck, LuMailCheck, LuTriangleAlert } from "react-icons/lu";
import { href } from "@/lib/paths";
import { currentSession, rpc, sessionFromUrlHash, signIn, signOut, signUp, supabaseConfigured, type Session } from "@/lib/supabase";
import { Button, Field, Input, Logo } from "../ui";

interface InviteInfo {
  valid: boolean;
  reason?: "not_found" | "accepted" | "expired";
  org_name?: string;
  email?: string;
}

const PENDING_KEY = "luma:pending-invite";

function readToken(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const t = hash.get("token");
  if (t && /^[0-9a-f]{64}$/.test(t)) {
    try {
      window.localStorage.setItem(PENDING_KEY, t);
    } catch {
      /* ignorado */
    }
    history.replaceState(null, "", window.location.pathname);
    return t;
  }
  try {
    return window.localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

function clearToken() {
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignorado */
  }
}

type Stage = "loading" | "unconfigured" | "invalid" | "form" | "check-email" | "done";

export function InviteAccept() {
  const [stage, setStage] = useState<Stage>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [orgName, setOrgName] = useState("");

  const accept = async (s: Session, t: string) => {
    const r = await rpc<{ org_name: string }>("accept_invitation", { p_token: t }, s);
    clearToken();
    setOrgName(r.org_name);
    setStage("done");
  };

  useEffect(() => {
    if (!supabaseConfigured()) {
      setStage("unconfigured");
      return;
    }
    // outro link colado na mesma aba: recarrega para ler o novo convite
    const onHash = () => window.location.reload();
    window.addEventListener("hashchange", onHash);
    (async () => {
      // volta do link de confirmação de e-mail
      const fromEmail = await sessionFromUrlHash().catch(() => null);
      const t = readToken();
      setToken(t);
      if (!t) {
        setStage("invalid");
        return;
      }
      const i = await rpc<InviteInfo>("invitation_info", { p_token: t }).catch(() => ({ valid: false, reason: "not_found" }) as InviteInfo);
      setInfo(i);
      if (!i.valid) {
        if (i.reason !== "expired") clearToken();
        setStage("invalid");
        return;
      }
      const s = fromEmail ?? (await currentSession());
      if (s && s.user.email?.toLowerCase() === i.email?.toLowerCase()) {
        try {
          await accept(s, t);
          return;
        } catch (e) {
          setError(e instanceof Error ? e.message : "Não foi possível ativar o acesso.");
        }
      }
      setStage("form");
    })();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !info?.email) return;
    setError("");
    if (mode === "signup") {
      if (password.length < 10) return setError("A senha deve ter pelo menos 10 caracteres.");
      if (password !== password2) return setError("As senhas não conferem.");
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const s = await signUp(info.email, password, `${window.location.origin}${href("/convite/")}`);
        if (s) await accept(s, token);
        else setStage("check-email");
      } else {
        const s = await signIn(info.email, password);
        await accept(s, token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dot-grid flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <a href={href("/")} className="mb-8" aria-label="Luma — início">
        <Logo />
      </a>
      <div className="card w-full max-w-md p-6 sm:p-8">
        {stage === "loading" && <p className="text-center text-sm text-muted">Verificando convite…</p>}

        {stage === "unconfigured" && <p className="text-center text-sm text-muted">A ativação de contas ainda não está disponível.</p>}

        {stage === "invalid" && (
          <div className="text-center">
            <LuTriangleAlert className="mx-auto size-10 text-soon" />
            <h1 className="mt-3 font-display text-xl font-semibold">
              {info?.reason === "accepted" ? "Este convite já foi utilizado" : info?.reason === "expired" ? "Este convite expirou" : "Convite inválido"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {info?.reason === "accepted"
                ? "O acesso desta empresa já foi ativado."
                : "Peça um novo link de ativação para quem contratou a Luma com você."}
            </p>
          </div>
        )}

        {stage === "form" && info && (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h1 className="font-display text-xl font-semibold">Ative o acesso da {info.org_name}</h1>
              <p className="mt-1 text-sm text-muted">
                {mode === "signup" ? "Crie sua senha para acessar a Luma." : "Entre com a senha da sua conta Luma."}
              </p>
            </div>
            <Field label="E-mail" htmlFor="inv-email">
              <Input id="inv-email" value={info.email ?? ""} readOnly className="bg-paper text-muted" />
            </Field>
            <Field label="Senha" htmlFor="inv-pass" hint={mode === "signup" ? "Mínimo de 10 caracteres." : undefined}>
              <Input id="inv-pass" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} data-autofocus />
            </Field>
            {mode === "signup" && (
              <Field label="Confirme a senha" htmlFor="inv-pass2">
                <Input id="inv-pass2" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
              </Field>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Aguarde…" : mode === "signup" ? "Criar senha e ativar" : "Entrar e ativar"}
            </Button>
            <button type="button" className="w-full text-center text-sm font-semibold text-ink underline-offset-4 hover:underline" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }}>
              {mode === "signup" ? "Já tenho uma conta Luma" : "Ainda não tenho conta"}
            </button>
          </form>
        )}

        {stage === "check-email" && (
          <div className="text-center">
            <LuMailCheck className="mx-auto size-10" />
            <h1 className="mt-3 font-display text-xl font-semibold">Confirme seu e-mail</h1>
            <p className="mt-2 text-sm text-muted">
              Enviamos um link de confirmação para <strong className="text-ink">{info?.email}</strong>. Abra-o <strong className="text-ink">neste mesmo navegador</strong> para concluir a ativação.
            </p>
          </div>
        )}

        {stage === "done" && (
          <div className="text-center">
            <LuCircleCheck className="mx-auto size-10 text-paid" />
            <h1 className="mt-3 font-display text-xl font-semibold">Acesso ativado</h1>
            <p className="mt-2 text-sm text-muted">
              Sua conta agora é a administradora da <strong className="text-ink">{orgName}</strong> na Luma. O painel da empresa está sendo preparado — avisaremos pelo e-mail cadastrado quando estiver liberado.
            </p>
            <Button variant="secondary" className="mt-6" onClick={() => signOut().then(() => (window.location.href = href("/")))}>
              Voltar ao site
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
