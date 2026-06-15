import { useState, useEffect, useCallback } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import StatCard from '@/components/StatCard';
import PageHeader from '@/components/PageHeader';
import { Link } from 'react-router-dom';
import { useLang } from '@/lib/LanguageContext';
import {
  TrendingUp, Building2, CreditCard, Receipt,
  CheckCircle2, CalendarRange, FileText
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { differenceInDays, parseISO, format, isValid, getYear, getMonth, startOfDay } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import usePullToRefresh from '@/hooks/usePullToRefresh';
import PullRefreshIndicator from '@/components/PullRefreshIndicator';
import { useAuth } from '@/lib/AuthContext';


const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const expCategoryLabels = {
  ar: { maintenance: 'صيانة', salary: 'رواتب', utilities: 'مرافق', equipment: 'معدات', cleaning: 'نظافة', admin: 'إدارة', marketing: 'تسويق', insurance: 'تأمين', savings: 'ادخار', other: 'أخرى' },
  en: { maintenance: 'Maintenance', salary: 'Salary', utilities: 'Utilities', equipment: 'Equipment', cleaning: 'Cleaning', admin: 'Admin', marketing: 'Marketing', insurance: 'Insurance', savings: 'Savings', other: 'Other' },
};

export default function Dashboard() {
  const [units, setUnits] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtered, setFiltered] = useState(false);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [kpiYearFilter, setKpiYearFilter] = useState('all');
  const [viewPayment, setViewPayment] = useState(null);
  const [viewExpense, setViewExpense] = useState(null);
  const { t, lang } = useLang();
  const isAr = lang === 'ar';
  const { user } = useAuth();
  const isTester = user?.role === 'tester';
  const maskName = (name) => isTester ? '***' : name;
  const currency = isAr ? 'د.إ' : 'AED';
  const expCategoryAr = expCategoryLabels[lang] || expCategoryLabels.ar;

  const MONTHS = isAr ? MONTHS_AR : MONTHS_EN;

  const loadData = useCallback(async () => {
    const [u, p, e] = await Promise.all([
      base44.entities.Unit.list(),
      base44.entities.Payment.list(),
      base44.entities.Expense.list(),
    ]);
    setUnits(u);
    setPayments(p);
    setExpenses(e);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, []);
  const refreshing = usePullToRefresh(loadData);

  const filteredPayments = payments.filter(p => {
    const d = p.payment_date;
    if (!d) return false;
    if (kpiYearFilter !== 'all' && !d.startsWith(kpiYearFilter)) return false;
    if (!filtered || (!dateFrom && !dateTo)) return true;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });

  const filteredExpenses = expenses.filter(e => {
    const d = e.expense_date;
    if (!d) return false;
    if (e.category === 'savings') return false;
    if (kpiYearFilter !== 'all' && !d.startsWith(kpiYearFilter)) return false;
    if (!filtered || (!dateFrom && !dateTo)) return true;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });

  const totalCollected = filteredPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netIncome = totalCollected - totalExpenses;
  const fmt = (n) => Number.isInteger(n) ? n.toLocaleString('ar-AE') : n.toLocaleString('ar-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const occupiedUnits = units.filter(u => u.status === 'occupied').length;
  const vacantUnits = units.filter(u => u.status === 'vacant').length;
  const maintenanceUnits = units.filter(u => u.status === 'maintenance').length;
  const occupancyRate = units.length ? Math.round((occupiedUnits / units.length) * 100) : 0;

  const occupancyStatusText = () => {
    if (units.length === 0) return isAr ? 'لا توجد وحدات' : 'No units';
    if (vacantUnits === 0 && maintenanceUnits === 0) return isAr ? '✓ جميع الوحدات مأجرة' : '✓ All units occupied';
    const parts = [];
    if (vacantUnits > 0) parts.push(isAr ? `${vacantUnits} شاغرة` : `${vacantUnits} vacant`);
    if (maintenanceUnits > 0) parts.push(isAr ? `${maintenanceUnits} صيانة` : `${maintenanceUnits} maintenance`);
    return parts.join(' · ');
  };
  const occupancyStatusColor = vacantUnits === 0 && maintenanceUnits === 0 ? '#2A9D8F' : '#E63946';

  const today_start = startOfDay(new Date());
  const expiringContracts = units.filter(u => {
    if (!u.contract_end) return false;
    const d = startOfDay(parseISO(u.contract_end));
    if (!isValid(d)) return false;
    const days = differenceInDays(d, today_start);
    return days >= -30 && days <= 90;
  }).map(u => ({
    ...u,
    daysLeft: differenceInDays(startOfDay(parseISO(u.contract_end)), today_start),
  })).sort((a, b) => a.daysLeft - b.daysLeft);

  const availableYears = [...new Set([
    ...payments.map(p => p.payment_date ? getYear(parseISO(p.payment_date)) : null),
    ...expenses.map(e => e.expense_date ? getYear(parseISO(e.expense_date)) : null),
  ].filter(Boolean))].sort((a, b) => b - a);

  const monthlyChartData = MONTHS.map((name, idx) => {
    const revenue = payments
      .filter(p => p.payment_date && isValid(parseISO(p.payment_date)) && getYear(parseISO(p.payment_date)) === yearFilter && getMonth(parseISO(p.payment_date)) === idx)
      .reduce((s, p) => s + (p.amount || 0), 0);
    const exp = expenses
      .filter(e => e.expense_date && e.category !== 'savings' && isValid(parseISO(e.expense_date)) && getYear(parseISO(e.expense_date)) === yearFilter && getMonth(parseISO(e.expense_date)) === idx)
      .reduce((s, e) => s + (e.amount || 0), 0);
    return { name, revenue, expenses: exp };
  }).filter(m => m.revenue > 0 || m.expenses > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-gold/30 border-t-gold rounded-full animate-spin"
          style={{ borderTopColor: '#C9A84C', borderColor: 'rgba(201,168,76,0.3)' }} />
      </div>
    );
  }

  const expCategory = (days) => {
    if (days < 0) return { color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' };
    if (days <= 30) return { color: '#E63946', bg: 'rgba(230,57,70,0.1)' };
    if (days <= 60) return { color: '#F97316', bg: 'rgba(249,115,22,0.1)' };
    return { color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' };
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <PullRefreshIndicator refreshing={refreshing} />
      <PageHeader
        titleAr="لوحة التحكم"
        titleEn="Executive Dashboard"
        description={t('dashSub')}
      />

      {/* Date Filter */}
      <div className="bg-white card-bevel rounded-xl p-3 sm:p-4 flex flex-wrap items-end gap-2 sm:gap-3">
        <CalendarRange size={16} style={{ color: '#C9A84C' }} className="mt-5 flex-shrink-0" />
        <div className="space-y-0.5 min-w-28">
          <Label className="text-[11px] sm:text-xs" style={{ color: '#1B2B4B' }}>{t('fromDate')}</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full sm:w-32 text-xs h-8" style={{ color: '#111827' }} />
        </div>
        <div className="space-y-0.5 min-w-28">
          <Label className="text-[11px] sm:text-xs" style={{ color: '#1B2B4B' }}>{t('toDate')}</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full sm:w-32 text-xs h-8" style={{ color: '#111827' }} />
        </div>
        <Button onClick={() => setFiltered(true)} className="text-xs h-8 px-3" style={{ backgroundColor: '#1B2B4B' }}>
          {t('apply')}
        </Button>
        {filtered && (
          <Button variant="outline" className="text-xs h-8 px-3" onClick={() => { setDateFrom(''); setDateTo(''); setFiltered(false); }}>
            {t('reset')}
          </Button>
        )}
      </div>

      {/* KPI Year Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium" style={{ color: '#1B2B4B' }}>{isAr ? 'فلترة الإجماليات:' : 'Filter totals:'}</span>
        <button onClick={() => setKpiYearFilter('all')} className="px-3 py-1 text-xs rounded-lg font-medium transition-all"
          style={{ backgroundColor: kpiYearFilter === 'all' ? '#C9A84C' : '#F1F5F9', color: kpiYearFilter === 'all' ? '#fff' : '#111827' }}>
          {isAr ? 'كل السنوات' : 'All Years'}
        </button>
        {(availableYears.length > 0 ? availableYears : [new Date().getFullYear()]).map(y => (
          <button key={y} onClick={() => setKpiYearFilter(String(y))} className="px-3 py-1 text-xs rounded-lg font-medium transition-all"
            style={{ backgroundColor: kpiYearFilter === String(y) ? '#1B2B4B' : '#F1F5F9', color: kpiYearFilter === String(y) ? '#FFFFFF' : '#111827' }}>
            {y}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard title="صافي الدخل" titleEn="Net Income" value={`${fmt(netIncome)} ${currency}`} subtitle={t('revenueMinusExpenses')} icon={TrendingUp} accentColor="navy" delay={0} />
<StatCard title="إجمالي المحصل" titleEn="Total Collected" value={`${fmt(totalCollected)} ${currency}`} subtitle={`${filteredPayments.length} ${t('paymentsCount')}`} icon={CreditCard} accentColor="success" delay={80} href="/payments" />
<StatCard title="إجمالي المصاريف" titleEn="Total Expenses" value={`${fmt(totalExpenses)} ${currency}`} subtitle={`${filteredExpenses.length} ${t('expensesCount')}`} icon={Receipt} accentColor="urgent" delay={160} href="/expenses" />
        <StatCard title="نسبة الإشغال" titleEn="Occupancy Rate" value={`${occupancyRate}%`} subtitle={`${occupiedUnits} / ${units.length}`} icon={Building2} accentColor="gold" delay={240} href="/units"
          extra={<p className="text-xs mt-1 font-medium" style={{ color: occupancyStatusColor }}>{occupancyStatusText()}</p>} />
      </div>

      {/* Charts + Expiring Contracts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-white card-bevel rounded-xl p-3 sm:p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-bold" style={{ color: '#1B2B4B' }}>{t('monthlyRevenueVsExpenses')}</h3>
              <p className="text-xs text-muted-foreground">{yearFilter}</p>
            </div>
            <div className="flex gap-1 flex-wrap">
              {(availableYears.length > 0 ? availableYears : [new Date().getFullYear()]).map(y => (
                <button key={y} onClick={() => setYearFilter(y)} className="px-3 py-1 text-xs rounded-lg font-medium transition-all"
                  style={{ backgroundColor: yearFilter === y ? '#1B2B4B' : '#F1F5F9', color: yearFilter === y ? '#FFFFFF' : '#111827' }}>
                  {y}
                </button>
              ))}
            </div>
          </div>
          {monthlyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyChartData} barGap={4} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'Cairo' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8', fontFamily: 'Cairo' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ fontFamily: 'Cairo', fontSize: 13, border: '1px solid #E2E8F0', borderRadius: 8 }}
                  formatter={(v, name) => [`${v.toLocaleString()} AED`, name === 'revenue' ? t('revenue') : t('totalExpensesR')]} />
                <Legend formatter={v => v === 'revenue' ? t('revenue') : t('totalExpensesR')} wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#1B2B4B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#E63946" radius={[4, 4, 0, 0]} opacity={0.75} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">
              {isAr ? 'لا توجد بيانات لهذا العام' : 'No data for this year'}
            </div>
          )}
        </div>

        <div className="bg-white card-bevel rounded-xl p-3 sm:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <h3 className="font-bold text-sm sm:text-base" style={{ color: '#1B2B4B' }}>{t('expiringContracts')}</h3>
              <p className="text-xs text-muted-foreground">{isAr ? 'عقود قريب الانتهاء' : 'Expiring or expired contracts'}</p>
            </div>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#E63946' }}>
              {expiringContracts.length}
            </span>
          </div>
          {expiringContracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="mb-2" size={32} style={{ color: '#2A9D8F' }} />
              <p className="text-sm text-muted-foreground">{t('noExpiring')}</p>
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2 overflow-y-auto max-h-52 sm:max-h-64">
              {expiringContracts.map((u) => {
                const cat = expCategory(u.daysLeft);
                return (
                  <div key={u.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg border border-border hover:bg-surface transition-colors">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#1B2B4B' }}>{u.tenant_name || `${t('unitLabel')} ${u.unit_number}`}</p>
                      <p className="text-xs text-muted-foreground">{t('unitNumber')} {u.unit_number}</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.bg, color: cat.color }}>
                      {u.daysLeft < 0
                        ? (isAr ? `منتهي ${Math.abs(u.daysLeft)} يوم` : `Expired ${Math.abs(u.daysLeft)}d`)
                        : `${u.daysLeft} ${t('days')}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* Recent Payments */}
      <div className="bg-white card-bevel rounded-xl p-3 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold" style={{ color: '#1B2B4B' }}>{t('recentPayments')}</h3>
            <p className="text-xs text-muted-foreground">{isAr ? 'أحدث الدفعات المسجّلة' : 'Latest recorded payments'}</p>
          </div>
          <Link to="/payments" className="text-xs font-medium hover:underline" style={{ color: '#C9A84C' }}>{t('viewAll')}</Link>
        </div>
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">{t('tenant')}</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">{t('unit')}</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">{t('amount')}</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">{t('paymentDate')}</th>
              </tr>
            </thead>
            <tbody className="table-striped">
              {payments.slice(0, 5).map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-surface transition-colors cursor-pointer" onClick={() => setViewPayment(p)}>
                  <td className="py-2.5 px-3 font-medium" style={{ color: '#1B2B4B' }}>{maskName(p.tenant_name)}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{p.unit_number || '-'}</td>
                  <td className="py-2.5 px-3 font-semibold" style={{ color: '#2A9D8F' }}>{fmt(p.amount || 0)} AED</td>
                  <td className="py-2.5 px-3 text-muted-foreground text-xs">{p.payment_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">{t('noPaymentsRegistered')}</div>}
        </div>
        <div className="md:hidden space-y-1.5">
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">{t('noPaymentsRegistered')}</div>
          ) : payments.slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-surface transition-colors cursor-pointer" onClick={() => setViewPayment(p)}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: '#1B2B4B' }}>{maskName(p.tenant_name)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('unit')}: {p.unit_number || '-'}</p>
              </div>
              <div className="text-left flex-shrink-0">
                <p className="text-sm font-semibold" style={{ color: '#2A9D8F' }}>{fmt(p.amount || 0)} AED</p>
                <p className="text-xs text-muted-foreground">{p.payment_date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="bg-white card-bevel rounded-xl p-3 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold" style={{ color: '#1B2B4B' }}>{isAr ? 'آخر المصروفات' : 'Recent Expenses'}</h3>
            <p className="text-xs text-muted-foreground">{isAr ? 'أحدث المصروفات المسجّلة' : 'Latest recorded expenses'}</p>
          </div>
          <Link to="/expenses" className="text-xs font-medium hover:underline" style={{ color: '#C9A84C' }}>{isAr ? 'عرض الكل' : 'View all'}</Link>
        </div>
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">{isAr ? 'البيان' : 'Description'}</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">{isAr ? 'التصنيف' : 'Category'}</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">{isAr ? 'المبلغ' : 'Amount'}</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">{isAr ? 'التاريخ' : 'Date'}</th>
              </tr>
            </thead>
            <tbody className="table-striped">
              {[...expenses].sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || '')).slice(0, 5).map((e) => (
                <tr key={e.id} className="border-b border-border/50 hover:bg-surface transition-colors cursor-pointer" onClick={() => setViewExpense(e)}>
                  <td className="py-2.5 px-3 font-medium" style={{ color: '#1B2B4B' }}>{e.description}</td>
                  <td className="py-2.5 px-3 text-muted-foreground text-xs">{expCategoryAr[e.category] || e.category || '-'}</td>
                  <td className="py-2.5 px-3 font-semibold" style={{ color: '#E63946' }}>{fmt(e.amount || 0)} AED</td>
                  <td className="py-2.5 px-3 text-muted-foreground text-xs">{e.expense_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {expenses.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">{isAr ? 'لا توجد مصروفات مسجّلة' : 'No expenses registered'}</div>}
        </div>
        <div className="md:hidden space-y-1.5">
          {expenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">{isAr ? 'لا توجد مصروفات مسجّلة' : 'No expenses registered'}</div>
          ) : [...expenses].sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || '')).slice(0, 5).map((e) => (
            <div key={e.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-surface transition-colors cursor-pointer" onClick={() => setViewExpense(e)}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: '#1B2B4B' }}>{e.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{expCategoryAr[e.category] || e.category || '-'}</p>
              </div>
              <div className="text-left flex-shrink-0">
                <p className="text-sm font-semibold" style={{ color: '#E63946' }}>{fmt(e.amount || 0)} AED</p>
                <p className="text-xs text-muted-foreground">{e.expense_date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* View Payment Dialog */}
      <Dialog open={!!viewPayment} onOpenChange={() => setViewPayment(null)}>
        <DialogContent className="max-w-sm font-cairo">
          <DialogHeader>
            <DialogTitle>{isAr ? 'بيانات الدفعة' : 'Payment Details'}</DialogTitle>
          </DialogHeader>
          {viewPayment && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-0.5 col-span-2">
                <p className="text-xs text-muted-foreground">{isAr ? 'اسم المستأجر' : 'Tenant Name'}</p>
                <p className="font-bold text-base" style={{ color: '#1B2B4B' }}>{maskName(viewPayment.tenant_name)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{isAr ? 'رقم الشقة' : 'Unit'}</p>
                <p className="font-medium">{viewPayment.unit_number || '-'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{isAr ? 'المبلغ' : 'Amount'}</p>
                <p className="font-bold" style={{ color: '#2A9D8F' }}>{fmt(viewPayment.amount || 0)} AED</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{isAr ? 'تاريخ الدفع' : 'Payment Date'}</p>
                <p className="font-medium">{viewPayment.payment_date || '-'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{isAr ? 'مستحق لشهر' : 'Due Month'}</p>
                <p className="font-medium">{viewPayment.due_months || '-'}</p>
              </div>
              {viewPayment.notes && (
                <div className="space-y-0.5 col-span-2">
                  <p className="text-xs text-muted-foreground">{isAr ? 'ملاحظات' : 'Notes'}</p>
                  <p className="font-medium">{viewPayment.notes}</p>
                </div>
              )}
              {viewPayment.receipt_image_url && (
                <div className="col-span-2 space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">{isAr ? 'صورة الإيصال' : 'Receipt'}</p>
                  <div className="rounded-lg border border-border overflow-hidden">
                    {viewPayment.receipt_image_url.toLowerCase().endsWith('.pdf') ? (
                      <div className="flex items-center gap-3 p-3 bg-muted">
                        <FileText size={20} style={{ color: '#C9A84C' }} />
                        <a href={viewPayment.receipt_image_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline" style={{ color: '#1B2B4B' }}>{isAr ? 'عرض ملف PDF' : 'View PDF'}</a>
                      </div>
                    ) : (
                      <img src={viewPayment.receipt_image_url} alt="receipt" className="w-full max-h-48 object-contain p-2 bg-muted" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewPayment(null)}>{isAr ? 'إغلاق' : 'Close'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Expense Dialog */}
      <Dialog open={!!viewExpense} onOpenChange={() => setViewExpense(null)}>
        <DialogContent className="max-w-sm font-cairo">
          <DialogHeader>
            <DialogTitle>{isAr ? 'بيانات المصروف' : 'Expense Details'}</DialogTitle>
          </DialogHeader>
          {viewExpense && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-0.5 col-span-2">
                <p className="text-xs text-muted-foreground">{isAr ? 'البيان' : 'Description'}</p>
                <p className="font-bold text-base" style={{ color: '#1B2B4B' }}>{viewExpense.description}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{isAr ? 'المبلغ' : 'Amount'}</p>
                <p className="font-bold" style={{ color: '#E63946' }}>{fmt(viewExpense.amount || 0)} AED</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{isAr ? 'التاريخ' : 'Date'}</p>
                <p className="font-medium">{viewExpense.expense_date || '-'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{isAr ? 'التصنيف' : 'Category'}</p>
                <p className="font-medium">{expCategoryAr[viewExpense.category] || viewExpense.category || '-'}</p>
              </div>
              {viewExpense.vendor && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{isAr ? 'المورد' : 'Vendor'}</p>
                  <p className="font-medium">{viewExpense.vendor}</p>
                </div>
              )}
              {viewExpense.unit_number && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{isAr ? 'رقم الشقة' : 'Unit'}</p>
                  <p className="font-medium">{viewExpense.unit_number}</p>
                </div>
              )}
              {viewExpense.invoice_number && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{isAr ? 'رقم الفاتورة' : 'Invoice No.'}</p>
                  <p className="font-medium">{viewExpense.invoice_number}</p>
                </div>
              )}
              {viewExpense.notes && (
                <div className="space-y-0.5 col-span-2">
                  <p className="text-xs text-muted-foreground">{isAr ? 'ملاحظات' : 'Notes'}</p>
                  <p className="font-medium text-xs">{viewExpense.notes}</p>
                </div>
              )}
              {viewExpense.invoice_image_url && (
                <div className="col-span-2 space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">{isAr ? 'صورة الفاتورة' : 'Invoice'}</p>
                  <div className="rounded-lg border border-border overflow-hidden">
                    {viewExpense.invoice_image_url.toLowerCase().endsWith('.pdf') ? (
                      <div className="flex items-center gap-3 p-3 bg-muted">
                        <FileText size={20} style={{ color: '#C9A84C' }} />
                        <a href={viewExpense.invoice_image_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline" style={{ color: '#1B2B4B' }}>{isAr ? 'عرض ملف PDF' : 'View PDF'}</a>
                      </div>
                    ) : (
                      <a href={viewExpense.invoice_image_url} target="_blank" rel="noopener noreferrer">
                        <img src={viewExpense.invoice_image_url} alt="receipt" className="w-full max-h-48 object-contain p-2 bg-muted hover:opacity-90 transition-opacity" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewExpense(null)}>{isAr ? 'إغلاق' : 'Close'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
