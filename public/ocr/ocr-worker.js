/* Worker de OCR da Luma: reconhece o texto de páginas em imagem (tudo no navegador). */
/* global importScripts, TesseractCore */
let ready = null;

function init(base) {
  if (!ready) {
    ready = (async () => {
      importScripts(base + "tesseract-core-lstm.js");
      const M = await TesseractCore({ locateFile: (f) => base + f });
      const res = await fetch(base + "por.traineddata");
      if (!res.ok) throw new Error("Falha ao baixar o modelo de OCR");
      M.FS.writeFile("por.traineddata", new Uint8Array(await res.arrayBuffer()));
      const api = new M.TessBaseAPI();
      if (api.Init(null, "por", 1) !== 0) throw new Error("Falha ao iniciar o OCR");
      return { M, api };
    })();
    ready.catch(() => {
      ready = null;
    });
  }
  return ready;
}

self.onmessage = async (e) => {
  const { id, base, width, height, gray, psm } = e.data;
  try {
    const { M, api } = await init(base);
    const header = new TextEncoder().encode("P5\n" + width + " " + height + "\n255\n");
    const file = new Uint8Array(header.length + gray.length);
    file.set(header);
    file.set(gray, header.length);
    M.FS.writeFile("/input", file);
    api.SetVariable("tessedit_pageseg_mode", String(psm || 6));
    api.SetImageFile(1, 0);
    api.Recognize(null);
    const tsv = api.GetTSVText(0);
    api.Clear();
    self.postMessage({ id, tsv });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
