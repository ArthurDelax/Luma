/**
 * Onde o cardápio é guardado.
 *  - CloudMenuRepo: loja real, tabela `menus` e pasta pública `cardapio` no Supabase
 *    (o banco confere quem pode ler e editar; ver supabase/migrations/0007_cardapio.sql).
 *  - LocalMenuRepo: demonstração do painel, só neste navegador.
 */

import { authed, rpc, SUPABASE_URL, SupabaseError } from "../supabase.ts";
import { compressImage } from "./image.ts";
import { normalizeMenu, uid } from "./logic.ts";
import type { MenuData, MenuRecord } from "./types.ts";

export interface MenuRepository {
  load(): Promise<MenuRecord | null>;
  save(rec: MenuRecord): Promise<MenuRecord>;
  /** Envia uma foto (comprimida) ou vídeo e devolve o endereço público. */
  upload(file: File, kind: "image" | "video"): Promise<string>;
  slugAvailable(slug: string): Promise<boolean>;
}

interface Row {
  slug: string;
  published: boolean;
  data: unknown;
  updated_at?: string;
}

const MAX_VIDEO = 20 * 1024 * 1024;

function friendly(e: unknown): Error {
  if (e instanceof SupabaseError) {
    if (/menus_slug_key|duplicate key/i.test(e.message)) return new Error("Esse endereço já está em uso por outra loja. Escolha outro.");
    if (/menus_slug_check/i.test(e.message)) return new Error("Endereço inválido: use de 3 a 48 letras minúsculas, números e hífens.");
    if (/row-level security|permission denied|42501/i.test(e.message) || e.status === 403) return new Error("Você não tem permissão para alterar este cardápio.");
    if (e.status === 413) return new Error("Arquivo grande demais.");
    if (/relation .*menus.* does not exist|PGRST205/i.test(e.message)) return new Error("O servidor ainda não tem a tabela de cardápios. Avise o suporte da Luma.");
  }
  return e instanceof Error ? e : new Error("Não foi possível concluir. Tente novamente.");
}

export class CloudMenuRepo implements MenuRepository {
  constructor(
    readonly orgId: string,
    readonly orgName: string,
  ) {}

  async load(): Promise<MenuRecord | null> {
    try {
      const rows = await authed<Row[]>(`/rest/v1/menus?select=slug,published,data,updated_at&org_id=eq.${this.orgId}`);
      const r = rows[0];
      return r ? { slug: r.slug, published: r.published, data: normalizeMenu(r.data, this.orgName), updatedAt: r.updated_at } : null;
    } catch (e) {
      throw friendly(e);
    }
  }

  async save(rec: MenuRecord): Promise<MenuRecord> {
    try {
      const rows = await authed<Row[]>("/rest/v1/menus?on_conflict=org_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ org_id: this.orgId, slug: rec.slug, published: rec.published, data: rec.data }),
      });
      const r = rows[0];
      return { slug: r.slug, published: r.published, data: normalizeMenu(r.data, this.orgName), updatedAt: r.updated_at };
    } catch (e) {
      throw friendly(e);
    }
  }

  async upload(file: File, kind: "image" | "video"): Promise<string> {
    let body: Blob = file;
    let ext = "mp4";
    if (kind === "image") {
      body = await compressImage(file, 1400, 0.82);
      ext = body.type === "image/webp" ? "webp" : "jpg";
    } else if (file.size > MAX_VIDEO) {
      throw new Error("O vídeo deve ter até 20 MB. Use um trecho curto (5 a 10 segundos).");
    }
    const path = `${this.orgId}/${uid(kind === "image" ? "foto" : "video")}.${ext}`;
    try {
      await authed(`/storage/v1/object/cardapio/${path}`, {
        method: "POST",
        headers: { "Content-Type": body.type || (kind === "image" ? "image/jpeg" : "video/mp4"), "x-upsert": "false", "cache-control": "31536000" },
        body,
      });
    } catch (e) {
      throw friendly(e);
    }
    return publicFileUrl(path);
  }

  async slugAvailable(slug: string): Promise<boolean> {
    try {
      return await authed<boolean>("/rest/v1/rpc/menu_slug_available", { method: "POST", body: JSON.stringify({ p_slug: slug, p_org: this.orgId }) });
    } catch {
      return true; // a restrição do banco confere de novo ao salvar
    }
  }
}

export function publicFileUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/cardapio/${path}`;
}

/** Cardápio publicado de uma loja, para qualquer visitante (sem login). */
export async function fetchPublicMenu(slug: string): Promise<MenuRecord | null> {
  const r = await rpc<{ slug: string; data: unknown; updated_at: string } | null>("public_menu", { p_slug: slug });
  if (!r) return null;
  return { slug: r.slug, published: true, data: normalizeMenu(r.data), updatedAt: r.updated_at };
}

/* ------------------------------------------------------------------ */
/* Demonstração: só neste navegador                                     */
/* ------------------------------------------------------------------ */

export const DEMO_MENU_KEY = "luma:demo-menu";

export class LocalMenuRepo implements MenuRepository {
  constructor(private readonly initial: () => MenuRecord) {}

  async load(): Promise<MenuRecord> {
    try {
      const raw = window.localStorage.getItem(DEMO_MENU_KEY);
      if (raw) {
        const r = JSON.parse(raw) as MenuRecord;
        return { ...r, data: normalizeMenu(r.data) };
      }
    } catch {
      /* sem armazenamento: começa do exemplo */
    }
    return this.initial();
  }

  async save(rec: MenuRecord): Promise<MenuRecord> {
    const next = { ...rec, updatedAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(DEMO_MENU_KEY, JSON.stringify(next));
    } catch {
      throw new Error("O navegador não tem espaço para guardar a demonstração. Use fotos menores ou restaure o exemplo.");
    }
    return next;
  }

  async upload(file: File, kind: "image" | "video"): Promise<string> {
    if (kind === "video") throw new Error("Na demonstração, os vídeos não são enviados. Nas lojas reais, sim.");
    const blob = await compressImage(file, 700, 0.75);
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      fr.readAsDataURL(blob);
    });
  }

  async slugAvailable(): Promise<boolean> {
    return true;
  }

  static reset() {
    try {
      window.localStorage.removeItem(DEMO_MENU_KEY);
    } catch {
      /* ignorado */
    }
  }

  /** Cardápio da demonstração salvo neste navegador (para a prévia). */
  static stored(): MenuData | null {
    try {
      const raw = window.localStorage.getItem(DEMO_MENU_KEY);
      return raw ? normalizeMenu((JSON.parse(raw) as MenuRecord).data) : null;
    } catch {
      return null;
    }
  }
}
