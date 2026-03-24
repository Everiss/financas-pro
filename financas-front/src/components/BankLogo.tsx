import React, { useState } from 'react';
import { getBankLogoUrl } from '../lib/bankLogos';
import { cn } from '../lib/utils';

interface Props {
  bankName: string | null | undefined;
  color?: string;          // cor do logo (hex sem #)
  size?: number;           // tamanho em px
  className?: string;
  /** Cor de fundo do fallback (hex com #) */
  fallbackColor?: string;
}

/**
 * Exibe o logotipo de um banco via Simple Icons CDN.
 * Em caso de falha (banco não mapeado ou CDN indisponível),
 * mostra um círculo colorido com a inicial do banco.
 */
export function BankLogo({ bankName, color = 'ffffff', size = 24, className, fallbackColor }: Props) {
  const [errored, setErrored] = useState(false);
  const logoUrl = getBankLogoUrl(bankName, color);

  const initials = bankName
    ? bankName.trim().slice(0, 2).toUpperCase()
    : '?';

  const bgColor = fallbackColor ?? '#3b82f6';

  if (!logoUrl || errored) {
    return (
      <span
        className={cn('inline-flex items-center justify-center rounded-full font-bold text-white shrink-0', className)}
        style={{ width: size, height: size, backgroundColor: bgColor, fontSize: size * 0.4 }}
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={bankName ?? ''}
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', className)}
      onError={() => setErrored(true)}
    />
  );
}
