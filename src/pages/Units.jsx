import { useState, useEffect, useRef, useCallback } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { Plus, Search, Edit2, Trash2, Building2, Phone, Upload, X, FileImage, Loader2 } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { differenceInDays, parseISO, isValid } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import usePullToRefresh from '@/hooks/usePullToRefresh';
import PullRefreshIndicator from '@/components/PullRefreshIndicator';

const emptyUnit = {
  unit_number: '', tenant_name: '', nationality: '', annual_rent: '',
  insurance: '', contract_start: '', contract_end: '', payment_plan: '',
  owner_phone: '', status: 'occupied', floor: '', notes: '', contract_image_url: '',
};

export default function Units() {
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
  const contractFileRef = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLang();
  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin || user?.role === 'data_entry';
  const isInvestor = user?.role === 'investor';

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
    const data = await base44.entities.Unit.list();
    setUnits(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUnits(); }, []);
  const refreshing = usePullToRefresh(fetchUnits);

  const openAdd = () => { setEditUnit(null); setForm(emptyUnit); setDialogOpen(true); };
  const openEdit = (u) => { setEditUnit(u); setForm({ ...emptyUnit, ...u }); setDialogOpen(true); };

  const logActivity = (action, unit, oldData = null, newData = null) => {
    base44.functions.invoke('logActivity', {
      action,
      entity_type: 'Unit',
      entity_id: unit?.id || '',
      entity_label: `وحدة ${unit?.unit_number || ''} - ${unit?.tenant_name || ''}`,
      changes_summary: action === 'create' ? `إضافة وحدة ${unit?.unit_number}` : action === 'update' ? `تعديل وحدة ${unit?.unit_number}` : `حذف وحدة ${unit?.unit_number}`,
      old_data: oldData,
      new_data: newData,
    }).catch(() => {});
  };

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form, annual_rent: parseFloat(form.annual_rent) || 0 };
    if (editUnit) {
      setUnits(prev => prev.map(u => u.id === editUnit.id ? { ...u, ...data } : u));
      setDialogOpen(false);
      setSaving(false);
      await base44.entities.Unit.update(editUnit.id, data);
      logActivity('update', { ...editUnit, ...data }, editUnit, data);
      toast({ description: t('unitUpdated') });
      fetchUnits();
    } else {
      const tempId = `temp_${Date.now()}`;
      setUnits(prev => [{ ...data, id: tempId }, ...prev]);
      setDialogOpen(false);
      setSaving(false);
      const created = await base44.entities.Unit.create(data);
      logActivity('create', { ...data, id: created?.id }, null, data);
      toast({ description: t('unitAdded') });
      fetchUnits();
    }
  };

  const handleDelete = (id) => {
    const unit = units.find(u => u.id === id);
    setConfirmDelete({ message: 'هل تريد حذف هذه الوحدة؟', onConfirm: async () => {
      setUnits(prev => prev.filter(u => u.id !== id));
      setConfirmDelete(null);
      await base44.entities.Unit.delete(id);
      logActivity('delete', { ...unit, id }, unit, null);
      toast({ description: t('unitDeleted') });
      fetchUnits();
    }});
  };

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
    return a.unit_number.localeCompare(b.unit_number);
  });

  // Investors can view units but not edit
  const canViewUnits = isAdmin || user?.role === 'data_entry' || isInvestor;

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PullRefreshIndicator refreshing={refreshing} />
      <PageHeader
        titleAr="الوحدات السكنية"
        titleEn="Residential Units"
        description={`${units.length} ${t('unitNumber')}`}
        actions={canEdit && (
          <Button onClick={openAdd} className="gap-2 text-sm" style={{ backgroundColor: '#1B2B4B' }}>
            <Plus size={16} /> {t('addUnit')}
          </Button>
        )}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
          <Input
            placeholder={t('searchUnits')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatuses')}</SelectItem>
            <SelectItem value="occupied">{t('occupied')}</SelectItem>
            <SelectItem value="vacant">{t('vacant')}</SelectItem>
            <SelectItem value="maintenance">{t('maintenance')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Pills + Year Filter */}
      <div className="flex gap-3 flex-wrap items-center">
        {Object.entries(statusConfig).map(([k, v]) => {
          const count = units.filter(u => u.status === k).length;
          return (
            <span key={k} className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: v.bg, color: v.color }}>
              {v.label}: {count}
            </span>
          );
        })}
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-28 h-7 text-xs">
            <SelectValue placeholder="السنة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل السنوات</SelectItem>
            {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Table */}
      <div className="bg-white card-bevel rounded-xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#1B2B4B' }}>
              <tr>
                {[t('unitNumber'), t('tenantName'), t('nationality'), t('annualRent'), t('paymentPlan'), t('contractEnd'), t('status'), ''].map(h => (
                  <th key={h} className="text-right py-3 px-4 text-white/80 font-medium text-xs whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array(8).fill(0).map((_, j) => (
                      <td key={j} className="py-3 px-4">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">{t('noUnitsFound')}</td></tr>
              ) : filtered.map((u, i) => {
                const sc = statusConfig[u.status] || statusConfig.vacant;
                const expTag = getExpiryTag(u.contract_end);
                const isExpired = u.contract_end && differenceInDays(parseISO(u.contract_end), new Date()) < 0;
                return (
                <tr key={u.id} onClick={() => setViewUnit(u)} className={`border-b border-border/50 hover:bg-surface transition-colors cursor-pointer`}
                  style={{ backgroundColor: isExpired ? 'rgba(230,57,70,0.07)' : i % 2 === 1 ? '#F8F9FA' : undefined }}>
                    <td className="py-3 px-4 font-bold">
                      <div className="flex items-center gap-2 font-bold" style={{ color: '#1B2B4B' }}>
                        <Building2 size={14} className="text-muted-foreground" />
                        {u.unit_number}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium max-w-40">
                      <div className="truncate font-semibold" style={{ color: '#1B2B4B' }}>
                        {u.tenant_name || '-'}
                      </div>
                      {u.owner_phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone size={10} />{u.owner_phone}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{u.nationality || '-'}</td>
                    <td className="py-3 px-4 font-semibold" style={{ color: '#1B2B4B' }}>
                      {u.annual_rent ? `${u.annual_rent.toLocaleString()} AED` : '-'}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs max-w-32">
                      <span className="truncate block">{u.payment_plan || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{u.contract_end || '-'}</span>
                        {expTag && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: expTag.bg, color: expTag.color }}>
                            {expTag.label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-4" onClick={ev => ev.stopPropagation()}>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => navigate(`/units/${encodeURIComponent(u.unit_number)}`)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-navy" title="عرض التفاصيل">
                            <Building2 size={14} />
                          </button>
                          <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-navy">
                            <Edit2 size={14} />
                          </button>
                          {isAdmin && (
                            <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                              <Trash2 size={14} />
                            </button>
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
        {loading ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} className="bg-white card-bevel rounded-xl p-4">
              <div className="h-4 bg-muted rounded animate-pulse mb-2" />
              <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-white card-bevel rounded-xl p-12 text-center text-muted-foreground">{t('noUnitsFound')}</div>
        ) : filtered.map((u) => {
          const sc = statusConfig[u.status] || statusConfig.vacant;
          const expTag = getExpiryTag(u.contract_end);
          const isExpired = u.contract_end && differenceInDays(parseISO(u.contract_end), new Date()) < 0;
          return (
            <div key={u.id} onClick={() => setViewUnit(u)} className="card-bevel rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer active:bg-muted/30"
              style={{ backgroundColor: isExpired ? 'rgba(230,57,70,0.07)' : '#ffffff', border: isExpired ? '1px solid rgba(230,57,70,0.25)' : undefined }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-muted-foreground" />
                  <span className="font-bold text-lg" style={{ color: '#1B2B4B' }}>{u.unit_number}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: sc.bg, color: sc.color }}>
                  {sc.label}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('tenantName')}</span>
                  <span className="text-sm font-semibold" style={{ color: '#1B2B4B' }}>{u.tenant_name || '-'}</span>
                </div>
                
                {u.owner_phone && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone size={12} />{u.owner_phone}
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('nationality')}</span>
                  <span className="text-sm">{u.nationality || '-'}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('annualRent')}</span>
                  <span className="text-sm font-semibold" style={{ color: '#1B2B4B' }}>
                    {u.annual_rent ? `${u.annual_rent.toLocaleString()} AED` : '-'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('paymentPlan')}</span>
                  <span className="text-xs text-muted-foreground">{u.payment_plan || '-'}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('contractEnd')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{u.contract_end || '-'}</span>
                    {expTag && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: expTag.bg, color: expTag.color }}>
                        {expTag.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {canEdit && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border" onClick={ev => ev.stopPropagation()}>
                  <button onClick={() => navigate(`/units/${encodeURIComponent(u.unit_number)}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-muted transition-colors text-sm">
                    <Building2 size={14} /> {t('details') || 'التفاصيل'}
                  </button>
                  <button onClick={() => openEdit(u)} 
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-muted transition-colors text-sm">
                    <Edit2 size={14} />{t('edit')}
                  </button>
                  {isAdmin && (
                    <button onClick={() => handleDelete(u.id)} 
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-destructive/10 transition-colors text-sm text-destructive">
                      <Trash2 size={14} />{t('delete')}
                    </button>
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
            <DialogTitle>تفاصيل الوحدة — {viewUnit?.unit_number}</DialogTitle>
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
                  { label: 'الإيجار السنوي', value: viewUnit.annual_rent ? `${viewUnit.annual_rent.toLocaleString()} AED` : null },
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
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" onClick={() => { setViewUnit(null); navigate(`/units/${encodeURIComponent(viewUnit.unit_number)}`); }} variant="outline">
                    <Building2 size={14} /> صفحة الوحدة
                  </Button>
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto font-cairo">
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
                <Input
                  type={f.type}
                  value={form[f.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="text-sm"
                />
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
                <input
                  ref={contractFileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={e => handleContractUpload(e.target.files[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => contractFileRef.current?.click()}
                  disabled={uploadingContract}
                  className="gap-2"
                >
                  {uploadingContract ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploadingContract ? t('uploading') : t('uploadContract')}
                </Button>
                {form.contract_image_url && (
                  <div className="flex items-center gap-2">
                    <a href={form.contract_image_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs hover:underline" style={{ color: '#1B2B4B' }}>
                      <FileImage size={14} />
                      {t('viewContract')}
                    </a>
                    <button type="button" onClick={() => setForm(p => ({ ...p, contract_image_url: '' }))}
                      className="text-destructive hover:opacity-70">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: '#1B2B4B' }}>
              {saving ? t('saving_') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}