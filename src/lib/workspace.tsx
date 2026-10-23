"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { OrgRole, OrgStatus } from "./orgs.ts";

export { ROLE_LABEL } from "./orgs.ts";

/**
 * Em que "ambiente" o painel está rodando:
 *  - demo: demonstração pública (dados de exemplo, só neste navegador)
 *  - cloud: loja real, dados no servidor
 */
export interface Workspace {
  mode: "demo" | "cloud";
  orgId?: string;
  orgName?: string;
  role?: OrgRole;
  status?: OrgStatus;
  email?: string;
  logout?: () => void;
  switchOrg?: () => void;
}

const WorkspaceContext = createContext<Workspace>({ mode: "demo" });

export function WorkspaceProvider({ value, children }: { value: Workspace; children: ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export const useWorkspace = () => useContext(WorkspaceContext);
