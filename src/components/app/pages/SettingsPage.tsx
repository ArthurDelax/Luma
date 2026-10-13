"use client";

import { useEffect, useRef, useState } from "react";
import { LuDatabase, LuDownload, LuEraser, LuHardDrive, LuRotateCcw, LuUpload } from "react-icons/lu";
import { downloadText } from "@/lib/csv";
import { formatFileSize } from "@/lib/format";
import { parseBackup, STORAGE_KEY } from "@/lib/storage";
import { useStore } from "@/lib/store";
import { ROLE_LABEL, useWorkspace } from "@/lib/workspace";
import { Button, PageHeader, useConfirm, useToast } from "../../ui";

export function SettingsPage() {
  const { data, today, resetToSample, clearAll, replaceAll, requireWrite, readOnly } = useStore();
  const ws = useWorkspace();
  const cloud = ws.mode === "cloud";
  const confirm = useConfirm();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<{ local: number; quota?: number; used?: number }>({ local: 0 });

  useEffect(() => {
    let local = 0;
    try {
      local = (window.localStorage.getItem(STORAGE_KEY) ?? "").length * 2;
    } catch {
      /* ignorado */
    }
    setUsage({ local });
    navigator.storage?.estimate?.().then((e) => setUsage({ local, quota: e.quota, used: e.usage })).catch(() => {});
  }, [data]);

  const attachments = data.bills.filter((b) => b.attachment).length + data.documents.filter((d) => d.attachment).length;

  const restore = async () => {
    if (!requireWrite()) return;
    const ok = await confirm({
      title: "Restaurar dados de exemplo?",
      message: "Todas as contas, despesas recorrentes, contratos, documentos e anexos atuais serão substituídos pelos dados de demonstração. Esta ação não pode ser desfeita.",
      confirmLabel: "Restaurar exemplo",
      danger: true,
    });
    if (ok) {
      await resetToSample();
      toast("success", "Dados de exemplo restaurados.");
    }
  };

  const wipe = async () => {
    if (!requireWrite()) return;
    const ok = await confirm({
      title: "Apagar todos os dados?",
      message: "Tudo o que está salvo neste navegador será apagado, inclusive os anexos. Esta ação não pode ser desfeita.",
      confirmLabel: "Apagar tudo",
      danger: true,
    });
    if (ok) {
      await clearAll();
      toast("success", "Todos os dados foram apagados.");
    }
  };

  const exportBackup = () => {
    downloadText(`luma-backup-${today}.json`, JSON.stringify({ app: "Luma", exportedAt: new Date().toISOString(), data }, null, 2), "application/json", false);
    toast("success", "Backup baixado.");
  };

  const importBackup = async (f: File | undefined) => {
    if (!f || !requireWrite()) return;
    try {
      const parsed = parseBackup(await f.text());
      const ok = await confirm({
        title: "Importar backup?",
        message: `O backup contém ${parsed.bills.length} contas, ${parsed.recurring.length} despesas recorrentes e ${parsed.documents.length} contratos/documentos. Os dados atuais serão substituídos. Anexos não fazem parte do backup.`,
        confirmLabel: "Importar e substituir",
        danger: true,
      });
      if (ok) {
        replaceAll(parsed);
        toast("success", "Backup importado.");
      }
    } catch (e) {
      toast("error", e instanceof Error && e.message.includes("backup") ? e.message : "Arquivo de backup inválido.");
    } finally {
      if (file.current) file.current.value = "";
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Dados e ajustes" description={cloud ? "Informações da sua empresa e cópias de segurança." : "Gerencie os dados desta demonstração."} />

      {cloud && (
        <section className="card mb-6 overflow-hidden">
          <div className="bg-ink px-5 py-5 text-paper sm:px-6">
            <h2 className="font-display text-lg font-semibold">{ws.orgName}</h2>
            <p className="mt-1 text-sm text-paper/70">
              {ws.email} · {ws.role ? ROLE_LABEL[ws.role] : ""}
            </p>
          </div>
          <ul className="grid gap-px bg-line text-sm sm:grid-cols-2">
            {[
              ["Dados no servidor", "Contas, contratos, documentos e anexos ficam salvos com segurança e aparecem em qualquer computador ou celular em que você entrar."],
              ["Exclusivos da sua empresa", "Somente os usuários da sua empresa têm acesso. Nem outras empresas nem a equipe da Luma veem seus dados financeiros."],
              ["Equipe", "Todos os usuários da empresa veem as mesmas informações. Alterações de um aparecem para os outros em até 1 minuto."],
              ["Cópia de segurança", "Você pode baixar um backup completo (sem os PDFs) quando quiser."],
            ].map(([t, d]) => (
              <li key={t} className="bg-white px-5 py-4">
                <p className="font-semibold">{t}</p>
                <p className="mt-0.5 text-slate-600">{d}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!cloud && (
      <section className="card mb-6 overflow-hidden">
        <div className="bg-navy-900 px-5 py-5 text-white sm:px-6">
          <h2 className="font-display text-lg font-semibold">Esta é uma versão demonstrativa</h2>
          <p className="mt-1 text-sm text-white/70">{readOnly ? "Explore à vontade: as alterações estão desativadas." : "Tudo funciona de verdade, mas apenas dentro do seu navegador."}</p>
        </div>
        <ul className="grid gap-px bg-line text-sm sm:grid-cols-2">
          {(readOnly
            ? [
                ["Dados fictícios", "Empresas, contas, valores e documentos desta demonstração são inventados. Nada do que você vê pertence a uma empresa real."],
                ["Somente leitura", "Você pode navegar, pesquisar, filtrar, exportar CSV e testar a leitura de boletos. Cadastrar, editar e excluir é exclusivo para assinantes."],
                ["Nada é gravado", "A demonstração roda só nesta página: ao recarregar, os dados fictícios voltam ao estado original."],
                ["Versão comercial", "Na versão para assinantes, cada empresa terá um ambiente exclusivo, com usuários, permissões e dados isolados."],
              ]
            : [
                ["Dados locais", "Contas, contratos e alertas ficam salvos neste navegador, neste dispositivo. Não há sincronização entre dispositivos."],
                ["Sem login", "Não há autenticação. Qualquer pessoa que use este navegador verá os mesmos dados."],
                ["Anexos", "PDFs anexados ficam no armazenamento do navegador (até 10 MB cada) e são perdidos se os dados do site forem limpos."],
                ["Sem envios", "Não há envio de e-mails, WhatsApp ou SMS, nem cobrança de assinatura. Alertas aparecem só dentro da Luma."],
              ]
          ).map(([t, d]) => (
            <li key={t} className="bg-white px-5 py-4">
              <p className="font-semibold">{t}</p>
              <p className="mt-0.5 text-slate-600">{d}</p>
            </li>
          ))}
        </ul>
      </section>
      )}

      <section className="card mb-6 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <LuHardDrive className="size-5 text-navy-600" /> Armazenamento
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">Contas</dt>
            <dd className="font-display text-xl font-semibold">{data.bills.length}</dd>
          </div>
          <div>
            <dt className="text-muted">Recorrentes</dt>
            <dd className="font-display text-xl font-semibold">{data.recurring.length}</dd>
          </div>
          <div>
            <dt className="text-muted">Contratos/docs.</dt>
            <dd className="font-display text-xl font-semibold">{data.documents.length}</dd>
          </div>
          <div>
            <dt className="text-muted">Anexos</dt>
            <dd className="font-display text-xl font-semibold">{attachments}</dd>
          </div>
        </dl>
        {!cloud && (
        <p className="mt-3 text-xs text-muted">
          Dados: {formatFileSize(usage.local)}
          {usage.used !== undefined && usage.quota ? ` — uso total do site: ${formatFileSize(usage.used)} de ${formatFileSize(usage.quota)} disponíveis` : ""}
        </p>
        )}
      </section>

      <section className="card divide-y divide-line">
        {[
          {
            icon: <LuDownload className="size-5" />,
            title: "Baixar backup",
            desc: "Salva contas, recorrentes, contratos e documentos em um arquivo JSON. Os anexos PDF não são incluídos.",
            action: (
              <Button variant="secondary" onClick={exportBackup}>
                Baixar backup
              </Button>
            ),
          },
          {
            icon: <LuUpload className="size-5" />,
            title: "Importar backup",
            desc: "Substitui os dados atuais pelos de um backup da Luma.",
            action: (
              <>
                <Button variant="secondary" onClick={() => requireWrite() && file.current?.click()}>
                  Importar backup
                </Button>
                <input ref={file} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => importBackup(e.target.files?.[0])} aria-label="Arquivo de backup" />
              </>
            ),
          },
          {
            icon: <LuRotateCcw className="size-5" />,
            title: "Restaurar dados de exemplo",
            desc: "Volta para os dados fictícios da demonstração, com datas recalculadas a partir de hoje.",
            action: (
              <Button variant="secondary" onClick={restore}>
                Restaurar exemplo
              </Button>
            ),
          },
          {
            icon: <LuEraser className="size-5" />,
            title: "Apagar todos os dados",
            desc: "Começa do zero, sem nenhum registro.",
            action: (
              <Button variant="danger" onClick={wipe}>
                Apagar tudo
              </Button>
            ),
          },
        ]
          .filter((row) => !cloud || row.title === "Baixar backup" || row.title === "Importar backup")
          .map((row) => (
          <div key={row.title} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:px-6">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-navy-600">{row.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold">{row.title}</p>
              <p className="text-[13px] text-muted">{row.desc}</p>
            </div>
            <div className="shrink-0">{row.action}</div>
          </div>
        ))}
      </section>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted">
        <LuDatabase className="size-4" />
        Luma — versão demonstrativa 0.1. O código está organizado para receber backend, login e notificações reais no futuro.
      </p>
    </div>
  );
}
