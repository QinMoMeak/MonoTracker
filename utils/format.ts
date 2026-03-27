import { Language } from '../types';

export function getCurrencyLocale(language: Language | string = 'zh-CN') {
  if (language === 'zh-TW') return 'zh-TW';
  if (language === 'ja') return 'ja-JP';
  if (language === 'en') return 'en-US';
  return 'zh-CN';
}

export function formatCurrency(
  value: number | string | null | undefined,
  currency: string = 'CNY',
  language: Language | string = 'zh-CN',
  options: Intl.NumberFormatOptions = {}
): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '';

  try {
    return new Intl.NumberFormat(getCurrencyLocale(language), {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
      ...options
    }).format(amount);
  } catch {
    const symbolMap: Record<string, string> = {
      CNY: '\u00A5',
      JPY: '\u00A5',
      USD: '$',
      EUR: '\u20AC'
    };
    const symbol = symbolMap[currency] ?? currency;
    const fractionDigits = options.maximumFractionDigits ?? 2;
    return symbol + amount.toFixed(fractionDigits);
  }
}
