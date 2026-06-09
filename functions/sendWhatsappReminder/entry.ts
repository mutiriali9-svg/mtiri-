import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'data_entry')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { alert_id } = body;

    if (!alert_id) {
      return Response.json({ error: 'alert_id مطلوب' }, { status: 400 });
    }

    // Fetch the alert
    const alerts = await base44.entities.PaymentAlert.filter({ id: alert_id });
    const alert = alerts[0];
    if (!alert) {
      return Response.json({ error: 'التنبيه غير موجود' }, { status: 404 });
    }

    // Find the unit to get the tenant phone number
    const unitNumber = alert.unit_number;
    let phone = null;

    const [units, reUnits] = await Promise.all([
      base44.entities.Unit.filter({ unit_number: unitNumber }),
      base44.entities.ReUnit.filter({ unit_number: unitNumber }),
    ]);

    const unit = units[0] || reUnits[0];
    if (unit?.owner_phone) {
      phone = unit.owner_phone;
    }

    // Data extraction
    const tenantName = alert.tenant_name || '';
    const unitNum = alert.unit_number || '';
    const monthlyAmount = Number(alert.original_amount || 0);
    const totalDue = Number(alert.remaining_balance || alert.original_amount || 0);
    const overdueAmount = Math.max(0, totalDue - monthlyAmount);
    const dueDate = alert.alert_date || '';
    const nextAlertDate = alert.next_alert_date || '';

    // Calculate days overdue
    let daysOverdue = 0;
    if (dueDate) {
      const today = new Date();
      const due = new Date(dueDate);
      const diff = today - due;
      if (diff > 0) daysOverdue = Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    const PAYMENT_PLAN_LABELS = {
      monthly:   { ar: 'شهرية',       en: 'Monthly' },
      quarterly: { ar: 'ربع سنوية',   en: 'Quarterly' },
      biannual:  { ar: 'نصف سنوية',   en: 'Bi-annual' },
      annual:    { ar: 'سنوية',        en: 'Annual' },
    };
    const plan = PAYMENT_PLAN_LABELS[alert.payment_plan] || { ar: 'شهرية', en: 'Monthly' };

    const fmt = (n) => Number(n).toLocaleString('en-AE');

    // Arabic overdue text with proper grammar
    let delayTextAr = '';
    if (daysOverdue === 1)       delayTextAr = 'لمدة يوم واحد';
    else if (daysOverdue === 2)  delayTextAr = 'لمدة يومين';
    else if (daysOverdue >= 3 && daysOverdue <= 10) delayTextAr = `لمدة ${daysOverdue} أيام`;
    else if (daysOverdue > 10)   delayTextAr = `لمدة ${daysOverdue} يوماً`;

    // English overdue text
    let delayTextEn = '';
    if (daysOverdue === 1)       delayTextEn = 'one day';
    else if (daysOverdue === 2)  delayTextEn = 'two days';
    else if (daysOverdue === 3)  delayTextEn = 'three days';
    else if (daysOverdue > 3)    delayTextEn = `${daysOverdue} days`;

    // Arabic intro sentence based on status
    let introAr = '';
    if (daysOverdue > 0) {
      introAr = `نود إعلامكم بأن الدفعة المستحقة قد تأخرت ${delayTextAr} عن موعدها المحدد، ويرجى الاطلاع على تفاصيل الحساب أدناه:`;
    } else {
      introAr = `نود إعلامكم بأن موعد استحقاق الدفعة القادمة قد اقترب، ويرجى الاطلاع على تفاصيل الحساب أدناه:`;
    }

    // English intro sentence based on status
    let introEn = '';
    if (daysOverdue > 0) {
      introEn = `We would like to inform you that your payment is ${delayTextEn} overdue. Please see the account details below:`;
    } else {
      introEn = `We would like to inform you that your upcoming payment is due soon. Please see the account details below:`;
    }

    // Build Arabic message
    let arLines = [
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
      arLines.push(`المبلغ المتأخر: ${fmt(overdueAmount)} درهم إماراتي`);
      arLines.push(``);
      arLines.push(`إجمالي المبلغ المستحق: ${fmt(totalDue)} درهم إماراتي`);
    } else {
      arLines.push(`المبلغ المستحق: ${fmt(totalDue)} درهم إماراتي`);
    }
    arLines.push(``);
    arLines.push(`تاريخ الاستحقاق: ${dueDate}`);
    arLines.push(``);
    if (nextAlertDate) {
      arLines.push(`موعد الدفعة القادمة: ${nextAlertDate}`);
      arLines.push(``);
    }
    arLines.push(`خطة الدفع: ${plan.ar}`);
    arLines.push(``);
    arLines.push(`نرجو منكم التكرم بالتواصل معنا في أقرب وقت ممكن لتنسيق عملية السداد وتسهيل الإجراءات.`);
    arLines.push(``);
    arLines.push(`شاكرين لكم حسن تعاونكم الدائم وتفهمكم.`);
    arLines.push(``);
    arLines.push(`أطيب التحيات،`);
    arLines.push(`[المطيري لإدارة العقارات]`);

    // Build English message
    let enLines = [
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
      enLines.push(`Overdue Amount: AED ${fmt(overdueAmount)}`);
      enLines.push(``);
      enLines.push(`Total Amount Due: AED ${fmt(totalDue)}`);
    } else {
      enLines.push(`Amount Due: AED ${fmt(totalDue)}`);
    }
    enLines.push(``);
    enLines.push(`Due Date: ${dueDate}`);
    enLines.push(``);
    if (nextAlertDate) {
      enLines.push(`Next Payment Date: ${nextAlertDate}`);
      enLines.push(``);
    }
    enLines.push(`Payment Plan: ${plan.en}`);
    enLines.push(``);
    enLines.push(`We kindly request that you contact us as soon as possible to arrange the payment process and facilitate the necessary procedures.`);
    enLines.push(``);
    enLines.push(`Thank you for your continued cooperation and understanding.`);
    enLines.push(``);
    enLines.push(`Best regards,`);
    enLines.push(`[Al Mutairi Real Estate Management]`);

    const message = [...arLines, ``, `════════════════════`, ``, ...enLines].join(`\n`);
    const encodedMessage = encodeURIComponent(message);

    let whatsappUrl = null;
    if (phone) {
      const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '').replace(/^00/, '+').replace(/^\+/, '');
      whatsappUrl = `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
    }
    const whatsappUrlGeneric = `https://wa.me/?text=${encodedMessage}`;

    return Response.json({
      success: true,
      phone,
      whatsapp_url: whatsappUrl || whatsappUrlGeneric,
      whatsapp_url_generic: whatsappUrlGeneric,
      message_preview: message,
      has_phone: !!phone,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});