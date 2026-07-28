import { parseISO, isValid, addMonths, format } from 'date-fns';

export const PAYMENT_PLANS = [
  { value: 'monthly', label: { ar: 'شهري', en: 'Monthly' }, months: 1 },
  { value: 'quarterly', label: { ar: 'كل 3 أشهر', en: 'Quarterly' }, months: 3 },
  { value: 'five_annual', label: { ar: '5 دفعات سنوياً', en: '5x Annually' }, days: 73 },
  { value: 'biannual', label: { ar: 'كل 6 أشهر', en: 'Biannual' }, months: 6 },
  { value: 'annual', label: { ar: 'سنوي', en: 'Annual' }, months: 12 },
];

export function getNextDateFromPlan(startDate, plan) {
  const planObj = PAYMENT_PLANS.find(p => p.value === plan) || PAYMENT_PLANS[0];
  const base = parseISO(startDate);
  if (planObj.days) {
    const next = new Date(base);
    next.setDate(next.getDate() + planObj.days);
    return format(next, 'yyyy-MM-dd');
  }
  return format(addMonths(base, planObj.months), 'yyyy-MM-dd');
}

export function cycleTotal(a) {
  const monthly = Number(a?.original_amount || 0);
  const acc = Number(a?.accumulated_amount || 0);
  return monthly + acc;
}

export function cyclePaid(a) {
  const total = cycleTotal(a);
  const remaining = Number(a?.remaining_balance ?? total);
  return Math.max(0, total - remaining);
}

export function paidAheadLabel(periods, plan, lang) {
  if (!periods || periods <= 1) return '';
  const planObj = PAYMENT_PLANS.find(p => p.value === plan) || PAYMENT_PLANS[0];
  const label = planObj.label[lang] || planObj.label.ar;
  return lang === 'en'
    ? `Paid ahead — ${periods} periods (${label})`
    : `مدفوع مقدماً — ${periods} دورات (${label})`;
}

export function getAccrued(a) {
  const todayStr = new Date().toISOString().split('T')[0];
  const monthly = Number(a?.original_amount || 0);
  const storedAcc = Number(a?.accumulated_amount || 0);
  const plan = a?.payment_plan || 'monthly';
  const startDate = a?.alert_date;

  if (a?.status === 'paid' || !startDate || !isValid(parseISO(startDate))) {
    return { missedCycles: 0, accrued: storedAcc, currentDueDate: startDate, periodsOverdue: 0 };
  }

  let cursor = startDate;
  let missedCycles = 0;
  while (cursor < todayStr) {
    const nextDate = getNextDateFromPlan(cursor, plan);
    if (nextDate <= todayStr) {
      missedCycles += 1;
      cursor = nextDate;
    } else {
      break;
    }
  }

  const accruedFromMissed = missedCycles * monthly;
  const accrued = storedAcc + accruedFromMissed;
  const periodsOverdue = (startDate <= todayStr ? 1 : 0) + missedCycles;

  return { missedCycles, accrued, currentDueDate: cursor, periodsOverdue };
}

export function applyAlertPayment(alertRec, paidAmount, payDate) {
  const todayStr = new Date().toISOString().split('T')[0];
  const monthly = Number(alertRec.original_amount || 0);
  const { accrued, currentDueDate } = getAccrued(alertRec);
  const effectiveDate = currentDueDate || alertRec.alert_date || todayStr;
  const storedRemaining = Number(alertRec.remaining_balance ?? monthly);
  const currentBalance = storedRemaining + (accrued - Number(alertRec.accumulated_amount || 0));
  const plan = alertRec.payment_plan || 'monthly';
  const paidBefore = cyclePaid({ ...alertRec, accumulated_amount: accrued, remaining_balance: currentBalance });

  if (paidAmount >= currentBalance) {
    const credit = paidAmount - currentBalance;
    const additionalPeriods = monthly > 0 ? Math.floor(credit / monthly) : 0;
    const partialCredit = monthly > 0 ? credit % monthly : 0;
    const periodsAdvanced = 1 + additionalPeriods;

    let newDate = effectiveDate;
    for (let i = 0; i < periodsAdvanced; i++) {
      newDate = getNextDateFromPlan(newDate, plan);
    }

    const newBalance = partialCredit > 0 ? monthly - partialCredit : monthly;
    const status = newDate > todayStr ? 'active' : 'overdue';

    return {
      payload: {
        remaining_balance: newBalance,
        accumulated_amount: 0,
        last_paid_date: payDate,
        last_paid_amount: paidAmount,
        alert_date: newDate,
        next_alert_date: newDate,
        status,
      },
      summary: {
        settled: true,
        periodsAdvanced,
        newDate,
        newBalance,
        credit: partialCredit,
        cyclePaidAfter: partialCredit,
        status,
      },
    };
  }

  const newTotalBalance = currentBalance - paidAmount;
  const newAcc = Math.max(0, newTotalBalance - monthly);
  const status = 'overdue';

  return {
    payload: {
      remaining_balance: newTotalBalance,
      accumulated_amount: newAcc,
      alert_date: effectiveDate,
      next_alert_date: effectiveDate,
      last_paid_date: payDate,
      last_paid_amount: paidAmount,
      status,
    },
    summary: {
      settled: false,
      periodsAdvanced: 0,
      newDate: effectiveDate,
      newBalance: newTotalBalance,
      credit: 0,
      cyclePaidAfter: paidBefore + paidAmount,
      status,
    },
  };
}