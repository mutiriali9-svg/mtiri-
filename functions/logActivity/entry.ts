import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, entity_type, entity_id, entity_label, changes_summary, old_data, new_data } = body;

    const user = await base44.auth.me();

    await base44.asServiceRole.entities.ActivityLog.create({
      action,
      entity_type,
      entity_id,
      entity_label: entity_label || '',
      performed_by_name: user?.full_name || 'مجهول',
      performed_by_id: user?.id || '',
      performed_by_role: user?.role || '',
      changes_summary: changes_summary || '',
      old_data: old_data || null,
      new_data: new_data || null,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});