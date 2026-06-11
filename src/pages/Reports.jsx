import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { useLang } from '@/lib/LanguageContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, DollarSign, Receipt, Percent } from 'lucide-react';
import { parseISO, isValid, getYear, getMonth } from 'date-fns';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Reports() {
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
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
    ]).then(([p, e]) => {
      setPayments(p);
      setExpenses(e);
      setLoading(false);
    });
  }, []);

  const availableYears = [...new Set([
    ...payments.map(p => p.payment_date ? getYear(parseISO(p.payment_date)) : null),
    ...expenses.map(e => e.expense_date ? getYear(parseISO(e.expense_date)) : null),
  ].filter(Boolean))].sort((a, b) => b - a);

  const filterByYear = (items, dateKey) =>
    items.filter(item => {
      if (!item[dateKey]) return false;
      const d = parseISO(item[dateKey]);
      return isValid(d) && getYear(d) === yearFilter;
    });

  const yearPayments = filterByYear(payments, 'payment_date');
  const yearExpenses = filterByYear(expenses, 'expense_date');

  const totalRevenue = yearPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalExpenses = yearExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue ? Math.round((netProfit / totalRevenue) * 100) : 0;

  const monthlyData = MONTHS.map((name, idx) => {
    const revenue = yearPayments
      .filter(p => getMonth(parseISO(p.payment_date)) === idx)
      .reduce((s, p) => s + (p.amount || 0), 0);
    const exp = yearExpenses
      .filter(e => getMonth(parseISO(e.expense_date)) === idx)
      .reduce((s, e) => s + (e.amount || 0), 0);
    return { name, revenue, expenses: exp, net: revenue - exp };
  }).filter(m => m.revenue > 0 || m.expenses > 0);

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
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        titleAr="التقارير المالية"
        titleEn="Financial Reports"
        description={t('reportsSubTitle')}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('year')}:</span>
            <div className="flex gap-1">
              {(availableYears.length > 0 ? availableYears : [new Date().getFullYear()]).map(y => (
                <button
                  key={y}
                  onClick={() => setYearFilter(y)}
                  className="px-3 py-1.5 text-sm rounded-lg font-medium transition-all"
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="إجمالي الإيرادات" titleEn="Total Revenue"
          value={`${totalRevenue.toLocaleString()} AED`}
          subtitle={`${yearPayments.length}`}
          icon={TrendingUp} accentColor="navy" delay={0} />
        <StatCard title="إجمالي المصاريف" titleEn="Total Expenses"
          value={`${totalExpenses.toLocaleString()} AED`}
          subtitle={`${yearExpenses.length}`}
          icon={Receipt} accentColor="urgent" delay={80} />
        <StatCard title="صافي الربح" titleEn="Net Profit"
          value={`${netProfit.toLocaleString()} AED`}
          subtitle={t('revenueMinusExpenses')}
          icon={DollarSign} accentColor="success" delay={160} />
        <StatCard title="هامش الربح" titleEn="Profit Margin"
          value={`${profitMargin}%`}
          subtitle=""
          icon={Percent} accentColor="gold" delay={240} />
      </div>

      {/* Monthly Revenue vs Expenses */}
      <div className="bg-white card-bevel rounded-xl p-5">
        <div className="mb-4">
          <h3 className="font-bold" style={{ color: '#1B2B4B' }}>{t('monthlyRevenueVsExpenses')}</h3>
          <p className="text-xs text-muted-foreground">{t('monthlyRevenueVsExpenses')} — {yearFilter}</p>
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
                  name === 'revenue' ? t('revenue') : name === 'expenses' ? t('totalExpensesR') : t('net')
                ]}
              />
              <Legend formatter={v => ({ revenue: t('revenue'), expenses: t('totalExpensesR'), net: t('net') }[v] || v)}
                wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#1B2B4B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#E63946" radius={[4, 4, 0, 0]} opacity={0.7} />
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
                {[t('month'), t('revenue'), t('totalExpensesR'), t('net'), t('margin')].map(h => (
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
            <div className="flex items-center justify-between text-base">
              <span className="text-muted-foreground">{t('net')}</span>
              <span className="font-bold text-lg" style={{ color: netProfit >= 0 ? '#2A9D8F' : '#E63946' }}>
                {netProfit.toLocaleString()} AED
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}