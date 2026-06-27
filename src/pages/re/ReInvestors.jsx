import { useState, useEffect } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import { useLang } from '@/lib/LanguageContext';
import { Users, DollarSign, TrendingUp, Percent, CalendarRange, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const thisYear = new Date().getFullYear();

export default function ReInvestors() {
  const [investors, setInvestors] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const { t, lang } = useLang();

  const categoryLabels = {
    maintenance: t('maintenance_cat'), salary: t('salary'), utilities: t('utilities'),
    equipment: t('equipment'), cleaning: t('cleaning'), admin: t('admin'),
    marketing: t('marketing'), insurance: t('insurance'), savings: t('savings_cat'), other: t('other_cat')
  };
  const paymentMethodLabels = { cash: t('cash'), bank_transfer: t('bank_transfer'), cheque: t('cheque'), other: t('other') };

  useEffect(() => {
    Promise.all([
      base44.entities.ReInvestor.list(),
      base44.entities.RePayment.list(),
      base44.entities.ReExpense.list(),
    ]).then(([inv, pay, exp]) => { setInvestors(inv); setPayments(pay); setExpenses(exp); setLoading(false); });
  }, []);

  const inRange = (dateStr) => {
    if (!dateStr) return false;
    return (!dateFrom || dateStr >= dateFrom) && (!dateTo || dateStr <= dateTo);
  };

  const totalRevenue = payments.filter(p => p.status === 'paid' && inRange(p.payment_date)).reduce((s, p) => s + (p.amount || 0), 0);
  const totalExpenses = expenses.filter(e => inRange(e.expense_date)).reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const totalShares = investors.reduce((s, i) => s + (i.share_percentage || 0), 0);
  const fmt = (n) => Number.isInteger(n) ? n.toLocaleString('ar-AE') : n.toLocaleString('ar-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const filteredPayments = payments.filter(p => p.status === 'paid' && inRange(p.payment_date));
  const filteredExpenses = expenses.filter(e => inRange(e.expense_date));
  const resetFilter = () => { setDateFrom(''); setDateTo(''); setSelectedYear(''); };
  const applyYearFilter = (year) => { setSelectedYear(year); setDateFrom(`${year}-01-01`); setDateTo(`${year}-12-31`); };
  const formatDateAr = (d) => d ? new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-US') : '';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(201,168,76,0.3)', borderTopColor: '#C9A84C' }} />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{t('investorsTitle')} — العقارات</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real Estate Investors & Profit Distribution</p>
        </div>
      </div>

      <div className="bg-white rounded-xl card-bevel p-4 flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#1B2B4B' }}>
          <CalendarRange size={18} style={{ color: '#C9A84C' }} />
          <span>{t('filterByDate')}</span>
        </div>
        <div className="flex flex-wrap items-end gap-3 flex-1">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{t('year')}</label>
            <select value={selectedYear} onChange={e => applyYearFilter(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">-- {t('selectYear')} --</option>
              {[thisYear, thisYear - 1, thisYear - 2, thisYear - 3].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{t('fromDate')}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{t('toDate')}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <button onClick={resetFilter} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input text-sm text-muted-foreground hover:bg-muted transition-colors">
            <RotateCcw size={14} />{t('reset')}
          </button>
        </div>
        {(dateFrom || dateTo) && <div className="text-xs text-muted-foreground self-end pb-2">{formatDateAr(dateFrom)} — {formatDateAr(dateTo)}</div>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button onClick={() => setModal('revenue')} className="bg-white rounded-xl card-bevel p-4 flex items-center gap-4 hover:shadow-md transition-shadow text-right w-full cursor-pointer">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EBF3FF' }}>
            <DollarSign size={20} style={{ color: '#1B2B4B' }} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('totalRevenueI')}</p>
            <p className="text-lg font-bold" style={{ color: '#1B2B4B' }}>{fmt(totalRevenue)} AED</p>
            <p className="text-xs text-muted-foreground mt-0.5">{filteredPayments.length} — {t('clickForDetails')}</p>
          </div>
        </button>
        <button onClick={() => setModal('expenses')} className="bg-white rounded-xl card-bevel p-4 flex items-center gap-4 hover:shadow-md transition-shadow text-right w-full cursor-pointer">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFF3F3' }}>
            <TrendingUp size={20} style={{ color: '#E63946' }} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('totalExpensesI')}</p>
            <p className="text-lg font-bold" style={{ color: '#E63946' }}>{fmt(totalExpenses)} AED</p>
            <p className="text-xs text-muted-foreground mt-0.5">{filteredExpenses.length} — {t('clickForDetails')}</p>
          </div>
        </button>
        <button onClick={() => setModal('profit')} className="bg-white rounded-xl card-bevel p-4 flex items-center gap-4 hover:shadow-md transition-shadow text-right w-full cursor-pointer">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F0FBF9' }}>
            <Percent size={20} style={{ color: '#2A9D8F' }} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('netProfitI')}</p>
            <p className="text-lg font-bold" style={{ color: '#2A9D8F' }}>{fmt(netProfit)} AED</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('clickForDetails')}</p>
          </div>
        </button>
      </div>

      <Dialog open={modal === 'revenue'} onOpenChange={() => setModal(null)}>
        <DialogContent className=" max-h-[80vh] overflow-y-auto mx-auto">
          <DialogHeader className="mb-4 text-center">
            <DialogTitle className="text-center text-xl" style={{ color: '#1B2B4B' }}>{t('revenueDetails')}</DialogTitle>
            <p className="text-center text-2xl font-bold text-green-700 mt-2">{fmt(totalRevenue)} AED</p>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/40 text-muted-foreground text-xs">
                <th className="text-right px-3 py-2 font-medium">{t('tenant')}</th>
                <th className="text-right px-3 py-2 font-medium">{t('unitNumber')}</th>
                <th className="text-right px-3 py-2 font-medium">{t('amount')}</th>
                <th className="text-right px-3 py-2 font-medium">{t('date')}</th>
                <th className="text-right px-3 py-2 font-medium">{t('paymentMethod')}</th>
              </tr></thead>
              <tbody>
                {filteredPayments.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || '')).map((p, i) => (
                  <tr key={p.id} className={`border-t border-border/50 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                    <td className="px-3 py-2.5 font-medium" style={{ color: '#1B2B4B' }}>{p.tenant_name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.unit_number || '—'}</td>
                    <td className="px-3 py-2.5 font-bold text-green-700">{fmt(p.amount || 0)} AED</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{paymentMethodLabels[p.payment_method] || p.payment_method}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-border bg-muted/30 font-bold">
                <td colSpan={2} className="px-3 py-2.5" style={{ color: '#1B2B4B' }}>{t('subTotal')} ({filteredPayments.length})</td>
                <td className="px-3 py-2.5 text-green-700">{fmt(totalRevenue)} AED</td>
                <td colSpan={2} />
              </tr></tfoot>
            </table>
            {filteredPayments.length === 0 && <p className="text-center text-muted-foreground py-8">{t('noPaymentsPeriod')}</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'expenses'} onOpenChange={() => setModal(null)}>
        <DialogContent className=" max-h-[80vh] overflow-y-auto mx-auto">
          <DialogHeader className="mb-4 text-center">
            <DialogTitle className="text-center text-xl" style={{ color: '#1B2B4B' }}>{t('expensesDetails')}</DialogTitle>
            <p className="text-center text-2xl font-bold text-red-600 mt-2">{fmt(totalExpenses)} AED</p>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/40 text-muted-foreground text-xs">
                <th className="text-right px-3 py-2 font-medium">{t('description_col')}</th>
                <th className="text-right px-3 py-2 font-medium">{t('category')}</th>
                <th className="text-right px-3 py-2 font-medium">{t('amount')}</th>
                <th className="text-right px-3 py-2 font-medium">{t('date')}</th>
                <th className="text-right px-3 py-2 font-medium">{t('vendor')}</th>
              </tr></thead>
              <tbody>
                {filteredExpenses.sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || '')).map((e, i) => (
                  <tr key={e.id} className={`border-t border-border/50 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                    <td className="px-3 py-2.5 font-medium" style={{ color: '#1B2B4B' }}>{e.description}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{categoryLabels[e.category] || e.category || '—'}</td>
                    <td className="px-3 py-2.5 font-bold text-red-600">{fmt(e.amount || 0)} AED</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{e.expense_date ? new Date(e.expense_date).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{e.vendor || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-border bg-muted/30 font-bold">
                <td colSpan={2} className="px-3 py-2.5" style={{ color: '#1B2B4B' }}>{t('subTotal')} ({filteredExpenses.length})</td>
                <td className="px-3 py-2.5 text-red-600">{fmt(totalExpenses)} AED</td>
                <td colSpan={2} />
              </tr></tfoot>
            </table>
            {filteredExpenses.length === 0 && <p className="text-center text-muted-foreground py-8">{t('noExpensesPeriod')}</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'profit'} onOpenChange={() => setModal(null)}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader className="mb-4 text-center">
            <DialogTitle className="text-center text-xl" style={{ color: '#1B2B4B' }}>{t('profitSummary')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: '#F0F7FF' }}>
              <span className="text-sm font-medium" style={{ color: '#1B2B4B' }}>{t('totalRevenueI')}</span>
              <span className="font-bold text-green-700">{fmt(totalRevenue)} AED</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: '#FFF5F5' }}>
              <span className="text-sm font-medium" style={{ color: '#1B2B4B' }}>{t('totalExpensesI')}</span>
              <span className="font-bold text-red-600">- {fmt(totalExpenses)} AED</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg border-2" style={{ backgroundColor: '#F0FBF9', borderColor: '#2A9D8F' }}>
              <span className="text-sm font-bold" style={{ color: '#1B2B4B' }}>{t('netProfitI')}</span>
              <span className="font-bold text-lg" style={{ color: netProfit >= 0 ? '#2A9D8F' : '#E63946' }}>{fmt(netProfit)} AED</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="bg-white rounded-xl card-bevel overflow-hidden hidden md:block">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Users size={18} style={{ color: '#C9A84C' }} />
          <h2 className="font-semibold" style={{ color: '#1B2B4B' }}>{t('investorShares')}</h2>
          <span className="text-xs text-muted-foreground mr-auto">{t('totalShares')}: {totalShares.toFixed(2)}%</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/40 text-muted-foreground text-xs">
              <th className="text-right px-5 py-3 font-medium">{t('investorName')}</th>
              <th className="text-right px-5 py-3 font-medium">{t('sharePct')}</th>
              <th className="text-right px-5 py-3 font-medium">{t('revShare')}</th>
              <th className="text-right px-5 py-3 font-medium">{t('expShare')}</th>
              <th className="text-right px-5 py-3 font-medium">{t('netShare')}</th>
            </tr></thead>
            <tbody>
              {investors.sort((a, b) => b.share_percentage - a.share_percentage).map((inv, i) => {
                const pct = inv.share_percentage / 100;
                return (
                  <tr key={inv.id} className={`border-t border-border/50 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                    <td className="px-5 py-3.5 font-medium" style={{ color: '#1B2B4B' }}>{inv.name}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#FFF8E7', color: '#C9A84C' }}>{inv.share_percentage}%</span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-green-700">{fmt(totalRevenue * pct)} AED</td>
                    <td className="px-5 py-3.5 text-red-600">{fmt(totalExpenses * pct)} AED</td>
                    <td className="px-5 py-3.5 font-bold" style={{ color: (netProfit * pct) >= 0 ? '#2A9D8F' : '#E63946' }}>{fmt(netProfit * pct)} AED</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {investors.sort((a, b) => b.share_percentage - a.share_percentage).map((inv) => {
          const pct = inv.share_percentage / 100;
          return (
            <div key={inv.id} className="bg-white rounded-xl card-bevel p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold" style={{ color: '#1B2B4B' }}>{inv.name}</h3>
                <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: '#FFF8E7', color: '#C9A84C' }}>{inv.share_percentage}%</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('revShare')}</span><span className="font-medium text-green-700">{fmt(totalRevenue * pct)} AED</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('expShare')}</span><span className="font-medium text-red-600">{fmt(totalExpenses * pct)} AED</span></div>
                <div className="flex justify-between text-base pt-2 border-t border-border">
                  <span className="text-muted-foreground">{t('netShare')}</span>
                  <span className="font-bold" style={{ color: (netProfit * pct) >= 0 ? '#2A9D8F' : '#E63946' }}>{fmt(netProfit * pct)} AED</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}