import { formatDueMonths, monthLabel, parseDueMonths, shiftMonth } from './dueMonths.js';

const r2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
const monthOf = (date) => String(date || '').slice(0, 7);
const dayOf = (date) => Number(String(date || '').slice(8, 10)) || 0;
const isMonth = (key) => /^\d{4}-\d{2}$/.test(key);
const money = (n) => r2(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

export const LATE_START_DAY = 15;

export const daysInMonth = (key) => new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).getUTCDate();

const firstBilledMonth = (contractStart) => {
  const key = monthOf(contractStart);
  if (!isMonth(key)) return '';
  return dayOf(contractStart) > LATE_START_DAY ? shiftMonth(key, 1) : key;
};

export function rentPosition({ unit, payments, exitDate, confirmGaps = false }) {
  const exitMonth = monthOf(exitDate);
  if (!isMonth(exitMonth)) return { ok: false };

  const read = (payments || [])
    .filter(p => !p.status || p.status === 'paid')
    .map(p => ({ payment: p, ...parseDueMonths(p.due_months) }));
  const share = new Map();
  const coveredBy = new Map();
  for (const x of read) {
    if (!x.months.length) continue;
    const part = (Number(x.payment.amount) || 0) / x.months.length;
    for (const m of x.months) {
      share.set(m, (share.get(m) || 0) + part);
      coveredBy.set(m, [...(coveredBy.get(m) || []), { payment: x.payment, part }]);
    }
  }
  const months = [...share.keys()].sort();
  if (!months.length) return { ok: false };

  const billed = firstBilledMonth(unit?.contract_start);
  const start = billed && billed > months[0] ? billed : months[0];
  const counted = months.filter(m => m >= start);
  if (!counted.length) return { ok: false };

  const annual = Number(unit?.annual_rent) || 0;
  const latest = read.filter(x => x.months.length)
    .sort((a, b) => String(b.payment.payment_date || '').localeCompare(String(a.payment.payment_date || '')))[0];
  const monthly = annual > 0 ? annual / 12 : (Number(latest.payment.amount) || 0) / latest.months.length;

  const covered = new Set(counted);
  const dim = daysInMonth(exitMonth);
  const exitDay = Math.min(dayOf(exitDate), dim);
  const dayRate = monthly / dim;

  const gaps = [];
  for (let m = start; m < exitMonth; m = shiftMonth(m, 1)) {
    if (!covered.has(m)) gaps.push(m);
  }
  const gapsTotal = r2(gaps.length * monthly);
  const unknown = gaps.length
    ? read.filter(x => x.custom && String(x.payment.payment_date || '') >= `${gaps[0]}-01`).map(x => x.payment)
    : [];
  const gapsConfirmed = !!confirmGaps && gaps.length > 0;

  let exitOwed = null;
  let exitCredit = null;
  if (exitMonth >= start) {
    if (covered.has(exitMonth)) {
      const days = dim - exitDay;
      exitCredit = { key: exitMonth, days, amount: r2(dayRate * days) };
    } else {
      const from = monthOf(unit?.contract_start) === exitMonth ? Math.max(1, dayOf(unit.contract_start)) : 1;
      const days = Math.max(0, exitDay - from + 1);
      exitOwed = { key: exitMonth, days, amount: r2(dayRate * days) };
    }
  }

  const ahead = counted.filter(m => m > exitMonth).map(key => ({ key, amount: r2(monthly) }));
  const aheadTotal = r2(ahead.length * monthly);
  const owed = r2((gapsConfirmed ? 0 : gapsTotal) + (exitOwed?.amount || 0));
  const credit = r2((exitCredit?.amount || 0) + aheadTotal);
  const paidTotal = r2(counted.reduce((s, m) => s + share.get(m), 0));

  const creditShare = new Map();
  const addCredit = (m, fraction) => {
    for (const { payment, part } of coveredBy.get(m) || []) {
      creditShare.set(payment, (creditShare.get(payment) || 0) + part * fraction);
    }
  };
  if (exitCredit) addCredit(exitMonth, exitCredit.days / dim);
  ahead.forEach(a => addCredit(a.key, 1));
  const creditPayments = [...creditShare.entries()]
    .map(([payment, remaining]) => ({ ...payment, remaining: r2(remaining) }))
    .filter(p => p.remaining > 0)
    .sort((a, b) => String(b.payment_date || '').localeCompare(String(a.payment_date || '')));

  return {
    ok: true,
    monthly: r2(monthly),
    dayRate: r2(dayRate),
    start,
    paidTo: counted[counted.length - 1],
    exitMonth,
    exitDay,
    daysInExitMonth: dim,
    gaps,
    gapsTotal,
    gapsConfirmed,
    unknown,
    exitOwed,
    exitCredit,
    ahead,
    aheadTotal,
    owed,
    credit,
    paidTotal,
    consumed: r2(Math.max(0, paidTotal - credit)),
    creditPayments,
  };
}

export const positionPeriod = (pos) => ({
  paidTotal: pos.paidTotal,
  periodStart: `${pos.start}-01`,
  periodEnd: `${pos.paidTo}-${String(daysInMonth(pos.paidTo)).padStart(2, '0')}`,
});

export const owedDueText = (pos) => formatDueMonths({
  months: pos.gapsConfirmed ? [] : pos.gaps,
  custom: pos.exitOwed ? `أيام السكن في ${monthLabel(pos.exitOwed.key, true)}: ${pos.exitOwed.days}` : '',
}, true);

export function positionNote(pos) {
  if (!pos?.ok) return '';
  const owedParts = [
    !pos.gapsConfirmed && pos.gaps.length ? `${formatDueMonths({ months: pos.gaps }, true)} (${money(pos.gapsTotal)})` : '',
    pos.exitOwed ? `أيام السكن في ${monthLabel(pos.exitOwed.key, true)}: ${pos.exitOwed.days} (${money(pos.exitOwed.amount)})` : '',
  ].filter(Boolean);
  return [
    owedParts.length ? `المستحق عند الخروج: ${owedParts.join('، و')}.` : '',
    pos.gapsConfirmed ? `اعتُبرت ${formatDueMonths({ months: pos.gaps }, true)} مسدَّدة بتأكيد من أنهى العقد (${money(pos.gapsTotal)})، لوجود دفعات لا يُعرف شهرها.` : '',
    pos.credit > 0 ? `غير مستهلك للمستأجر عند الخروج: ${money(pos.credit)}.` : '',
  ].filter(Boolean).join(' ');
}
