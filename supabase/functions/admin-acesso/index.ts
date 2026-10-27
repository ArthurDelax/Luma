// Luma — ajuda de acesso para o dono da plataforma (Edge Function do Supabase).
//
// Por que existe: o e-mail padrão do Supabase só entrega para a equipe do projeto,
// então "Esqueceu a senha?" e a confirmação de e-mail podem não chegar ao cliente.
// Com esta função, o administrador (platform_admins + 2 etapas) gera o link de
// nova senha ou libera o e-mail do responsável da loja e envia pelo WhatsApp.
//
// Ações (POST JSON): { action: "recovery_link" | "confirm_email", org_id, redirect_to? }
// A chave secreta (service_role) existe só aqui no servidor; nunca vai para o site.

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // quem chama precisa ser administrador da plataforma com 2 etapas (conferido no banco)
    const asCaller = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: isAdmin, error: adminErr } = await asCaller.rpc("is_platform_admin");
    if (adminErr || isAdmin !== true) return json({ error: "acesso negado" }, 403);
    const { data: caller } = await asCaller.auth.getUser();

    const { action, org_id, redirect_to } = (await req.json()) as { action?: string; org_id?: string; redirect_to?: string };
    if (!org_id || !/^[0-9a-f-]{36}$/i.test(org_id)) return json({ error: "loja inválida" }, 400);

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: org } = await admin.from("organizations").select("id, name, responsible_email").eq("id", org_id).maybeSingle();
    if (!org) return json({ error: "loja não encontrada" }, 404);
    const email = String(org.responsible_email).toLowerCase();

    // procura a conta do responsável
    let user: { id: string; email?: string; email_confirmed_at?: string | null } | undefined;
    for (let page = 1; page <= 20 && !user; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      user = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
      if (data.users.length < 200) break;
    }
    if (!user) return json({ error: "O responsável ainda não criou a conta. Envie o link de ativação da loja." }, 400);

    const log = (what: string) =>
      admin.from("admin_audit_log").insert({ actor: caller.user?.id ?? null, action: what, org_id: org.id, details: { email } });

    if (action === "recovery_link") {
      const redirect = typeof redirect_to === "string" && /^https?:\/\//.test(redirect_to) ? redirect_to : undefined;
      const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: redirect ? { redirectTo: redirect } : undefined });
      if (error) throw error;
      await log("link_nova_senha");
      return json({ link: data.properties.action_link, email });
    }

    if (action === "confirm_email") {
      if (!user.email_confirmed_at) {
        const { error } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
        if (error) throw error;
      }
      await log("email_liberado");
      return json({ ok: true, email, already: !!user.email_confirmed_at });
    }

    return json({ error: "ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
