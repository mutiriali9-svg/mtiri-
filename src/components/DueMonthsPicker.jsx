import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Sparkles, X } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { useLang } from '@/lib/LanguageContext';
import {
  coveredMonths, currentMonthKey, formatDueMonths, keyYear, monthKey, monthLabel, monthName,
  parseDueMonths, shiftMonth, sortMonths, suggestDueMonths,
} from '@/utils/dueMonths';
import { exitPaymentName, splitWithCarryOver } from '@/utils/contractPeriods';

export default function DueMonthsPicker({
  value, onChange, unitNumber = '', table = 'payments', excludeId = null, suggest = false,
}) {
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const PrevIcon = isAr ? ChevronRight : ChevronLeft;
  const NextIcon = isAr ? ChevronLeft : ChevronRight;

  const [sel, setSel] = useState(() => parseDueMonths(value));
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [history, setHistory] = useState({ key: '', rows: [], failed: false });
  const lastEmitted = useRef(value || '');
  const autoValue = useRef('');
  const inputRef = useRef(null);

  const historyKey = unitNumber ? `${table}::${unitNumber}` : '';
  const ready = history.key === historyKey;

  useEffect(() => {
    const text = value || '';
    if (text === lastEmitted.current) return;
    lastEmitted.current = text;
    setSel(parseDueMonths(text));
  }, [value]);

  useEffect(() => {
    if (!historyKey) { setHistory({ key: '', rows: [], failed: false }); return; }
    let live = true;
    const prop = table === 're_payments' ? 'real_estate' : 'qarya';
    Promise.all([
      supabase.from(table).select('*').eq('unit_number', unitNumber),
      supabase.from('contract_archive').select('id, created_at, reason, tenant_name')
        .eq('property_type', prop)
        .eq('unit_number', String(unitNumber))
        .in('reason', ['vacate', 'tenant_change', 'expiry']),
      supabase.from(prop === 'real_estate' ? 're_units' : 'units_masked').select('tenant_name')
        .eq('unit_number', String(unitNumber)).limit(1),
    ]).then(([{ data, error }, { data: exits }, { data: unitRows }]) => {
      const rows = splitWithCarryOver(exits || [], data || [], p => p.payment_date, p => p.created_at,
        exitPaymentName, unitRows?.[0]?.tenant_name).current;
      if (live) setHistory({ key: historyKey, rows, failed: !!error });
    });
    return () => { live = false; };
  }, [historyKey]);

  const suggestion = useMemo(
    () => (suggest && ready ? suggestDueMonths(history.rows, unitNumber, excludeId) : null),
    [suggest, ready, history, unitNumber, excludeId],
  );
  const covered = useMemo(
    () => (ready ? coveredMonths(history.rows, unitNumber, excludeId) : new Set()),
    [ready, history, unitNumber, excludeId],
  );

  const emit = (next) => {
    const text = formatDueMonths(next, isAr);
    setSel(next);
    lastEmitted.current = text;
    onChange(text);
  };

  useEffect(() => {
    if (!suggest || !ready) return;
    const current = value || '';
    if (current && current !== autoValue.current) return;
    const next = { months: suggestion?.months || [], custom: '' };
    autoValue.current = formatDueMonths(next, isAr);
    if (autoValue.current !== current) emit(next);
  }, [suggestion, ready]);

  const selected = new Set(sel.months);
  const lastSelected = sel.months[sel.months.length - 1];
  const nextKey = lastSelected ? shiftMonth(lastSelected, 1) : currentMonthKey();
  const nowKey = currentMonthKey();
  const isAuto = !!suggestion && (value || '') === autoValue.current;
  const suggestionText = suggestion ? formatDueMonths({ months: suggestion.months }, isAr) : '';
  const showUseSuggestion = !!suggestion && !isAuto
    && sortMonths(sel.months).join() !== suggestion.months.join();

  const toggle = (key) => {
    const months = selected.has(key) ? sel.months.filter(k => k !== key) : sortMonths([...sel.months, key]);
    emit({ ...sel, months });
  };

  const toggleOpen = () => {
    if (!open) setViewYear(lastSelected ? keyYear(lastSelected) : new Date().getFullYear());
    setOpen(o => !o);
  };

  const onTextKeyDown = (e) => {
    if (e.key === 'Backspace' && !e.currentTarget.value && lastSelected) {
      e.preventDefault();
      toggle(lastSelected);
    }
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-input shadow-sm bg-white focus-within:ring-1 focus-within:ring-ring">
        <div className="flex items-start gap-1 ps-2 pe-1 py-1 cursor-text" onClick={() => inputRef.current?.focus()}>
          <div className="flex flex-1 flex-wrap items-center gap-1.5 min-h-7">
            {sel.months.map(key => (
              <span key={key} className="inline-flex items-center gap-1 rounded-full ps-2.5 pe-1 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: 'rgba(27,43,75,0.08)', color: '#1B2B4B' }}>
                {monthLabel(key, isAr)}
                <button type="button" onClick={e => { e.stopPropagation(); toggle(key); }}
                  aria-label={isAr ? `حذف ${monthLabel(key, true)}` : `Remove ${monthLabel(key, false)}`}
                  className="rounded-full p-0.5 hover:bg-black/10 transition-colors">
                  <X size={11} />
                </button>
              </span>
            ))}
            <input ref={inputRef} value={sel.custom}
              onChange={e => emit({ ...sel, custom: e.target.value })}
              onKeyDown={onTextKeyDown}
              aria-label={isAr ? 'الأشهر المستحقة' : 'Due months'}
              placeholder={sel.months.length
                ? (isAr ? 'أضف نصاً، مثل: نصف أغسطس' : 'Add text, e.g. half of August')
                : (isAr ? 'اكتب هنا، أو اختر الأشهر من السهم' : 'Type here, or pick months from the arrow')}
              className="flex-1 min-w-[9rem] h-7 bg-transparent px-1 text-base md:text-sm outline-none placeholder:text-muted-foreground" />
          </div>
          <button type="button" onClick={e => { e.stopPropagation(); toggleOpen(); }}
            aria-expanded={open} aria-label={isAr ? 'قائمة الأشهر' : 'Months list'}
            className="shrink-0 p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
            <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {open && (
          <div className="border-t border-input p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setViewYear(y => y - 1)}
                aria-label={isAr ? 'السنة السابقة' : 'Previous year'}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <PrevIcon size={16} />
              </button>
              <span className="text-sm font-bold" style={{ color: '#1B2B4B' }}>{viewYear}</span>
              <button type="button" onClick={() => setViewYear(y => y + 1)}
                aria-label={isAr ? 'السنة التالية' : 'Next year'}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <NextIcon size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => {
                const key = monthKey(viewYear, i + 1);
                const on = selected.has(key);
                return (
                  <button key={key} type="button" onClick={() => toggle(key)} aria-pressed={on}
                    className="relative rounded-lg border py-2 text-xs font-semibold transition-colors hover:opacity-90"
                    style={on
                      ? { backgroundColor: '#1B2B4B', borderColor: '#1B2B4B', color: '#fff' }
                      : { backgroundColor: '#fff', borderColor: key === nowKey ? '#C9A84C' : 'hsl(var(--border))', color: '#1B2B4B' }}>
                    {monthName(i + 1, isAr)}
                    {covered.has(key) && (
                      <span className="absolute top-1 end-1 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#2A9D8F' }} />
                    )}
                  </button>
                );
              })}
            </div>
            {[...covered].some(key => keyYear(key) === viewYear) && (
              <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#2A9D8F' }} />
                {isAr ? 'مدفوع في دفعة سابقة' : 'Covered by an earlier payment'}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => toggle(nextKey)}
          title={isAr ? 'إضافة الشهر التالي' : 'Add the next month'}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
          style={{ backgroundColor: 'rgba(201,168,76,0.15)', color: '#B8860B' }}>
          <Plus size={12} /> {monthLabel(nextKey, isAr)}
        </button>
        {showUseSuggestion && (
          <button type="button" onClick={() => emit({ ...sel, months: suggestion.months })}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
            style={{ backgroundColor: 'rgba(27,43,75,0.06)', color: '#1B2B4B' }}>
            <Sparkles size={12} /> {isAr ? `استخدام الاقتراح: ${suggestionText}` : `Use suggestion: ${suggestionText}`}
          </button>
        )}
      </div>

      {isAuto && (
        <p className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: '#2A9D8F' }}>
          <Sparkles size={12} className="shrink-0" />
          {isAr
            ? `مقترحة تلقائياً بعد آخر دفعة (${formatDueMonths({ months: suggestion.basis }, true)})`
            : `Suggested after the last payment (${formatDueMonths({ months: suggestion.basis }, false)})`}
        </p>
      )}
    </div>
  );
}
