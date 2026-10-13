"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { OrgRole, OrgStatus } from "./cloud.ts";
import { DEMO_MODE } from "./demo.ts";

/**
 * Em que "ambiente" o painel está rodando:
 *  - demo: demonstração pública (dados fictícios, somente leitura)
 *  - local: dados só neste navegador (modo de testes)
 *  - cloud: empresa real, dados no servidor
 */
export interface Workspace {
  mode: "demo" | "local" | "cloud";
  orgName?: string;
  role?: OrgRole;
  status?: OrgStatus;
  email?: string;
  /** Por que alterações estão bloqueadas (somente na nuvem). */
  readOnlyReason?: "consulta" | "suspensa";
  logout?: () => void;
  switchOrg?: () => void;
}

const WorkspaceContext = createContext<Workspace>({ mode: DEMO_MODE ? "demo" : "local" });

export function WorkspaceProvider({ value, children }: { value: Workspace; children: ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export const useWorkspace = () => useContext(WorkspaceContext);

export const ROLE_LABEL: Record<OrgRole, string> = {
  administrador: "Administrador",
  financeiro: "Financeiro",
  consulta: "Somente consulta",
};

export function initials(name: string): string {
  const parts = name
    .replace(/\b(ltda|me|eireli|s\/?a|epp)\b\.?/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? "L") + (parts[1]?.[0] ?? "")).toUpperCase();
}
