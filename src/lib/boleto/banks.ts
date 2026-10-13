/** Principais instituições emissoras de boletos (código de compensação → nome). */
const BANKS: Record<string, string> = {
  "001": "Banco do Brasil",
  "004": "Banco do Nordeste",
  "021": "Banestes",
  "033": "Santander",
  "037": "Banpará",
  "041": "Banrisul",
  "047": "Banese",
  "070": "BRB",
  "077": "Banco Inter",
  "085": "Ailos",
  "104": "Caixa Econômica Federal",
  "136": "Unicred",
  "197": "Stone",
  "208": "BTG Pactual",
  "212": "Banco Original",
  "237": "Bradesco",
  "260": "Nubank",
  "290": "PagBank",
  "323": "Mercado Pago",
  "336": "C6 Bank",
  "341": "Itaú Unibanco",
  "380": "PicPay",
  "403": "Cora",
  "422": "Safra",
  "623": "Banco Pan",
  "655": "Banco BV",
  "748": "Sicredi",
  "756": "Sicoob",
};

export function bankName(code: string): string | undefined {
  return BANKS[code.padStart(3, "0")];
}
