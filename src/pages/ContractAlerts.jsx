import { useState, useEffect } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Bell, ArrowRight, Edit2, X, Building2, Calendar, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, parseISO, isValid, startOfDay } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PREVIEW_COUNT = 5;

export default function ContractAlerts() {
  const { user } = useAuth();
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
      ...units.map(u => ({ ...u, _source: 'qarya', _sourceLabel: 'بناية القرية' })),
      ...reUnits.map(u => ({ ...u, _source: 're', _sourceLabel: 'العقارات' })),
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
    return <div className="text-center py-20 text-muted-foreground">غير مصرح</div>;
  }

  const getDayStyle = (days) => {
    if (days < 0) return { color: '#E63946', bg: 'rgba(230,57,70,0.1)', label: `منتهي ${Math.abs(days)} يوم` };
    if (days === 0) return { color: '#E63946', bg: 'rgba(230,57,70,0.1)', label: 'ينتهي اليوم' };
    if (days <= 30) return { color: '#E63946', bg: 'rgba(230,57,70,0.08)', label: `${days} يوم` };
    return { color: '#F97316', bg: 'rgba(249,115,22,0.08)', label: `${days} يوم` };
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
        await base44.entities.Unit.update(editUnit.id, editForm);
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
    <div className="space-y-5 animate-fade-in-up" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowRight size={18} />
        </button>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(230,57,70,0.12)' }}>
          <Bell size={20} style={{ color: '#E63946' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>تنبيهات العقود</h1>
          <p className="text-xs text-muted-foreground">
            {expiredCount > 0 && `${expiredCount} منتهي`}
            {expiredCount > 0 && soonCount > 0 && ' · '}
            {soonCount > 0 && `${soonCount} قريب من الانتهاء`}
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
          <p className="font-semibold" style={{ color: '#1B2B4B' }}>لا توجد عقود منتهية أو قريبة من الانتهاء</p>
          <p className="text-xs text-muted-foreground">كل العقود خلال 90 يوم القادمة</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden card-bevel">
          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border" style={{ backgroundColor: 'rgba(230,57,70,0.05)' }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(230,57,70,0.12)' }}>
                <Building2 size={16} style={{ color: '#E63946' }} />
              </div>
              <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>العقود المنتهية والقريبة من الانتهاء</span>
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
                        {u.tenant_name || `وحدة ${u.unit_number}`}
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(27,43,75,0.08)', color: '#1B2B4B' }}>
                        {u._sourceLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-muted-foreground">وحدة {u.unit_number}</p>
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
                  {user?.role === 'admin' && (
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
              {showAll ? 'عرض أقل' : `عرض المزيد (${contracts.length - PREVIEW_COUNT})`}
              <ChevronDown size={15} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editUnit} onOpenChange={() => setEditUnit(null)}>
        <DialogContent className="max-w-sm font-cairo" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل العقد — وحدة {editUnit?.unit_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">اسم المستأجر</Label>
              <Input value={editForm.tenant_name || ''} onChange={e => setEditForm(p => ({ ...p, tenant_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">بداية العقد</Label>
                <Input type="date" value={editForm.contract_start || ''} onChange={e => setEditForm(p => ({ ...p, contract_start: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">نهاية العقد</Label>
                <Input type="date" value={editForm.contract_end || ''} onChange={e => setEditForm(p => ({ ...p, contract_end: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الإيجار السنوي</Label>
              <Input type="number" value={editForm.annual_rent || ''} onChange={e => setEditForm(p => ({ ...p, annual_rent: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">خطة الدفع</Label>
              <Input value={editForm.payment_plan || ''} onChange={e => setEditForm(p => ({ ...p, payment_plan: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: '#1B2B4B' }}>
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
            <Button variant="outline" onClick={() => setEditUnit(null)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}