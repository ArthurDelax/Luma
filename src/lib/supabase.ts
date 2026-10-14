/**
 * Cliente mínimo do Supabase (Auth + chamadas RPC), sem dependências.
 *
 * A URL do projeto e a chave "anon/public" são públicas por natureza — a
 * proteção dos dados é feita no banco (RLS e funções que verificam permissão).
 * Nunca coloque aqui a chave service_role nem a senha do banco.
 */

export const SUPABASE_URL: string = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
export const SUPABASE_ANON_KEY: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseConfigured = (): boolean => /^https?:\/\//.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;

export interface Factor {
  id: string;
  factor_type: string;
  status: "verified" | "unverified";
  friendly_name?: string;
}

export interface AuthUser {
  id: string;
  email?: string;
  factors?: Factor[];
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  user: AuthUser;
}

export class SupabaseError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Armazenamento da sessão (por aba: sessionStorage)                   */
/* ------------------------------------------------------------------ */

const SESSION_KEY = "luma:sb-session";

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function loadSession(): Session | null {
  try {
    const raw = storage()?.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(s: Session | null) {
  try {
    if (s) storage()?.setItem(SESSION_KEY, JSON.stringify(s));
    else storage()?.removeItem(SESSION_KEY);
  } catch {
    /* ignorado */
  }
}

/** Lê o conteúdo (payload) do JWT — apenas para exibir estado; a verificação real é no servidor. */
export function jwtClaims(token: string | undefined): Record<string, unknown> {
  if (!token) return {};
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return {};
  }
}

export function sessionAal(s: Session | null): string {
  return String(jwtClaims(s?.access_token).aal ?? "aal1");
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                 */
/* ------------------------------------------------------------------ */

const ERROR_PT: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "Confirme seu e-mail pelo link que enviamos antes de entrar.",
  "User already registered": "Este e-mail já tem uma conta. Use a opção de entrar.",
  "Invalid TOTP code entered": "Código inválido. Confira o código no aplicativo autenticador.",
  "Unexpected failure, please check server logs for more information": "Falha temporária no servidor de login. Clique em Sair, entre de novo e tente outra vez.",
  "New password should be different from the old password.": "A nova senha deve ser diferente da anterior.",
  "Error sending recovery email": "Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.",
  "Error sending confirmation email": "Não foi possível enviar o e-mail de confirmação agora. Tente novamente em alguns minutos.",
  "Email rate limit exceeded":"Limite de envio de e-mails atingido. Tente novamente em alguns minutos.",
  "email rate limit exceeded": "Limite de envio de e-mails atingido. Tente novamente em alguns minutos.",
  "AAL2 session is required to update email or password when MFA is enabled.": "Sua conta usa verificação em duas etapas. Fale com a Luma para redefinir a senha.",
};

function translateError(raw: string): string {
  if (ERROR_PT[raw]) return ERROR_PT[raw];
  if (/^For security purposes, you can only request this after/i.test(raw)) return "Aguarde alguns segundos antes de pedir um novo link.";
  if (/org_records_kind_check/.test(raw)) return "o servidor ainda não aceita este tipo de cadastro (categorias). Avise o suporte da Luma";
  return raw;
}

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  if (!supabaseConfigured()) throw new SupabaseError("O painel ainda não está conectado ao banco de dados.", 0);
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
  // Chave nova (sb_publishable_…) não é JWT: vai só no "apikey". A antiga (anon) também pode ir no Authorization.
  const bearer = init.token ?? (SUPABASE_ANON_KEY.startsWith("sb_") ? "" : SUPABASE_ANON_KEY);
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  } catch {
    throw new SupabaseError("Não foi possível conectar. Verifique sua internet e tente novamente.", 0);
  }
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    const b = (body ?? {}) as Record<string, string>;
    const raw = b.msg || b.message || b.error_description || b.error || `Erro ${res.status}`;
    throw new SupabaseError(translateError(raw), res.status, b.code || b.error_code);
  }
  return body as T;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

function toSession(r: { access_token: string; refresh_token: string; expires_in?: number; expires_at?: number; user: AuthUser }): Session {
  return {
    access_token: r.access_token,
    refresh_token: r.refresh_token,
    expires_at: r.expires_at ?? Math.floor(Date.now() / 1000) + (r.expires_in ?? 3600),
    user: r.user,
  };
}

/* ------------------------------------------------------------------ */
/* Auth                                                                 */
/* ------------------------------------------------------------------ */

export async function signIn(email: string, password: string): Promise<Session> {
  const r = await request<Parameters<typeof toSession>[0]>("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const s = toSession(r);
  saveSession(s);
  return s;
}

/** Cria a conta. Se o projeto exige confirmação de e-mail, retorna null (sem sessão). */
export async function signUp(email: string, password: string, redirectTo: string): Promise<Session | null> {
  const r = await request<Record<string, unknown>>(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (typeof r.access_token === "string") {
    const s = toSession(r as unknown as Parameters<typeof toSession>[0]);
    saveSession(s);
    return s;
  }
  return null;
}

export async function refreshSession(s: Session): Promise<Session> {
  const r = await request<Parameters<typeof toSession>[0]>("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  });
  const next = toSession(r);
  saveSession(next);
  return next;
}

/** Sessão válida (renova se estiver perto de expirar). */
export async function currentSession(): Promise<Session | null> {
  const s = loadSession();
  if (!s) return null;
  if (s.expires_at - 60 > Date.now() / 1000) return s;
  try {
    return await refreshSession(s);
  } catch {
    saveSession(null);
    return null;
  }
}

export async function signOut(): Promise<void> {
  const s = loadSession();
  saveSession(null);
  if (s) {
    try {
      await request("/auth/v1/logout", { method: "POST", token: s.access_token });
    } catch {
      /* a sessão local já foi apagada */
    }
  }
}

/**
 * Envia o e-mail de redefinição de senha. O Supabase responde da mesma forma
 * exista ou não uma conta com o e-mail, então a tela não revela quem é cliente.
 */
export async function requestPasswordReset(email: string, redirectTo: string): Promise<void> {
  await request(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** Define a nova senha usando a sessão recebida pelo link de redefinição. */
export async function updatePassword(s: Session, password: string): Promise<void> {
  await request("/auth/v1/user", { method: "PUT", token: s.access_token, body: JSON.stringify({ password }) });
}

export async function getUser(s: Session): Promise<AuthUser> {
  return request<AuthUser>("/auth/v1/user", { token: s.access_token });
}

/** Recebe a sessão que o Supabase devolve no endereço (#access_token=…) após confirmar o e-mail. */
export async function sessionFromUrlHash(): Promise<Session | null> {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash.includes("access_token=")) return null;
  const p = new URLSearchParams(hash);
  const access_token = p.get("access_token")!;
  const refresh_token = p.get("refresh_token") ?? "";
  const expires_in = Number(p.get("expires_in") ?? 3600);
  history.replaceState(null, "", window.location.pathname + window.location.search);
  const partial = { access_token, refresh_token, expires_at: Math.floor(Date.now() / 1000) + expires_in, user: { id: String(jwtClaims(access_token).sub ?? "") } };
  const user = await getUser(partial);
  const s = { ...partial, user };
  saveSession(s);
  return s;
}

/* ------------------------------------------------------------------ */
/* Verificação em duas etapas (TOTP)                                    */
/* ------------------------------------------------------------------ */

export interface TotpEnrollment {
  id: string;
  qr_code: string;
  secret: string;
  uri: string;
}

export async function enrollTotp(s: Session): Promise<TotpEnrollment> {
  // remove tentativas antigas não confirmadas
  const user = await getUser(s);
  for (const f of user.factors ?? []) {
    if (f.status !== "verified") {
      await request(`/auth/v1/factors/${f.id}`, { method: "DELETE", token: s.access_token }).catch(() => {});
    }
  }
  const r = await request<{ id: string; totp: { qr_code: string; secret: string; uri: string } }>("/auth/v1/factors", {
    method: "POST",
    token: s.access_token,
    body: JSON.stringify({ factor_type: "totp", friendly_name: `Luma ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, issuer: "Luma" }),
  });
  return { id: r.id, ...r.totp, qr_code: qrDataUrl(r.totp.qr_code) };
}

/** A API devolve o SVG "cru"; transforma em endereço de imagem (aceita também já prefixado). */
export function qrDataUrl(raw: string): string {
  if (!raw) return "";
  const prefixed = raw.match(/^data:image\/svg\+xml(?:;[^,]*)?,([\s\S]*)$/);
  const svg = prefixed ? safeDecode(prefixed[1]) : raw;
  if (/^data:image\/(png|gif|jpeg)/.test(raw)) return raw;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export async function verifyTotp(s: Session, factorId: string, code: string): Promise<Session> {
  const ch = await request<{ id: string }>(`/auth/v1/factors/${factorId}/challenge`, { method: "POST", token: s.access_token, body: "{}" });
  const r = await request<Parameters<typeof toSession>[0]>(`/auth/v1/factors/${factorId}/verify`, {
    method: "POST",
    token: s.access_token,
    body: JSON.stringify({ challenge_id: ch.id, code: code.replace(/\s/g, "") }),
  });
  const next = toSession({ ...r, user: r.user ?? s.user });
  saveSession(next);
  return next;
}

/* ------------------------------------------------------------------ */
/* Banco: funções (RPC)                                                 */
/* ------------------------------------------------------------------ */

/** Chamada autenticada com a sessão atual (renovada se necessário). */
export async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const s = await currentSession();
  if (!s) throw new SupabaseError("Sua sessão expirou. Entre novamente.", 401, "session_expired");
  return request<T>(path, { ...init, token: s.access_token });
}

/** Baixa um arquivo (resposta binária) com a sessão atual. */
export async function authedBlob(path: string): Promise<Blob | undefined> {
  const s = await currentSession();
  if (!s) return undefined;
  try {
    const res = await fetch(`${SUPABASE_URL}${path}`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${s.access_token}` } });
    return res.ok ? await res.blob() : undefined;
  } catch {
    return undefined;
  }
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}, s?: Session | null): Promise<T> {
  return request<T>(`/rest/v1/rpc/${fn}`, { method: "POST", token: s?.access_token, body: JSON.stringify(args) });
}
