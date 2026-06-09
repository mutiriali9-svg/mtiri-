import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { name, email } = await req.json();

    // Send email notification to admin
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'mutiriali77@gmail.com',
      from_name: 'المطيري - نظام الإدارة',
      subject: `طلب وصول جديد من ${name}`,
      body: `
مرحباً،

لديك طلب وصول جديد للنظام:

الاسم: ${name}
البريد الإلكتروني: ${email}

يرجى الدخول للنظام ومراجعة الطلب من قسم الإشعارات.

---
Al-Mutairi Business Management System
      `.trim(),
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});