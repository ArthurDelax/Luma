"use client";

import { createContext, useContext } from "react";
import type { MenuRepository } from "@/lib/menu/repo";
import type { MenuData, MenuRecord } from "@/lib/menu/types";

export interface EditorContextValue {
  record: MenuRecord;
  menu: MenuData;
  /** altera o cardápio (fica pendente até salvar) */
  update: (fn: (m: MenuData) => MenuData) => void;
  setRecord: (fn: (r: MenuRecord) => MenuRecord) => void;
  repo: MenuRepository;
  readOnly: boolean;
  publicUrl: (slug: string) => string;
  /** salvo no servidor, sem alterações pendentes */
  clean: boolean;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const v = useContext(EditorContext);
  if (!v) throw new Error("useEditor fora do editor");
  return v;
}
