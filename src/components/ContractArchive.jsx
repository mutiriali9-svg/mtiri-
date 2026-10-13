import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, Building2, CalendarX, ChevronDown, ChevronLeft, ChevronRight, DoorOpen, Edit2, RefreshCw, Search, UserPlus } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import { formatPhone } from '@/utils/phone';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ARCHIVE_REASONS, archiveContract, arrearsLeft, contractEnded, listAllContractArchive } from '@/utils/contractArchive';
import { exitPaymentName, localDay, splitWithCarryOver } from '@/utils/contractPeriods';

export const archivePathFor = (propertyType) => (propertyType === 'real_estate' ? '/re-units/archive' : '/units/archive');

export function useContractArchive(propertyType) {
  const { user } = useAuth();
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const isAdmin = user?.role === 'admin';
  const [choice, setChoice] = useState(null);
  const [version, setVersion] = useState(0);

  const archiveForVacate = async (unit, note, reason = 'vacate', outstanding = 0, depositApplied = 0, settlementNote = '') => {
    await archiveContract(unit, propertyType, reason, user, note, outstanding, depositApplied, settlementNote);
    setVersion(v => v + 1);
  };

  const archiveForRenewal = async (unit) => {
    await archiveContract(unit, propertyType, 'renewal', user);
    setVersion(v => v + 1);
  };

  const chooseAction = (unit, handlers) => setChoice({ unit, handlers });

  const pick = (key) => {
    const c = choice;
    setChoice(null);
    c?.handlers[key]?.(c.unit);
  };

  const options = [
    {
      key: 'renew', Icon: RefreshCw, color: '#2A9D8F',
      title: isAr ? 'تجديد العقد' : 'Renew the contract',
      hint: isAr
        ? 'المستأجر نفسه بعقد جديد. تدخل التواريخ والقيمة وصورة العقد، ويُحفظ العقد الحالي في الأرشيف تلقائياً.'
        : 'Same tenant, new contract. Enter the dates, rent and contract image; the current contract is archived automatically.',
    },
    {
      key: 'replace', Icon: UserPlus, color: '#C9A84C', adminOnly: true,
      title: isAr ? 'تبديل المستأجر' : 'Replace the tenant',
      hint: isAr
        ? 'مستأجر جديد. تُفرَّغ الوحدة أولاً ويُحفظ عقدها في الأرشيف، ثم تدخل بيانات المستأجر الجديد.'
        : 'New tenant. The unit is vacated first and its contract archived, then you enter the new tenant.',
    },
    {
      key: 'vacate', Icon: DoorOpen, color: '#E63946', adminOnly: true,
      title: isAr ? 'إخلاء المستأجر' : 'Vacate the tenant',
      hint: isAr
        ? 'خروج المستأجر دون مستأجر جديد. تُسوّى المتأخرات والتأمين بالشروط نفسها، ويُحفظ العقد في الأرشيف، وتبقى الوحدة شاغرة.'
        : 'The tenant leaves with no new tenant. Arrears and the deposit are settled under the same rules, the contract is archived and the unit stays vacant.',
    },
    {
      key: 'expire', Icon: CalendarX, color: '#0EA5E9', adminOnly: true,
      title: isAr ? 'انتهاء مدة العقد' : 'Contract term ended',
      hint: isAr
        ? 'انتهت مدة العقد وخرج المستأجر. تظهر لك شروط الإنهاء المتاحة له: ردّ التأمين، أو سداد المتأخرات منه، ويُحفظ العقد في الأرشيف بسبب «انتهاء العقد».'
        : 'The term is over and the tenant leaves. You see the closing options that apply: return the deposit or settle arrears from it, and the contract is archived as «Contract ended».',
    },
    {
      key: 'correct', Icon: Edit2, color: '#1B2B4B',
      title: isAr ? 'تصحيح بيانات العقد الحالي' : 'Correct the current contract',
      hint: isAr ? 'لإصلاح خطأ في البيانات، دون أرشفة.' : 'Fix a mistake in the data, without archiving.',
    },
  ];

  const chooserDialog = (
    <Dialog open={!!choice} onOpenChange={v => { if (!v) setChoice(null); }}>
      <DialogContent className="max-w-sm font-cairo" dir={isAr ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {isAr ? `الوحدة ${choice?.unit?.unit_number || ''}` : `Unit ${choice?.unit?.unit_number || ''}`}
          </DialogTitle>
        </DialogHeader>
        {choice && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {choice.unit.tenant_name || ''}
              {choice.unit.contract_end ? ` · ${isAr ? 'ينتهي العقد في' : 'contract ends'} ${choice.unit.contract_end}` : ''}
            </p>
            {options.filter(o => choice.handlers[o.key]).map(({ key, Icon, color, title, hint, adminOnly }) => {
              const ownerOnly = adminOnly && !isAdmin;
              const early = key === 'expire' && !contractEnded(choice.unit, new Date().toISOString().split('T')[0]);
              const locked = ownerOnly || early;
              const end = String(choice.unit.contract_end || '').slice(0, 10);
              return (
                <button key={key} type="button" disabled={locked} onClick={() => pick(key)}
                  className="w-full text-start rounded-xl border px-3 py-3 flex items-start gap-3 transition-colors hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderColor: `${color}55` }}>
                  <span className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}14` }}>
                    <Icon size={16} style={{ color }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold" style={{ color }}>{title}</span>
                    <span className="block text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                      {ownerOnly
                        ? (isAr ? 'متاح للمالك فقط.' : 'Owner only.')
                        : early
                          ? (end
                            ? (isAr ? `ينتهي العقد في ${end}. وللخروج قبل ذلك استخدم «إخلاء المستأجر».` : `The contract ends on ${end}. To leave before then, use «Vacate the tenant».`)
                            : (isAr ? 'لا يوجد تاريخ نهاية لهذا العقد. وللخروج استخدم «إخلاء المستأجر».' : 'This contract has no end date. To leave, use «Vacate the tenant».'))
                          : hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  return { chooseAction, archiveForVacate, archiveForRenewal, chooserDialog, archiveVersion: version };
}

export function ArchiveReason({ c, isAr, pill = false }) {
  const r = ARCHIVE_REASONS[c.reason] || ARCHIVE_REASONS.renewal;
  const vacated = c.reason !== 'renewal';
  const Icon = c.reason === 'expiry' ? CalendarX : DoorOpen;
  if (pill || !vacated) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0"
      style={{ backgroundColor: `${r.color}1A`, color: r.color }}>
      {vacated && <Icon size={13} />}
      {r[isAr ? 'ar' : 'en']}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full text-xs font-semibold" title={c.note || undefined}
      style={{ color: '#374151' }}>
      <Icon size={14} className="shrink-0" style={{ color: r.color }} />
      <span className="truncate">{c.note || r[isAr ? 'ar' : 'en']}</span>
    </span>
  );
}

const archivedOn = (c) => localDay(c.created_at);
const period = (c) => (c.contract_start || c.contract_end ? `${c.contract_start || '?'} → ${c.contract_end || '?'}` : '—');
const money = (n) => (n ? `${Number(n).toLocaleString()} AED` : '-');

export function ContractArchiveList({ propertyType }) {
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const thisYear = String(new Date().getFullYear());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const search = searchParams.get('q') || '';
  const year = searchParams.get('year') || 'all';

  useEffect(() => {
    let live = true;
    listAllContractArchive(propertyType)
      .then(data => { if (live) { setRows(data); setError(''); } })
      .catch(e => { if (live) setError(e?.message || (isAr ? 'تعذّر تحميل الأرشيف' : 'Could not load the archive')); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [propertyType]);

  const [later, setLater] = useState({ pays: [], tenants: {} });
  useEffect(() => {
    const units = [...new Set(rows.filter(c => Number(c.outstanding_amount) > 0).map(c => String(c.unit_number)))];
    if (!units.length) return undefined;
    let live = true;
    const realEstate = propertyType === 'real_estate';
    Promise.all([
      supabase.from(realEstate ? 're_payments' : 'payments')
        .select('id, unit_number, tenant_name, amount, status, notes, payment_date, created_at').in('unit_number', units),
      supabase.from(realEstate ? 're_units' : 'units_masked').select('unit_number, tenant_name').in('unit_number', units),
    ]).then(([{ data: pays }, { data: tenants }]) => {
      if (live) setLater({ pays: pays || [], tenants: Object.fromEntries((tenants || []).map(u => [String(u.unit_number), u.tenant_name])) });
    });
    return () => { live = false; };
  }, [rows, propertyType]);

  const leftOf = (c) => {
    const unit = String(c.unit_number);
    const carried = splitWithCarryOver(
      rows.filter(x => String(x.unit_number) === unit),
      later.pays.filter(p => String(p.unit_number) === unit),
      p => p.payment_date, p => p.created_at, exitPaymentName, later.tenants[unit],
    ).carried[c.id] || [];
    return arrearsLeft(c, carried.filter(p => !p.status || p.status === 'paid').reduce((s, p) => s + (Number(p.amount) || 0), 0));
  };

  const remember = (key, value) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    if (value) next.set(key, value);
    else next.delete(key);
    return next;
  }, { replace: true, state: location.state });

  const yearOf = (c) => archivedOn(c).slice(0, 4);
  const years = [...new Set([thisYear, ...(year !== 'all' ? [year] : []), ...rows.map(yearOf).filter(Boolean)])]
    .sort((a, b) => b.localeCompare(a));
  const q = search.trim().toLowerCase();
  const searched = rows.filter(c => !q || [c.tenant_name, c.unit_number, c.owner_phone].some(v => String(v || '').toLowerCase().includes(q)));
  const shown = searched.filter(c => year === 'all' || yearOf(c) === year);
  const otherYears = Object.entries(searched.reduce((m, c) => {
    const y = yearOf(c);
    if (y && y !== year) m[y] = (m[y] || 0) + 1;
    return m;
  }, {})).sort((a, b) => b[0].localeCompare(a[0]));

  const open = (c) => navigate(`${archivePathFor(propertyType)}/${c.id}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
          <Input placeholder={isAr ? 'بحث باسم المستأجر أو رقم الوحدة...' : 'Search by tenant or unit #...'}
            value={search} onChange={e => remember('q', e.target.value)} className="ps-9 text-sm" />
        </div>
        <Select value={year} onValueChange={v => remember('year', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder={isAr ? 'السنة' : 'Year'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isAr ? 'كل السنوات' : 'All Years'}</SelectItem>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {isAr
          ? `${shown.length} ${shown.length === 1 ? 'عقد مؤرشف' : 'عقود مؤرشفة'}${year === 'all' ? '' : ` في ${year}`}`
          : `${shown.length} archived contract${shown.length === 1 ? '' : 's'}${year === 'all' ? '' : ` in ${year}`}`}
      </p>

      {year !== 'all' && otherYears.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{isAr ? 'عقود مؤرشفة في سنوات أخرى:' : 'Archived in other years:'}</span>
          {otherYears.map(([y, n]) => (
            <button key={y} type="button" onClick={() => remember('year', y)}
              className="px-3 rounded-full font-semibold border border-border bg-white hover:bg-muted/40 transition-colors"
              style={{ color: '#1B2B4B', minHeight: 32 }}>
              {y} ({n})
            </button>
          ))}
          <button type="button" onClick={() => remember('year', '')}
            className="px-3 rounded-full font-semibold border border-border bg-white hover:bg-muted/40 transition-colors"
            style={{ color: '#1B2B4B', minHeight: 32 }}>
            {isAr ? 'كل السنوات' : 'All years'}
          </button>
        </div>
      )}

      {error && <p className="text-xs font-medium" style={{ color: '#E63946' }}>{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="bg-white card-bevel rounded-xl h-16 animate-pulse" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="bg-white card-bevel rounded-xl p-12 text-center text-muted-foreground">
          <Archive size={34} className="mx-auto mb-3" style={{ color: '#E2E8F0' }} />
          <p className="text-sm">
            {rows.length === 0
              ? (isAr ? 'لا توجد عقود مؤرشفة بعد. يُحفظ العقد هنا عند تجديده أو تبديل المستأجر أو إخلاء الوحدة.' : 'No archived contracts yet. A contract is saved here when it is renewed, the tenant is replaced or the unit is vacated.')
              : (isAr ? 'لا توجد عقود مؤرشفة مطابقة.' : 'No matching archived contracts.')}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white card-bevel rounded-xl overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] lg:text-sm">
                <thead style={{ backgroundColor: '#1B2B4B' }}>
                  <tr>
                    {[isAr ? 'المستأجر' : 'Tenant', isAr ? 'الوحدة' : 'Unit', isAr ? 'فترة العقد' : 'Contract period',
                      isAr ? 'الإيجار السنوي' : 'Annual Rent', isAr ? 'تاريخ الأرشفة' : 'Archived on', isAr ? 'السبب' : 'Reason'].map((h, i) => (
                      <th key={i} className="text-start py-2.5 lg:py-3 px-2 lg:px-4 text-white/80 font-medium text-[10px] lg:text-xs whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c, i) => (
                    <tr key={c.id} onClick={() => open(c)}
                      className="border-b border-border/50 hover:bg-surface transition-colors cursor-pointer"
                      style={{ backgroundColor: i % 2 === 1 ? '#F8F9FA' : undefined }}>
                      <td className="py-2.5 lg:py-3 px-2 lg:px-4 max-w-[160px] lg:max-w-56">
                        <span className="truncate font-bold block text-sm lg:text-[15px]" style={{ color: '#1B2B4B' }}>{c.tenant_name || (isAr ? 'بدون مستأجر' : 'No tenant')}</span>
                        {c.owner_phone && <p className="text-[9px] lg:text-xs text-muted-foreground mt-0.5" dir="ltr">{formatPhone(c.owner_phone)}</p>}
                      </td>
                      <td className="py-2.5 lg:py-3 px-2 lg:px-4">
                        <div className="flex items-center gap-1.5 font-semibold" style={{ color: '#1B2B4B' }}>
                          <Building2 size={14} className="text-muted-foreground" />
                          {c.unit_number}
                        </div>
                      </td>
                      <td className="py-2.5 lg:py-3 px-2 lg:px-4 text-[10px] lg:text-xs text-muted-foreground whitespace-nowrap"><span dir="ltr">{period(c)}</span></td>
                      <td className="py-2.5 lg:py-3 px-2 lg:px-4 font-semibold whitespace-nowrap" style={{ color: '#1B2B4B' }}>{money(c.annual_rent)}</td>
                      <td className="py-2.5 lg:py-3 px-2 lg:px-4 text-[10px] lg:text-xs text-muted-foreground whitespace-nowrap">{archivedOn(c)}</td>
                      <td className="py-2.5 lg:py-3 px-2 lg:px-4 max-w-[180px] lg:max-w-60">
                        <div className="flex flex-col items-start gap-1 min-w-0">
                          <ArchiveReason c={c} isAr={isAr} />
                          {Number(c.outstanding_amount) > 0 && (() => {
                            const { left } = leftOf(c);
                            return (
                              <span className="text-[11px] font-semibold" style={{ color: left > 0 ? '#E63946' : '#2A9D8F' }}>
                                {left > 0 ? `${isAr ? 'متأخرات' : 'Arrears'} ${left.toLocaleString()}` : (isAr ? 'سُدِّدت المتأخرات' : 'Arrears paid')}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="md:hidden space-y-3">
            {shown.map(c => (
              <div key={c.id} onClick={() => open(c)}
                className="bg-white card-bevel rounded-xl p-4 cursor-pointer active:bg-muted/30">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-bold text-lg truncate" style={{ color: '#1B2B4B' }}>{c.tenant_name || (isAr ? 'بدون مستأجر' : 'No tenant')}</p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                      <Building2 size={14} />
                      {isAr ? 'الوحدة' : 'Unit'} {c.unit_number}
                    </p>
                  </div>
                  <ArchiveReason c={c} isAr={isAr} pill />
                </div>
                <div className="space-y-2">
                  {c.reason !== 'renewal' && c.note && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground shrink-0">{isAr ? 'السبب' : 'Reason'}</span>
                      <ArchiveReason c={c} isAr={isAr} />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{isAr ? 'فترة العقد' : 'Contract period'}</span>
                    <span className="text-xs"><span dir="ltr">{period(c)}</span></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{isAr ? 'الإيجار السنوي' : 'Annual Rent'}</span>
                    <span className="text-sm font-semibold" style={{ color: '#1B2B4B' }}>{money(c.annual_rent)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{isAr ? 'تاريخ الأرشفة' : 'Archived on'}</span>
                    <span className="text-xs">{archivedOn(c)}</span>
                  </div>
                  {Number(c.outstanding_amount) > 0 && (() => {
                    const { left } = leftOf(c);
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{isAr ? 'المتأخرات المتبقية' : 'Arrears left'}</span>
                        <span className="text-sm font-semibold" style={{ color: left > 0 ? '#E63946' : '#2A9D8F' }}>
                          {left > 0 ? money(left) : (isAr ? 'سُدِّدت' : 'Paid')}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ContractArchiveSection({ rows, propertyType }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const allowed = user?.role === 'admin' || user?.role === 'data_entry';
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  if (!allowed) return null;

  return (
    <div className="bg-white card-bevel rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} disabled={rows.length === 0} aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-5 py-4 hover:bg-muted/30 transition-colors disabled:cursor-default">
        <span className="flex items-center gap-2">
          <Archive size={16} style={{ color: '#C9A84C' }} />
          <span className="font-bold text-sm" style={{ color: '#1B2B4B' }}>
            {isAr ? 'أرشيف العقود' : 'Contract archive'} ({rows.length})
          </span>
        </span>
        {rows.length > 0
          ? <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          : <span className="text-xs text-muted-foreground">{isAr ? 'لا توجد عقود سابقة' : 'No previous contracts'}</span>}
      </button>
      {open && rows.map(c => (
        <button key={c.id} type="button" onClick={() => navigate(`${archivePathFor(propertyType)}/${c.id}`)}
          className="w-full flex items-center gap-3 px-5 py-3 border-t border-border text-start hover:bg-muted/30 transition-colors">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold truncate" style={{ color: '#1B2B4B' }}>{c.tenant_name || (isAr ? 'بدون مستأجر' : 'No tenant')}</span>
            <span className="block text-[11px] text-muted-foreground">
              <span dir="ltr">{period(c)}</span>
              {` · ${isAr ? 'أُرشف في' : 'archived on'} ${archivedOn(c)}`}
            </span>
            {c.reason !== 'renewal' && c.note && (
              <span className="flex mt-0.5"><ArchiveReason c={c} isAr={isAr} /></span>
            )}
          </span>
          <ArchiveReason c={c} isAr={isAr} pill />
          <Chevron size={16} className="shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
