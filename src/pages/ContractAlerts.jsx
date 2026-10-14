import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { Bell, ArrowRight, ArrowLeft, Edit2, Building2, Calendar, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, parseISO, isValid, startOfDay } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PREVIEW_COUNT = 5;

export default function ContractAlerts() {
  const { user } = useAuth();
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [editUnit, setEditUnit] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const today_start = startOfDay(new Date());

  const loadData = async () => {
    setLoading(true);
    const [units, reUnits] = await Promise.all([
      base44.entities.Unit.list(),
      base44.entities.ReUnit.list(),
    ]);

    const allUnits = [
      ...units.map(u => ({ ...u, _source: 'qarya', _sourceLabel: { ar: 'بناية القرية', en: 'Qarya Villa' } })),
      ...reUnits.map(u => ({ ...u, _source: 're', _sourceLabel: { ar: 'العقارات', en: 'Real Estate' } })),
    ];

    const filtered = allUnits
      .filter(u => {
        if (!u.contract_end) return false;
        try {
          const d = startOfDay(parseISO(u.contract_end));
          if (!isValid(d)) return false;
          return differenceInDays(d, today_start) <= 90;
        } catch { return false; }
      })
      .map(u => ({
        ...u,
        daysLeft: differenceInDays(startOfDay(parseISO(u.contract_end)), today_start),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);

    setContracts(filtered);
    setLoading(false);
  };

  useEffect(() => { if (user) loadData(); }, [user]);

  if (user?.role !== 'admin' && user?.role !== 'investor') {
    return <div className="text-center py-20 text-muted-foreground">{isAr ? 'غير مصرح' : 'Unauthorized'}</div>;
  }

  const enDays = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

  const getDayStyle = (days) => {
    if (days < 0) return { color: '#E63946', bg: 'rgba(230,57,70,0.1)', label: isAr ? `منتهي ${Math.abs(days)} يوم` : `Expired ${enDays(Math.abs(days))} ago` };
    if (days === 0) return { color: '#E63946', bg: 'rgba(230,57,70,0.1)', label: isAr ? 'ينتهي اليوم' : 'Expires today' };
    if (days <= 30) return { color: '#E63946', bg: 'rgba(230,57,70,0.08)', label: isAr ? `${days} يوم` : enDays(days) };
    return { color: '#F97316', bg: 'rgba(249,115,22,0.08)', label: isAr ? `${days} يوم` : enDays(days) };
  };

  const openEdit = (u) => {
    setEditUnit(u);
    setEditForm({
      tenant_name: u.tenant_name || '',
      unit_number: u.unit_number || '',
      annual_rent: u.annual_rent || '',
      contract_start: u.contract_start || '',
      contract_end: u.contract_end || '',
      payment_plan: u.payment_plan || '',
      status: u.status || 'occupied',
    });
  };

  const handleSave = async () => {
    if (!editUnit) return;
    setSaving(true);
    try {
      if (editUnit._source === 'qarya') {
        await base44.entities.UnitWrite.update(editUnit.id, editForm);
      } else {
        await base44.entities.ReUnit.update(editUnit.id, editForm);
      }
      setEditUnit(null);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleClick = (u) => {
    if (u._source === 'qarya') {
      navigate(`/units/${u.unit_number}`);
    } else {
      navigate('/re-units');
    }
  };

  const visible = showAll ? contracts : contracts.slice(0, PREVIEW_COUNT);
  const expiredCount = contracts.filter(u => u.daysLeft < 0).length;
  const soonCount = contracts.filter(u => u.daysLeft >= 0).length;

  return (
    <div className="space-y-5 animate-fade-in-up" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
          <BackIcon size={18} />
        </button>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(230,57,70,0.12)' }}>
          <Bell size={20} style={{ color: '#E63946' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{isAr ? 'تنبيهات العقود' : 'Contract Alerts'}</h1>
          <p className="text-xs text-muted-foreground">
            {expiredCount > 0 && (isAr ? `${expiredCount} منتهي` : `${expiredCount} expired`)}
            {expiredCount > 0 && soonCount > 0 && ' · '}
            {soonCount > 0 && (isAr ? `${soonCount} قريب من الانتهاء` : `${soonCount} expiring soon`)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-4">
              <div className="h-4 bg-muted rounded animate-pulse mb-2 w-2/3" />
              <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
            </div>
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 flex flex-col items-center gap-3 text-center card-bevel">
          <CheckCircle2 size={40} style={{ color: '#2A9D8F' }} />
          <p className="font-semibold" style={{ color: '#1B2B4B' }}>{isAr ? 'لا توجد عقود منتهية أو قريبة من الانتهاء' : 'No expired or expiring contracts'}</p>
          <p className="text-xs text-muted-foreground">{isAr ? 'كل العقود خلال 90 يوم القادمة' : 'Covers all contracts ending within the next 90 days'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden card-bevel">
          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border" style={{ backgroundColor: 'rgba(230,57,70,0.05)' }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(230,57,70,0.12)' }}>
                <Building2 size={16} style={{ color: '#E63946' }} />
              </div>
              <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>{isAr ? 'العقود المنتهية والقريبة من الانتهاء' : 'Expired and Expiring Contracts'}</span>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(230,57,70,0.1)', color: '#E63946' }}>
              {contracts.length}
            </span>
          </div>

          {/* Contracts list */}
          <div className="divide-y divide-border">
            {visible.map(u => {
              const style = getDayStyle(u.daysLeft);
              return (
                <div
                  key={`${u._source}-${u.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  style={{ backgroundColor: u.daysLeft < 0 ? 'rgba(230,57,70,0.03)' : 'transparent' }}
                >
                  {/* Clickable contract info */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleClick(u)}>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm" style={{ color: '#1B2B4B' }}>
                        {u.tenant_name || `${isAr ? 'وحدة' : 'Unit'} ${u.unit_number}`}
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(27,43,75,0.08)', color: '#1B2B4B' }}>
                        {u._sourceLabel[lang]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-muted-foreground">{isAr ? 'وحدة' : 'Unit'} {u.unit_number}</p>
                      <div className="flex items-center gap-1 text-xs" style={{ color: '#64748B' }}>
                        <Calendar size={10} />
                        <span>{u.contract_end}</span>
                      </div>
                    </div>
                  </div>

                  {/* Days badge */}
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ color: style.color, backgroundColor: style.bg }}>
                    {style.label}
                  </span>

                  {/* Edit button - admin only */}
                  {(user?.role === 'admin' || user?.role === 'tester') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(u); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
                      style={{ color: '#64748B' }}
                    >
                      <Edit2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Show more */}
          {contracts.length > PREVIEW_COUNT && (
            <button
              onClick={() => setShowAll(p => !p)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
              style={{ color: '#E63946' }}
            >
              {showAll ? (isAr ? 'عرض أقل' : 'Show less') : (isAr ? `عرض المزيد (${contracts.length - PREVIEW_COUNT})` : `Show more (${contracts.length - PREVIEW_COUNT})`)}
              <ChevronDown size={15} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editUnit} onOpenChange={() => setEditUnit(null)}>
        <DialogContent className="max-w-sm font-cairo" dir={isAr ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{isAr ? 'تعديل العقد — وحدة' : 'Edit Contract — Unit'} {editUnit?.unit_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{isAr ? 'اسم المستأجر' : 'Tenant Name'}</Label>
              <Input value={editForm.tenant_name || ''} onChange={e => setEditForm(p => ({ ...p, tenant_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{isAr ? 'بداية العقد' : 'Contract Start'}</Label>
                <Input type="date" value={editForm.contract_start || ''} onChange={e => setEditForm(p => ({ ...p, contract_start: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isAr ? 'نهاية العقد' : 'Contract End'}</Label>
                <Input type="date" value={editForm.contract_end || ''} onChange={e => setEditForm(p => ({ ...p, contract_end: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isAr ? 'الإيجار السنوي' : 'Annual Rent'}</Label>
              <Input type="number" value={editForm.annual_rent || ''} onChange={e => setEditForm(p => ({ ...p, annual_rent: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isAr ? 'خطة الدفع' : 'Payment Plan'}</Label>
              <Input value={editForm.payment_plan || ''} onChange={e => setEditForm(p => ({ ...p, payment_plan: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: '#1B2B4B' }}>
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
            </Button>
            <Button variant="outline" onClick={() => setEditUnit(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}