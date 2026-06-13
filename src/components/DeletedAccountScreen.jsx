import { useEffect, useState } from 'react';
import { base44, uploadFile } from '@/api/base44Client';

export default function DeletedAccountScreen() {
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          base44.auth.logout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 z-50" dir="rtl">
      <div className="max-w-md w-full mx-4 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-l from-navy-deep to-navy p-6 text-center" style={{ background: 'linear-gradient(to left, #0E1A30, #1B2B4B)' }}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 mb-3">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white font-cairo">المطيري لإدارة الأعمال</h1>
        </div>

        {/* Body */}
        <div className="p-8 text-center space-y-5 font-cairo">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mb-1">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800">عذراً، لا يمكنك الدخول</h2>
            <p className="text-slate-600 leading-relaxed text-sm">
              لا يمكنك الوصول إلى الموقع المسجل.<br />
              تم حذف حسابك بناءً على طلبك.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-500 leading-relaxed border border-slate-100">
            للوصول إلى الموقع مرة أخرى، يرجى تسجيل حساب جديد خلال الأيام القادمة.
          </div>

          {/* Countdown */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white"
              style={{ background: seconds > 10 ? '#1B2B4B' : '#E63946' }}
            >
              {seconds}
            </div>
            <p className="text-xs text-slate-400">سيتم تسجيل الخروج تلقائياً</p>
          </div>
        </div>
      </div>
    </div>
  );
}