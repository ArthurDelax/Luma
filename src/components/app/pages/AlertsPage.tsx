"use client";

import { useState } from "react";
import { LuBellOff, LuCheck, LuCheckCheck, LuFilePenLine, LuFileText, LuReceipt, LuRepeat } from "react-icons/lu";
import { formatDate, relativeDays } from "@/lib/dates";
import { ALERT_LEVEL_LABEL, type Alert } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { Badge, Button, cx, EmptyState, IconButton, PageHeader, Segmented } from "../../ui";
import { useBillActions } from "../bills/BillActions";
import { navigate } from "../routing";
import { useUnreadAlerts } from "../Shell";

const SOURCE_ICON = {
  conta: <LuReceipt className="size-[18px]" />,
  recorrente: <LuRepeat className="size-[18px]" />,
  contrato: <LuFilePenLine className="size-[18px]" />,
  documento: <LuFileText className="size-[18px]" />,
};

const SOURCE_LABEL = { conta: "Conta a pagar", recorrente: "Despesa recorrente", contrato: "Contrato", documento: "Documento" };

export function AlertsPage() {
  const { data, markAlertsRead } = useStore();
  const { all, unread } = useUnreadAlerts();
  const actions = useBillActions();
  const [filter, setFilter] = useState<"nao_lidos" | "todos">("todos");
  const read = new Set(data.readAlerts);
  const list = filter === "todos" ? all : unread;

  const open = (a: Alert) => {
    markAlertsRead([a.id]);
    if (a.source === "conta") actions.viewBill(a.refId);
    else if (a.source === "recorrente") navigate("recorrentes");
    else navigate("documentos");
  };

  const groups: { key: Alert["severity"]; title: string }[] = [
    { key: "critico", title: "Vencidos e vencendo hoje" },
    { key: "atencao", title: "Próximos 7 dias" },
    { key: "info", title: "Próximos 30 dias" },
  ];

  return (
    <div>
      <PageHeader
        title="Central de alertas"
        description="Calculados automaticamente a partir das datas cadastradas, sempre que você abre a Luma."
        actions={
          unread.length > 0 && (
            <Button variant="secondary" icon={<LuCheckCheck className="size-4" />} onClick={() => markAlertsRead(unread.map((a) => a.id))}>
              Marcar todos como lidos
            </Button>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-4">
            <Segmented
              label="Filtro de alertas"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "todos", label: "Todos", count: all.length },
                { value: "nao_lidos", label: "Não lidos", count: unread.length },
              ]}
            />
          </div>
          {list.length === 0 ? (
            <div className="card">
              <EmptyState icon={<LuBellOff className="size-6" />} title={filter === "nao_lidos" ? "Nenhum alerta não lido" : "Nenhum alerta no momento"}>
                Quando um vencimento se aproximar, ele aparecerá aqui.
              </EmptyState>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((g) => {
                const items = list.filter((a) => a.severity === g.key);
                if (!items.length) return null;
                return (
                  <section key={g.key}>
                    <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">
                      <span className={cx("size-2 rounded-full", g.key === "critico" ? "bg-overdue" : g.key === "atencao" ? "bg-soon" : "bg-sky-400")} />
                      {g.title}
                      <span className="tabular">({items.length})</span>
                    </h2>
                    <ul className="card divide-y divide-line overflow-hidden">
                      {items.map((a) => {
                        const isRead = read.has(a.id);
                        return (
                          <li key={a.id} className={cx("flex items-center gap-3 px-4 py-3", !isRead && "bg-sky-50/50")}>
                            <span className={cx("grid size-9 shrink-0 place-items-center rounded-lg", a.severity === "critico" ? "bg-overdue-soft text-overdue" : a.severity === "atencao" ? "bg-soon-soft text-soon" : "bg-sky-100 text-navy-600")}>{SOURCE_ICON[a.source]}</span>
                            <button className="min-w-0 flex-1 text-left" onClick={() => open(a)}>
                              <p className="flex items-center gap-2 text-sm font-semibold">
                                {!isRead && <span className="size-1.5 shrink-0 rounded-full bg-sky-500" aria-label="Não lido" />}
                                <span className="truncate">{a.title}</span>
                              </p>
                              <p className="truncate text-xs text-muted">
                                {SOURCE_LABEL[a.source]} — {a.detail}
                              </p>
                            </button>
                            <div className="hidden flex-col items-end gap-1 sm:flex">
                              <Badge tone={a.severity === "critico" ? "overdue" : a.severity === "atencao" ? "soon" : "info"}>{ALERT_LEVEL_LABEL[a.level]}</Badge>
                              <span className="text-xs text-muted">
                                {formatDate(a.date)}, {relativeDays(a.days)}
                              </span>
                            </div>
                            {!isRead && (
                              <IconButton label="Marcar como lido" onClick={() => markAlertsRead([a.id])}>
                                <LuCheck className="size-4" />
                              </IconButton>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <aside className="card h-fit p-5 text-sm">
          <h2 className="font-display text-base font-semibold">Como os alertas funcionam</h2>
          <ul className="mt-3 space-y-2 text-slate-600">
            <li>
              <strong className="text-ink">Contratos e documentos:</strong> avisos 30, 15, 7 e 3 dias antes, no dia do vencimento e depois de vencidos.
            </li>
            <li>
              <strong className="text-ink">Contas a pagar:</strong> avisos 7 e 3 dias antes, no dia e enquanto estiverem vencidas.
            </li>
            <li>
              <strong className="text-ink">Despesas recorrentes:</strong> aviso quando um vencimento se aproxima e ainda não foi lançado.
            </li>
          </ul>
          <p className="mt-4 rounded-lg bg-paper px-3 py-2 text-xs text-muted">
            Nesta versão demonstrativa os alertas aparecem apenas dentro da Luma. Não há envio de e-mail, WhatsApp ou SMS.
          </p>
        </aside>
      </div>
    </div>
  );
}
