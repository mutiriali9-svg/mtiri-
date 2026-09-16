import { getAlertState } from '@/utils/alertAccrual';
import { waDigits } from '@/utils/phone';

const PAYMENT_PLAN_LABELS = {
  monthly: { ar: 'شهرية', en: 'Monthly' },
  quarterly: { ar: 'ربع سنوية', en: 'Quarterly' },
  five_annual: { ar: '5 دفعات سنوياً', en: '5x Annually' },
  biannual: { ar: 'نصف سنوية', en: 'Bi-annual' },
  annual: { ar: 'سنوية', en: 'Annual' },
};

const COMPANY_AR = 'المطيري لإدارة العقارات';
const COMPANY_EN = 'Al Mutairi Real Estate Management';

const fmt = (n) => Number(n || 0).toLocaleString('en-AE');

export function normalizePhone(phone) {
  return waDigits(phone);
}

export function buildReminderMessage(alertRec, unit) {
  const state = getAlertState(alertRec);
  const tenantName = alertRec.tenant_name || '';
  const unitNum = alertRec.unit_number || '';
  const monthlyAmount = state.monthly;
  const totalDue = state.remaining;
  const overdueAmount = Math.max(0, totalDue - monthlyAmount);
  const dueDate = alertRec.alert_date || '';
  const nextAlertDate = alertRec.next_alert_date || '';
  const plan = PAYMENT_PLAN_LABELS[alertRec.payment_plan] || PAYMENT_PLAN_LABELS.monthly;

  let daysOverdue = 0;
  if (dueDate) {
    const diff = new Date().setHours(0, 0, 0, 0) - new Date(dueDate).setHours(0, 0, 0, 0);
    if (diff > 0) daysOverdue = Math.floor(diff / 86400000);
  }

  let delayTextAr = '';
  if (daysOverdue === 1) delayTextAr = 'لمدة يوم واحد';
  else if (daysOverdue === 2) delayTextAr = 'لمدة يومين';
  else if (daysOverdue >= 3 && daysOverdue <= 10) delayTextAr = `لمدة ${daysOverdue} أيام`;
  else if (daysOverdue > 10) delayTextAr = `لمدة ${daysOverdue} يوماً`;

  let delayTextEn = '';
  if (daysOverdue === 1) delayTextEn = 'one day';
  else if (daysOverdue === 2) delayTextEn = 'two days';
  else if (daysOverdue === 3) delayTextEn = 'three days';
  else if (daysOverdue > 3) delayTextEn = `${daysOverdue} days`;

  const introAr = daysOverdue > 0
    ? `نود إعلامكم بأن الدفعة المستحقة قد تأخرت ${delayTextAr} عن موعدها المحدد، ويرجى الاطلاع على تفاصيل الحساب أدناه:`
    : `نود إعلامكم بأن موعد استحقاق الدفعة القادمة قد اقترب، ويرجى الاطلاع على تفاصيل الحساب أدناه:`;

  const introEn = daysOverdue > 0
    ? `We would like to inform you that your payment is ${delayTextEn} overdue. Please see the account details below:`
    : `We would like to inform you that your upcoming payment is due soon. Please see the account details below:`;

  const arLines = [
    `السلام وعليكم ورحمة الله وبركاتة`,
    ``,
    `تحية طيبة وبعد`,
    ``,
    `عزيزي السيد ${tenantName} ، نتمنى أن تكون بأتم الصحة والعافية. ${introAr}`,
    ``,
    `رقم الوحدة: ${unitNum}`,
    ``,
    `الإيجار الشهري: ${fmt(monthlyAmount)} درهم إماراتي`,
    ``,
  ];
  if (overdueAmount > 0) {
    arLines.push(`المبلغ المتأخر: ${fmt(overdueAmount)} درهم إماراتي`, ``, `إجمالي المبلغ المستحق: ${fmt(totalDue)} درهم إماراتي`);
  } else {
    arLines.push(`المبلغ المستحق: ${fmt(totalDue)} درهم إماراتي`);
  }
  arLines.push(``, `تاريخ الاستحقاق: ${dueDate}`, ``);
  if (nextAlertDate) arLines.push(`موعد الدفعة القادمة: ${nextAlertDate}`, ``);
  arLines.push(
    `خطة الدفع: ${plan.ar}`,
    ``,
    `نرجو منكم التكرم بالتواصل معنا في أقرب وقت ممكن لتنسيق عملية السداد وتسهيل الإجراءات.`,
    ``,
    `شاكرين لكم حسن تعاونكم الدائم وتفهمكم.`,
    ``,
    `أطيب التحيات،`,
    `[${COMPANY_AR}]`,
  );

  const enLines = [
    `Peace, mercy, and blessings of God be upon you.`,
    ``,
    `Greetings,`,
    ``,
    `Dear Mr. ${tenantName}, we hope you are in good health. ${introEn}`,
    ``,
    `Unit Number: ${unitNum}`,
    ``,
    `Monthly Rent: AED ${fmt(monthlyAmount)}`,
    ``,
  ];
  if (overdueAmount > 0) {
    enLines.push(`Overdue Amount: AED ${fmt(overdueAmount)}`, ``, `Total Amount Due: AED ${fmt(totalDue)}`);
  } else {
    enLines.push(`Amount Due: AED ${fmt(totalDue)}`);
  }
  enLines.push(``, `Due Date: ${dueDate}`, ``);
  if (nextAlertDate) enLines.push(`Next Payment Date: ${nextAlertDate}`, ``);
  enLines.push(
    `Payment Plan: ${plan.en}`,
    ``,
    `We kindly request that you contact us as soon as possible to arrange the payment process and facilitate the necessary procedures.`,
    ``,
    `Thank you for your continued cooperation and understanding.`,
    ``,
    `Best regards,`,
    `[${COMPANY_EN}]`,
  );

  const message = [...arLines, ``, `════════════════════`, ``, ...enLines].join('\n');
  const phone = normalizePhone(unit?.owner_phone || alertRec.tenant_phone);

  return {
    message,
    phone,
    hasPhone: !!phone,
    whatsappUrl: phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`,
  };
}
