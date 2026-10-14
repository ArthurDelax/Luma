/**
 * Dados da empresa guardados no Supabase.
 *
 * Cada conta, recorrente, documento e alerta lido é um registro em
 * `org_records`. O banco garante (RLS) que cada usuário só lê e grava os
 * registros da própria empresa — este arquivo só envia o que mudou.
 */

import { uid } from "./format.ts";
import { authed, authedBlob, SupabaseError } from "./supabase.ts";
import type { AttachmentMeta, Bill, BusinessDocument, CustomCategory, LumaData, RecurringExpense } from "./types.ts";

export type OrgRole = "administrador" | "financeiro" | "consulta";
export type OrgStatus = "ativa" | "inadimplente" | "suspensa" | "cancelada";

export interface OrgInfo {
  org_id: string;
  name: string;
  role: OrgRole;
  status: OrgStatus;
}

type Kind = "bill" | "recurring" | "document" | "category" | "alert_read";
interface Row {
  kind: Kind;
  id: string;
  data: unknown;
}

const PAGE = 1000;

/** Converte os dados do app em registros "tipo:id" → conteúdo. */
export function toRecords(d: LumaData): Map<string, Row> {
  const m = new Map<string, Row>();
  for (const b of d.bills) m.set(`bill:${b.id}`, { kind: "bill", id: b.id, data: b });
  for (const r of d.recurring) m.set(`recurring:${r.id}`, { kind: "recurring", id: r.id, data: r });
  for (const x of d.documents) m.set(`document:${x.id}`, { kind: "document", id: x.id, data: x });
  for (const c of d.categories ?? []) m.set(`category:${c.id}`, { kind: "category", id: c.id, data: c });
  for (const a of d.readAlerts) m.set(`alert_read:${a}`, { kind: "alert_read", id: a, data: {} });
  return m;
}

export function fromRows(rows: Row[]): LumaData {
  const d: LumaData = { version: 1, bills: [], recurring: [], documents: [], categories: [], readAlerts: [] };
  for (const r of rows) {
    if (r.kind === "bill") d.bills.push(r.data as Bill);
    else if (r.kind === "recurring") d.recurring.push(r.data as RecurringExpense);
    else if (r.kind === "document") d.documents.push(r.data as BusinessDocument);
    else if (r.kind === "category") d.categories!.push(r.data as CustomCategory);
    else if (r.kind === "alert_read") d.readAlerts.push(r.id);
  }
  const byCreated = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);
  d.bills.sort(byCreated);
  d.recurring.sort(byCreated);
  d.documents.sort(byCreated);
  d.categories!.sort(byCreated);
  return d;
}

/** O que precisa ser gravado e apagado para ir de `prev` a `next`. */
export function diff(prev: LumaData, next: LumaData): { upserts: Row[]; deletes: Row[] } {
  const a = toRecords(prev);
  const b = toRecords(next);
  const upserts: Row[] = [];
  const deletes: Row[] = [];
  for (const [k, row] of b) {
    const old = a.get(k);
    if (!old || JSON.stringify(old.data) !== JSON.stringify(row.data)) upserts.push(row);
  }
  for (const [k, row] of a) if (!b.has(k)) deletes.push(row);
  return { upserts, deletes };
}

const q = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export class CloudSync {
  constructor(readonly orgId: string) {}

  async load(): Promise<LumaData> {
    const rows: Row[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const page = await authed<Row[]>(
        `/rest/v1/org_records?select=kind,id,data&org_id=eq.${this.orgId}&order=kind.asc,id.asc&limit=${PAGE}&offset=${offset}`,
      );
      rows.push(...page);
      if (page.length < PAGE) break;
    }
    return fromRows(rows);
  }

  /**
   * Envia as diferenças, um tipo de registro por vez: se o servidor recusar um tipo
   * (ex.: banco sem a migração de categorias), os demais — contas, recorrentes,
   * documentos — continuam sendo gravados. O primeiro erro é repassado no final.
   */
  async push(prev: LumaData, next: LumaData): Promise<void> {
    const { upserts, deletes } = diff(prev, next);
    let firstError: unknown;
    const attempt = async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (e) {
        firstError ??= e;
      }
    };

    const upsertsByKind = new Map<Kind, Row[]>();
    for (const r of upserts) upsertsByKind.set(r.kind, [...(upsertsByKind.get(r.kind) ?? []), r]);
    for (const rows of upsertsByKind.values()) {
      await attempt(async () => {
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200).map((r) => ({ org_id: this.orgId, kind: r.kind, id: r.id, data: r.data }));
          await authed("/rest/v1/org_records", {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify(chunk),
          });
        }
      });
    }

    const deletesByKind = new Map<Kind, string[]>();
    for (const r of deletes) deletesByKind.set(r.kind, [...(deletesByKind.get(r.kind) ?? []), r.id]);
    for (const [kind, ids] of deletesByKind) {
      await attempt(async () => {
        for (let i = 0; i < ids.length; i += 100) {
          const list = ids.slice(i, i + 100).map(q).join(",");
          await authed(`/rest/v1/org_records?org_id=eq.${this.orgId}&kind=eq.${kind}&id=in.(${encodeURIComponent(list)})`, {
            method: "DELETE",
            headers: { Prefer: "return=minimal" },
          });
        }
      });
    }

    if (firstError !== undefined) throw firstError;
  }

  /* ---------------- anexos (Supabase Storage, bucket privado) ---------------- */

  async saveAttachment(file: Blob, name: string): Promise<AttachmentMeta> {
    const id = `${this.orgId}/${uid("anx_")}.pdf`;
    await authed(`/storage/v1/object/anexos/${id}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/pdf", "x-upsert": "false" },
      body: file,
    }).catch((e) => {
      throw e instanceof SupabaseError && e.status === 413 ? new Error("O anexo excede 10 MB.") : e;
    });
    return { id, name, size: file.size, type: file.type || "application/pdf", addedAt: new Date().toISOString() };
  }

  getAttachment(id: string): Promise<Blob | undefined> {
    if (!id.startsWith(`${this.orgId}/`)) return Promise.resolve(undefined);
    return authedBlob(`/storage/v1/object/authenticated/anexos/${id}`);
  }

  async deleteAttachment(id: string): Promise<void> {
    if (!id.startsWith(`${this.orgId}/`)) return;
    await authed(`/storage/v1/object/anexos`, { method: "DELETE", body: JSON.stringify({ prefixes: [id] }) }).catch(() => {});
  }
}
