import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const TARGET_PAYMENT_FIELDS = ['payment_method', 'alert_id', 'alert_snapshot'];
const TARGET_ALERT_FIELDS = ['accumulated_amount'];

export default function SchemaProbe() {
  const [loading, setLoading] = useState(true);
  const [payKeys, setPayKeys] = useState([]);
  const [alertKeys, setAlertKeys] = useState([]);
  const [readError, setReadError] = useState('');
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState(null);
  const [probeError, setProbeError] = useState('');

  const collectKeys = (rows) => {
    const s = new Set();
    (rows || []).forEach(r => Object.keys(r || {}).forEach(k => s.add(k)));
    return [...s].sort();
  };

  useEffect(() => {
    (async () => {
      try {
        const [pays, alrts] = await Promise.all([
          base44.entities.Payment.list(),
          base44.entities.PaymentAlert.list(),
        ]);
        setPayKeys(collectKeys(pays));
        setAlertKeys(collectKeys(alrts));
      } catch (e) {
        setReadError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const runWriteProbe = async () => {
    setProbing(true);
    setProbeError('');
    setProbeResult(null);
    let created = null;
    try {
      const payload = {
        tenant_name: '__PROBE__',
        unit_number: '__PROBE__',
        amount: 0,
        payment_date: new Date().toISOString().split('T')[0],
        status: 'paid',
        notes: 'schema probe — safe to delete',
        payment_method: 'cash',
        alert_id: 'probe-alert-id',
        alert_snapshot: { probe: true, remaining_balance: 123, status: 'overdue' },
      };
      created = await base44.entities.Payment.create(payload);
      const back = created || {};
      setProbeResult({
        id: created?.id || null,
        returnedKeys: Object.keys(back).sort(),
        payment_method: back.payment_method ?? null,
        alert_id: back.alert_id ?? null,
        alert_snapshot: back.alert_snapshot ?? null,
        snapshotType: typeof back.alert_snapshot,
      });
    } catch (e) {
      setProbeError(e?.message || String(e));
    } finally {
      if (created?.id) {
        try {
          await base44.entities.Payment.delete(created.id);
        } catch (delErr) {
          setProbeError(p => (p ? p + ' · ' : '') + 'تعذّر حذف سجل الفحص: ' + (delErr?.message || '') + ' — id: ' + created.id);
        }
      }
      setProbing(false);
    }
  };

  const badge = (ok) => (
    <span style={{
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      backgroundColor: ok ? 'rgba(42,157,143,0.12)' : 'rgba(230,57,70,0.12)',
      color: ok ? '#2A9D8F' : '#E63946',
    }}>{ok ? 'موجود' : 'مفقود'}</span>
  );

  return (
    <div dir="rtl" style={{ padding: 24, maxWidth: 760, margin: '0 auto', fontSize: 14, color: '#1B2B4B' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>فحص مخطط الحقول</h1>
      <p style={{ fontSize: 12, color: '#64748B', marginBottom: 20 }}>صفحة مؤقتة — تُحذف بعد الانتهاء</p>

      {readError && (
        <p style={{ backgroundColor: 'rgba(230,57,70,0.08)', color: '#E63946', padding: '10px 12px', borderRadius: 10, fontSize: 12, marginBottom: 16 }}>
          ⚠️ فشل القراءة: {readError}
        </p>
      )}

      {loading ? <p style={{ color: '#64748B' }}>جاري القراءة...</p> : (
        <>
          <section style={{ marginBottom: 20, border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Payment — الحقول المطلوبة</h2>
            {TARGET_PAYMENT_FIELDS.map(f => (
              <div key={f} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                <code style={{ fontSize: 12 }}>{f}</code>
                {badge(payKeys.includes(f))}
              </div>
            ))}
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 12, color: '#64748B', cursor: 'pointer' }}>كل حقول Payment ({payKeys.length})</summary>
              <p style={{ fontSize: 11, color: '#64748B', marginTop: 8, lineHeight: 1.9 }}>{payKeys.join(' · ') || '— لا سجلات —'}</p>
            </details>
          </section>

          <section style={{ marginBottom: 20, border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>PaymentAlert — الحقول المطلوبة</h2>
            {TARGET_ALERT_FIELDS.map(f => (
              <div key={f} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                <code style={{ fontSize: 12 }}>{f}</code>
                {badge(alertKeys.includes(f))}
              </div>
            ))}
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 12, color: '#64748B', cursor: 'pointer' }}>كل حقول PaymentAlert ({alertKeys.length})</summary>
              <p style={{ fontSize: 11, color: '#64748B', marginTop: 8, lineHeight: 1.9 }}>{alertKeys.join(' · ') || '— لا سجلات —'}</p>
            </details>
          </section>

          <section style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>اختبار الكتابة</h2>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
              ينشئ دفعة تجريبية بالحقول الثلاثة ثم يحذفها فوراً — يكشف أي حقل يرفضه المخطط، ونوع alert_snapshot المقبول.
            </p>
            <button onClick={runWriteProbe} disabled={probing}
              style={{ backgroundColor: '#1B2B4B', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44, opacity: probing ? 0.6 : 1 }}>
              {probing ? 'جاري الفحص...' : 'تشغيل اختبار الكتابة'}
            </button>

            {probeError && (
              <p style={{ backgroundColor: 'rgba(230,57,70,0.08)', color: '#E63946', padding: '10px 12px', borderRadius: 10, fontSize: 12, marginTop: 12, wordBreak: 'break-word' }}>
                ⚠️ {probeError}
              </p>
            )}

            {probeResult && (
              <div style={{ marginTop: 12, backgroundColor: 'rgba(42,157,143,0.06)', border: '1px solid rgba(42,157,143,0.3)', borderRadius: 10, padding: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#2A9D8F', marginBottom: 8 }}>✅ الكتابة نجحت — السجل التجريبي حُذف</p>
                {TARGET_PAYMENT_FIELDS.map(f => (
                  <div key={f} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                    <code>{f}</code>
                    {badge(probeResult.returnedKeys.includes(f))}
                  </div>
                ))}
                <p style={{ fontSize: 12, marginTop: 8, color: '#1B2B4B' }}>
                  نوع alert_snapshot المُعاد: <b>{probeResult.snapshotType}</b>
                </p>
                <pre style={{ fontSize: 10, backgroundColor: '#fff', padding: 10, borderRadius: 8, marginTop: 8, overflowX: 'auto', direction: 'ltr' }}>
{JSON.stringify(probeResult.alert_snapshot, null, 2)}
                </pre>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}