/**
 * Reduz a foto no próprio navegador antes de enviar: celulares geram fotos de
 * 4 a 8 MB, e o cardápio abre muito mais rápido com imagens de ~200 KB.
 */
export async function compressImage(file: Blob, maxSide: number, quality: number): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && file.type !== "") {
    throw new Error("Envie uma foto em JPG, PNG ou WebP.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Não foi possível abrir essa imagem. Tente outra foto em JPG ou PNG.");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não conseguiu preparar a imagem.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const toBlob = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpg = await toBlob("image/jpeg");
  if (!jpg) throw new Error("O navegador não conseguiu preparar a imagem.");
  return jpg;
}
