import { differenceInCalendarDays, parseISO, isValid } from 'date-fns';

export const PROPERTY_TYPES = [
  { value: 'qarya',       label: { ar: 'بناية القرية', en: 'Qarya Villa' } },
  { value: 'real_estate', label: { ar: 'العقارات',      en: 'Real Estate' } },
];

export const propLabel = (type, ar) => {
  const p = PROPERTY_TYPES.find(x => x.value === type) || PROPERTY_TYPES[0];
  return p.label[ar ? 'ar' : 'en'];
};

export const REFUND_KINDS = [
  { value: 'tenant_refund',    label: { ar: 'خروج مبكر لمستأجر',   en: 'Early Tenant Exit' },    color: '#7C3AED', settlement: true  },
  { value: 'eviction',         label: { ar: 'إخلاء مستأجر',        en: 'Tenant Eviction' },      color: '#E63946', settlement: true  },
  { value: 'gov_deduction',    label: { ar: 'خصم جهة حكومية',      en: 'Government Deduction' }, color: '#E63946', settlement: false, hidden: true },
  { value: 'rent_discount',    label: { ar: 'خصم إيجار متفق عليه', en: 'Agreed Rent Discount' }, color: '#C9A84C', settlement: false, hidden: true },
  { value: 'other',            label: { ar: 'أخرى',                 en: 'Other' },                color: '#64748B', settlement: true  },
];

export const VISIBLE_REFUND_KINDS = REFUND_KINDS.filter(k => !k.hidden);

export const autoReasonKind = (kind) => kind === 'tenant_refund';

export const reasonFieldLabel = (kind, ar) => {
  if (kind === 'eviction') return ar ? 'سبب الإخلاء *' : 'Eviction reason *';
  return ar ? 'اسم الحركة *' : 'Record name *';
};

export const SETTLEMENT_MODES = [
  {
    value: 'full',
    label: { ar: 'خصم واسترجاع', en: 'Deduct & refund' },
    hint: { ar: 'أسباب خصم وبنود إضافية قبل احتساب المسترجَع', en: 'Deduction reasons and extra items before the refund' },
    color: '#7C3AED',
  },
  {
    value: 'waiver',
    label: { ar: 'خصم المتبقي كاملاً', en: 'Deduct the full balance' },
    hint: {
      ar: 'يبقى كامل المتبقي إيراداً لك بسبب مكتوب — تخلّف عن السداد · إخلال بالعقد · تلفيات.',
      en: 'The whole remaining balance stays as revenue against a written reason.',
    },
    color: '#E63946',
  },
  {
    value: 'simple',
    label: { ar: 'تسوية بدون خصم', en: 'Plain settlement' },
    hint: { ar: 'حسبة الأيام فقط — يُردّ كامل ما لم يسكنه بلا أي خصم', en: 'Days only — the full unconsumed balance is returned' },
    color: '#0EA5E9',
  },
];

const kindDef = (kind) => REFUND_KINDS.find(k => k.value === kind) || REFUND_KINDS[REFUND_KINDS.length - 1];
export const kindLabel = (kind, ar) => kindDef(kind).label[ar ? 'ar' : 'en'];
export const kindColor = (kind) => kindDef(kind).color;
export const needsSettlement = (kind) => kindDef(kind).settlement;

export const PAY_METHODS = [
  { value: 'cash',          label: { ar: 'نقداً',      en: 'Cash' } },
  { value: 'bank_transfer', label: { ar: 'تحويل بنكي', en: 'Bank Transfer' } },
  { value: 'cheque',        label: { ar: 'شيك',        en: 'Cheque' } },
  { value: 'other',         label: { ar: 'أخرى',       en: 'Other' } },
];

export const methodLabel = (m, ar) => {
  const x = PAY_METHODS.find(p => p.value === m) || PAY_METHODS[0];
  return x.label[ar ? 'ar' : 'en'];
};

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const day = (s) => { if (!s) return null; const d = parseISO(s); return isValid(d) ? d : null; };

export const emptySettlement = {
  paidTotal: '', periodStart: '', periodEnd: '', exitDate: '',
  penalty: '', penaltyReason: '', items: [],
};

export const cleanItems = (items) => (items || [])
  .map(i => ({ reason: (i.reason || '').trim(), amount: Math.max(0, num(i.amount)) }))
  .filter(i => i.amount > 0 || i.reason !== '');

export const itemsTotal = (items) => r2(cleanItems(items).reduce((s, i) => s + i.amount, 0));

const blank = (error) => ({
  ok: false, error,
  totalDays: 0, consumedDays: 0, remainingDays: 0,
  dailyRate: 0, consumedAmount: 0, remainingAmount: 0,
  penalty: 0, itemsTotal: 0, items: [], netRefund: 0,
});

export function settle(input, ar = true) {
  const paidTotal = num(input.paidTotal);
  const penalty = Math.max(0, num(input.penalty));
  const items = cleanItems(input.items);
  const total = itemsTotal(items);

  if (paidTotal <= 0) return blank(ar ? 'لا توجد دفعات مسجَّلة لهذه الوحدة داخل فترة العقد — سجّل الدفعة أولاً' : 'No payments recorded for this unit inside the contract period');

  const start = day(input.periodStart);
  const end = day(input.periodEnd);
  const exit = day(input.exitDate);

  if (!start || !end) return blank(ar ? 'يُرجى إدخال بداية الفترة المدفوعة ونهايتها' : 'Enter the paid period');
  if (!exit) return blank(ar ? 'يُرجى إدخال تاريخ الخروج الفعلي' : 'Enter the actual exit date');

  if (penalty > 0 && !(input.penaltyReason || '').trim()) {
    return blank(ar ? 'يُرجى كتابة سبب الخصم' : 'Enter the deduction reason');
  }
  if (items.find(i => i.amount <= 0 || i.reason === '')) {
    return blank(ar ? 'كل خصم يحتاج سبباً ومبلغاً أكبر من صفر' : 'Every deduction needs a reason and an amount');
  }

  const totalDays = differenceInCalendarDays(end, start) + 1;
  if (totalDays <= 0) return blank(ar ? 'يجب أن تكون نهاية الفترة بعد بدايتها' : 'Period end must be after start');

  const consumedDays = Math.min(totalDays, Math.max(0, differenceInCalendarDays(exit, start) + 1));
  const remainingDays = totalDays - consumedDays;

  const dailyRate = r4(paidTotal / totalDays);
  const consumedAmount = r2(dailyRate * consumedDays);
  const remainingAmount = r2(paidTotal - consumedAmount);
  const netRefund = Math.max(0, r2(remainingAmount - penalty - total));

  return {
    ok: true, error: '',
    totalDays, consumedDays, remainingDays,
    dailyRate, consumedAmount, remainingAmount,
    penalty, itemsTotal: total, items, netRefund,
  };
}

export function settlementColumns(input, s) {
  const items = cleanItems(input.items);
  return {
    paid_total: num(input.paidTotal),
    period_start: input.periodStart || null,
    period_end: input.periodEnd || null,
    exit_date: input.exitDate || null,
    daily_rate: s.ok ? s.dailyRate : null,
    consumed_amount: s.ok ? s.consumedAmount : null,
    penalty_amount: Math.max(0, num(input.penalty)),
    penalty_reason: num(input.penalty) > 0 ? (input.penaltyReason || '').trim() || null : null,
    deduction_items: items.length ? items : null,
    computed_amount: s.ok ? s.netRefund : null,
  };
}

export const isCheque = (d) => d?.method === 'cheque';

export function depositBalance(deposits, deductions, propertyType, unitNumber) {
  const zero = {
    received: 0, used: 0, balance: 0,
    cheque: 0, chequeCount: 0, hasCheque: false, hasDeposit: false,
  };
  if (!unitNumber) return zero;

  const mine = (deposits || []).filter(d => d.property_type === propertyType && d.unit_number === unitNumber);
  const cashRows = mine.filter(d => !isCheque(d));
  const chequeRows = mine.filter(isCheque);

  const received = r2(cashRows.reduce((s, d) => s + num(d.amount), 0));
  const cheque = r2(chequeRows.reduce((s, d) => s + num(d.amount), 0));
  const used = r2((deductions || [])
    .filter(x => x.property_type === propertyType && x.unit_number === unitNumber)
    .reduce((s, x) => s + num(x.amount), 0));

  return {
    received,
    used,
    balance: r2(Math.max(0, received - used)),
    cheque,
    chequeCount: chequeRows.length,
    hasCheque: chequeRows.length > 0,
    hasDeposit: mine.length > 0,
  };
}

export const DEDUCTION_DESTINATIONS = [
  {
    value: 'tenant_return',
    group: 'return',
    label: { ar: 'إرجاع للمستأجر', en: 'Returned to tenant' },
    hint: {
      ar: 'ردّ التأمين أو جزء منه إلى المستأجر عند إخلاء الوحدة — ينقص الرصيد المحفوظ ولا يمسّ الإيراد ولا المصاريف.',
      en: 'Deposit handed back to the tenant — reduces the held balance with no P&L effect.',
    },
    color: '#0EA5E9',
  },
  {
    value: 'owner_recovery',
    group: 'deduction',
    label: { ar: 'استرداد للمالك', en: 'Owner recovery' },
    hint: {
      ar: 'دفعت صيانة أو تصليحاً واسترددته من التأمين — يدخل الإيراد ببند «استردادات من التأمينات».',
      en: 'You paid for a repair and recovered it — counted as revenue.',
    },
    color: '#2A9D8F',
  },
  {
    value: 'payment',
    group: 'deduction',
    label: { ar: 'دفعة إيجار', en: 'Rent payment' },
    hint: {
      ar: 'يُنشأ سند دفعة في سجل الدفعات بنفس المبلغ — لطلب المستأجر احتساب التأمين من إيجار شهر.',
      en: 'Creates a payment record in the payments ledger.',
    },
    color: '#C9A84C',
  },
];

export const destLabel = (v, ar) => {
  const d = DEDUCTION_DESTINATIONS.find(x => x.value === v) || DEDUCTION_DESTINATIONS[0];
  return d.label[ar ? 'ar' : 'en'];
};

export const destColor = (v) => (DEDUCTION_DESTINATIONS.find(x => x.value === v) || DEDUCTION_DESTINATIONS[0]).color;


const emptyUnconsumed = (reason) => ({
  ok: false, reason,
  totalDays: 0, elapsedDays: 0, remainingDays: 0,
  paid: 0, consumed: 0, balance: 0, payments: [],
});

export function unconsumed(unit, payments, unitNumber, asOf, ar = true) {
  if (!unitNumber) return emptyUnconsumed(ar ? 'يُرجى اختيار الوحدة أولاً' : 'Select a unit first');

  const startStr = unit?.contract_start || '';
  const endStr = unit?.contract_end || '';
  const start = day(startStr);
  const end = day(endStr);
  const now = day(asOf);

  if (!start || !end) {
    return emptyUnconsumed(ar
      ? 'لا توجد تواريخ عقد لهذه الوحدة — يُرجى إدخالها في صفحة الوحدات ليُحتسب المستهلَك'
      : 'This unit has no contract dates');
  }
  if (!now) return emptyUnconsumed(ar ? 'يُرجى تحديد تاريخ العملية' : 'Set the transaction date');

  const totalDays = differenceInCalendarDays(end, start) + 1;
  if (totalDays <= 0) return emptyUnconsumed(ar ? 'تواريخ العقد غير صحيحة' : 'Contract dates are invalid');

  const elapsedDays = Math.min(totalDays, Math.max(0, differenceInCalendarDays(now, start) + 1));
  const remainingDays = totalDays - elapsedDays;

  const mine = (payments || [])
    .filter(p => p.unit_number === unitNumber && (!p.status || p.status === 'paid'))
    .filter(p => { const d = p.payment_date || ''; return d >= startStr && d <= endStr; })
    .sort((a, b) => String(a.payment_date || '').localeCompare(String(b.payment_date || '')));

  const paid = r2(mine.reduce((s, p) => s + num(p.amount), 0));
  if (paid <= 0) {
    return emptyUnconsumed(ar ? 'لا توجد دفعات مسجّلة داخل فترة العقد' : 'No payments inside the contract period');
  }

  const consumed = r2(paid * (elapsedDays / totalDays));
  const balance = r2(Math.max(0, paid - consumed));

  let toConsume = consumed;
  const rows = mine.map(p => {
    const amt = num(p.amount);
    const eaten = Math.min(amt, Math.max(0, toConsume));
    toConsume = r2(toConsume - eaten);
    return { ...p, consumed: r2(eaten), remaining: r2(amt - eaten) };
  });

  return {
    ok: true, reason: '',
    totalDays, elapsedDays, remainingDays,
    paid, consumed, balance,
    payments: rows.filter(p => p.remaining > 0).reverse(),
  };
}

export const dueMonthsLabel = (due, ar) => {
  const t = (due || '').trim();
  if (!t) return ar ? 'بدون شهور محددة' : 'no months';
  return ar ? `شهور ${t}` : `months ${t}`;
};

export const defaultAppliesTo = (paymentDate, periodStart, refundDate) =>
  paymentDate || periodStart || refundDate;

export const crossesYear = (appliesTo, refundDate) =>
  !!appliesTo && !!refundDate && appliesTo.slice(0, 4) !== refundDate.slice(0, 4);

export const fmtNum = (n) => Number.isInteger(n)
  ? n.toLocaleString('ar-AE')
  : n.toLocaleString('ar-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
