export const MONTHS_MEMORY_START = '2024-01-01';

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const normalize = (s) => String(s || '')
  .replace(/[إأآ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/[ً-ٟـ]/g, '')
  .toLowerCase();

const latinDigits = (s) => String(s || '')
  .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));

const MONTH_LOOKUP = (() => {
  const map = new Map();
  AR_MONTHS.forEach((name, i) => map.set(normalize(name), i + 1));
  EN_MONTHS.forEach((name, i) => {
    map.set(name.toLowerCase(), i + 1);
    map.set(name.slice(0, 3).toLowerCase(), i + 1);
  });
  [['يونيه', 6], ['يوليه', 7], ['sept', 9]].forEach(([name, m]) => map.set(normalize(name), m));
  return map;
})();

export const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
export const keyYear = (key) => Number(key.slice(0, 4));
export const keyMonth = (key) => Number(key.slice(5, 7));
export const monthName = (month, ar) => (ar ? AR_MONTHS : EN_MONTHS)[month - 1];
export const monthLabel = (key, ar) => `${monthName(keyMonth(key), ar)} ${keyYear(key)}`;
export const currentMonthKey = () => {
  const d = new Date();
  return monthKey(d.getFullYear(), d.getMonth() + 1);
};

export const shiftMonth = (key, n) => {
  const index = keyYear(key) * 12 + keyMonth(key) - 1 + n;
  return monthKey(Math.floor(index / 12), (index % 12) + 1);
};

export const sortMonths = (keys) => [...new Set(keys)].sort();

export function formatDueMonths({ months = [], custom = '' }, ar = true) {
  const keys = sortMonths(months);
  const monthsText = keys.map((key, i) => {
    const next = keys[i + 1];
    const name = monthName(keyMonth(key), ar);
    return next && keyYear(next) === keyYear(key) ? name : `${name} ${keyYear(key)}`;
  }).join(ar ? '، ' : ', ');
  return [monthsText, custom.trim()].filter(Boolean).join(' + ');
}

function parseMonthList(text) {
  const tokens = latinDigits(text).split(/\s*[،,]\s*/).map(s => s.trim()).filter(Boolean);
  if (!tokens.length) return null;
  const keys = [];
  let pending = [];
  for (const token of tokens) {
    const match = token.match(/^(\S+?)(?:\s+(\d{4}))?$/);
    const month = match && MONTH_LOOKUP.get(normalize(match[1]));
    if (!month) return null;
    pending.push(month);
    if (match[2]) {
      pending.forEach(m => keys.push(monthKey(Number(match[2]), m)));
      pending = [];
    }
  }
  return pending.length ? null : sortMonths(keys);
}

export function parseDueMonths(text) {
  const raw = String(text || '').trim();
  if (!raw) return { months: [], custom: '' };
  const cut = raw.indexOf(' + ');
  const months = parseMonthList(cut >= 0 ? raw.slice(0, cut) : raw);
  if (!months) return { months: [], custom: raw };
  return { months, custom: cut >= 0 ? raw.slice(cut + 3).trim() : '' };
}

const recordedOn = (p) => String(p?.created_at || p?.created_date || p?.payment_date || '');

export const isTrackedPayment = (p) => recordedOn(p) >= MONTHS_MEMORY_START;

const trackedMonths = (history, unitNumber, excludeId) => (history || [])
  .filter(p => p.unit_number === unitNumber && p.id !== excludeId && isTrackedPayment(p))
  .map(p => ({ payment: p, months: parseDueMonths(p.due_months).months }))
  .filter(x => x.months.length > 0);

export function suggestDueMonths(history, unitNumber, excludeId = null) {
  if (!unitNumber) return null;
  let best = null;
  for (const x of trackedMonths(history, unitNumber, excludeId)) {
    const last = x.months[x.months.length - 1];
    if (!best || last > best.last || (last === best.last && recordedOn(x.payment) > recordedOn(best.payment))) {
      best = { ...x, last };
    }
  }
  if (!best) return null;
  return {
    months: best.months.map((_, i) => shiftMonth(best.last, i + 1)),
    basis: best.months,
  };
}

export const coveredMonths = (history, unitNumber, excludeId = null) =>
  new Set(trackedMonths(history, unitNumber, excludeId).flatMap(x => x.months));
