/**
 * Mapeamento de nome de banco → slug do Simple Icons
 * CDN: https://cdn.simpleicons.org/{slug}/{color_hex_sem_hash}
 */
const BANK_SLUG_MAP: Record<string, string> = {
  // Bancos digitais
  nubank: 'nubank',
  nu: 'nubank',
  neon: 'neon',
  picpay: 'picpay',
  'mercado pago': 'mercadopago',
  mercadopago: 'mercadopago',
  'mercado livre': 'mercadolibre',
  inter: 'inter',
  'banco inter': 'inter',
  next: 'next',
  'will bank': 'willbank',
  willbank: 'willbank',
  c6: 'c6bank',
  'c6 bank': 'c6bank',
  pagseguro: 'pagseguro',
  pagbank: 'pagbank',
  iti: 'iti',
  'banco bs2': 'bs2',
  bs2: 'bs2',
  digio: 'digio',
  superdigital: 'superdigital',

  // Bancos tradicionais
  'xp': 'xpinc',
  'xp investimentos': 'xpinc',
  'xp inc': 'xpinc',
  itau: 'itau',
  itaú: 'itau',
  bradesco: 'bradesco',
  santander: 'santander',
  'banco do brasil': 'bancodobrasil',
  bb: 'bancodobrasil',
  caixa: 'caixa',
  'caixa economica': 'caixa',
  'caixa econômica': 'caixa',
  sicredi: 'sicredi',
  sicoob: 'sicoob',
  safra: 'safra',
  btg: 'btgpactual',
  'btg pactual': 'btgpactual',

  // Internacionais
  visa: 'visa',
  mastercard: 'mastercard',
  amex: 'americanexpress',
  'american express': 'americanexpress',
  paypal: 'paypal',
  stripe: 'stripe',
  revolut: 'revolut',
  wise: 'wise',
};

/**
 * Retorna o slug do Simple Icons para um nome de banco,
 * ou null se não encontrado.
 */
export function getBankSlug(bankName: string | null | undefined): string | null {
  if (!bankName) return null;
  const key = bankName.toLowerCase().trim();

  // busca direta
  if (BANK_SLUG_MAP[key]) return BANK_SLUG_MAP[key];

  // busca parcial (ex: "XP BlackCard" → "xp")
  for (const [mapKey, slug] of Object.entries(BANK_SLUG_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return slug;
  }

  return null;
}

/**
 * Retorna a URL do logo no Simple Icons CDN.
 * @param bankName  Nome do banco
 * @param color     Cor hex sem '#' (padrão: ffffff para fundo escuro)
 */
export function getBankLogoUrl(bankName: string | null | undefined, color = 'ffffff'): string | null {
  const slug = getBankSlug(bankName);
  if (!slug) return null;
  return `https://cdn.simpleicons.org/${slug}/${color}`;
}
