import { useState, useEffect, useRef, useCallback } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { Plus, Search, Edit2, Trash2, Building2, Phone, Upload, X, FileImage, Loader2, BellRing } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { differenceInDays, parseISO, isValid, addMonths, format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import usePullToRefresh from '@/hooks/usePullToRefresh';
import PullRefreshIndicator from '@/components/PullRefreshIndicator';
import { logActivity } from '@/utils/activityLogger';

const emptyUnit = {
  unit_number: '', tenant_name: '', nationality: '', annual_rent: '',
  insurance: '', contract_start: '', contract_end: '', payment_plan: '',
  owner_phone: '', status: 'occupied', floor: '', notes: '', contract_image_url: '',
  _type: 're',
};

const TYPE_MAP = {
  re: {
    write: () => base44.entities.ReUnit,
    labelAr: 'العقارات', labelEn: 'Real Estate',
    color: '#C9A84C', bg: 'rgba(201,168,76,0.12)',
  },
};

const PAYMENT_PLANS = [
  { value: 'monthly', label: { ar: 'شهري', en: 'Monthly' }, months: 1 },
  { value: 'quarterly', label: { ar: 'كل 3 أشهر', en: 'Quarterly' }, months: 3 },
  { value: 'five_annual', label: { ar: '5 دفعات سنوياً', en: '5x Annually' }, days: 73 },
  { value: 'biannual', label: { ar: 'كل 6 أشهر', en: 'Biannual' }, months: 6 },
  { value: 'annual', label: { ar: 'سنوي', en: 'Annual' }, months: 12 },
];

function getNextDateFromPlan(startDate, plan) {
  const planObj = PAYMENT_PLANS.find(p => p.value === plan) || PAYMENT_PLANS[0];
  const base = parseISO(startDate);
  if (planObj.days) {
    const next = new Date(base);
    next.setDate(next.getDate() + planObj.days);
    return format(next, 'yyyy-MM-dd');
  }
  return format(addMonths(base, planObj.months), 'yyyy-MM-dd');
}

export default function ReUnits() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUnit, setEditUnit] = useState(null);
  const [form, setForm] = useState(emptyUnit);
  const [saving, setSaving] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewUnit, setViewUnit] = useState(null);

  const [alertDialog, setAlertDialog] = useState(null);
  const [alertForm, setAlertForm] = useState({
    alert_date: '', original_amount: '', accumulated_amount: '',
    payment_plan: 'monthly', description: '',
  });
  const [alertSaving, setAlertSaving] = useState(false);

  const contractFileRef = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, lang } = useLang();
  const isAr = lang === 'ar';
  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin || user?.role === 'data_entry';
  const canAlert = isAdmin || user?.role === 'data_entry';

  const today = new Date().toISOString().split('T')[0];

  const statusConfig = {
    occupied: { label: t('occupied'), color: '#2A9D8F', bg: 'rgba(42,157,143,0.1)' },
    vacant: { label: t('vacant'), color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' },
    maintenance: { label: t('maintenance'), color: '#E63946', bg: 'rgba(230,57,70,0.1)' },
  };

  const handleContractUpload = async (file) => {
    if (!file) return;
    setUploadingContract(true);
    const { file_url } = await uploadFile(file);
    setForm(p => ({ ...p, contract_image_url: file_url }));
    setUploadingContract(false);
  };

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const re = await base44.entities.ReUnit.list();
      const merged = (re || []).map(u => ({ ...u, _type: 're' }));
      setUnits(merged);
    } catch (err) {
      console.error('fetchUnits ERROR:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUnits(); }, []);
  const refreshing = usePullToRefresh(fetchUnits);

  const openAdd = () => { setEditUnit(null); setForm(emptyUnit); setDialogOpen(true); };
  const openEdit = (u) => { setEditUnit(u); setForm({ ...emptyUnit, ...u }); setDialogOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    const type = 're';
    const entity = TYPE_MAP[type].write();
    const { _type, id, created_at, ...clean } = form;
    const data = { ...clean, annual_rent: parseFloat(form.annual_rent) || 0 };

    try {
      if (editUnit) {
        setUnits(prev => prev.map(u => u.id === editUnit.id ? { ...u, ...data, _type: type } : u));
        setDialogOpen(false);
        await entity.update(editUnit.id, data);
        await logActivity('ReUnit', 'update', `${form.unit_number} - ${form.tenant_name}`, editUnit, data, null, user);
        toast({ description: t('unitUpdated') });
      } else {
        setDialogOpen(false);
        const created = await entity.create(data);
        await logActivity('ReUnit', 'create', `${form.unit_number} - ${form.tenant_name}`, null, data, null, user);
        toast({ description: t('unitAdded') });
      }
      fetchUnits();
    } catch (err) {
      console.error('save ERROR:', err);
      toast({ description: isAr ? 'فشل الحفظ، حاول مرة أخرى' : 'Save failed', variant: 'destructive' });
      fetchUnits();
    }
    setSaving(false);
  };

  const handleDelete = (unit) => {
    const type = 're';
    const entity = TYPE_MAP[type].write();
    setConfirmDelete({
      message: `هل تريد حذف وحدة ${unit.unit_number} (${TYPE_MAP[type].labelAr})؟`,
      onConfirm: async () => {
        setUnits(prev => prev.filter(u => u.id !== unit.id));
        setConfirmDelete(null);
        try {
          await entity.delete(unit.id);
          await logActivity('ReUnit', 'delete', `${unit.unit_number} - ${unit.tenant_name}`, unit, null, null, user);
          toast({ description: t('unitDeleted') });
        } catch (err) {
          console.error('delete ERROR:', err);
          fetchUnits();
        }
      },
    });
  };

  const openAlert = (unit) => {
    setAlertForm({
      alert_date: '',
      original_amount: unit.annual_rent ? String(Math.round(Number(unit.annual_rent) / 12)) : '',
      accumulated_amount: '', payment_plan: 'monthly', description: '',
    });
    setAlertDialog(unit);
  };

  const handleSaveAlert = async () => {
    const unit = alertDialog;
    if (!unit || !alertForm.alert_date) return;
    setAlertSaving(true);
    try {
      const monthly = Number(alertForm.original_amount) || 0;
      const overdue = Number(alertForm.accumulated_amount) || 0;
      const total = monthly + overdue;

      await base44.entities.PaymentAlert.create({
        unit_number: unit.unit_number,
        tenant_name: unit.tenant_name || '',
        property_type: 'real_estate',
        alert_date: alertForm.alert_date,
        original_amount: monthly,
        remaining_balance: total || monthly,
        payment_plan: alertForm.payment_plan || 'monthly',
        description: alertForm.description || '',
        status: overdue > 0 ? 'overdue' : (alertForm.alert_date <= today ? 'overdue' : 'active'),
      });

      await logActivity('ReUnit', 'create', `تنبيه - ${unit.unit_number}`, null, { alert: true }, null, user);
      toast({ description: isAr ? 'تم إنشاء التنبيه ✓' : 'Alert created ✓' });
      setAlertDialog(null);
    } catch (err) {
      console.error('alert save ERROR:', err);
      toast({ description: isAr ? 'فشل إنشاء التنبيه' : 'Failed to create alert', variant: 'destructive' });
    }
    setAlertSaving(false);
  };

  const alertPreviewDate = alertForm.alert_date && alertForm.payment_plan
    ? getNextDateFromPlan(alertForm.alert_date, alertForm.payment_plan)
    : null;

  const getExpiryTag = (contract_end) => {
    if (!contract_end) return null;
    const d = parseISO(contract_end);
    if (!isValid(d)) return null;
    const days = differenceInDays(d, new Date());
    if (days < 0) return { label: t('expired'), color: '#E63946', bg: 'rgba(230,57,70,0.1)' };
    if (days <= 30) return { label: `${days}d`, color: '#E63946', bg: 'rgba(230,57,70,0.1)' };
    if (days <= 90) return { label: `${days}d`, color: '#F97316', bg: 'rgba(249,115,22,0.1)' };
    return null;
  };

  const availableYears = [...new Set(units.map(u => u.contract_start?.substring(0, 4)).filter(Boolean))].sort((a, b) => b - a);

  const filtered = units.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.unit_number?.toLowerCase().includes(q) || u.tenant_name?.toLowerCase().includes(q) || u.nationality?.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || u.status === statusFilter;
    const matchY = yearFilter === 'all' || u.contract_start?.startsWith(yearFilter) || u.contract_end?.startsWith(yearFilter);
    return matchQ && matchS && matchY;
  }).sort((a, b) => {
    const aNum = parseInt(a.unit_number) || Infinity;
    const bNum = parseInt(b.unit_number) || Infinity;
    if (aNum !== Infinity && bNum !== Infinity) return aNum - bNum;
    return (a.unit_number || '').localeCompare(b.unit_number || '');
  });

  return (
    <div className="space-y-5 animate-fade-in-up max-w-7xl mx-auto">
      <PullRefreshIndicator refreshing={refreshing} />
      <PageHeader
        titleAr="العقارات"
        titleEn="Real Estate Units"
        description={`${units.length} ${t('unitNumber')}`}
        actions={canEdit && (
          <Button onClick={openAdd} className="gap-2 text-sm" style={{ backgroundColor: '#C9A84C' }}>
            <Plus size={16} /> {t('addUnit')}
          </Button>
        )}
      />

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
          <Input placeholder={t('searchUnits')} value={search} onChange={e => setSearch(e.target.value)} className="pr-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder={t('status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatuses')}</SelectItem>
            <SelectItem value="occupied">{t('occupied')}</SelectItem>
            <SelectItem value="vacant">{t('vacant')}</SelectItem>
            <SelectItem value="maintenance">{t('maintenance')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        {Object.entries(statusConfig).map(([k, v]) => {
          const count = units.filter(u => u.status === k).length;
          return (
            <span key={k} className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: v.bg, color: v.color }}>
              {v.label}: {count}
            </span>
          );
        })}
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-28 h-7 text-xs"><SelectValue placeholder="السنة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isAr ? 'كل السنوات' : 'All Years'}</SelectItem>
            {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Table */}
      <div className="bg-white card-bevel rounded-xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#C9A84C' }}>
              <tr>
                {[t('unitNumber'), t('tenantName'), t('nationality'), t('annualRent'), t('paymentPlan'), t('contractEnd'), t('status'), ''].map((h, i) => (
                  <th key={i} className="text-right py-3 px-4 text-white/80 font-medium text-xs whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array(5).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array(8).fill(0).map((_, j) => <td key={j} className="py-3 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                </tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">{t('noUnitsFound')}</td></tr>
              ) : filtered.map((u, i) => {
                const sc = statusConfig[u.status] || statusConfig.vacant;
                const expTag = getExpiryTag(u.contract_end);
                const isExpired = u.contract_end && differenceInDays(parseISO(u.contract_end), new Date()) < 0;
                const TypeIcon = Building2;
                return (
                  <tr key={u.id} onClick={() => setViewUnit(u)}
                    className="border-b border-border/50 hover:bg-surface transition-colors cursor-pointer"
                    style={{ backgroundColor: isExpired ? 'rgba(230,57,70,0.07)' : i % 2 === 1 ? '#F8F9FA' : undefined }}>
                    <td className="py-3 px-4 font-bold">
                      <div className="flex items-center gap-2" style={{ color: '#1B2B4B' }}>
                        <TypeIcon size={14} className="text-muted-foreground" />
                        {u.unit_number}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium max-w-44">
                      <span className="truncate font-semibold" style={{ color: '#1B2B4B' }}>{u.tenant_name || '-'}</span>
                      {u.owner_phone && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone size={10} />{u.owner_phone}</p>}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{u.nationality || '-'}</td>
                    <td className="py-3 px-4 font-semibold" style={{ color: '#1B2B4B' }}>{u.annual_rent ? `${Number(u.annual_rent).toLocaleString()} AED` : '-'}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs max-w-32"><span className="truncate block">{u.payment_plan || '-'}</span></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{u.contract_end || '-'}</span>
                        {expTag && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: expTag.bg, color: expTag.color }}>{expTag.label}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                    </td>
                    <td className="py-3 px-4" onClick={ev => ev.stopPropagation()}>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          {canAlert && (
                            <button onClick={() => openAlert(u)} title={isAr ? 'إضافة تنبيه' : 'Add alert'}
                              className="p-1.5 rounded hover:bg-muted transition-colors" style={{ color: '#C9A84C' }}><BellRing size={14} /></button>
                          )}
                          <button onClick={() => openEdit(u)}
                            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-navy"><Edit2 size={14} /></button>
                          {isAdmin && (
                            <button onClick={() => handleDelete(u)}
                              className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-white card-bevel rounded-xl p-4">
            <div className="h-4 bg-muted rounded animate-pulse mb-2" />
            <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
          </div>
        )) : filtered.length === 0 ? (
          <div className="bg-white card-bevel rounded-xl p-12 text-center text-muted-foreground">{t('noUnitsFound')}</div>
        ) : filtered.map((u) => {
          const sc = statusConfig[u.status] || statusConfig.vacant;
          const expTag = getExpiryTag(u.contract_end);
          const isExpired = u.contract_end && differenceInDays(parseISO(u.contract_end), new Date()) < 0;
          const TypeIcon = Building2;
          return (
            <div key={u.id} onClick={() => setViewUnit(u)}
              className="card-bevel rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer active:bg-muted/30"
              style={{ backgroundColor: isExpired ? 'rgba(230,57,70,0.07)' : '#ffffff', border: isExpired ? '1px solid rgba(230,57,70,0.25)' : undefined }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TypeIcon size={18} className="text-muted-foreground" />
                  <span className="font-bold text-lg" style={{ color: '#1B2B4B' }}>{u.unit_number}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('tenantName')}</span>
                  <span className="text-sm font-semibold" style={{ color: '#1B2B4B' }}>{u.tenant_name || '-'}</span>
                </div>
                {u.owner_phone && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone size={12} />{u.owner_phone}</div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('annualRent')}</span>
                  <span className="text-sm font-semibold" style={{ color: '#1B2B4B' }}>{u.annual_rent ? `${Number(u.annual_rent).toLocaleString()} AED` : '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('contractEnd')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{u.contract_end || '-'}</span>
                    {expTag && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: expTag.bg, color: expTag.color }}>{expTag.label}</span>}
                  </div>
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap" onClick={ev => ev.stopPropagation()}>
                  {canAlert && (
                    <button onClick={() => openAlert(u)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-muted transition-colors text-sm" style={{ color: '#C9A84C' }}><BellRing size={14} /> {isAr ? 'تنبيه' : 'Alert'}</button>
                  )}
                  <button onClick={() => openEdit(u)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-muted transition-colors text-sm"><Edit2 size={14} />{t('edit')}</button>
                  {isAdmin && (
                    <button onClick={() => handleDelete(u)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-destructive/10 transition-colors text-sm text-destructive"><Trash2 size={14} />{t('delete')}</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog open={!!confirmDelete} message={confirmDelete?.message} onConfirm={confirmDelete?.onConfirm} onCancel={() => setConfirmDelete(null)} />

      {/* View Unit Dialog */}
      <Dialog open={!!viewUnit} onOpenChange={() => setViewUnit(null)}>
        <DialogContent className="max-w-md font-cairo">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              تفاصيل الوحدة — {viewUnit?.unit_number}
            </DialogTitle>
          </DialogHeader>
          {viewUnit && (() => {
            const sc = statusConfig[viewUnit.status] || statusConfig.vacant;
            const expTag = getExpiryTag(viewUnit.contract_end);
            return (
              <div className="space-y-3 py-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">الحالة</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                </div>
                {[
                  { label: 'اسم المستأجر', value: viewUnit.tenant_name },
                  { label: 'الجنسية', value: viewUnit.nationality },
                  { label: 'الإيجار السنوي', value: viewUnit.annual_rent ? `${Number(viewUnit.annual_rent).toLocaleString()} AED` : null },
                  { label: 'خطة الدفع', value: viewUnit.payment_plan },
                  { label: 'الطابق', value: viewUnit.floor },
                  { label: 'رقم المالك', value: viewUnit.owner_phone },
                  { label: 'بداية العقد', value: viewUnit.contract_start },
                  { label: 'نهاية العقد', value: viewUnit.contract_end },
                  { label: 'التأمين', value: viewUnit.insurance },
                  { label: 'ملاحظات', value: viewUnit.notes },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-sm">{row.label}</span>
                    <span className="font-medium text-sm" style={{ color: '#1B2B4B' }}>
                      {row.value}
                      {row.label === 'نهاية العقد' && expTag && (
                        <span className="mr-2 text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: expTag.bg, color: expTag.color }}>{expTag.label}</span>
                      )}
                    </span>
                  </div>
                ))}
                {viewUnit.contract_image_url && (
                  <a href={viewUnit.contract_image_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border hover:bg-muted transition-colors" style={{ color: '#1B2B4B' }}>
                    <FileImage size={14} /> عرض صورة العقد
                  </a>
                )}
                <div className="flex gap-2 pt-1 flex-wrap">
                  {canAlert && (
                    <Button className="flex-1 gap-1" onClick={() => { setViewUnit(null); openAlert(viewUnit); }} style={{ backgroundColor: '#C9A84C' }}>
                      <BellRing size={14} /> {isAr ? 'تنبيه' : 'Alert'}
                    </Button>
                  )}
                  {canEdit && (
                    <Button className="flex-1" onClick={() => { setViewUnit(null); openEdit(viewUnit); }} style={{ backgroundColor: '#1B2B4B' }}>
                      <Edit2 size={14} /> تعديل
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className=" max-h-[90vh] overflow-y-auto font-cairo">
          <DialogHeader>
            <DialogTitle>{editUnit ? t('editUnit') : t('addNewUnit')}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {[
              { label: `${t('unitNumber')} *`, key: 'unit_number', type: 'text' },
              { label: t('tenantName'), key: 'tenant_name', type: 'text' },
              { label: t('nationality'), key: 'nationality', type: 'text' },
              { label: `${t('annualRent')} (AED)`, key: 'annual_rent', type: 'number' },
              { label: t('insurance'), key: 'insurance', type: 'text' },
              { label: t('ownerPhone'), key: 'owner_phone', type: 'text' },
              { label: t('contractStart'), key: 'contract_start', type: 'date' },
              { label: t('contractEndDate'), key: 'contract_end', type: 'date' },
              { label: t('paymentPlan'), key: 'payment_plan', type: 'text' },
              { label: t('floor'), key: 'floor', type: 'text' },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-sm">{f.label}</Label>
                <Input type={f.type} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="text-sm" />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-sm">{t('status')}</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="occupied">{t('occupied')}</SelectItem>
                  <SelectItem value="vacant">{t('vacant')}</SelectItem>
                  <SelectItem value="maintenance">{t('maintenance')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm">{t('notes')}</Label>
              <Input value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm">{t('contractImage')}</Label>
              <div className="flex items-center gap-3">
                <input ref={contractFileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleContractUpload(e.target.files[0])} />
                <Button type="button" variant="outline" size="sm" onClick={() => contractFileRef.current?.click()} disabled={uploadingContract} className="gap-2">
                  {uploadingContract ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploadingContract ? t('uploading') : t('uploadContract')}
                </Button>
                {form.contract_image_url && (
                  <div className="flex items-center gap-2">
                    <a href={form.contract_image_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs hover:underline" style={{ color: '#1B2B4B' }}>
                      <FileImage size={14} />{t('viewContract')}
                    </a>
                    <button type="button" onClick={() => setForm(p => ({ ...p, contract_image_url: '' }))} className="text-destructive hover:opacity-70"><X size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !form.unit_number} style={{ backgroundColor: '#C9A84C' }}>
              {saving ? t('saving_') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Alert Dialog */}
      <Dialog open={!!alertDialog} onOpenChange={(v) => { if (!v) setAlertDialog(null); }}>
        <DialogContent className="max-w-md font-cairo" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellRing size={18} style={{ color: '#C9A84C' }} />
              {isAr ? 'إضافة تنبيه' : 'Add Alert'} — {alertDialog?.unit_number}
            </DialogTitle>
          </DialogHeader>
          {alertDialog && (
            <div className="space-y-3 py-1">
              <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: 'rgba(27,43,75,0.04)', border: '1px solid rgba(27,43,75,0.1)' }}>
                <p className="font-bold" style={{ color: '#1B2B4B' }}>{alertDialog.tenant_name || (isAr ? 'بدون مستأجر' : 'No tenant')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{isAr ? 'نوع' : 'Type'}: {isAr ? 'العقارات' : 'Real Estate'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">{isAr ? 'خطة الدفع *' : 'Payment Plan *'}</Label>
                  <Select value={alertForm.payment_plan} onValueChange={v => setAlertForm(p => ({ ...p, payment_plan: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_PLANS.map(p => <SelectItem key={p.value} value={p.value}>{isAr ? p.label.ar : p.label.en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{isAr ? 'تاريخ أول دفعة *' : 'First Due *'}</Label>
                  <Input type="date" value={alertForm.alert_date} onChange={e => setAlertForm(p => ({ ...p, alert_date: e.target.value }))} className="text-sm" />
                </div>
              </div>

              {alertPreviewDate && (
                <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
                  <span style={{ color: '#1B2B4B' }}>{isAr ? 'الدفعة التالية' : 'Next payment'}: </span>
                  <span className="font-bold" style={{ color: '#C9A84C' }}>{alertPreviewDate}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm">{isAr ? 'المبلغ الشهري *' : 'Monthly Amount *'}</Label>
                <Input type="number" value={alertForm.original_amount}
                  onChange={e => setAlertForm(p => ({ ...p, original_amount: e.target.value }))}
                  placeholder="0.00" className="text-sm" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm" style={{ color: '#E63946' }}>{isAr ? 'مبلغ متأخر (اختياري)' : 'Overdue (optional)'}</Label>
                <Input type="number" value={alertForm.accumulated_amount}
                  onChange={e => setAlertForm(p => ({ ...p, accumulated_amount: e.target.value }))}
                  placeholder="0.00" className="text-sm"
                  style={{ borderColor: Number(alertForm.accumulated_amount) > 0 ? '#E63946' : undefined }} />
              </div>

              {(Number(alertForm.original_amount) > 0 || Number(alertForm.accumulated_amount) > 0) && (
                <div className="rounded-xl p-3 flex justify-between items-center text-sm" style={{ backgroundColor: 'rgba(27,43,75,0.04)' }}>
                  <span className="font-bold" style={{ color: '#1B2B4B' }}>{isAr ? 'الإجمالي المستحق' : 'Total Due'}</span>
                  <span className="font-bold" style={{ color: '#1B2B4B' }}>
                    {((Number(alertForm.original_amount) || 0) + (Number(alertForm.accumulated_amount) || 0)).toLocaleString()} AED
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm">{isAr ? 'ملاحظات' : 'Notes'}</Label>
                <Input value={alertForm.description} onChange={e => setAlertForm(p => ({ ...p, description: e.target.value }))} className="text-sm" />
              </div>

              <div className="flex gap-2 pt-1">
                <Button onClick={handleSaveAlert} disabled={alertSaving || !alertForm.alert_date}
                  className="flex-1" style={{ backgroundColor: '#1B2B4B' }}>
                  {alertSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التنبيه' : 'Save Alert')}
                </Button>
                <Button variant="outline" onClick={() => setAlertDialog(null)} className="flex-1">{isAr ? 'إلغاء' : 'Cancel'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}