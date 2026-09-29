/**
 * DONGATO (دنگاتو) - Iranian Bank Card & Financial Utilities
 * Provides BIN detection, Luhn validation, Persian formatting, and IBAN (Sheba) helpers.
 */

export interface BankInfo {
  name: string;
  slug: string;
  bins: string[];
  gradient: string;
  textColor: string;
  accentColor: string;
  badgeBg: string;
}

// Comprehensive Iranian Bank BIN Mappings
export const IRANIAN_BANKS: BankInfo[] = [
  {
    name: 'بانک ملت',
    slug: 'mellat',
    bins: ['610433', '991975'],
    gradient: 'from-[#b91c1c] via-[#991b1b] to-[#450a0a]',
    textColor: 'text-white',
    accentColor: '#ef4444',
    badgeBg: 'bg-red-500/20 text-red-300 border-red-500/30',
  },
  {
    name: 'بانک ملی ایران',
    slug: 'melli',
    bins: ['603799', '170019'],
    gradient: 'from-[#0369a1] via-[#0284c7] to-[#082f49]',
    textColor: 'text-white',
    accentColor: '#38bdf8',
    badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  },
  {
    name: 'بانک صادرات ایران',
    slug: 'saderat',
    bins: ['603769', '903769'],
    gradient: 'from-[#1e1b4b] via-[#312e81] to-[#0f172a]',
    textColor: 'text-white',
    accentColor: '#818cf8',
    badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
  {
    name: 'بانک تجارت',
    slug: 'tejarat',
    bins: ['585983', '627353'],
    gradient: 'from-[#1e3a8a] via-[#1d4ed8] to-[#172554]',
    textColor: 'text-white',
    accentColor: '#60a5fa',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  {
    name: 'بانک کشاورزی',
    slug: 'keshavarzi',
    bins: ['603770', '639217'],
    gradient: 'from-[#14532d] via-[#15803d] to-[#052e16]',
    textColor: 'text-white',
    accentColor: '#4ade80',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    name: 'بانک پاسارگاد',
    slug: 'pasargad',
    bins: ['502229', '639347'],
    gradient: 'from-[#292524] via-[#78350f] to-[#1c1917]',
    textColor: 'text-amber-100',
    accentColor: '#fbbf24',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    name: 'بانک سامان',
    slug: 'saman',
    bins: ['621986'],
    gradient: 'from-[#0e7490] via-[#0891b2] to-[#164e63]',
    textColor: 'text-white',
    accentColor: '#22d3ee',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  },
  {
    name: 'بانک پارسیان',
    slug: 'parsian',
    bins: ['622106', '639194', '627884'],
    gradient: 'from-[#881337] via-[#9f1239] to-[#4c0519]',
    textColor: 'text-white',
    accentColor: '#fb7185',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
  {
    name: 'بانک قرض‌الحسنه رسالت',
    slug: 'resalat',
    bins: ['504172'],
    gradient: 'from-[#115e59] via-[#0f766e] to-[#042f2e]',
    textColor: 'text-white',
    accentColor: '#2dd4bf',
    badgeBg: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  },
  {
    name: 'بانک قرض‌الحسنه مهر ایران',
    slug: 'mehr',
    bins: ['606373'],
    gradient: 'from-[#065f46] via-[#059669] to-[#022c22]',
    textColor: 'text-white',
    accentColor: '#34d399',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    name: 'بانک مسکن',
    slug: 'maskan',
    bins: ['628023'],
    gradient: 'from-[#9a3412] via-[#ea580c] to-[#431407]',
    textColor: 'text-white',
    accentColor: '#fb923c',
    badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  },
  {
    name: 'بانک شهر',
    slug: 'shahr',
    bins: ['502806', '504706'],
    gradient: 'from-[#991b1b] via-[#dc2626] to-[#450a0a]',
    textColor: 'text-white',
    accentColor: '#f87171',
    badgeBg: 'bg-red-500/20 text-red-300 border-red-500/30',
  },
  {
    name: 'بانک رفاه کارگران',
    slug: 'refah',
    bins: ['589463'],
    gradient: 'from-[#1e3a8a] via-[#1e40af] to-[#0f172a]',
    textColor: 'text-white',
    accentColor: '#93c5fd',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  {
    name: 'بانک سپه',
    slug: 'sepah',
    bins: ['589210'],
    gradient: 'from-[#854d0e] via-[#ca8a04] to-[#422006]',
    textColor: 'text-amber-50',
    accentColor: '#fde047',
    badgeBg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  },
  {
    name: 'بانک آینده',
    slug: 'ayandeh',
    bins: ['636214'],
    gradient: 'from-[#713f12] via-[#854d0e] to-[#292524]',
    textColor: 'text-white',
    accentColor: '#facc15',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    name: 'بانک اقتصاد نوین',
    slug: 'en',
    bins: ['627412'],
    gradient: 'from-[#581c87] via-[#7e22ce] to-[#3b0764]',
    textColor: 'text-white',
    accentColor: '#c084fc',
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
  {
    name: 'بانک دی',
    slug: 'dey',
    bins: ['502938'],
    gradient: 'from-[#1d4ed8] via-[#2563eb] to-[#1e293b]',
    textColor: 'text-white',
    accentColor: '#60a5fa',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  {
    name: 'بانک سینا',
    slug: 'sina',
    bins: ['639346'],
    gradient: 'from-[#0369a1] via-[#0284c7] to-[#0c4a6e]',
    textColor: 'text-white',
    accentColor: '#38bdf8',
    badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  },
  {
    name: 'بانک کارآفرین',
    slug: 'karafarin',
    bins: ['627488', '502908'],
    gradient: 'from-[#166534] via-[#15803d] to-[#14532d]',
    textColor: 'text-white',
    accentColor: '#86efac',
    badgeBg: 'bg-green-500/20 text-green-300 border-green-500/30',
  },
  {
    name: 'پست بانک ایران',
    slug: 'postbank',
    bins: ['627760'],
    gradient: 'from-[#047857] via-[#059669] to-[#064e3b]',
    textColor: 'text-white',
    accentColor: '#6ee7b7',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    name: 'بانک گردشگری',
    slug: 'gardeshgari',
    bins: ['505416'],
    gradient: 'from-[#9f1239] via-[#be123c] to-[#4c0519]',
    textColor: 'text-white',
    accentColor: '#fda4af',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
  {
    name: 'بانک سرمایه',
    slug: 'sarmayeh',
    bins: ['639607'],
    gradient: 'from-[#7f1d1d] via-[#991b1b] to-[#450a0a]',
    textColor: 'text-white',
    accentColor: '#fca5a5',
    badgeBg: 'bg-red-500/20 text-red-300 border-red-500/30',
  },
  {
    name: 'بانک توسعه تعاون',
    slug: 'ttbank',
    bins: ['207177'],
    gradient: 'from-[#1e40af] via-[#2563eb] to-[#1e3a8a]',
    textColor: 'text-white',
    accentColor: '#93c5fd',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  {
    name: 'بانک ایران زمین',
    slug: 'iranzamin',
    bins: ['505785'],
    gradient: 'from-[#831843] via-[#9d174d] to-[#500724]',
    textColor: 'text-white',
    accentColor: '#f472b6',
    badgeBg: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  },
];

// Fallback for unidentified BINs
export const DEFAULT_BANK: BankInfo = {
  name: 'بانک شتاب',
  slug: 'shetab',
  bins: [],
  gradient: 'from-[#1e293b] via-[#334155] to-[#0f172a]',
  textColor: 'text-slate-100',
  accentColor: '#94a3b8',
  badgeBg: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
};

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Normalizes Persian and Arabic numbers to standard ASCII digits 0-9.
 */
export function normalizeCardDigits(value: string): string {
  if (!value) return '';
  let result = value;
  for (let i = 0; i < 10; i++) {
    result = result
      .replace(new RegExp(PERSIAN_DIGITS[i], 'g'), i.toString())
      .replace(new RegExp(ARABIC_DIGITS[i], 'g'), i.toString());
  }
  return result.replace(/\D/g, '');
}

/**
 * Formats standard numbers to Persian digits.
 */
export function toPersianDigits(value: string | number): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[+digit]);
}

/**
 * Detects the issuing Iranian bank based on the first 6 digits (BIN).
 */
export function detectBank(cardNumber: string): BankInfo {
  const digits = normalizeCardDigits(cardNumber);
  if (digits.length < 6) {
    return DEFAULT_BANK;
  }

  const bin6 = digits.slice(0, 6);
  const matched = IRANIAN_BANKS.find((bank) => bank.bins.some((b) => b === bin6));
  return matched || DEFAULT_BANK;
}

/**
 * Validates a 16-digit card number using the Iranian Luhn algorithm (ISO/IEC 7812).
 */
export function isValidCardNumber(cardNumber: string): boolean {
  const clean = normalizeCardDigits(cardNumber);
  if (clean.length !== 16) return false;

  const digits = clean.split('').map(Number);
  let sum = 0;

  for (let i = 0; i < 16; i++) {
    let digit = digits[i];
    // In a 16-digit card, indices 0, 2, 4, 6, 8, 10, 12, 14 are even positions
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }

  return sum % 10 === 0;
}

/**
 * Formats a card number into 4-digit groups (e.g. ۶۰۳۷-۹۹۷۵-۱۲۳۴-۵۶۷۸ or 6037-9975-1234-5678).
 */
export function formatCardNumber(
  cardNumber: string,
  usePersian = true,
  separator = '-'
): string {
  const clean = normalizeCardDigits(cardNumber);
  if (!clean) return '';

  const parts: string[] = [];
  for (let i = 0; i < clean.length && i < 16; i += 4) {
    parts.push(clean.slice(i, i + 4));
  }

  const formatted = parts.join(separator);
  return usePersian ? toPersianDigits(formatted) : formatted;
}

/**
 * Validates Iranian Sheba (IBAN) format and checksum (ISO 7064 Mod 97-10).
 */
export function isValidShaba(shaba: string): boolean {
  if (!shaba) return false;
  const clean = shaba.toUpperCase().replace(/[\s-]/g, '');
  if (!/^IR\d{24}$/.test(clean)) return false;

  // Rearrange: Move 'IR' and 2 check digits to end: 'IRxx...' -> '...IRxx'
  // Where I=18, R=27
  const rearranged = clean.slice(4) + '1827' + clean.slice(2, 4);

  // BigInt modulo 97 check
  try {
    let remainder = 0;
    for (let i = 0; i < rearranged.length; i += 7) {
      const chunk = remainder.toString() + rearranged.slice(i, i + 7);
      remainder = Number(chunk) % 97;
    }
    return remainder === 1;
  } catch {
    return false;
  }
}

/**
 * Formats a Sheba string into standard grouped format: IR00 0000 0000 0000 0000 0000.
 */
export function formatShaba(shaba: string): string {
  if (!shaba) return '';
  const clean = shaba.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const digitsOnly = clean.startsWith('IR') ? clean.slice(2) : clean;

  const parts: string[] = [];
  if (clean.startsWith('IR')) {
    parts.push('IR' + digitsOnly.slice(0, 2));
    const rest = digitsOnly.slice(2);
    for (let i = 0; i < rest.length && i < 22; i += 4) {
      parts.push(rest.slice(i, i + 4));
    }
  } else {
    for (let i = 0; i < digitsOnly.length && i < 24; i += 4) {
      parts.push(digitsOnly.slice(i, i + 4));
    }
  }

  return parts.join(' ');
}
