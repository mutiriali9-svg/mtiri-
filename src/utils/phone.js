import {
  parsePhoneNumber,
  isValidPhoneNumber,
  getCountryCallingCode,
  isSupportedCountry,
  getExampleNumber,
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';

export const DEFAULT_COUNTRY = 'AE';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function asciiDigits(text) {
  return String(text || '')
    .replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d))
    .replace(/[۰-۹]/g, d => FA_DIGITS.indexOf(d));
}

function regionOf(country) {
  const code = String(country || '').trim().toUpperCase();
  return code && isSupportedCountry(code) ? code : undefined;
}

export function countryDialCode(country = DEFAULT_COUNTRY) {
  const region = regionOf(country);
  return region ? getCountryCallingCode(region) : '';
}

export function normalizeE164(raw, country = DEFAULT_COUNTRY) {
  let text = asciiDigits(raw).trim();
  if (!text) return '';
  text = text.replace(/^00/, '+');
  const region = regionOf(country);
  const digits = text.replace(/\D/g, '');
  const candidates = [];
  try {
    const local = parsePhoneNumber(text, region);
    if (local) candidates.push(local);
  } catch { /* ignore */ }
  if (!text.startsWith('+') && digits.length >= 8) {
    try {
      const intl = parsePhoneNumber(`+${digits}`);
      if (intl) candidates.push(intl);
    } catch { /* ignore */ }
  }
  if (!candidates.length) return '';
  const valid = candidates.find(c => c.isValid());
  return (valid || candidates[0]).number;
}

export function isValidE164(value, country = DEFAULT_COUNTRY) {
  const text = asciiDigits(value).trim();
  if (!text) return false;
  try {
    return isValidPhoneNumber(text, regionOf(country));
  } catch {
    return false;
  }
}

export function formatPhone(value, country = DEFAULT_COUNTRY) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const e164 = normalizeE164(raw, country);
  if (!e164) return raw;
  try {
    const parsed = parsePhoneNumber(e164);
    return parsed ? parsed.formatInternational() : e164;
  } catch {
    return e164;
  }
}

export function phoneExampleFor(country = DEFAULT_COUNTRY) {
  const region = regionOf(country);
  if (!region) return '+xxx xxxx xxxx';
  const example = getExampleNumber(region, examples);
  const dial = `+${getCountryCallingCode(region)}`;
  if (!example) return `${dial} xxxxxxxx`;
  const intl = example.formatInternational();
  const rest = intl.startsWith(dial) ? intl.slice(dial.length) : ` ${example.nationalNumber}`;
  let first = true;
  const masked = rest.replace(/\d/g, d => {
    if (first) { first = false; return d; }
    return 'x';
  });
  return `${dial}${masked}`;
}

export function phoneInvalidText(ar = true, country = DEFAULT_COUNTRY) {
  const example = phoneExampleFor(country);
  return ar ? `رقم الهاتف غير صالح — مثال: ${example}` : `Invalid phone number — e.g. ${example}`;
}

export function waDigits(phone, country = DEFAULT_COUNTRY) {
  const e164 = normalizeE164(phone, country);
  return e164 ? e164.replace(/\D/g, '') : '';
}

export function waUrl(phone, text = '', country = DEFAULT_COUNTRY) {
  const digits = waDigits(phone, country);
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return digits ? `https://wa.me/${digits}${query}` : `https://wa.me/${query}`;
}
