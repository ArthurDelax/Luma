import QRCode from "qrcode";

/**
 * QR Code gerado no próprio navegador (nada é enviado a outro serviço).
 * Correção de erro "M": continua lendo com a impressão um pouco gasta ou amassada.
 */
export function qrPng(text: string, size = 720, dark = "#13342a"): Promise<string> {
  return QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 2, width: size, color: { dark, light: "#ffffff" } });
}

export function qrSvg(text: string, dark = "#13342a"): Promise<string> {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark, light: "#ffffff" } });
}
