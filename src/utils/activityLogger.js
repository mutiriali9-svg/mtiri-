import { base44 } from '@/api/base44Client';

export const logActivity = async (entityType, action, entityLabel, oldData, newData, changesSummary, user) => {
  try {
    await base44.supabase.from('activity_logs').insert({
      entity_type: entityType,
      action: action,
      entity_label: entityLabel,
      old_data: oldData || null,
      new_data: newData || null,
      changes_summary: changesSummary || null,
      performed_by_id: user?.id,
      performed_by_name: user?.name || 'Unknown',
      performed_by_role: user?.role,
    });
  } catch (e) {
    console.error('Activity log error:', e);
  }
};

export const getChangeSummary = (oldData, newData, fieldsToCheck) => {
  const changes = [];
  fieldsToCheck?.forEach(field => {
    if (oldData?.[field] !== newData?.[field]) {
      changes.push(`${field}: ${oldData?.[field]} → ${newData?.[field]}`);
    }
  });
  return changes.join(', ') || null;
};