/** Lojas (empresas na plataforma) e o papel de cada usuário nelas. */

export type OrgRole = "administrador" | "financeiro" | "consulta";
export type OrgStatus = "ativa" | "inadimplente" | "suspensa" | "cancelada";

export interface OrgInfo {
  org_id: string;
  name: string;
  role: OrgRole;
  status: OrgStatus;
}

/** No banco o papel de quem edita continua "financeiro"; na tela é "Editor". */
export const ROLE_LABEL: Record<OrgRole, string> = {
  administrador: "Administrador",
  financeiro: "Editor do cardápio",
  consulta: "Somente consulta",
};
