"use client";

import { useEffect, useState } from "react";
import { LuDownload, LuPrinter, LuTriangleAlert } from "react-icons/lu";
import { tableUrl } from "@/lib/menu/links";
import { qrPng, qrSvg } from "@/lib/menu/qr";
import { Badge, Button, Field, Input, useToast } from "../../ui";
import { useEditor } from "./context";
import { Panel, Toggle } from "./fields";
import { useStore } from "./StorePage";

const MAX_TABLES = 200;

function useQr(text: string, size = 720) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    qrPng(text, size).then((s) => alive && setSrc(s), () => alive && setSrc(""));
    return () => {
      alive = false;
    };
  }, [text, size]);
  return src;
}

function download(name: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const esc = (s: string) => s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]!);

/** Abre uma janela só com os cartões e chama a impressão do navegador. */
function printSheet(title: string, cardsHtml: string, accent: string, perPage: "poster" | "cards") {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif; color: #1c1712; }
  .grid { display: grid; grid-template-columns: ${perPage === "poster" ? "1fr" : "1fr 1fr"}; gap: 8mm; }
  .card { border: 1.5px dashed #c9c2b4; border-radius: 6mm; padding: ${perPage === "poster" ? "16mm 12mm" : "7mm 6mm"}; text-align: center; break-inside: avoid; page-break-inside: avoid; }
  .store { font-weight: 800; font-size: ${perPage === "poster" ? "26pt" : "13pt"}; letter-spacing: -0.02em; }
  .table { display: inline-block; margin-top: 3mm; background: ${accent}; color: #fff; font-weight: 800; border-radius: 99px; padding: 1.5mm 6mm; font-size: ${perPage === "poster" ? "16pt" : "15pt"}; }
  .qr { width: ${perPage === "poster" ? "120mm" : "62mm"}; height: auto; margin: ${perPage === "poster" ? "10mm" : "4mm"} auto; display: block; }
  .call { font-weight: 700; font-size: ${perPage === "poster" ? "20pt" : "11.5pt"}; }
  .sub { color: #6b6156; font-size: ${perPage === "poster" ? "12pt" : "8.5pt"}; margin-top: 2mm; }
  .url { color: #6b6156; font-size: ${perPage === "poster" ? "10pt" : "7pt"}; margin-top: 3mm; word-break: break-all; }
</style></head><body><div class="grid">${cardsHtml}</div>
<script>
  const imgs = [...document.images];
  Promise.all(imgs.map((i) => i.complete ? 0 : new Promise((r) => { i.onload = r; i.onerror = r; }))).then(() => setTimeout(() => window.print(), 150));
</script></body></html>`);
  w.document.close();
  return true;
}

export function QrPage() {
  const { record, publicUrl, readOnly } = useEditor();
  const { store: s, setStore } = useStore();
  const toast = useToast();
  const url = publicUrl(record.slug);
  const qr = useQr(url);
  const [preview, setPreview] = useState(1);
  const tables = Math.min(MAX_TABLES, Math.max(1, s.dineIn.tables || 1));
  const tableQr = useQr(tableUrl(url, preview), 480);
  const fileBase = record.slug || "cardapio";
  const accent = /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : "#de3f1c";

  const downloadSvg = async (text: string, name: string) => {
    const svg = await qrSvg(text);
    const href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    download(name, href);
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  };

  const blocked = () => toast("error", "O navegador bloqueou a janela de impressão. Permita janelas pop-up para este site e tente de novo.");

  const printPoster = () => {
    if (!qr) return;
    const html = `<div class="card"><div class="store">${esc(s.name)}</div><img class="qr" src="${qr}" alt=""><div class="call">Aponte a câmera do celular e faça seu pedido</div><div class="sub">Cardápio completo com fotos. O pedido chega pelo WhatsApp.</div><div class="url">${esc(url)}</div></div>`;
    if (!printSheet(`QR Code — ${s.name}`, html, accent, "poster")) blocked();
  };

  const printTables = async () => {
    const cards: string[] = [];
    for (let n = 1; n <= tables; n++) {
      const src = await qrPng(tableUrl(url, n), 480);
      cards.push(`<div class="card"><div class="store">${esc(s.name)}</div><div class="table">Mesa ${n}</div><img class="qr" src="${src}" alt=""><div class="call">Escaneie, escolha e peça daqui da mesa</div><div class="sub">O pedido vai direto para a equipe da casa.</div></div>`);
    }
    if (!printSheet(`Mesas — ${s.name}`, cards.join(""), accent, "cards")) blocked();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2rem]">QR Code</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">Imprima e cole no balcão, na vitrine, nas embalagens e nas mesas. O cliente aponta a câmera do celular e o cardápio abre na hora, sem baixar nada.</p>
      </div>

      {!record.published && (
        <div className="flex items-start gap-3 rounded-2xl bg-soon-soft px-4 py-3 text-sm text-soon">
          <LuTriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            O cardápio ainda não está publicado. O QR Code já pode ser impresso, mas só abre o cardápio depois de você publicar na tela Início.
          </span>
        </div>
      )}

      <Panel title="QR Code do cardápio" description="Leva para o cardápio completo, com entrega e retirada. Use em cartazes, panfletos, sacolas e no balcão.">
        <div className="grid items-center gap-6 sm:grid-cols-[220px_1fr]">
          <div className="mx-auto w-full max-w-[220px] rounded-3xl border border-line bg-white p-3">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`QR Code do cardápio da ${s.name}`} className="aspect-square w-full" />
            ) : (
              <div className="aspect-square w-full animate-pulse rounded-2xl bg-sky-100" />
            )}
          </div>
          <div className="min-w-0 space-y-4">
            <p className="break-all rounded-xl bg-paper px-3 py-2 font-mono text-xs text-muted">{url}</p>
            <div className="flex flex-wrap gap-2">
              <Button icon={<LuPrinter className="size-4" />} onClick={printPoster} disabled={!qr}>
                Imprimir cartaz
              </Button>
              <Button variant="secondary" icon={<LuDownload className="size-4" />} onClick={() => qr && download(`qrcode-${fileBase}.png`, qr)} disabled={!qr}>
                Baixar PNG
              </Button>
              <Button variant="secondary" icon={<LuDownload className="size-4" />} onClick={() => downloadSvg(url, `qrcode-${fileBase}.svg`)}>
                Baixar SVG (gráfica)
              </Button>
            </div>
            <p className="text-xs text-muted">PNG para redes sociais e WhatsApp; SVG para a gráfica, que imprime em qualquer tamanho sem perder qualidade.</p>
          </div>
        </div>
      </Panel>

      <Panel
        title="Pedido na mesa"
        description="Cada mesa ganha o seu QR Code. O cliente pede pelo celular e a mensagem chega no WhatsApp da loja com o número da mesa, sem endereço nem taxa de entrega."
        actions={<Toggle checked={s.dineIn.enabled} disabled={readOnly} onChange={(enabled) => setStore({ dineIn: { ...s.dineIn, enabled } })} label={s.dineIn.enabled ? "Ativado" : "Desativado"} />}
      >
        {s.dineIn.enabled ? (
          <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
            <div className="mx-auto w-full max-w-[220px]">
              <div className="rounded-3xl border border-dashed border-sky-300 bg-white p-4 text-center">
                <p className="truncate font-display text-sm font-semibold">{s.name}</p>
                <span className="mt-1.5 inline-block rounded-full px-3 py-0.5 text-sm font-bold text-white" style={{ background: accent }}>
                  Mesa {preview}
                </span>
                {tableQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tableQr} alt={`QR Code da mesa ${preview}`} className="mx-auto mt-2 aspect-square w-full" />
                ) : (
                  <div className="mt-2 aspect-square w-full animate-pulse rounded-2xl bg-sky-100" />
                )}
                <p className="text-[11px] font-semibold">Escaneie, escolha e peça daqui da mesa</p>
              </div>
              <p className="mt-2 text-center text-xs text-muted">Prévia do cartão impresso</p>
            </div>
            <div className="min-w-0 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                <Field label="Quantas mesas?" htmlFor="qr-tables" hint={`Até ${MAX_TABLES}`}>
                  <Input
                    id="qr-tables"
                    type="number"
                    min={1}
                    max={MAX_TABLES}
                    value={s.dineIn.tables}
                    disabled={readOnly}
                    onChange={(e) => setStore({ dineIn: { ...s.dineIn, tables: Math.min(MAX_TABLES, Math.max(1, Number(e.target.value) || 1)) } })}
                  />
                </Field>
                <Field label="Ver a mesa" htmlFor="qr-preview">
                  <Input id="qr-preview" type="number" min={1} max={tables} value={preview} onChange={(e) => setPreview(Math.min(tables, Math.max(1, Number(e.target.value) || 1)))} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon={<LuPrinter className="size-4" />} onClick={printTables}>
                  Imprimir cartões das {tables} mesas
                </Button>
                <Button variant="secondary" icon={<LuDownload className="size-4" />} onClick={() => tableQr && download(`qrcode-${fileBase}-mesa-${preview}.png`, tableQr)} disabled={!tableQr}>
                  Baixar QR da mesa {preview}
                </Button>
              </div>
              <ul className="space-y-1.5 text-sm text-muted">
                <li>• Saem 6 cartões por folha A4, com linha tracejada para recortar.</li>
                <li>• O link de cada mesa termina com o número dela, ex.: <span className="font-mono text-xs">…&amp;mesa=5</span>.</li>
                <li>
                  • Na mesa o pedido não tem taxa nem pedido mínimo, e o WhatsApp do cliente é opcional. <Badge tone="info">Salve para valer</Badge>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Desativado: os QR Codes de mesa abrem o cardápio normal, com entrega e retirada. Ative se a loja tem mesas ou balcão para consumo no local.</p>
        )}
      </Panel>
    </div>
  );
}
