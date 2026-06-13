import { useState, useEffect } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import StatCard from '@/components/StatCard';
import PageHeader from '@/components/PageHeader';
import { Link } from 'react-router-dom';
import { useLang } from '@/lib/LanguageContext';
import {
  TrendingUp, Building2, CreditCard, Receipt,
  CheckCircle2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { differenceInDays, parseISO, isValid, getYear, getMonth } from 'date-fns';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ReDashboard() {
  const [units, setUnits] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const { t, lang } = useLang();

  const MONTHS = lang === 'ar' ? MONTHS_AR : MONTHS_EN;

  useEffect(() => {
    Promise.all([
      base44.entities.ReUnit.list(),
      base44.entities.RePayment.list(),
      base44.entities.ReExpense.list(),
    ]).then(([u, p, e]) => {
      setUnits(u);
      setPayments(p);
      setExpenses(e);
      setLoading(false);
    });
  }, []);

  const totalCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalExpensesSum = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netIncome = totalCollected - totalExpensesSum;
  const fmt = (n) => Number.isInteger(n) ? n.toLocaleString('ar-AE') : n.toLocaleString('ar-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const occupiedUnits = units.filter(u => u.status === 'occupied').length;
  const occupancyRate = units.length ? Math.round((occupiedUnits / units.length) * 100) : 0;

  const expiringContracts = units.filter(u => {
    if (!u.contract_end) return false;
    const d = parseISO(u.contract_end);
    if (!isValid(d)) return false;
    const days = differenceInDays(d, new Date());
    return days >= 0 && days <= 90;
  }).map(u => ({
    ...u,
    daysLeft: differenceInDays(parseISO(u.contract_end), new Date()),
  })).sort((a, b) => a.daysLeft - b.daysLeft);

  // Available years from data
  const availableYears = [...new Set([
    ...payments.map(p => p.payment_date ? getYear(parseISO(p.payment_date)) : null),
    ...expenses.map(e => e.expense_date ? getYear(parseISO(e.expense_date)) : null),
  ].filter(Boolean))].sort((a, b) => b - a);

  // Monthly Revenue vs Expenses for selected year
  const monthlyChartData = MONTHS.map((name, idx) => {
    const revenue = payments
      .filter(p => p.payment_date && isValid(parseISO(p.payment_date)) && getYear(parseISO(p.payment_date)) === yearFilter && getMonth(parseISO(p.payment_date)) === idx)
      .reduce((s, p) => s + (p.amount || 0), 0);
    const exp = expenses
      .filter(e => e.expense_date && isValid(parseISO(e.expense_date)) && getYear(parseISO(e.expense_date)) === yearFilter && getMonth(parseISO(e.expense_date)) === idx)
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
    if (days <= 30) return { color: '#E63946', bg: 'rgba(230,57,70,0.1)' };
    if (days <= 60) return { color: '#F97316', bg: 'rgba(249,115,22,0.1)' };
    return { color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' };
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        titleAr="لوحة التحكم - العقارات"
        titleEn="Real Estate Dashboard"
        description={t('dashSub')}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="صافي الدخل" titleEn="Net Income" value={`${fmt(netIncome)} د.إ`} subtitle={t('revenueMinusExpenses')} icon={TrendingUp} accentColor="navy" delay={0} />
        <StatCard title="إجمالي المحصل" titleEn="Total Collected" value={`${fmt(totalCollected)} د.إ`} subtitle={`${payments.length} ${t('paymentsCount')}`} icon={CreditCard} accentColor="success" delay={80} />
        <StatCard title="إجمالي المصاريف" titleEn="Total Expenses" value={`${fmt(totalExpensesSum)} د.إ`} subtitle={`${expenses.length} ${t('expensesCount')}`} icon={Receipt} accentColor="urgent" delay={160} />
        <StatCard title="نسبة الإشغال" titleEn="Occupancy Rate" value={`${occupancyRate}%`} subtitle={`${occupiedUnits} / ${units.length}`} icon={Building2} accentColor="gold" delay={240} />
      </div>

      {/* Charts + Expiring Contracts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white card-bevel rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-bold" style={{ color: '#1B2B4B' }}>{t('monthlyRevenueVsExpenses')}</h3>
              <p className="text-xs text-muted-foreground">{yearFilter}</p>
            </div>
            {/* Year Filter */}
            <div className="flex gap-1 flex-wrap">
              {(availableYears.length > 0 ? availableYears : [new Date().getFullYear()]).map(y => (
                <button
                  key={y}
                  onClick={() => setYearFilter(y)}
                  className="px-3 py-1 text-xs rounded-lg font-medium transition-all"
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
          {monthlyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyChartData} barGap={4} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B', fontFamily: 'Cairo' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8', fontFamily: 'Cairo' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ fontFamily: 'Cairo', fontSize: 13, border: '1px solid #E2E8F0', borderRadius: 8 }}
                  formatter={(v, name) => [`${v.toLocaleString()} AED`, name === 'revenue' ? t('revenue') : t('totalExpensesR')]}
                />
                <Legend formatter={v => v === 'revenue' ? t('revenue') : t('totalExpensesR')}
                  wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#1B2B4B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#E63946" radius={[4, 4, 0, 0]} opacity={0.75} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">{t('noDataForYear') || 'لا توجد بيانات لهذا العام'}</div>
          )}
        </div>

        <div className="bg-white card-bevel rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold" style={{ color: '#1B2B4B' }}>{t('expiringContracts')}</h3>
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
            <div className="space-y-2 overflow-y-auto max-h-64">
              {expiringContracts.map((u) => {
                const cat = expCategory(u.daysLeft);
                return (
                  <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-surface transition-colors">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#1B2B4B' }}>{u.tenant_name || u.unit_number}</p>
                      <p className="text-xs text-muted-foreground">{t('unitNumber')} {u.unit_number}</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.bg, color: cat.color }}>
                      {u.daysLeft} {t('days')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-white card-bevel rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold" style={{ color: '#1B2B4B' }}>{t('recentPayments')}</h3>
          <Link to="/re-payments" className="text-xs font-medium hover:underline" style={{ color: '#C9A84C' }}>{t('viewAll')}</Link>
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
                <tr key={p.id} className="border-b border-border/50 hover:bg-surface transition-colors">
                  <td className="py-2.5 px-3 font-medium" style={{ color: '#1B2B4B' }}>{p.tenant_name}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{p.unit_number || '-'}</td>
                  <td className="py-2.5 px-3 font-semibold" style={{ color: '#2A9D8F' }}>{fmt(p.amount || 0)} AED</td>
                  <td className="py-2.5 px-3 text-muted-foreground text-xs">{p.payment_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">{t('noPaymentsRegistered')}</div>}
        </div>
        <div className="md:hidden space-y-2">
          {payments.slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: '#1B2B4B' }}>{p.tenant_name}</p>
                <p className="text-xs text-muted-foreground">{t('unit')}: {p.unit_number || '-'}</p>
              </div>
              <div className="text-left flex-shrink-0">
                <p className="text-sm font-semibold" style={{ color: '#2A9D8F' }}>{fmt(p.amount || 0)} AED</p>
                <p className="text-xs text-muted-foreground">{p.payment_date}</p>
              </div>
            </div>
          ))}
          {payments.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">{t('noPaymentsRegistered')}</div>}
        </div>
      </div>
    </div>
  );
}