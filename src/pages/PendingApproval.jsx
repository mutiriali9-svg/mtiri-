import { useEffect, useState } from 'react';
import { supabase } from '@/api/base44Client';

export default function PendingApproval() {
  const [requestId, setRequestId] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data } = await supabase
          .from('registration_requests')
          .select('id, created_at')
          .eq('email', user.email)
          .single();
        if (data) {
          const year = new Date(data.created_at).getFullYear();
          const short = data.id.toString().slice(-4).toUpperCase();
          setRequestId(`MT-${year}-${short}`);
        }
      }
    };
    load();
  }, []);

  return (
    <div dir="rtl" style={{
      minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
      fontFamily: "'Tajawal', sans-serif",
      background: 'radial-gradient(130% 100% at 50% -10%, #1a2c52 0%, #15264a 22%, #102140 45%, #0b1730 72%, #091327 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes mt-spin { to { transform: rotate(360deg); } }
        @keyframes mt-pulse { 0%,100%{transform:scale(1);opacity:.55} 50%{transform:scale(1.18);opacity:.9} }
        @keyframes mt-glow { 0%,100%{opacity:.35;transform:scale(.92)} 50%{opacity:.7;transform:scale(1.08)} }
        @keyframes mt-dot { 0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(201,162,94,.45)} 50%{transform:scale(.82);box-shadow:0 0 0 5px rgba(201,162,94,0)} }
      `}</style>

      {/* Background glows */}
      <div style={{ position:'absolute', top:'-160px', left:'50%', transform:'translateX(-50%)', width:'520px', height:'520px', borderRadius:'50%', background:'radial-gradient(circle, rgba(201,162,94,.16) 0%, rgba(201,162,94,0) 65%)', filter:'blur(10px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-180px', right:'-120px', width:'420px', height:'420px', borderRadius:'50%', background:'radial-gradient(circle, rgba(60,96,160,.22) 0%, rgba(60,96,160,0) 68%)', filter:'blur(20px)', pointerEvents:'none' }} />

      {/* Logo */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', marginBottom:'30px' }}>
        <div style={{ fontSize:'40px', fontWeight:900, letterSpacing:'-1px', lineHeight:1, background:'linear-gradient(170deg,#f3dca6 0%,#dcb976 45%,#c79a52 100%)', WebkitBackgroundClip:'text', backgroundClip:'text', WebkitTextFillColor:'transparent', color:'#dcb976' }}>المطيري</div>
        <div style={{ display:'flex', alignItems:'center', gap:'9px', opacity:.72 }}>
          <span style={{ width:'22px', height:'1px', background:'linear-gradient(90deg,transparent,rgba(201,162,94,.7))' }} />
          <span style={{ fontSize:'11.5px', fontWeight:500, letterSpacing:'4px', color:'#cdb78a' }}>بوابة الخدمات</span>
          <span style={{ width:'22px', height:'1px', background:'linear-gradient(90deg,rgba(201,162,94,.7),transparent)' }} />
        </div>
      </div>

      {/* Card */}
      <div style={{
        position:'relative', width:'min(440px, 92vw)',
        background:'linear-gradient(180deg,#ffffff 0%,#fcfbf9 100%)',
        border:'1px solid rgba(255,255,255,.6)', borderRadius:'26px',
        padding:'44px 38px 34px',
        boxShadow:'0 1px 0 rgba(255,255,255,.6) inset, 0 30px 60px -22px rgba(6,14,30,.6), 0 12px 28px -16px rgba(6,14,30,.45)',
      }}>

        {/* Spinner icon */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:'22px' }}>
          <div style={{ position:'relative', width:'100px', height:'100px', display:'grid', placeItems:'center' }}>
            <div style={{ position:'absolute', inset:'-6px', borderRadius:'50%', background:'radial-gradient(circle,rgba(201,162,94,.28) 0%,rgba(201,162,94,0) 68%)', filter:'blur(0)', animation:'mt-glow 3s ease-in-out infinite' }} />
            <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'4px solid #eef0f4' }} />
            <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'conic-gradient(from -90deg,rgba(201,162,94,0) 0deg,rgba(201,162,94,0) 210deg,rgba(201,162,94,.35) 300deg,#c9a25e 360deg)', WebkitMask:'radial-gradient(closest-side,transparent 91%,#000 92%)', mask:'radial-gradient(closest-side,transparent 91%,#000 92%)', animation:'mt-spin 2.8s linear infinite' }} />
            <div style={{ position:'relative', width:'70px', height:'70px', borderRadius:'50%', background:'linear-gradient(160deg,#faf6ee 0%,#f3ecdd 100%)', display:'grid', placeItems:'center', boxShadow:'inset 0 1px 2px rgba(0,0,0,.04)' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8.4" stroke="#c79a52" strokeWidth="1.6" />
                <path d="M12 7.4V12L15 13.8" stroke="#1a2742" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div style={{ textAlign:'center', marginBottom:'6px' }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:'7px', padding:'5px 13px', borderRadius:'999px', background:'rgba(201,162,94,.1)', border:'1px solid rgba(201,162,94,.22)' }}>
            <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#c9a25e', animation:'mt-dot 1.6s ease-in-out infinite' }} />
            <span style={{ fontSize:'12px', fontWeight:700, color:'#a9803f', letterSpacing:'.2px' }}>قيد المعالجة</span>
          </span>
        </div>

        <h1 style={{ margin:'14px 0 8px', textAlign:'center', fontSize:'23px', fontWeight:800, color:'#16233f', letterSpacing:'-.3px' }}>طلبك قيد المراجعة</h1>
        <p style={{ margin:'0 auto', textAlign:'center', fontSize:'14.5px', fontWeight:400, lineHeight:1.75, color:'#6b7689', maxWidth:'290px' }}>تتم مراجعة طلبك من قبل فريق المختصين، وسيتم إشعارك فور الموافقة عليه.</p>

        {/* Steps */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'center', margin:'30px 0 26px' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'9px', width:'78px' }}>
            <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'linear-gradient(160deg,#d7b377,#c0934d)', display:'grid', placeItems:'center', boxShadow:'0 4px 10px -3px rgba(192,147,77,.55)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.2 4.2L19 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <span style={{ fontSize:'11.5px', fontWeight:700, color:'#2c3852', textAlign:'center', lineHeight:1.3 }}>تم الاستلام</span>
          </div>
          <div style={{ flex:1, height:'2px', marginTop:'14px', maxWidth:'46px', borderRadius:'2px', background:'linear-gradient(90deg,#c0934d,#d9c08a)' }} />
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'9px', width:'78px' }}>
            <div style={{ position:'relative', width:'30px', height:'30px', borderRadius:'50%', background:'#fff', border:'2.5px solid #c9a25e', display:'grid', placeItems:'center', boxShadow:'0 0 0 4px rgba(201,162,94,.12)' }}>
              <span style={{ width:'9px', height:'9px', borderRadius:'50%', background:'#c9a25e', animation:'mt-pulse 1.8s ease-in-out infinite' }} />
            </div>
            <span style={{ fontSize:'11.5px', fontWeight:800, color:'#16233f', textAlign:'center', lineHeight:1.3 }}>قيد المراجعة</span>
          </div>
          <div style={{ flex:1, height:'2px', marginTop:'14px', maxWidth:'46px', borderRadius:'2px', background:'#e7e9ee' }} />
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'9px', width:'78px' }}>
            <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'#f4f5f8', border:'1.5px solid #e2e5ec', display:'grid', placeItems:'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.2 4.2L19 7" stroke="#c2c7d2" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <span style={{ fontSize:'11.5px', fontWeight:600, color:'#9aa3b2', textAlign:'center', lineHeight:1.3 }}>الموافقة</span>
          </div>
        </div>

        {/* Info box */}
        <div style={{ borderRadius:'16px', background:'#f7f8fa', border:'1px solid #eef0f4', padding:'4px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0', borderBottom:'1px solid #eceef2' }}>
            <span style={{ fontSize:'12.5px', fontWeight:500, color:'#8a93a3' }}>رقم الطلب</span>
            <span style={{ fontSize:'13px', fontWeight:700, color:'#1f2c47', letterSpacing:'.5px', direction:'ltr' }}>{requestId || 'MT-2026-****'}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0' }}>
            <span style={{ fontSize:'12.5px', fontWeight:500, color:'#8a93a3' }}>المدة المتوقعة</span>
            <span style={{ fontSize:'13px', fontWeight:700, color:'#1f2c47' }}>٢٤ – ٤٨ ساعة</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop:'22px', display:'flex', alignItems:'center', gap:'7px' }}>
        <span style={{ fontSize:'12.5px', color:'rgba(214,222,236,.55)' }}>هل لديك استفسار؟</span>
        <a href="mailto:support@mtiri.com" style={{ fontSize:'12.5px', fontWeight:700, color:'#d6b676', textDecoration:'none', borderBottom:'1px solid rgba(214,182,118,.35)', paddingBottom:'1px' }}>تواصل مع الدعم</a>
      </div>
    </div>
  );
}