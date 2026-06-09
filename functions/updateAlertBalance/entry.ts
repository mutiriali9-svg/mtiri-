import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PLAN_MONTHS = { monthly: 1, quarterly: 3, biannual: 6, annual: 12 };

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { alert_id, paid_amount, payment_date } = await req.json();
  if (!alert_id || !paid_amount) return Response.json({ error: 'Missing params' }, { status: 400 });

  const alert = await base44.asServiceRole.entities.PaymentAlert.get(alert_id);
  if (!alert) return Response.json({ error: 'Alert not found' }, { status: 404 });

  const remaining = Number(alert.remaining_balance ?? alert.original_amount ?? 0);
  const paid = Number(paid_amount) || 0;
  const monthly = Number(alert.original_amount || 0);
  const newBalance = Math.max(0, remaining - paid);

  const today = payment_date || new Date().toISOString().split('T')[0];
  const alertDate = alert.alert_date || today;

  // هل الدفعة قبل موعد الاستحقاق؟
  const isPaidEarly = today < alertDate;

  const planMonths = PLAN_MONTHS[alert.payment_plan] || 1;
  const nextDateObj = new Date(alertDate);
  nextDateObj.setMonth(nextDateObj.getMonth() + planMonths);
  const nextAlertDate = nextDateObj.toISOString().split('T')[0];

  let updatePayload;

  if (newBalance === 0) {
    // سداد كامل → جدول للدورة القادمة بمبلغ شهري
    const nextStatus = nextAlertDate > today ? 'active' : 'overdue';
    updatePayload = {
      remaining_balance: monthly,
      last_paid_date: today,
      last_paid_amount: paid,
      alert_date: nextAlertDate,
      next_alert_date: nextAlertDate,
      status: nextStatus,
    };
  } else {
    // دفع جزئي → اخصم فقط، ابق على نفس التاريخ
    // الحالة: active إذا لم يحن الموعد بعد، overdue إذا تجاوزنا الموعد
    const partialStatus = isPaidEarly ? 'active' : 'overdue';
    updatePayload = {
      remaining_balance: newBalance,
      last_paid_date: today,
      last_paid_amount: paid,
      // لا نغير alert_date — يبقى على نفس موعد الاستحقاق
      status: partialStatus,
    };
  }

  await base44.asServiceRole.entities.PaymentAlert.update(alert_id, updatePayload);

  return Response.json({ success: true, newBalance, isPaidEarly });
});