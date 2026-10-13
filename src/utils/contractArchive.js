import { supabase } from '@/api/base44Client';
import { getAlertState } from '@/utils/alertAccrual';

const TABLE = 'contract_archive';

const val = (v) => String(v ?? '').trim();

export const hasContract = (u) =>
  !!(val(u?.tenant_name) || val(u?.contract_start) || val(u?.contract_end) || val(u?.contract_image_url));

export const renewalDraft = (unit) => ({
  ...unit, contract_start: '', contract_end: '', annual_rent: '', contract_image_url: '',
});

export const ARCHIVE_REASONS = {
  renewal: { ar: 'تجديد العقد', en: 'Contract renewal', color: '#2A9D8F' },
  tenant_change: { ar: 'إخلاء', en: 'Vacated', color: '#E63946' },
  vacate: { ar: 'إخلاء', en: 'Vacated', color: '#E63946' },
  expiry: { ar: 'انتهاء العقد', en: 'Contract ended', color: '#0EA5E9' },
};

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const settleArrears = (owed, depositBalance, useDeposit) => {
  const total = Math.max(0, r2(owed));
  const bal = Math.max(0, r2(depositBalance));
  const applied = useDeposit ? Math.min(bal, total) : 0;
  return {
    owed: total,
    applied,
    recovery: useDeposit ? r2(bal - applied) : 0,
    remaining: r2(total - applied),
  };
};

export const arrearsLeft = (c, paidAfter = 0) => {
  const { owed, remaining } = settleArrears(c?.outstanding_amount, c?.deposit_applied, true);
  return { owed, left: Math.max(0, r2(remaining - (Number(paidAfter) || 0))) };
};

export const contractEnded = (unit, today) => {
  const end = String(unit?.contract_end || '').slice(0, 10);
  return !!end && end <= today;
};

export const isAlertDue = (a, asOf) =>
  a?.status !== 'paid' && !!a?.alert_date && String(a.alert_date).slice(0, 10) <= asOf;

export const owedAsOf = (alerts, asOf) =>
  r2((alerts || []).filter(a => isAlertDue(a, asOf)).reduce((s, a) => s + getAlertState(a, asOf).remaining, 0));

const VACANT = {
  status: 'vacant', tenant_name: null, nationality: null, owner_phone: null,
  insurance: null, insurance_type: 'cash', annual_rent: null, payment_plan: null,
  contract_start: null, contract_end: null, contract_image_url: null,
};

export async function vacateUnit(propertyType, unitNumber) {
  const unit = String(unitNumber);
  const { data, error } = await supabase.from(propertyType === 'real_estate' ? 're_units' : 'units')
    .update(VACANT).eq('unit_number', unit).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('unit_not_vacated');
  const { error: alertError } = await supabase.from('payment_alerts').delete()
    .eq('property_type', propertyType).eq('unit_number', unit)
    .or('status.is.null,status.neq.paid');
  if (alertError) throw alertError;
}

export async function archiveContract(unit, propertyType, reason, user, note = '', outstanding = 0, depositApplied = 0, settlementNote = '') {
  if (!hasContract(unit)) return null;
  const record = {
    property_type: propertyType,
    unit_id: unit.id != null ? String(unit.id) : null,
    unit_number: String(unit.unit_number),
    tenant_name: val(unit.tenant_name) || null,
    nationality: val(unit.nationality) || null,
    owner_phone: val(unit.owner_phone) || null,
    annual_rent: Number(unit.annual_rent) || null,
    insurance: val(unit.insurance) || null,
    insurance_type: val(unit.insurance_type) || null,
    payment_plan: val(unit.payment_plan) || null,
    contract_start: val(unit.contract_start) || null,
    contract_end: val(unit.contract_end) || null,
    contract_image_url: val(unit.contract_image_url) || null,
    reason,
    note: val(note) || null,
    outstanding_amount: Number(outstanding) > 0 ? r2(outstanding) : null,
    deposit_applied: Number(depositApplied) > 0 ? r2(depositApplied) : null,
    settlement_note: val(settlementNote) || null,
    archived_by_name: user?.full_name || user?.email || null,
  };

  const { data: last } = await supabase.from(TABLE)
    .select('tenant_name, contract_start, contract_end')
    .eq('property_type', propertyType).eq('unit_number', record.unit_number)
    .order('created_at', { ascending: false }).limit(1);
  const top = last?.[0];
  if (top && val(top.tenant_name) === val(record.tenant_name)
    && val(top.contract_start) === val(record.contract_start)
    && val(top.contract_end) === val(record.contract_end)) return top;

  const { data, error } = await supabase.from(TABLE).insert(record).select().single();
  if (error) throw error;
  return data;
}

export async function listContractArchive(propertyType, unitNumber) {
  const { data, error } = await supabase.from(TABLE).select('*')
    .eq('property_type', propertyType).eq('unit_number', String(unitNumber))
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listAllContractArchive(propertyType) {
  const { data, error } = await supabase.from(TABLE).select('*')
    .eq('property_type', propertyType)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getContractArchive(id) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
