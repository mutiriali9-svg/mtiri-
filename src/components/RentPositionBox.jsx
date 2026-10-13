import { Button } from '@/components/ui/button';
import { formatDueMonths, monthLabel } from '@/utils/dueMonths';

const money = (n, isAr) => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString()} ${isAr ? 'د.إ' : 'AED'}`;

function Row({ label, sub, value, color = '#1B2B4B', bold = false, strike = false }) {
  return (
    <div className="flex items-start justify-between gap-2 text-[11px]">
      <span className="min-w-0 leading-relaxed" style={{ color: bold ? '#1B2B4B' : '#64748B' }}>
        <span className={bold ? 'font-bold' : undefined}>{label}</span>
        {sub && <span className="block text-[10px]" style={{ color: '#94A3B8' }}>{sub}</span>}
      </span>
      <span className={`shrink-0 ${bold ? 'font-bold text-xs' : 'font-medium'}`}
        style={{ color, textDecoration: strike ? 'line-through' : undefined }}>{value}</span>
    </div>
  );
}

export default function RentPositionBox({ pos, isAr, deposit = 0, confirmed = false, onConfirm }) {
  if (!pos?.ok) return null;
  const list = (keys) => formatDueMonths({ months: keys }, isAr);
  const rate = `${money(pos.monthly, isAr)} ÷ ${pos.daysInExitMonth}`;
  const askGaps = pos.gaps.length > 0 && pos.unknown.length > 0;

  return (
    <div className="space-y-2">
      <div className="rounded-xl p-3 space-y-1.5"
        style={{ backgroundColor: 'rgba(27,43,75,0.04)', border: '1px solid rgba(27,43,75,0.12)' }}>
        <p className="text-xs font-bold" style={{ color: '#1B2B4B' }}>
          {isAr ? 'حساب الإيجار حتى تاريخ الخروج' : 'Rent up to the exit date'}
        </p>
        <Row label={isAr ? 'مسدَّد حتى' : 'Paid up to'} value={monthLabel(pos.paidTo, isAr)} />
        {pos.gaps.length > 0 && (
          <Row label={isAr ? `أشهر غير مسدَّدة: ${list(pos.gaps)}` : `Unpaid months: ${list(pos.gaps)}`}
            sub={pos.gapsConfirmed ? (isAr ? 'اعتُبرت مسدَّدة بتأكيدك' : 'Counted as paid on your confirmation') : null}
            value={money(pos.gapsTotal, isAr)} color={pos.gapsConfirmed ? '#94A3B8' : '#E63946'} strike={pos.gapsConfirmed} />
        )}
        {pos.exitOwed && (
          <Row label={isAr ? `${monthLabel(pos.exitOwed.key, true)} غير مدفوع` : `${monthLabel(pos.exitOwed.key, false)} unpaid`}
            sub={isAr ? `أيام السكن فيه ${pos.exitOwed.days} × (${rate})` : `Days lived ${pos.exitOwed.days} × (${rate})`}
            value={money(pos.exitOwed.amount, isAr)} color="#E63946" />
        )}
        {pos.exitCredit && pos.exitCredit.days > 0 && (
          <Row label={isAr ? `${monthLabel(pos.exitCredit.key, true)} مدفوع` : `${monthLabel(pos.exitCredit.key, false)} paid`}
            sub={isAr ? `أيامه بعد الخروج ${pos.exitCredit.days} × (${rate})` : `Days after the exit ${pos.exitCredit.days} × (${rate})`}
            value={money(pos.exitCredit.amount, isAr)} color="#2A9D8F" />
        )}
        {pos.ahead.length > 0 && (
          <Row label={isAr ? `أشهر مدفوعة بعد الخروج: ${list(pos.ahead.map(a => a.key))}` : `Months paid after the exit: ${list(pos.ahead.map(a => a.key))}`}
            value={money(pos.aheadTotal, isAr)} color="#2A9D8F" />
        )}
        {deposit > 0 && <Row label={isAr ? 'تأمين محفوظ' : 'Deposit held'} value={money(deposit, isAr)} color="#2A9D8F" />}
        <div className="pt-1 mt-1 border-t space-y-1" style={{ borderColor: 'rgba(27,43,75,0.12)' }}>
          {pos.owed > 0 && <Row bold label={isAr ? 'على المستأجر' : 'Owed by the tenant'} value={money(pos.owed, isAr)} color="#E63946" />}
          {pos.credit > 0 && <Row bold label={isAr ? 'للمستأجر (غير مستهلك)' : 'Due back to the tenant'} value={money(pos.credit, isAr)} color="#2A9D8F" />}
          {pos.owed <= 0 && pos.credit <= 0 && <Row bold label={isAr ? 'لا شيء عليه ولا له' : 'Nothing owed either way'} value={money(0, isAr)} />}
        </div>
      </div>

      {askGaps && (
        <div className="rounded-xl p-3 space-y-1.5"
          style={{ backgroundColor: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.4)' }}>
          <p className="text-xs font-bold" style={{ color: '#8A6D1F' }}>
            {isAr ? 'دفعات لا يُعرف الشهر الذي تغطيه' : 'Payments without a month'}
          </p>
          {pos.unknown.map(p => (
            <Row key={p.id} label={`«${p.due_months}»`} sub={p.payment_date} value={money(p.amount, isAr)} />
          ))}
          <p className="text-[11px] leading-relaxed" style={{ color: '#374151' }}>
            {isAr
              ? `لذلك تظهر ${list(pos.gaps)} غير مسدَّدة (${money(pos.gapsTotal, true)}). هل أنت متأكد أن المستأجر سدّدها كاملة؟ إن أكّدت تُعدّ مسدَّدة على مسؤوليتك، ويسقط مبلغها من المستحق، ويُسجَّل ذلك في أرشيف العقد.`
              : `So ${list(pos.gaps)} show as unpaid (${money(pos.gapsTotal, false)}). Are you sure the tenant paid them in full? If you confirm, they count as paid on your responsibility, the amount drops from what is owed, and this is noted in the contract archive.`}
          </p>
          {confirmed ? (
            <button type="button" onClick={() => onConfirm?.(false)}
              className="text-[11px] font-bold underline" style={{ color: '#8A6D1F', minHeight: 44 }}>
              {isAr ? 'تراجع، واحسبها غير مسدَّدة' : 'Undo and count them as unpaid'}
            </button>
          ) : (
            <Button type="button" onClick={() => onConfirm?.(true)}
              className="w-full text-white" style={{ backgroundColor: '#C9A84C', minHeight: 44 }}>
              {isAr ? 'نعم، سدّدها كاملة، احسبها مدفوعة' : 'Yes, paid in full, count them as paid'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
