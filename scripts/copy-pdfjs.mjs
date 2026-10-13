// Copia os arquivos do PDF.js para public/pdfjs, para que sejam servidos como
// arquivos estáticos (o PDF é processado inteiramente no navegador do usuário).
import { cpSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("pdfjs-dist/package.json"));
const dest = join(process.cwd(), "public", "pdfjs");

if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

cpSync(join(pkgDir, "legacy", "build", "pdf.min.mjs"), join(dest, "pdf.min.mjs"));
cpSync(join(pkgDir, "legacy", "build", "pdf.worker.min.mjs"), join(dest, "pdf.worker.min.mjs"));
for (const dir of ["cmaps", "standard_fonts", "wasm"]) {
  const src = join(pkgDir, dir);
  if (existsSync(src)) cpSync(src, join(dest, dir), { recursive: true });
}
console.log("PDF.js copiado para public/pdfjs");
