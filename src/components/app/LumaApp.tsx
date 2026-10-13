"use client";

import { useEffect } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { ConfirmProvider, LogoMark, ToastProvider } from "../ui";
import { BillActionsProvider } from "./bills/BillActions";
import { DemoBlockedDialog } from "./DemoGate";
import { AlertsPage } from "./pages/AlertsPage";
import { BillsPage } from "./pages/BillsPage";
import { CalendarPage } from "./pages/CalendarPage";
import { Dashboard } from "./pages/Dashboard";
import { DocumentsPage } from "./pages/DocumentsPage";
import { RecurringPage } from "./pages/RecurringPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NAV, Shell } from "./Shell";
import { useHashRoute } from "./routing";

function Screen() {
  const { ready } = useStore();
  const route = useHashRoute();

  useEffect(() => {
    const label = NAV.find((n) => n.id === route.id)?.label ?? "Painel";
    document.title = `${label} · Luma`;
  }, [route.id]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper">
        <div className="flex flex-col items-center gap-3 text-sm text-muted">
          <LogoMark className="size-10 animate-pulse" />
          Carregando seus dados…
        </div>
      </div>
    );
  }

  return (
    <BillActionsProvider>
      <Shell current={route.id}>
        <div key={route.id} className="animate-fade-in">
          {route.id === "painel" && <Dashboard />}
          {route.id === "contas" && <BillsPage route={route} />}
          {route.id === "recorrentes" && <RecurringPage />}
          {route.id === "documentos" && <DocumentsPage />}
          {route.id === "alertas" && <AlertsPage />}
          {route.id === "calendario" && <CalendarPage />}
          {route.id === "relatorios" && <ReportsPage />}
          {route.id === "ajustes" && <SettingsPage />}
        </div>
      </Shell>
      <DemoBlockedDialog />
    </BillActionsProvider>
  );
}

export function LumaApp() {
  return (
    <StoreProvider>
      <ToastProvider>
        <ConfirmProvider>
          <Screen />
        </ConfirmProvider>
      </ToastProvider>
    </StoreProvider>
  );
}
