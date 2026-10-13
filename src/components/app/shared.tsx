"use client";

import { useMemo } from "react";
import { addDays, diffDays, formatDate, relativeDays } from "@/lib/dates";
import { billStatus, occurrencesInRange, STATUS_LABEL, type Occurrence } from "@/lib/domain";
import { useStore } from "@/lib/store";
import type { Bill, BillStatus } from "@/lib/types";
import { Badge, type Tone } from "../ui";

export const STATUS_TONE: Record<BillStatus, Tone> = { pendente: "info", pago: "paid", vencido: "overdue" };

export function StatusBadge({ bill, today }: { bill: Bill; today: string }) {
  const s = billStatus(bill, today);
  const days = diffDays(today, bill.dueDate);
  if (s === "pendente" && days <= 7) {
    return (
      <Badge tone="soon" dot>
        {days === 0 ? "Vence hoje" : `Vence ${relativeDays(days)}`}
      </Badge>
    );
  }
  return (
    <Badge tone={STATUS_TONE[s]} dot>
      {STATUS_LABEL[s]}
    </Badge>
  );
}

export function DueText({ bill, today }: { bill: Bill; today: string }) {
  const s = billStatus(bill, today);
  const days = diffDays(today, bill.dueDate);
  return (
    <span className="flex flex-col leading-tight">
      <span className="tabular font-medium">{formatDate(bill.dueDate)}</span>
      <span className={s === "vencido" ? "text-xs text-overdue" : "text-xs text-muted"}>
        {s === "pago" ? `pago em ${formatDate(bill.paidAt)}` : relativeDays(days)}
      </span>
    </span>
  );
}

/** Dados derivados usados por várias telas. */
export function useDerived() {
  const { data, today } = useStore();
  return useMemo(() => {
    const withStatus = data.bills.map((b) => ({ bill: b, status: billStatus(b, today) }));
    const open = withStatus.filter((x) => x.status !== "pago");
    const overdue = withStatus.filter((x) => x.status === "vencido");
    const next7 = withStatus.filter((x) => x.status === "pendente" && x.bill.dueDate <= addDays(today, 7));
    const upcomingOccurrences: Occurrence[] = occurrencesInRange(data.recurring, data.bills, today, addDays(today, 60)).filter((o) => !o.bill);
    return { withStatus, open, overdue, next7, upcomingOccurrences };
  }, [data, today]);
}

export function sumAmount(bills: { bill: Bill }[] | Bill[]): number {
  return (bills as (Bill | { bill: Bill })[]).reduce((a, x) => a + ("bill" in x ? x.bill.amount : x.amount), 0);
}
