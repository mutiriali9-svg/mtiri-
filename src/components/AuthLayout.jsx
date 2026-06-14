import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" 
      style={{ background: 'linear-gradient(135deg, #0E1A30 0%, #1B2B4B 50%, #0E1A30 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img 
  src="https://hhgedebikuqdxzacqxqn.supabase.co/storage/v1/object/public/mtiri/logo_png..png"
  alt="المطيري"
  className="w-48 h-48 object-contain mx-auto mb-2"
  style={{ mixBlendMode: 'screen' }}
/>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6" style={{ color: 'rgba(255,255,255,0.7)' }}>{footer}</p>
        )}
      </div>
    </div>
  );
}