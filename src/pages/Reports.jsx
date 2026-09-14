import { useState, useEffect } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { useLang } from '@/lib/LanguageContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, DollarSign, Receipt, Percent, PiggyBank, RotateCcw, ShieldCheck, CalendarRange } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { parseISO, getYear } from 'date-fns';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const thisYear = new Date().getFullYear();
const dayOf = (d) => (d ? String(d).slice(0, 10) : '');
const bucketOf = (d) => (d ? String(d).slice(0, 7) : '');

export default function Reports() {
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [recoveries, setRecoveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState(thisYear);
  const [dateFrom, setDateFrom] = useState(`${thisYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${thisYear}-12-31`);
  const [drill, setDrill] = useState(null);
  const { t, lang } = useLang();

  const MONTHS = lang === 'ar' ? MONTHS_AR : MONTHS_EN;

  const catLabels = {
    maintenance: t('maintenance_cat'), salary: t('salary'), utilities: t('utilities'),
    equipment: t('equipment'), cleaning: t('cleaning'), admin: t('admin'),
    marketing: t('marketing'), insurance: t('insurance'), other: t('other_cat')
  };

  useEffect(() => {
    Promise.all([
      base44.entities.Payment.list(),
      base44.entities.Expense.list(),
      base44.entities.Refund.list(),
      base44.entities.DepositDeduction.list(),
    ]).then(([p, e, r, dd]) => {
      setPayments(p);
      setExpenses(e);
      setRefunds((r || []).filter(x => x.property_type === 'qarya'));
      setRecoveries((dd || []).filter(x => x.property_type === 'qarya' && x.destination === 'owner_recovery'));
      setLoading(false);
    });
  }, []);

  const availableYears = [...new Set([
    ...payments.map(p => p.payment_date ? getYear(parseISO(p.payment_date)) : null),
    ...expenses.map(e => e.expense_date ? getYear(parseISO(e.expense_date)) : null),
    ...refunds.map(r => (r.applies_to_date || r.refund_date) ? getYear(parseISO(r.applies_to_date || r.refund_date)) : null),
  ].filter(Boolean))].sort((a, b) => b - a);

  const inRange = (dateStr) => {
    const d = dayOf(dateStr);
    if (!d) return false;
    return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
  };

  const applyYear = (y) => {
    setYearFilter(y);
    setDateFrom(`${y}-01-01`);
    setDateTo(`${y}-12-31`);
  };

  const resetRange = () => applyYear(thisYear);

  const yearPayments = payments.filter(p => inRange(p.payment_date));
  const yearAllExpenses = expenses.filter(e => inRange(e.expense_date));
  const yearExpenses = yearAllExpenses.filter(e => e.category !== 'savings');
  const yearSavings = yearAllExpenses.filter(e => e.category === 'savings');
  const yearRefunds = refunds.filter(r => inRange(r.applies_to_date || r.refund_date));
  const yearRecoveries = recoveries.filter(x => inRange(x.deduction_date));

  const rangeLabel = dateFrom && dateTo && dateFrom === `${yearFilter}-01-01` && dateTo === `${yearFilter}-12-31`
    ? String(yearFilter)
    : `${dateFrom || '…'} → ${dateTo || '…'}`;

  const grossRevenue = yearPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalRefunds = yearRefunds.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalRecovery = yearRecoveries.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const totalRevenue = grossRevenue + totalRecovery - totalRefunds;
  const totalExpenses = yearExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalSavings = yearSavings.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue ? Math.round((netProfit / totalRevenue) * 100) : 0;

  const bucketKeys = [...new Set([
    ...yearPayments.map(p => bucketOf(p.payment_date)),
    ...yearAllExpenses.map(e => bucketOf(e.expense_date)),
    ...yearRefunds.map(r => bucketOf(r.applies_to_date || r.refund_date)),
    ...yearRecoveries.map(x => bucketOf(x.deduction_date)),
  ].filter(Boolean))].sort();

  const spansYears = new Set(bucketKeys.map(k => k.slice(0, 4))).size > 1;

  const bucketLabel = (key) => {
    const m = MONTHS[Number(key.slice(5, 7)) - 1] || key;
    return spansYears ? `${m} ${key.slice(2, 4)}` : m;
  };

  const sumBy = (items, dateKey, key, amountKey = 'amount') =>
    items.filter(x => bucketOf(typeof dateKey === 'function' ? dateKey(x) : x[dateKey]) === key)
      .reduce((s, x) => s + (Number(x[amountKey]) || 0), 0);

  const monthlyData = bucketKeys.map(key => {
    const gross = sumBy(yearPayments, 'payment_date', key);
    const ref = sumBy(yearRefunds, r => r.applies_to_date || r.refund_date, key);
    const rec = sumBy(yearRecoveries, 'deduction_date', key);
    const revenue = gross + rec - ref;
    const exp = sumBy(yearExpenses, 'expense_date', key);
    const sav = sumBy(yearSavings, 'expense_date', key);
    return { key, name: bucketLabel(key), revenue, refunds: ref, expenses: exp, savings: sav, net: revenue - exp };
  });

  const drillRows = (() => {
    if (!drill) return [];
    const key = drill.key;
    const pick = (items, dateKey) => items.filter(x => {
      const d = typeof dateKey === 'function' ? dateKey(x) : x[dateKey];
      return !key || bucketOf(d) === key;
    });
    if (drill.kind === 'revenue') {
      return [
        ...pick(yearPayments, 'payment_date').map(p => ({
          id: `p-${p.id}`, date: dayOf(p.payment_date), sign: 1,
          label: p.tenant_name || '-', sub: `${lang === 'ar' ? 'دفعة' : 'Payment'}${p.unit_number ? ` · ${p.unit_number}` : ''}`,
          amount: Number(p.amount) || 0,
        })),
        ...pick(yearRecoveries, 'deduction_date').map(x => ({
          id: `r-${x.id}`, date: dayOf(x.deduction_date), sign: 1,
          label: x.tenant_name || x.unit_number || '-', sub: lang === 'ar' ? 'استرداد من تأمين' : 'Deposit recovery',
          amount: Number(x.amount) || 0,
        })),
        ...pick(yearRefunds, r => r.applies_to_date || r.refund_date).map(r => ({
          id: `f-${r.id}`, date: dayOf(r.applies_to_date || r.refund_date), sign: -1,
          label: r.tenant_name || r.unit_number || '-', sub: lang === 'ar' ? 'استرجاع' : 'Refund',
          amount: Number(r.amount) || 0,
        })),
      ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    if (drill.kind === 'refunds') {
      return pick(yearRefunds, r => r.applies_to_date || r.refund_date).map(r => ({
        id: `f-${r.id}`, date: dayOf(r.applies_to_date || r.refund_date), sign: -1,
        label: r.tenant_name || r.unit_number || '-', sub: r.reason || (lang === 'ar' ? 'استرجاع' : 'Refund'),
        amount: Number(r.amount) || 0,
      })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    const src = drill.kind === 'savings' ? yearSavings : yearExpenses;
    return pick(src, 'expense_date').map(e => ({
      id: `e-${e.id}`, date: dayOf(e.expense_date), sign: -1,
      label: e.description || '-', sub: `${catLabels[e.category] || e.category || '-'}${e.vendor ? ` · ${e.vendor}` : ''}`,
      amount: Number(e.amount) || 0,
    })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  })();

  const drillTotal = drillRows.reduce((s, r) => s + r.sign * r.amount, 0);

  const drillTitle = !drill ? '' : ({
    revenue: lang === 'ar' ? 'تفاصيل صافي الإيراد' : 'Net revenue details',
    refunds: lang === 'ar' ? 'تفاصيل الاسترجاعات والخصومات' : 'Refunds & deductions',
    expenses: lang === 'ar' ? 'تفاصيل المصاريف' : 'Expense details',
    savings: lang === 'ar' ? 'تفاصيل الادخار' : 'Savings details',
  }[drill.kind] || '');

  const expCatData = Object.entries(
    yearExpenses.reduce((acc, e) => {
      const cat = e.category || 'other';
      acc[cat] = (acc[cat] || 0) + (e.amount || 0);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const PIE_COLORS = ['#1B2B4B', '#C9A84C', '#2A9D8F', '#E63946', '#7C3AED', '#F97316', '#0EA5E9', '#64748B'];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: 'rgba(201,168,76,0.3)', borderTopColor: '#C9A84C' }} />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up ">
      <PageHeader
        titleAr="التقارير المالية"
        titleEn="Financial Reports"
        description={t('reportsSubTitle')}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">{t('year')}:</span>
            <div className="flex gap-1 flex-wrap">
              {[...new Set([thisYear, ...availableYears])].sort((a, b) => b - a).map(y => (
                <button
                  key={y}
                  onClick={() => applyYear(y)}
                  className="px-3 py-1.5 text-sm rounded-lg font-medium transition-all min-h-[44px] sm:min-h-0"
                  style={{
                    backgroundColor: yearFilter === y ? '#1B2B4B' : '#F1F5F9',
                    color: yearFilter === y ? '#FFFFFF' : '#64748B',
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="bg-white card-bevel rounded-xl p-3 sm:p-4 flex flex-wrap items-end gap-2 sm:gap-3">
        <CalendarRange size={16} style={{ color: '#C9A84C' }} className="mt-5 flex-shrink-0" />
        <div className="space-y-0.5 min-w-28">
          <label className="text-[11px] sm:text-xs block" style={{ color: '#1B2B4B' }}>{t('fromDate')}</label>
          <Input type="date" value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setYearFilter(null); }}
            className="w-full sm:w-36 text-base sm:text-xs h-11 sm:h-8" style={{ color: '#111827' }} />
        </div>
        <div className="space-y-0.5 min-w-28">
          <label className="text-[11px] sm:text-xs block" style={{ color: '#1B2B4B' }}>{t('toDate')}</label>
          <Input type="date" value={dateTo}
            onChange={e => { setDateTo(e.target.value); setYearFilter(null); }}
            className="w-full sm:w-36 text-base sm:text-xs h-11 sm:h-8" style={{ color: '#111827' }} />
        </div>
        <Button variant="outline" className="text-xs h-11 sm:h-8 px-3" onClick={resetRange}>
          <RotateCcw size={14} /> {t('reset')}
        </Button>
        <span className="text-xs text-muted-foreground mr-auto self-center">
          {lang === 'ar' ? 'الفترة' : 'Period'}: <span dir="ltr">{rangeLabel}</span>
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard title="صافي الإيراد" titleEn="Net Revenue"
          value={`${totalRevenue.toLocaleString()} AED`}
          subtitle={totalRecovery > 0
            ? `${grossRevenue.toLocaleString()} + ${totalRecovery.toLocaleString()} − ${totalRefunds.toLocaleString()}`
            : `${grossRevenue.toLocaleString()} − ${totalRefunds.toLocaleString()}`}
          icon={TrendingUp} accentColor="navy" delay={0}
          onClick={() => setDrill({ kind: 'revenue' })} />
        <StatCard title="الاسترجاعات والخصومات" titleEn="Refunds & Deductions"
          value={`${totalRefunds.toLocaleString()} AED`}
          subtitle={`${yearRefunds.length}`}
          icon={RotateCcw} accentColor="gold" delay={40}
          onClick={() => setDrill({ kind: 'refunds' })} />
        <StatCard title="إجمالي المصاريف" titleEn="Total Expenses"
          value={`${totalExpenses.toLocaleString()} AED`}
          subtitle={`${yearExpenses.length}`}
          icon={Receipt} accentColor="urgent" delay={80}
          onClick={() => setDrill({ kind: 'expenses' })} />
        <StatCard title="صافي الربح" titleEn="Net Profit"
          value={`${netProfit.toLocaleString()} AED`}
          subtitle={lang === 'ar' ? 'صافي الإيراد − المصاريف' : 'Net revenue − expenses'}
          icon={DollarSign} accentColor="success" delay={160} />
        <StatCard title="هامش الربح" titleEn="Profit Margin"
          value={`${profitMargin}%`}
          subtitle=""
          icon={Percent} accentColor="gold" delay={240} />
      </div>

      <button type="button" onClick={() => setDrill({ kind: 'savings' })}
        className="bg-white card-bevel rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap w-full text-right hover:opacity-90 transition-opacity cursor-pointer min-h-[44px]">
        <div className="flex items-center gap-2">
          <PiggyBank size={18} style={{ color: '#059669' }} />
          <span className="text-sm font-bold" style={{ color: '#1B2B4B' }}>{lang === 'ar' ? 'الادخار' : 'Savings'}</span>
          <span className="text-[11px] text-muted-foreground">{lang === 'ar' ? 'غير محتسب ضمن المصاريف ولا يؤثر على هامش الربح' : 'Excluded from expenses — does not affect profit margin'}</span>
        </div>
        <span className="text-lg font-bold" style={{ color: '#059669' }}>{totalSavings.toLocaleString()} AED</span>
      </button>

      {totalRecovery > 0 && (
        <div className="bg-white card-bevel rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} style={{ color: '#2A9D8F' }} />
            <span className="text-sm font-bold" style={{ color: '#1B2B4B' }}>
              {lang === 'ar' ? 'استردادات من التأمينات' : 'Recovered from deposits'}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {lang === 'ar'
                ? 'مبالغ خُصمت من تأمين المستأجر لتغطية مصاريف دفعها المالك — تُضاف إلى الإيراد'
                : 'Deducted from tenant deposits against owner-paid costs — added to revenue'}
            </span>
          </div>
          <span className="text-lg font-bold" style={{ color: '#2A9D8F' }}>+ {totalRecovery.toLocaleString()} AED</span>
        </div>
      )}

      {/* Monthly Revenue vs Expenses */}
      <div className="bg-white card-bevel rounded-xl p-5">
        <div className="mb-4">
          <h3 className="font-bold" style={{ color: '#1B2B4B' }}>{t('monthlyRevenueVsExpenses')}</h3>
          <p className="text-xs text-muted-foreground">
            {lang === 'ar' ? 'اضغط أي عمود لعرض حركاته' : 'Tap any bar to list its entries'} — <span dir="ltr">{rangeLabel}</span>
          </p>
        </div>
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData} barGap={4} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B', fontFamily: 'Cairo' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ fontFamily: 'Cairo', fontSize: 13, border: '1px solid #E2E8F0', borderRadius: 8 }}
                formatter={(v, name) => [
                  `${v.toLocaleString()} AED`,
                  name === 'revenue' ? t('revenue') : name === 'expenses' ? t('totalExpensesR') : name === 'savings' ? (lang === 'ar' ? 'الادخار' : 'Savings') : t('net')
                ]}
              />
              <Legend formatter={v => ({ revenue: t('revenue'), expenses: t('totalExpensesR'), savings: (lang === 'ar' ? 'الادخار' : 'Savings'), net: t('net') }[v] || v)}
                wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#1B2B4B" radius={[4, 4, 0, 0]} cursor="pointer"
                onClick={d => setDrill({ kind: 'revenue', key: d?.payload?.key || d?.key })} />
              <Bar dataKey="expenses" fill="#E63946" radius={[4, 4, 0, 0]} opacity={0.7} cursor="pointer"
                onClick={d => setDrill({ kind: 'expenses', key: d?.payload?.key || d?.key })} />
              <Bar dataKey="savings" fill="#059669" radius={[4, 4, 0, 0]} opacity={0.75} cursor="pointer"
                onClick={d => setDrill({ kind: 'savings', key: d?.payload?.key || d?.key })} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            {t('noDataForYear')}
          </div>
        )}
      </div>

      {/* Net Profit Line + Expense Pie */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white card-bevel rounded-xl p-5">
          <div className="mb-4">
            <h3 className="font-bold" style={{ color: '#1B2B4B' }}>{t('monthlyNetProfit')}</h3>
            <p className="text-xs text-muted-foreground">{t('monthlyNetProfitSub')}</p>
          </div>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8', fontFamily: 'Cairo' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ fontFamily: 'Cairo', fontSize: 13, border: '1px solid #E2E8F0', borderRadius: 8 }}
                  formatter={(v) => [`${v.toLocaleString()} AED`, t('net')]}
                />
                <Line type="monotone" dataKey="net" stroke="#C9A84C" strokeWidth={2.5} dot={{ fill: '#C9A84C', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">{t('noData')}</div>
          )}
        </div>

        <div className="bg-white card-bevel rounded-xl p-5">
          <div className="mb-4">
            <h3 className="font-bold" style={{ color: '#1B2B4B' }}>{t('expenseByCategory')}</h3>
            <p className="text-xs text-muted-foreground">{t('expenseCategorySub')}</p>
          </div>
          {expCatData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={expCatData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({ name, percent }) => `${catLabels[name] || name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  style={{ fontSize: 11, fontFamily: 'Cairo' }}>
                  {expCatData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontFamily: 'Cairo', fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 8 }}
                  formatter={(v, name) => [`${v.toLocaleString()} AED`, catLabels[name] || name]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">{t('noExpenseData')}</div>
          )}
        </div>
      </div>

      {/* Summary Table - Desktop */}
      <div className="bg-white card-bevel rounded-xl p-5 hidden md:block">
        <div className="mb-4">
          <h3 className="font-bold" style={{ color: '#1B2B4B' }}>{t('monthlyFinancialSummary')}</h3>
          <p className="text-xs text-muted-foreground">{t('monthlyFinancialSummary')} — {yearFilter}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {[t('month'), t('revenue'), t('totalExpensesR'), (lang === 'ar' ? 'الادخار' : 'Savings'), t('net'), t('margin')].map(h => (
                  <th key={h} className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((m, i) => {
                const margin = m.revenue ? Math.round((m.net / m.revenue) * 100) : 0;
                return (
                  <tr key={m.name} className={`border-b border-border/50 ${i % 2 === 1 ? 'bg-[#F8F9FA]' : ''}`}>
                    <td className="py-2.5 px-3 font-medium" style={{ color: '#1B2B4B' }}>{m.name}</td>
                    <td className="py-2.5 px-3 font-semibold" style={{ color: '#2A9D8F' }}>{m.revenue.toLocaleString()} AED</td>
                    <td className="py-2.5 px-3 font-semibold" style={{ color: '#E63946' }}>{m.expenses.toLocaleString()} AED</td>
                    <td className="py-2.5 px-3 font-semibold" style={{ color: '#059669' }}>{(m.savings || 0).toLocaleString()} AED</td>
                    <td className="py-2.5 px-3 font-bold" style={{ color: m.net >= 0 ? '#2A9D8F' : '#E63946' }}>
                      {m.net.toLocaleString()} AED
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: margin >= 50 ? 'rgba(42,157,143,0.1)' : margin >= 0 ? 'rgba(201,168,76,0.1)' : 'rgba(230,57,70,0.1)',
                          color: margin >= 50 ? '#2A9D8F' : margin >= 0 ? '#C9A84C' : '#E63946'
                        }}>
                        {margin}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border" style={{ backgroundColor: '#F8F9FA' }}>
                <td className="py-3 px-3 font-bold" style={{ color: '#1B2B4B' }}>{t('totalRow')}</td>
                <td className="py-3 px-3 font-bold" style={{ color: '#2A9D8F' }}>{totalRevenue.toLocaleString()} AED</td>
                <td className="py-3 px-3 font-bold" style={{ color: '#E63946' }}>{totalExpenses.toLocaleString()} AED</td>
                <td className="py-3 px-3 font-bold" style={{ color: '#059669' }}>{totalSavings.toLocaleString()} AED</td>
                <td className="py-3 px-3 font-bold text-xl" style={{ color: netProfit >= 0 ? '#2A9D8F' : '#E63946' }}>
                  {netProfit.toLocaleString()} AED
                </td>
                <td className="py-3 px-3 font-bold">{profitMargin}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary Cards - Mobile */}
      <div className="md:hidden space-y-3">
        {monthlyData.map((m, i) => {
          const margin = m.revenue ? Math.round((m.net / m.revenue) * 100) : 0;
          return (
            <div key={m.name} className="bg-white card-bevel rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-base" style={{ color: '#1B2B4B' }}>{m.name}</h4>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: margin >= 50 ? 'rgba(42,157,143,0.1)' : margin >= 0 ? 'rgba(201,168,76,0.1)' : 'rgba(230,57,70,0.1)',
                    color: margin >= 50 ? '#2A9D8F' : margin >= 0 ? '#C9A84C' : '#E63946'
                  }}>
                  {margin}% {t('margin')}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('revenue')}</span>
                  <span className="font-semibold" style={{ color: '#2A9D8F' }}>{m.revenue.toLocaleString()} AED</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('totalExpensesR')}</span>
                  <span className="font-semibold" style={{ color: '#E63946' }}>{m.expenses.toLocaleString()} AED</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{lang === 'ar' ? 'الادخار' : 'Savings'}</span>
                  <span className="font-semibold" style={{ color: '#059669' }}>{(m.savings || 0).toLocaleString()} AED</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('net')}</span>
                  <span className="font-bold" style={{ color: m.net >= 0 ? '#2A9D8F' : '#E63946' }}>{m.net.toLocaleString()} AED</span>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Total Summary Card */}
        <div className="bg-[#F8F9FA] card-bevel rounded-xl p-4">
          <h4 className="font-bold text-base mb-3" style={{ color: '#1B2B4B' }}>{t('totalRow')}</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('revenue')}</span>
              <span className="font-bold" style={{ color: '#2A9D8F' }}>{totalRevenue.toLocaleString()} AED</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('totalExpensesR')}</span>
              <span className="font-bold" style={{ color: '#E63946' }}>{totalExpenses.toLocaleString()} AED</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{lang === 'ar' ? 'الادخار' : 'Savings'}</span>
              <span className="font-bold" style={{ color: '#059669' }}>{totalSavings.toLocaleString()} AED</span>
            </div>
            <div className="flex items-center justify-between text-base">
              <span className="text-muted-foreground">{t('net')}</span>
              <span className="font-bold text-lg" style={{ color: netProfit >= 0 ? '#2A9D8F' : '#E63946' }}>
                {netProfit.toLocaleString()} AED
              </span>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!drill} onOpenChange={() => setDrill(null)}>
        <DialogContent className="max-w-2xl font-cairo max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: '#1B2B4B' }}>{drillTitle}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              <span dir="ltr">{drill?.key ? bucketLabel(drill.key) : rangeLabel}</span> · {drillRows.length} {lang === 'ar' ? 'حركة' : 'entries'}
            </p>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] lg:text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground text-xs">
                  <th className="text-right px-2.5 lg:px-4 py-2 font-medium whitespace-nowrap">{t('date')}</th>
                  <th className="text-right px-2.5 lg:px-4 py-2 font-medium">{lang === 'ar' ? 'البيان' : 'Description'}</th>
                  <th className="text-right px-2.5 lg:px-4 py-2 font-medium">{lang === 'ar' ? 'التفاصيل' : 'Details'}</th>
                  <th className="text-right px-2.5 lg:px-4 py-2 font-medium whitespace-nowrap">{t('amount')}</th>
                </tr>
              </thead>
              <tbody>
                {drillRows.map((r, i) => (
                  <tr key={r.id} className={`border-t border-border/50 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                    <td className="px-2.5 lg:px-4 py-2.5 text-muted-foreground whitespace-nowrap" dir="ltr">{r.date || '—'}</td>
                    <td className="px-2.5 lg:px-4 py-2.5 font-medium" style={{ color: '#1B2B4B' }}>{r.label}</td>
                    <td className="px-2.5 lg:px-4 py-2.5 text-muted-foreground">{r.sub}</td>
                    <td className="px-2.5 lg:px-4 py-2.5 font-bold whitespace-nowrap"
                      style={{ color: r.sign > 0 ? '#2A9D8F' : '#E63946' }}>
                      {r.sign > 0 ? '' : '− '}{r.amount.toLocaleString()} AED
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30 font-bold">
                  <td className="px-2.5 lg:px-4 py-2.5 whitespace-nowrap" style={{ color: '#1B2B4B' }} colSpan={3}>
                    {lang === 'ar' ? 'الإجمالي' : 'Total'}
                  </td>
                  <td className="px-2.5 lg:px-4 py-2.5 whitespace-nowrap"
                    style={{ color: drillTotal >= 0 ? '#2A9D8F' : '#E63946' }}>
                    {drillTotal.toLocaleString()} AED
                  </td>
                </tr>
              </tfoot>
            </table>
            {drillRows.length === 0 && (
              <p className="text-center text-muted-foreground py-10 text-sm">
                {lang === 'ar' ? 'لا توجد حركات في هذه الفترة' : 'No entries in this period'}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}