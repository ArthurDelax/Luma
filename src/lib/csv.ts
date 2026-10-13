/** Exportação CSV compatível com Excel em português (separador ";" e BOM UTF-8). */

export type CsvValue = string | number | undefined | null;

function cell(v: CsvValue): string {
  if (v === undefined || v === null) return "";
  const s = typeof v === "number" ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }) : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers: string[], rows: CsvValue[][]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
}

export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8", bom = true) {
  const blob = new Blob(bom ? ["\uFEFF", content] : [content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
